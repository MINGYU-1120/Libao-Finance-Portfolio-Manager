
export type MarketType = 'TW' | 'US';

export interface AssetLot {
  id: string;
  date: string; // ISO String
  shares: number;
  costPerShare: number; // For US, this is in USD
  exchangeRate: number; // FX rate at time of purchase (1 for TW)
}

export interface Asset {
  id: string;
  symbol: string; // 代號
  name: string; // 公司名稱
  shares: number; // 現有股數
  avgCost: number; // 成本均價 (Display purpose, calculated from lots)
  currentPrice: number; // 當前股價 (Original Currency)
  note?: string;
  lots: AssetLot[]; // FIFO Tracking
}

export interface PositionCategory {
  id: string;
  name: string; // e.g., 紅標(頭等艙), G倉(長線)
  market: MarketType;
  allocationPercent: number; // 資金占比 (0-100)
  assets: Asset[];
}

export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND';

export interface TransactionRecord {
  id: string;
  date: string; // ISO String
  assetId: string;
  lotId?: string; // For BUY: The ID of the lot created
  symbol: string;
  name: string;
  type: TransactionType;
  shares: number;
  price: number; // Original Currency
  exchangeRate: number; // FX Rate used
  amount: number; // Total value in TWD
  fee: number; // TWD
  tax: number; // TWD
  realizedPnL?: number; // Only for SELL (in TWD)
  originalCostTWD?: number; // NEW: The cost basis (TWD) of the shares sold, used for perfect undo
  categoryName: string;
  portfolioRatio?: number; // % of Category Projected Investment at time of trade
}

export type CapitalType = 'DEPOSIT' | 'WITHDRAW';

export interface CapitalLogEntry {
  id: string;
  date: string; // ISO String
  type: CapitalType;
  amount: number;
  note?: string;
}

export interface AppSettings {
  usExchangeRate: number;
  enableFees: boolean;
  usBroker: 'Firstrade' | 'IBKR' | 'Sub-brokerage';
  twFeeDiscount?: number; // Discount rate (e.g., 6 for 60%, 2.8 for 28%)
  enableSystemNotifications?: boolean; // New Field for Push Notifications
}

export interface PortfolioState {
  totalCapital: number; // Derived from capitalLogs (Cached value)
  settings: AppSettings;
  categories: PositionCategory[];
  transactions: TransactionRecord[]; // History Ledger
  capitalLogs: CapitalLogEntry[]; // Funding History
  lastModified?: number; // Timestamp for sync conflict resolution
}

export interface CalculatedCategory {
  id: string;
  name: string;
  market: MarketType;
  allocationPercent: number;
  projectedInvestment: number; // 預計投入資金
  investedAmount: number; // 已投入 (TWD)
  remainingCash: number; // 剩餘現金 (TWD)
  investmentRatio: number; // 投入比例
  realizedPnL: number; // 總已實現損益 (TWD)
  assets: CalculatedAsset[];
}

export interface CalculatedAsset extends Asset {
  costBasis: number; // 投資成本 (TWD)
  marketValue: number; // 持倉價值 (TWD)
  unrealizedPnL: number; // 未實現損益 (TWD)
  returnRate: number; // 損益率
  portfolioRatio: number; // 投入比例 (relative to category projected)
  realizedPnL: number; // Cumulative realized PnL for this asset
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  symbol: string;
  market: MarketType;
}
