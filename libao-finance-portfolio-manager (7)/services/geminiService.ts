
import { GoogleGenAI } from "@google/genai";
import { PortfolioState } from "../types";
import { stockService } from "./StockService";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// Helper to identify quota errors
const isQuotaError = (error: any) => {
  const msg = error?.message || '';
  const status = error?.status || '';
  return status === 'RESOURCE_EXHAUSTED' || (typeof msg === 'string' && (msg.includes('429') || msg.includes('quota') || msg.includes('Quota')));
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

// Re-export stock functions from the new Service for cleaner imports in App
export const fetchStockPrice = (s: string, m: string) => stockService.getPrice(s, m as 'TW'|'US');
export const fetchPortfolioPrices = (assets: any[]) => stockService.getPrices(assets);
export const searchStocksYahoo = (q: string, m: string) => stockService.searchStocks(q, m as 'TW'|'US');
export const fetchStockDividends = (s: string, m: string) => stockService.getDividends(s, m as 'TW'|'US');
