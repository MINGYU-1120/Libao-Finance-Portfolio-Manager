
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
  // CodeTabs usually works well for simple GETs
  { url: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, wrapper: 'none' },
  // ThingProxy is another option
  { url: (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`, wrapper: 'none' },
  // AllOrigins wrap in JSON
  { url: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, wrapper: 'allorigins' },
  // CorsProxy.io (often 401/404 recently, move to last)
  { url: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`, wrapper: 'none' }
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

  public async searchStocks(query: string, market: MarketType): Promise<{ symbol: string, name: string, market: MarketType }[]> {
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

  /**
   * Fetch historical dividends
   */
  public async getStockDividends(symbol: string, market: MarketType, startDate: string): Promise<{ date: string; rate: number }[]> {
    const start = Math.floor(new Date(startDate).getTime() / 1000);
    const end = Math.floor(Date.now() / 1000);

    // Yahoo Finance Chart API with events=div
    // Example: https://query1.finance.yahoo.com/v8/finance/chart/AAPL?symbol=AAPL&period1=...&period2=...&interval=1d&events=div

    const querySymbol = market === 'TW'
      ? (symbol.includes('.') ? symbol : `${symbol}.TW`)
      : symbol;

    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?symbol=${querySymbol}&period1=${start}&period2=${end}&interval=1d&events=div`;

    const data = await this.fetchWithProxy(targetUrl, true);

    if (!data?.chart?.result?.[0]?.events?.dividends) {
      return [];
    }

    const dividendsMap = data.chart.result[0].events.dividends;
    const dividends: { date: string; rate: number }[] = Object.values(dividendsMap).map((d: any) => ({
      date: new Date(d.date * 1000).toISOString(),
      rate: d.amount
    }));

    return dividends.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Fetch Historical Open Price for a specific date
   */
  public async getHistoricalOpen(symbol: string, market: MarketType, dateStr: string): Promise<number | null> {
    // Correctly handle TW suffixes (TWSE vs TPEX)
    const suffixes = (market === 'TW' && !symbol.includes('.')) ? ['.TW', '.TWO'] : [''];

    for (const suffix of suffixes) {
      const querySymbol = symbol + suffix;

      // --- Attempt 1: Real-time Quote (v7 Quote API) ---
      // Prioritize this for "Today" related queries as it's faster and fresher
      try {
        console.log(`[StockService] Fetching quote for ${querySymbol}...`);
        // Simplify URL to avoid proxy encoding issues or region blocks
        // The symbol itself (e.g. 4168.TWO) usually implies the region for unique tickers
        const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${querySymbol}`;
        const quoteData = await this.fetchWithProxy(quoteUrl);
        // console.log(`[StockService] Quote data for ${querySymbol}:`, quoteData);

        if (quoteData?.quoteResponse?.result?.[0]) {
          const q = quoteData.quoteResponse.result[0];
          console.log(`[StockService] Got quote: Open=${q.regularMarketOpen}, Time=${q.regularMarketTime}`);

          if (q.regularMarketOpen && q.regularMarketTime) {
            const marketDate = new Date(q.regularMarketTime * 1000).toISOString().split('T')[0];

            const isRequestingToday = dateStr === new Date().toISOString().split('T')[0];
            const isRecent = Math.abs((Date.now() / 1000) - q.regularMarketTime) < 86400 * 2; // extended to 48h to catch weekend/holiday closes if needed

            // If requesting today, accept if it's recent (last 24-48h session)
            if (isRequestingToday && isRecent) {
              return q.regularMarketOpen;
            }
            // If requesting a specific past date, strict match
            if (!isRequestingToday && marketDate === dateStr) {
              return q.regularMarketOpen;
            }
          }
        }
      } catch (quoteError) {
        console.error(`[StockService] Quote fetch failed for ${querySymbol}`, quoteError);
      }

      // --- Attempt 2: Historical Data (Daily Candles) ---
      try {
        console.log(`[StockService] Fetching history for ${querySymbol}...`);
        // 1. Convert Date String (YYYY-MM-DD) to Timestamp
        const dateObj = new Date(dateStr);
        const startTs = Math.floor(dateObj.getTime() / 1000);
        const endTs = startTs + 86400 * 2; // Look ahead 2 days

        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?symbol=${querySymbol}&period1=${startTs}&period2=${endTs}&interval=1d`;
        const data = await this.fetchWithProxy(targetUrl);

        if (data?.chart?.result?.[0]) {
          const result = data.chart.result[0];
          const timestamps = result.timestamp || [];
          const opens = result.indicators?.quote?.[0]?.open || [];

          for (let i = 0; i < timestamps.length; i++) {
            // Convert Yahoo timestamp to YYYY-MM-DD
            const tsDate = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
            if (tsDate === dateStr) {
              const openPrice = opens[i];
              if (openPrice) return openPrice;
            }
          }
        }
      } catch (e) {
        console.error(`[StockService] Historical fetch failed for ${querySymbol}`, e);
      }
    } // End Suffix Loop

    return null;
  }
}

export const stockService = new StockService();
