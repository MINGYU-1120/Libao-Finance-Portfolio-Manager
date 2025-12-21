
import { NewsItem, MarketType } from '../types';

/**
 * 核心代理配置：針對 RSS XML 優化
 */
const NEWS_PROXIES = [
  { url: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, mode: 'json' },
  { url: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`, mode: 'raw' },
  { url: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, mode: 'raw' }
];

const STOCK_PROXIES = [
  { url: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`, wrapper: 'none' },
  { url: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, wrapper: 'allorigins' }
];

class StockService {
  private priceCache: Record<string, { price: number; timestamp: number }> = {};
  private PRICE_TTL = 30 * 1000;

  private async fetchWithProxy(targetUrl: string, isJson: boolean = true): Promise<any | null> {
    for (const config of STOCK_PROXIES) {
      try {
        const pUrl = config.url(targetUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const response = await fetch(pUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) continue;
        if (config.wrapper === 'allorigins') {
          const json = await response.json();
          return isJson ? JSON.parse(json.contents) : json.contents;
        }
        return isJson ? await response.json() : await response.text();
      } catch (e) { continue; }
    }
    return null;
  }

  public async getPrice(symbol: string, market: MarketType): Promise<number | null> {
    const cacheKey = `${symbol}-${market}`;
    const now = Date.now();
    if (this.priceCache[cacheKey] && (now - this.priceCache[cacheKey].timestamp < this.PRICE_TTL)) {
      return this.priceCache[cacheKey].price;
    }
    let price: number | null = null;
    if (market === 'TW') {
      const suffixes = ['.TW', '.TWO'];
      for (const s of suffixes) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${s}?interval=1d&range=1d`;
        const data = await this.fetchWithProxy(url);
        if (data?.chart?.result?.[0]?.meta) {
          price = data.chart.result[0].meta.regularMarketPrice || data.chart.result[0].meta.previousClose;
          break;
        }
      }
    } else {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const data = await this.fetchWithProxy(url);
      if (data?.chart?.result?.[0]?.meta) {
        price = data.chart.result[0].meta.regularMarketPrice || data.chart.result[0].meta.previousClose;
      }
    }
    if (price !== null) this.priceCache[cacheKey] = { price, timestamp: now };
    return price;
  }

  public async getPrices(assets: { symbol: string, market: MarketType }[]): Promise<Record<string, number>> {
    const priceMap: Record<string, number> = {};
    const unique = Array.from(new Set(assets.map(a => `${a.symbol}|${a.market}`)));
    await Promise.all(unique.map(async (key) => {
      const [symbol, market] = key.split('|');
      const price = await this.getPrice(symbol, market as MarketType);
      if (price !== null) priceMap[symbol] = price;
    }));
    return priceMap;
  }

  public async searchStocks(query: string, market: MarketType): Promise<{symbol: string, name: string, market: MarketType}[]> {
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
   * 抓取新聞的核心邏輯 (智能解析)
   */
  public async getStockNews(symbol: string, market: MarketType, name?: string): Promise<NewsItem[]> {
    // 優先策略：台股使用 Yahoo RSS (較穩定)，美股使用 Google News
    const urls = market === 'TW' 
      ? [
          `https://tw.stock.yahoo.com/rss/s/${symbol}`, // Yahoo 台灣個股 RSS
          `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + " " + (name || "") + " 股票")}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
        ]
      : [
          `https://finance.yahoo.com/rss/headline?s=${symbol}`, // Yahoo US RSS
          `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + " stock news")}&hl=en-US&gl=US&ceid=US:en`
        ];

    for (const targetUrl of urls) {
      for (const proxy of NEWS_PROXIES) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const response = await fetch(proxy.url(targetUrl), { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!response.ok) continue;

          let xmlText = '';
          if (proxy.mode === 'json') {
            const json = await response.json();
            xmlText = json.contents || '';
          } else {
            xmlText = await response.text();
          }

          if (!xmlText || xmlText.length < 300) continue;

          // 清理 XML (移除可能的 JSON 包裝殘留)
          const xmlStart = xmlText.indexOf('<?xml');
          const rssStart = xmlText.indexOf('<rss');
          const startIdx = xmlStart !== -1 ? xmlStart : rssStart;
          if (startIdx === -1) continue;
          xmlText = xmlText.substring(startIdx);

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          if (xmlDoc.getElementsByTagName("parsererror").length > 0) continue;

          const items = xmlDoc.querySelectorAll("item");
          if (items.length === 0) continue;

          const news: NewsItem[] = [];
          items.forEach((item, index) => {
            if (index >= 4) return;
            const title = item.querySelector("title")?.textContent || "";
            const link = item.querySelector("link")?.textContent || "";
            const pubDate = item.querySelector("pubDate")?.textContent || "";
            const source = item.querySelector("source")?.textContent || (market === 'TW' ? "Yahoo 財經" : "Yahoo Finance");
            
            if (title && link) {
              news.push({ title: title.split(' - ')[0], link, pubDate, source, symbol, market });
            }
          });

          if (news.length > 0) return news;
        } catch (e) { continue; }
      }
    }
    return [];
  }
}

export const stockService = new StockService();
