
// CORS Proxies
const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

interface CacheEntry {
  price: number;
  timestamp: number;
}

class StockService {
  private priceCache: Record<string, CacheEntry> = {};
  private PRICE_TTL = 60 * 1000; // 60 seconds

  /**
   * Helper to fetch data using multiple proxies to avoid downtime
   */
  private async fetchWithProxy(targetUrl: string, isJson: boolean = true): Promise<any | null> {
    for (const proxyGen of PROXIES) {
      try {
        const proxyUrl = proxyGen(targetUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        return isJson ? await response.json() : await response.text();
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  /**
   * Main entry point to get stock price
   */
  public async getPrice(symbol: string, market: 'TW' | 'US'): Promise<number | null> {
    const cacheKey = `${symbol}-${market}`;
    const now = Date.now();

    // 1. Check Cache
    if (this.priceCache[cacheKey] && (now - this.priceCache[cacheKey].timestamp < this.PRICE_TTL)) {
      return this.priceCache[cacheKey].price;
    }

    let price: number | null = null;

    // 2. Fetch based on Market Strategy
    if (market === 'TW') {
      price = await this.fetchPriceFromYahooTW(symbol);
    } else {
      // US: Try Google Finance first, Fallback to Yahoo if fails
      price = await this.fetchPriceFromGoogleUS(symbol);
      if (price === null) {
        // Fallback silently to Yahoo to ensure UX consistency
        console.warn(`Google Finance failed for ${symbol}, falling back to Yahoo.`);
        price = await this.fetchPriceFromYahooUS(symbol);
      }
    }

    // 3. Update Cache
    if (price !== null) {
      this.priceCache[cacheKey] = { price, timestamp: now };
    } else if (this.priceCache[cacheKey]) {
      // Return stale cache if fetch completely failed
      return this.priceCache[cacheKey].price;
    }

    return price;
  }

  /**
   * Batch fetch prices
   */
  public async getPrices(assets: { symbol: string, market: 'TW' | 'US' }[]): Promise<Record<string, number>> {
    const priceMap: Record<string, number> = {};
    const uniqueAssets = Array.from(new Set(assets.map(a => JSON.stringify(a)))).map(s => JSON.parse(s));

    const promises = uniqueAssets.map(async (asset) => {
      const price = await this.getPrice(asset.symbol, asset.market);
      if (price !== null) {
        priceMap[asset.symbol] = price;
        priceMap[asset.symbol.toUpperCase()] = price;
      }
    });

    await Promise.all(promises);
    return priceMap;
  }

  // --- Yahoo Finance Strategy (TW) ---
  private async fetchPriceFromYahooTW(symbol: string): Promise<number | null> {
    // Try .TW (Listed)
    let url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?interval=1d&range=1d`;
    let data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }

    // Try .TWO (OTC)
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TWO?interval=1d&range=1d`;
    data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }

    return null;
  }

  // --- Yahoo Finance Strategy (US Fallback) ---
  private async fetchPriceFromYahooUS(symbol: string): Promise<number | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }
    return null;
  }

  // --- Google Finance Strategy (US Primary) ---
  private async fetchPriceFromGoogleUS(symbol: string): Promise<number | null> {
    // Google Finance URL structure: https://www.google.com/finance/quote/AAPL:NASDAQ
    // Since we don't know the exchange, we try common ones or just the symbol if Google redirects.
    // Try NASDAQ first, then NYSE.
    
    const exchanges = ['NASDAQ', 'NYSE'];
    
    for (const exchange of exchanges) {
        const url = `https://www.google.com/finance/quote/${symbol}:${exchange}`;
        const html = await this.fetchWithProxy(url, false); // Fetch as text
        
        if (typeof html === 'string') {
            // Regex to find price class. Note: Google changes classes occasionally.
            // Current common class for big price: "YMlKec fxKbKc"
            const regex = /<div class="YMlKec fxKbKc">\$?([0-9,]+\.[0-9]+)<\/div>/;
            const match = html.match(regex);
            
            if (match && match[1]) {
                return parseFloat(match[1].replace(/,/g, ''));
            }
        }
    }
    return null;
  }

  // --- Search & Dividends (Keep using Yahoo as it's the best free JSON source) ---
  
  public async searchStocks(query: string, market: 'TW' | 'US'): Promise<{symbol: string, name: string, market: 'TW'|'US'}[]> {
    const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=zh-Hant-TW&region=TW&quotesCount=10&newsCount=0`;
    const data = await this.fetchWithProxy(targetUrl);

    if (data && data.quotes && Array.isArray(data.quotes)) {
      return data.quotes
        .filter((q: any) => {
          const isEquity = q.quoteType === 'EQUITY' || q.quoteType === 'ETF';
          if (!isEquity) return false;
          if (market === 'TW') return q.symbol.endsWith('.TW') || q.symbol.endsWith('.TWO');
          return !q.symbol.endsWith('.TW') && !q.symbol.endsWith('.TWO');
        })
        .map((q: any) => {
          let cleanSymbol = q.symbol;
          let m: 'TW' | 'US' = 'US';
          if (q.symbol.endsWith('.TW') || q.symbol.endsWith('.TWO')) {
            m = 'TW';
            cleanSymbol = q.symbol.replace('.TW', '').replace('.TWO', '');
          }
          return {
            symbol: cleanSymbol,
            name: q.shortname || q.longname || cleanSymbol,
            market: m
          };
        });
    }
    return [];
  }

  public async getDividends(symbol: string, market: 'TW' | 'US'): Promise<{date: string, amount: number}[]> {
    const getUrl = (s: string) => `https://query1.finance.yahoo.com/v8/finance/chart/${s}?region=US&lang=en-US&includePrePost=false&interval=1d&range=2y&events=div`;
    
    let url = market === 'TW' ? getUrl(`${symbol}.TW`) : getUrl(symbol);
    let data = await this.fetchWithProxy(url);

    if (market === 'TW' && (!data?.chart?.result?.[0]?.events?.dividends)) {
       data = await this.fetchWithProxy(getUrl(`${symbol}.TWO`));
    }

    if (data?.chart?.result?.[0]?.events?.dividends) {
       const divs = data.chart.result[0].events.dividends;
       const events: {date: string, amount: number}[] = [];
       Object.values(divs).forEach((d: any) => {
          if (d.date && d.amount) {
             const date = new Date(d.date * 1000).toISOString();
             events.push({ date, amount: d.amount });
          }
       });
       return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  }
}

export const stockService = new StockService();
