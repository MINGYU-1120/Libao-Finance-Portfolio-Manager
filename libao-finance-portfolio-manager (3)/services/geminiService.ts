
import { GoogleGenAI } from "@google/genai";
import { PortfolioState } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// --- Cache Implementation ---
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const PRICE_TTL = 60 * 1000; // 60 seconds

// Helper to identify quota errors (kept for analyzePortfolio)
const isQuotaError = (error: any) => {
  const msg = error?.message || '';
  const status = error?.status || '';
  return status === 'RESOURCE_EXHAUSTED' || (typeof msg === 'string' && (msg.includes('429') || msg.includes('quota') || msg.includes('Quota')));
};

// --- Robust Yahoo Finance Fetcher ---

// List of CORS proxies to try in order.
// 1. corsproxy.io - Usually fastest
// 2. allorigins.win - Reliable backup
const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

const getYahooUrl = (symbol: string) => 
  `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?region=US&lang=en-US&includePrePost=false&interval=1d&range=1d`;

const getYahooDividendUrl = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?region=US&lang=en-US&includePrePost=false&interval=1d&range=1y&events=div`;


/**
 * Attempts to fetch data from a URL using multiple proxies with timeout.
 */
const fetchWithProxy = async (targetUrl: string): Promise<any | null> => {
  for (const proxyGen of PROXIES) {
    try {
      const proxyUrl = proxyGen(targetUrl);
      
      // Timeout controller to fail fast if a proxy is hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout per proxy

      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) continue; // Try next proxy

      const data = await response.json();
      return data;
    } catch (e) {
      // Console warning disabled to keep log clean, just try next proxy
      continue;
    }
  }
  return null;
};

export const analyzePortfolio = async (portfolio: PortfolioState): Promise<string> => {
  const client = getClient();
  if (!client) {
    return "請配置 API Key 以啟用 AI 助理功能。";
  }

  const summary = portfolio.categories.map(cat => {
    const assets = cat.assets.map(a => `${a.symbol} (${a.shares} shares @ ${a.avgCost})`).join(', ');
    return `${cat.name} (${cat.market}): Allocation ${cat.allocationPercent}%, Assets: [${assets}]`;
  }).join('\n');

  const prompt = `
    你是一個專業的財務顧問，現在正在協助「Libao財經學院」的學生檢視他們的投資倉位。
    
    總資金: NT$${portfolio.totalCapital}
    
    倉位配置如下:
    ${summary}
    
    請針對這個投資組合提供簡短、專業的建議。
    重點分析：
    1. 資金配置是否過於集中或分散？
    2. 針對目前持有的股票代號（如果有的話），提供一句話的風險提示。
    3. 語氣要鼓勵且專業，使用繁體中文。
    4. 如果沒有資產，請建議學生開始依照計畫填入標的。
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "AI 暫時無法提供建議，請稍後再試。";
  } catch (error) {
    if (isQuotaError(error)) {
      console.warn("Gemini AI Analysis Quota Exceeded.");
      return "AI 分析服務目前繁忙（額度已滿），請稍後再試。";
    }
    console.error("Gemini Error:", error);
    return "分析過程中發生錯誤。";
  }
};

export const fetchStockPrice = async (symbol: string, market: string): Promise<number | null> => {
  const cacheKey = `${symbol}-${market}`;
  const now = Date.now();

  // 1. Check Fresh Cache
  if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp < PRICE_TTL)) {
    return priceCache[cacheKey].price;
  }

  let price: number | null = null;
  let data: any = null;

  // 2. Fetch Logic
  if (market === 'TW') {
    // Strategy: Try .TW first (Listed), then .TWO (OTC)
    const urlTw = getYahooUrl(`${symbol}.TW`);
    data = await fetchWithProxy(urlTw);
    
    if (data?.chart?.result?.[0]?.meta) {
        const meta = data.chart.result[0].meta;
        price = meta.regularMarketPrice || meta.previousClose;
    } else {
        // Fallback to OTC
        const urlTwo = getYahooUrl(`${symbol}.TWO`);
        data = await fetchWithProxy(urlTwo);
        if (data?.chart?.result?.[0]?.meta) {
            const meta = data.chart.result[0].meta;
            price = meta.regularMarketPrice || meta.previousClose;
        }
    }
  } else {
    // Strategy: Try symbol directly for US
    const urlUs = getYahooUrl(symbol);
    data = await fetchWithProxy(urlUs);
    if (data?.chart?.result?.[0]?.meta) {
        const meta = data.chart.result[0].meta;
        price = meta.regularMarketPrice || meta.previousClose;
    }
  }
  
  // 3. Update Cache or Return Stale
  if (typeof price === 'number') {
    priceCache[cacheKey] = { price, timestamp: now };
    return price;
  }

  // Fallback to Stale Cache if all network attempts fail
  if (priceCache[cacheKey]) {
    return priceCache[cacheKey].price;
  }

  return null;
};

