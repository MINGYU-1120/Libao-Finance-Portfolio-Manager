
import { MarketType } from "../types";

export const getIndustry = (symbol: string, market: MarketType): string => {
  if (market === 'US') {
    const map: Record<string, string> = {
      // Tech / Semi
      'AAPL': '科技 (Technology)', 'MSFT': '科技 (Technology)', 
      'NVDA': '半導體 (Semiconductor)', 'TSM': '半導體 (Semiconductor)', 
      'AMD': '半導體 (Semiconductor)', 'INTC': '半導體 (Semiconductor)',
      'AVGO': '半導體 (Semiconductor)', 'QCOM': '半導體 (Semiconductor)',
      'TXN': '半導體 (Semiconductor)', 'MU': '半導體 (Semiconductor)',
      'AMAT': '半導體 (Semiconductor)', 'LRCX': '半導體 (Semiconductor)',
      'ARM': '半導體 (Semiconductor)', 'SMH': 'ETF (Semi)', 'SOXX': 'ETF (Semi)',
      'SOXL': 'ETF (Semi)',
      
      // Comm Services
      'GOOGL': '通訊服務 (Comm)', 'GOOG': '通訊服務 (Comm)', 'META': '通訊服務 (Comm)',
      'NFLX': '通訊服務 (Comm)', 'DIS': '通訊服務 (Comm)',
      
      // Consumer
      'AMZN': '非必需消費 (Consumer)', 'TSLA': '非必需消費 (Consumer)',
      'COST': '必需消費 (Staples)', 'WMT': '必需消費 (Staples)', 
      'TGT': '必需消費 (Staples)', 'PG': '必需消費 (Staples)',
      'KO': '必需消費 (Staples)', 'PEP': '必需消費 (Staples)',
      'MCD': '非必需消費 (Consumer)', 'NKE': '非必需消費 (Consumer)',
      'SBUX': '非必需消費 (Consumer)',
      
      // Financial
      'JPM': '金融 (Financial)', 'BAC': '金融 (Financial)', 'V': '金融 (Financial)',
      'MA': '金融 (Financial)', 'WFC': '金融 (Financial)', 'GS': '金融 (Financial)',
      'BRK.B': '金融 (Financial)', 'COIN': '金融 (Crypto)',
      
      // Pharma / Health
      'LLY': '醫療保健 (Health)', 'UNH': '醫療保健 (Health)', 
      'JNJ': '醫療保健 (Health)', 'PFE': '醫療保健 (Health)', 
      'MRK': '醫療保健 (Health)', 'ABBV': '醫療保健 (Health)',
      
      // ETF
      'SPY': '大盤 ETF', 'VOO': '大盤 ETF', 'IVV': '大盤 ETF', 
      'QQQ': '大盤 ETF', 'TQQQ': '大盤 ETF', 'SQQQ': '大盤 ETF',
      'VTI': '全市場 ETF', 'VT': '全市場 ETF', 'TLT': '債券 ETF',
      'SCHD': '高股息 ETF', 'JEPI': '高股息 ETF', 'ARKK': '創新 ETF'
    };
    
    if (map[symbol]) return map[symbol];
    if (symbol.length <= 4 && !symbol.includes('.')) return '美股其他 (US Other)';
    return '美股 ETF/其他';
  }

  // TW Logic (Based on TWSE/TPEX code ranges)
  if (symbol.startsWith('00')) return 'ETF';
  
  // Specific known big caps override
  if (['2330', '2454', '2303', '2379', '3034', '3711', '3008'].includes(symbol)) return '半導體 (Semiconductor)';
  if (['2603', '2609', '2615'].includes(symbol)) return '航運 (Shipping)';
  if (['2881', '2882', '2891', '2886', '2884'].includes(symbol)) return '金融 (Financial)';

  // Ranges
  if (symbol.startsWith('11')) return '水泥 (Cement)';
  if (symbol.startsWith('12')) return '食品 (Food)';
  if (symbol.startsWith('13')) return '塑膠/化學 (Plastic)';
  if (symbol.startsWith('14')) return '紡織 (Textile)';
  if (symbol.startsWith('15')) return '電機機械 (Electric)';
  if (symbol.startsWith('16')) return '電器電纜 (Cable)';
  if (symbol.startsWith('17')) return '生技/化學 (Biotech)';
  if (symbol.startsWith('20')) return '鋼鐵 (Steel)';
  if (symbol.startsWith('21')) return '橡膠 (Rubber)';
  if (symbol.startsWith('22')) return '汽車 (Auto)';
  if (symbol.startsWith('23')) return '電子 (Electronics)';
  if (symbol.startsWith('24')) return '電子 (Electronics)';
  if (symbol.startsWith('25')) return '營建 (Construction)';
  if (symbol.startsWith('26')) return '航運 (Shipping)';
  if (symbol.startsWith('27')) return '觀光 (Tourism)';
  if (symbol.startsWith('28')) return '金融 (Financial)';
  if (symbol.startsWith('29')) return '貿易百貨 (Retail)';
  
  // 3xxx - 9xxx mixture
  if (symbol.startsWith('30') || symbol.startsWith('31') || symbol.startsWith('32') || symbol.startsWith('33') || 
      symbol.startsWith('34') || symbol.startsWith('35') || symbol.startsWith('36') || symbol.startsWith('37')) {
      if (symbol.startsWith('31') || symbol.startsWith('32')) return '電子/生技 (OTC)';
      return '電子 (Electronics)';
  }
  
  if (symbol.startsWith('41')) return '生技 (Biotech)';
  if (symbol.startsWith('47')) return '化學生技 (Chemical)';
  if (symbol.startsWith('49')) return '通訊網路 (Comm)';
  if (symbol.startsWith('52')) return '電子 (Electronics)';
  if (symbol.startsWith('53')) return '電子 (Electronics)';
  if (symbol.startsWith('55')) return '營建 (Construction)';
  if (symbol.startsWith('58')) return '金融 (Financial)';
  if (symbol.startsWith('61')) return '電子 (Electronics)';
  if (symbol.startsWith('62')) return '電子 (Electronics)';
  if (symbol.startsWith('64')) return '生技/電子';
  if (symbol.startsWith('65')) return '生技/電子';
  if (symbol.startsWith('80')) return '電子 (Electronics)';
  if (symbol.startsWith('99')) return '其他 (Other)';

  return '其他 (Other)';
};
