
// CORS Proxies rotation to avoid rate limits
// We use these to bypass browser CORS restrictions when fetching from Google/Yahoo directly
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
  private PRICE_TTL = 60 * 1000; // 60 seconds cache

  /**
   * Helper to fetch data using multiple proxies to ensure high availability
   */
  private async fetchWithProxy(targetUrl: string, isJson: boolean = true): Promise<any | null> {
    for (const proxyGen of PROXIES) {
      try {
        const proxyUrl = proxyGen(targetUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        return isJson ? await response.json() : await response.text();
      } catch (e) {
        console.warn(`Proxy failed: ${proxyGen(targetUrl).substring(0, 30)}...`, e);
        continue;
      }
    }
    return null;
  }

  /**
   * Main Public API: Get Price
   */
  public async getPrice(symbol: string, market: 'TW' | 'US'): Promise<number | null> {
    const cacheKey = `${symbol}-${market}`;
    const now = Date.now();

    // 1. Check Memory Cache
    if (this.priceCache[cacheKey] && (now - this.priceCache[cacheKey].timestamp < this.PRICE_TTL)) {
      return this.priceCache[cacheKey].price;
    }

    let price: number | null = null;

    // 2. Fetch based on Market Strategy
    if (market === 'TW') {
      price = await this.fetchPriceFromYahooTW(symbol);
    } else {
      // US Strategy: Try Google First -> Fallback to Yahoo
      price = await this.fetchPriceFromGoogleUS(symbol);
      if (price === null) {
        console.warn(`[StockService] Google Finance failed for ${symbol}, falling back to Yahoo.`);
        price = await this.fetchPriceFromYahooUS(symbol);
      }
    }

    // 3. Update Cache & Return
    if (price !== null) {
      this.priceCache[cacheKey] = { price, timestamp: now };
    } else if (this.priceCache[cacheKey]) {
      // If fetch failed completely, return stale cache if available as last resort
      console.warn(`[StockService] Fetch failed for ${symbol}, serving stale cache.`);
      return this.priceCache[cacheKey].price;
    }

    return price;
  }

  /**
   * Batch Fetch (Optimization)
   */
  public async getPrices(assets: { symbol: string, market: 'TW' | 'US' }[]): Promise<Record<string, number>> {
    const priceMap: Record<string, number> = {};
    // Deduplicate
    const uniqueAssets = Array.from(new Set(assets.map(a => JSON.stringify(a)))).map(s => JSON.parse(s));

    // Parallel Fetching
    const promises = uniqueAssets.map(async (asset) => {
      const price = await this.getPrice(asset.symbol, asset.market);
      if (price !== null) {
        priceMap[asset.symbol] = price;
        // Also map uppercase for safety
        priceMap[asset.symbol.toUpperCase()] = price;
      }
    });

    await Promise.all(promises);
    return priceMap;
  }

  // ==========================================
  // Strategy Implementations
  // ==========================================

  // --- TW: Yahoo Finance API (Best for TWSE/TPEX logic) ---
  private async fetchPriceFromYahooTW(symbol: string): Promise<number | null> {
    // 1. Try Listed (.TW)
    let url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?interval=1d&range=1d`;
    let data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }

    // 2. Try OTC (.TWO)
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TWO?interval=1d&range=1d`;
    data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }

    return null;
  }

  // --- US Primary: Google Finance Scraping ---
  private async fetchPriceFromGoogleUS(symbol: string): Promise<number | null> {
    // Try generic symbol first, then common exchanges
    // Google URL format: https://www.google.com/finance/quote/AAPL:NASDAQ
    const queries = [symbol, `${symbol}:NASDAQ`, `${symbol}:NYSE`];

    for (const q of queries) {
      const url = `https://www.google.com/finance/quote/${q}`;
      const html = await this.fetchWithProxy(url, false); // Fetch as Text

      if (typeof html === 'string') {
        // Parse HTML for price class.
        // Class "YMlKec fxKbKc" is currently used by Google for the main price.
        // We use a regex to extract it.
        const regex = /<div class="YMlKec fxKbKc">\$?([0-9,]+\.[0-9]+)<\/div>/;
        const match = html.match(regex);

        if (match && match[1]) {
          const priceStr = match[1].replace(/,/g, ''); // Remove commas
          return parseFloat(priceStr);
        }
      }
    }
    return null;
  }

  // --- US Fallback: Yahoo Finance API ---
  private async fetchPriceFromYahooUS(symbol: string): Promise<number | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }
    return null;
  }

  // --- Search & Dividend: Yahoo is still the best free source for this ---
  
  public async searchStocks(query: string, market: 'TW' | 'US'): Promise<{symbol: string, name: string, market: 'TW'|'US'}[]> {
    // Yahoo Search API
    const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=zh-Hant-TW&region=TW&quotesCount=10&newsCount=0`;
    const data = await this.fetchWithProxy(targetUrl);

    if (data && data.quotes && Array.isArray(data.quotes)) {
      return data.quotes
        .filter((q: any) => {
          const isEquity = q.quoteType === 'EQUITY' || q.quoteType === 'ETF';
          if (!isEquity) return false;
          // Market Filtering
          if (market === 'TW') return q.symbol.endsWith('.TW') || q.symbol.endsWith('.TWO');
          return !q.symbol.endsWith('.TW') && !q.symbol.endsWith('.TWO');
        })
        .map((q: any) => {
          // Clean symbol
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
    
    // Auto-detect suffix for TW
    let url = market === 'TW' ? getUrl(`${symbol}.TW`) : getUrl(symbol);
    let data = await this.fetchWithProxy(url);

    // If TW listed failed, try OTC
    if (market === 'TW' && (!data?.chart?.result?.[0]?.events?.dividends)) {
       data = await this.fetchWithProxy(getUrl(`${symbol}.TWO`));
    }

    if (data?.chart?.result?.[0]?.events?.dividends) {
       const divs = data.chart.result[0].events.dividends;
       const events: {date: string, amount: number}[] = [];
       
       Object.values(divs).forEach((d: any) => {
          if (d.date && d.amount) {
             // Convert UNIX timestamp to ISO Date
             const date = new Date(d.date * 1000).toISOString();
             events.push({ date, amount: d.amount });
          }
       });
       // Sort Newest First
       return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  }
}

// Export Singleton Instance
export const stockService = new StockService();