export const fetchPortfolioPrices = async (assets: {symbol: string, market: string}[]): Promise<Record<string, number>> => {
  const priceMap: Record<string, number> = {};
  
  // Deduplicate to save requests
  const uniqueAssets = Array.from(new Set(assets.map(a => JSON.stringify({s: a.symbol, m: a.market}))))
    .map(str => JSON.parse(str));

  // Process in batches (parallel) to speed up
  const promises = uniqueAssets.map(async (asset) => {
    const price = await fetchStockPrice(asset.s, asset.m);
    if (price !== null) {
      priceMap[asset.s] = price;
      // Also map uppercase for safety
      priceMap[asset.s.toUpperCase()] = price;
    }
  });

  await Promise.all(promises);
  return priceMap;
};

export interface StockSearchResult {
  symbol: string;
  name: string;
  market: 'TW' | 'US';
}

export const searchStocksYahoo = async (query: string, marketContext: 'TW' | 'US'): Promise<StockSearchResult[]> => {
  // Yahoo Finance Search API
  // q: query
  // lang: zh-Hant-TW (Force Traditional Chinese for names)
  // region: TW (Prioritize TW region relevance, though US stocks also show up)
  const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=zh-Hant-TW&region=TW&quotesCount=10&newsCount=0`;
  
  const data = await fetchWithProxy(targetUrl);
  
  if (data && data.quotes && Array.isArray(data.quotes)) {
    return data.quotes
      .filter((q: any) => {
          // Filter equity/etf
          const isEquity = q.quoteType === 'EQUITY' || q.quoteType === 'ETF';
          if (!isEquity) return false;

          // Filter by Market Context if possible
          if (marketContext === 'TW') {
             // TW stocks must end in .TW or .TWO
             return q.symbol.endsWith('.TW') || q.symbol.endsWith('.TWO');
          } else {
             // US stocks usually don't have suffix (or different ones). 
             // Exclude .TW/.TWO for US context
             return !q.symbol.endsWith('.TW') && !q.symbol.endsWith('.TWO');
          }
      })
      .map((q: any) => {
          let cleanSymbol = q.symbol;
          let market: 'TW' | 'US' = 'US';

          if (q.symbol.endsWith('.TW') || q.symbol.endsWith('.TWO')) {
             market = 'TW';
             cleanSymbol = q.symbol.replace('.TW', '').replace('.TWO', '');
          }

          return {
            symbol: cleanSymbol,
            name: q.shortname || q.longname || cleanSymbol,
            market: market
          };
      });
  }
  
  return [];
};

export interface DividendEvent {
  date: string; // ISO Date String of Ex-Date
  amount: number; // Dividend per share
}

export const fetchStockDividends = async (symbol: string, market: 'TW' | 'US'): Promise<DividendEvent[]> => {
  let url = '';
  if (market === 'TW') {
      // Try .TW first
      url = getYahooDividendUrl(`${symbol}.TW`);
  } else {
      url = getYahooDividendUrl(symbol);
  }
  
  const data = await fetchWithProxy(url);
  
  // If TW fetch fails or empty, maybe try .TWO?
  if (market === 'TW' && (!data?.chart?.result?.[0]?.events?.dividends)) {
      const urlTwo = getYahooDividendUrl(`${symbol}.TWO`);
      const dataTwo = await fetchWithProxy(urlTwo);
      if (dataTwo?.chart?.result?.[0]?.events?.dividends) {
         return parseDividendData(dataTwo);
      }
  }

  if (data?.chart?.result?.[0]?.events?.dividends) {
      return parseDividendData(data);
  }

  return [];
};

const parseDividendData = (data: any): DividendEvent[] => {
    const divs = data.chart.result[0].events.dividends;
    const events: DividendEvent[] = [];
    Object.values(divs).forEach((d: any) => {
        if (d.date && d.amount) {
            // Yahoo dates are seconds timestamps
            const date = new Date(d.date * 1000).toISOString();
            events.push({
                date,
                amount: d.amount
            });
        }
    });
    // Sort descending
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
