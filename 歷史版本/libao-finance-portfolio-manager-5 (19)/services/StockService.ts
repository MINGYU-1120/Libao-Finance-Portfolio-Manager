
import { NewsItem } from '../types';

/**
 * 針對新聞 RSS 優化的代理清單
 * 優先使用 raw 模式直接獲取 XML 字串
 */
const NEWS_PROXY_CONFIGS = [
  { url: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, type: 'text' },
  { url: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`, type: 'text' },
  { url: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, type: 'text' }
];

const STOCK_PROXY_CONFIGS = [
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
  private PRICE_TTL = 30 * 1000;

  /**
   * 一般報價抓取
   */
  private async fetchWithProxy(targetUrl: string, isJson: boolean = true): Promise<any | null> {
    for (const config of STOCK_PROXY_CONFIGS) {
      try {
        const pUrl = config.url(targetUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(pUrl, { 
          signal: controller.signal,
          headers: { 'Accept': isJson ? 'application/json' : 'text/html' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        if (config.wrapper === 'allorigins') {
          const json = await response.json();
          const content = json.contents;
          if (!content) continue;
          return isJson ? JSON.parse(content) : content;
        } else {
          return isJson ? await response.json() : await response.text();
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

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
      price = await this.fetchPriceFromYahooUS(symbol);
      if (price === null) price = await this.fetchPriceFromGoogleUS(symbol);
    }

    if (price !== null) {
      this.priceCache[cacheKey] = { price, timestamp: now };
    }
    return price;
  }

  public async getPrices(assets: { symbol: string, market: 'TW' | 'US' }[]): Promise<Record<string, number>> {
    const priceMap: Record<string, number> = {};
    const uniqueAssets = Array.from(new Set(assets.map(a => JSON.stringify(a)))).map(s => JSON.parse(s));
    await Promise.all(uniqueAssets.map(async (asset: any) => {
      const price = await this.getPrice(asset.symbol, asset.market);
      if (price !== null) priceMap[asset.symbol] = price;
    }));
    return priceMap;
  }

  private async fetchPriceFromYahooTW(symbol: string): Promise<number | null> {
    const suffixes = ['.TW', '.TWO'];
    for (const s of suffixes) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${s}?interval=1d&range=1d`;
      const data = await this.fetchWithProxy(url);
      if (data?.chart?.result?.[0]?.meta) return data.chart.result[0].meta.regularMarketPrice || data.chart.result[0].meta.previousClose;
    }
    return null;
  }

  private async fetchPriceFromYahooUS(symbol: string): Promise<number | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const data = await this.fetchWithProxy(url);
    if (data?.chart?.result?.[0]?.meta) return data.chart.result[0].meta.regularMarketPrice || data.chart.result[0].meta.previousClose;
    return null;
  }

  private async fetchPriceFromGoogleUS(symbol: string): Promise<number | null> {
    const queries = [symbol, `NASDAQ:${symbol}`, `NYSE:${symbol}`];
    for (const q of queries) {
      const url = `https://www.google.com/finance/quote/${q}`;
      const html = await this.fetchWithProxy(url, false);
      if (typeof html === 'string') {
        const match = html.match(/<div class="YMlKec fxKbKc">\$?([0-9,]+\.[0-9]+)<\/div>/);
        if (match && match[1]) return parseFloat(match[1].replace(/,/g, ''));
      }
    }
    return null;
  }
  
  public async searchStocks(query: string, market: 'TW' | 'US'): Promise<{symbol: string, name: string, market: 'TW'|'US'}[]> {
    const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=zh-Hant-TW&region=TW`;
    const data = await this.fetchWithProxy(targetUrl);
    if (data?.quotes) {
      return data.quotes
        .filter((q: any) => (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') && (market === 'TW' ? (q.symbol.endsWith('.TW') || q.symbol.endsWith('.TWO')) : (!q.symbol.endsWith('.TW') && !q.symbol.endsWith('.TWO'))))
        .map((q: any) => ({ symbol: q.symbol.split('.')[0], name: q.shortname || q.longname || q.symbol, market: market }));
    }
    return [];
  }

  /**
   * 獲取持股新聞：深度修復版
   */
  public async getStockNews(symbol: string, market: 'TW' | 'US', name?: string): Promise<NewsItem[]> {
    const region = market === 'TW' ? 'TW' : 'US';
    const lang = market === 'TW' ? 'zh-TW' : 'en-US';
    const ceid = market === 'TW' ? 'TW:zh-Hant' : 'US:en';
    
    // 改良搜尋關鍵字，組合 代號 + 名稱 + 股票
    const query = market === 'TW' 
      ? `${symbol} ${name || ''} 股票`.trim()
      : `${symbol} stock market news`.trim();

    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${region}&ceid=${ceid}`;
    
    // 遍歷專用新聞代理
    for (const config of NEWS_PROXY_CONFIGS) {
      try {
        const pUrl = config.url(rssUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 新聞 XML 較大，給 5 秒

        const response = await fetch(pUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) continue;
        const xmlText = await response.text();

        // 檢查內容是否為有效的 XML (Google News RSS 至少會有 <rss 或 <channel 標籤)
        if (!xmlText || xmlText.length < 500 || !xmlText.includes('<rss')) continue;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        // 檢查解析錯誤
        if (xmlDoc.getElementsByTagName("parsererror").length > 0) continue;

        const items = xmlDoc.querySelectorAll("item");
        if (items.length === 0) continue;

        const news: NewsItem[] = [];
        items.forEach((item, index) => {
          if (index >= 6) return; 
          const title = item.querySelector("title")?.textContent || "";
          const link = item.querySelector("link")?.textContent || "";
          const pubDate = item.querySelector("pubDate")?.textContent || "";
          const source = item.querySelector("source")?.textContent || "Google News";
          
          if (title && link) {
            // 清理標題中的來源後綴 (例如: "台積電創新高 - 經濟日報" -> "台積電創新高")
            const cleanTitle = title.split(' - ')[0];
            news.push({ title: cleanTitle, link, pubDate, source, symbol, market });
          }
        });

        if (news.length > 0) return news;
      } catch (e) {
        console.warn(`News Proxy ${config.url('')} failed:`, e);
        continue;
      }
    }
    return [];
  }
}

export const stockService = new StockService();
