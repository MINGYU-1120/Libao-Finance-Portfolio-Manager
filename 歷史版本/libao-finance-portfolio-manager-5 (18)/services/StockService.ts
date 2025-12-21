
import { NewsItem } from '../types';

/**
 * 最佳化的 CORS 代理清單
 * 優先順序調整：corsproxy.io (快) > codetabs (穩定) > allorigins (備援)
 */
const PROXY_CONFIGS = [
  { url: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`, wrapper: 'none' },
  { url: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, wrapper: 'none' },
  { url: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, wrapper: 'allorigins' }
];

interface CacheEntry {
  price: number;
  timestamp: number;
}

class StockService {
  private priceCache: Record<string, CacheEntry> = {};
  private PRICE_TTL = 30 * 1000; // 縮短快取時間至 30 秒以確保報價更新

  /**
   * 強化版代理抓取：縮短超時並優化切換邏輯
   */
  private async fetchWithProxy(targetUrl: string, isJson: boolean = true): Promise<any | null> {
    for (const config of PROXY_CONFIGS) {
      try {
        const pUrl = config.url(targetUrl);
        const controller = new AbortController();
        // 縮短為 3.5 秒，失敗立即切換下一個代理
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(pUrl, { 
          signal: controller.signal,
          headers: { 'Accept': isJson ? 'application/json' : 'text/html,application/xhtml+xml,application/xml' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        if (config.wrapper === 'allorigins') {
          const json = await response.json();
          const content = json.contents;
          if (!content) continue;
          if (isJson) {
            try { return JSON.parse(content); } catch { continue; }
          }
          return content;
        } else {
          return isJson ? await response.json() : await response.text();
        }
      } catch (e) {
        // 發生錯誤或超時，自動跳到下一組 Proxy
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
      // 美股改以 Yahoo API 為首選 (較穩定且為 JSON)
      price = await this.fetchPriceFromYahooUS(symbol);
      // 若 Yahoo 失敗再嘗試 Google 爬蟲
      if (price === null) {
        price = await this.fetchPriceFromGoogleUS(symbol);
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

    const promises = uniqueAssets.map(async (asset: any) => {
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
    // 優先嘗試上市 (.TW)
    let url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?interval=1d&range=1d`;
    let data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
    }

    // 再嘗試上櫃 (.TWO)
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TWO?interval=1d&range=1d`;
    data = await this.fetchWithProxy(url);

    if (data?.chart?.result?.[0]?.meta) {
      const meta = data.chart.result[0].meta;
      return meta.regularMarketPrice || meta.previousClose;
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

  private async fetchPriceFromGoogleUS(symbol: string): Promise<number | null> {
    // 嘗試不同的 Google Finance 格式
    const queries = [symbol, `NASDAQ:${symbol}`, `NYSE:${symbol}`];
    for (const q of queries) {
      const url = `https://www.google.com/finance/quote/${q}`;
      const html = await this.fetchWithProxy(url, false);

      if (typeof html === 'string') {
        // 更新 regex 確保能抓到多種可能的報價標籤
        const patterns = [
          /<div class="YMlKec fxKbKc">\$?([0-9,]+\.[0-9]+)<\/div>/,
          /data-last-price="([0-9,]+\.[0-9]+)"/
        ];
        
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            return parseFloat(match[1].replace(/,/g, ''));
          }
        }
      }
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
   * 獲取持股新聞
   */
  public async getStockNews(symbol: string, market: 'TW' | 'US', name?: string): Promise<NewsItem[]> {
    const region = market === 'TW' ? 'TW' : 'US';
    const lang = market === 'TW' ? 'zh-TW' : 'en-US';
    const ceid = market === 'TW' ? 'TW:zh-Hant' : 'US:en';
    
    const query = (market === 'TW' && name) ? name : `${symbol} stock`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${region}&ceid=${ceid}`;
    
    try {
      const xmlText = await this.fetchWithProxy(rssUrl, false);
      if (!xmlText || typeof xmlText !== 'string' || xmlText.length < 150) return [];

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      
      if (xmlDoc.getElementsByTagName("parsererror").length > 0) return [];

      const items = xmlDoc.querySelectorAll("item");
      const news: NewsItem[] = [];

      items.forEach((item, index) => {
        if (index >= 5) return; 
        const title = item.querySelector("title")?.textContent || "";
        const link = item.querySelector("link")?.textContent || "";
        const pubDate = item.querySelector("pubDate")?.textContent || "";
        const source = item.querySelector("source")?.textContent || "Google News";
        
        if (title && link) {
          news.push({ title, link, pubDate, source, symbol, market });
        }
      });
      return news;
    } catch (e) {
      return [];
    }
  }
}

export const stockService = new StockService();
