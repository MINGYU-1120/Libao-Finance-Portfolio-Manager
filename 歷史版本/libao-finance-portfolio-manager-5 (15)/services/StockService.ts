
import { NewsItem } from '../types';

// 更穩定的 CORS 代理伺服器清單，增加備援節點
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
];

interface CacheEntry {
  price: number;
  timestamp: number;
}

class StockService {
  private priceCache: Record<string, CacheEntry> = {};
  private PRICE_TTL = 60 * 1000; // 60 seconds cache

  /**
   * 強化版的代理抓取工具：支援多節點自動切換
   */
  private async fetchWithProxy(targetUrl: string, isJson: boolean = true): Promise<any | null> {
    for (const proxyGen of PROXIES) {
      try {
        const proxyUrl = proxyGen(targetUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 延長至 6s 確保回應

        const response = await fetch(proxyUrl, { 
          signal: controller.signal,
          headers: { 'Accept': isJson ? 'application/json' : 'text/xml, application/xml, text/plain' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const result = isJson ? await response.json() : await response.text();
        if (result) return result;
      } catch (e) {
        console.warn(`Proxy Attempt Failed: ${proxyGen(targetUrl).substring(0, 40)}...`);
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

    if (this.priceCache[cacheKey] && (now - this.priceCache[cacheKey].timestamp < this.PRICE_TTL)) {
      return this.priceCache[cacheKey].price;
    }

    let price: number | null = null;

    if (market === 'TW') {
      price = await this.fetchPriceFromYahooTW(symbol);
    } else {
      price = await this.fetchPriceFromGoogleUS(symbol);
      if (price === null) {
        price = await this.fetchPriceFromYahooUS(symbol);
      }
    }

    if (price !== null) {
      this.priceCache[cacheKey] = { price, timestamp: now };
    } else if (this.priceCache[cacheKey]) {
      return this.priceCache[cacheKey].price;
    }

    return price;
  }

  /**
   * Batch Fetch
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

  private async fetchPriceFromYahooTW(symbol: string): Promise<number | null> {
    let url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?interval=1d&range=1d`;
    let data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }

    url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TWO?interval=1d&range=1d`;
    data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }

    return null;
  }

  private async fetchPriceFromGoogleUS(symbol: string): Promise<number | null> {
    const queries = [symbol, `${symbol}:NASDAQ`, `${symbol}:NYSE`];
    for (const q of queries) {
      const url = `https://www.google.com/finance/quote/${q}`;
      const html = await this.fetchWithProxy(url, false);

      if (typeof html === 'string') {
        const regex = /<div class="YMlKec fxKbKc">\$?([0-9,]+\.[0-9]+)<\/div>/;
        const match = html.match(regex);
        if (match && match[1]) {
          return parseFloat(match[1].replace(/,/g, ''));
        }
      }
    }
    return null;
  }

  private async fetchPriceFromYahooUS(symbol: string): Promise<number | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const data = await this.fetchWithProxy(url);
    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }
    return null;
  }
  
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
          return { symbol: cleanSymbol, name: q.shortname || q.longname || cleanSymbol, market: m };
        });
    }
    return [];
  }

  /**
   * 修復版：獲取持股新聞
   */
  public async getStockNews(symbol: string, market: 'TW' | 'US'): Promise<NewsItem[]> {
    const region = market === 'TW' ? 'TW' : 'US';
    const lang = market === 'TW' ? 'zh-TW' : 'en-US';
    const ceid = market === 'TW' ? 'TW:zh-Hant' : 'US:en';
    
    // 優化關鍵字：台股不再強加「股」字，直接搜尋代號效果較好
    const query = market === 'TW' ? symbol : `${symbol} stock`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${region}&ceid=${ceid}`;
    
    try {
      const xmlText = await this.fetchWithProxy(rssUrl, false);
      if (!xmlText || typeof xmlText !== 'string') return [];

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      
      // 檢查是否解析成功
      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        console.error("XML Parsing Error for", symbol);
        return [];
      }

      const items = xmlDoc.querySelectorAll("item");
      const news: NewsItem[] = [];

      items.forEach((item, index) => {
        if (index >= 4) return; // 稍微增加到 4 則
        const title = item.querySelector("title")?.textContent || "";
        const link = item.querySelector("link")?.textContent || "";
        let pubDate = item.querySelector("pubDate")?.textContent || "";
        const source = item.querySelector("source")?.textContent || "Google News";
        
        if (title && link) {
          news.push({ title, link, pubDate, source, symbol, market });
        }
      });
      return news;
    } catch (e) {
      console.warn(`Failed to fetch news for ${symbol}`, e);
      return [];
    }
  }
}

export const stockService = new StockService();
