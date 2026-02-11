export type UserRole = 'viewer' | 'member' | 'vip' | 'admin';

export enum AccessTier {
  GUEST = 0,
  STANDARD = 1,
  FIRST_CLASS = 2,
  ADMIN = 3
}

// Helper to convert Role to Tier
export const getTier = (role: UserRole): AccessTier => {
  switch (role) {
    case 'admin': return AccessTier.ADMIN;
    case 'vip': return AccessTier.FIRST_CLASS;
    case 'member': return AccessTier.STANDARD;
    case 'viewer':
    default: return AccessTier.GUEST;
  }
};

export type MarketType = 'US' | 'TW';
export type CapitalType = 'DEPOSIT' | 'WITHDRAW' | 'ADJUST';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  lastActive: number;
  createdAt?: number;
}

export interface NewsItem {
  id?: number | string; // Made optional and allow string
  title: string;
  summary?: string;
  url?: string;
  published_at?: string;
  sentiment_score?: number;
  related_stocks?: string[];
  link?: string;
  pubDate?: string;
  symbol?: string;
  market?: string;
  source?: string;
}

export interface AIPick {
  id: string;
  stock_symbol: string;
  prediction: string;
  confidence: number;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  timestamp: string | number; // Allow number
  reasoning?: string;
  status?: 'active' | 'closed' | 'pending' | 'CLOSED' | 'ACTIVE';
  exitDate?: string;
  realizedReturn?: number;
  symbol?: string; // Added alias for stock_symbol
  name?: string; // Added
  market?: MarketType; // Added
  entryPrice?: number;
  exitCondition?: string;
  analysis?: string;
  currentPrice?: number;
  date?: string;
  exitPrice?: number;
  returnSinceEntry?: number; // Added
}

export interface AuditLog {
  id: string;
  timestamp: number;
  action: string;
  actorEmail: string;
  targetId: string;
  details: string;
}

// Rename Lot to AssetLot to match App.tsx import
export interface AssetLot {
  id?: string; // App.tsx uses id for lot
  date: string | number; // Allow number
  shares: number;
  cost?: number; // legacy?
  costPerShare: number;
  exchangeRate: number;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  note?: string;
  currentPrice?: number;
  lots?: AssetLot[];
}

export interface CalculatedAsset extends Asset {
  currentPrice?: number; // Made optional to match Asset
  marketValue: number;
  unrealizedPnL: number;
  portfolioRatio: number;
  costBasis: number; // Added
  returnRate: number; // Added
  realizedPnL: number; // Added
}

export interface CalculatedCategory {
  id: string;
  name: string;
  market: MarketType;
  projectedInvestment: number;
  remainingCash: number;
  investedAmount: number;
  investmentRatio: number;
  assets: CalculatedAsset[];
  allocationPercent?: number;
  realizedPnL?: number;
}

export interface PortfolioState {
  totalCapital: number;
  settings: AppSettings;
  categories: PositionCategory[];
  transactions: TransactionRecord[];
  capitalLogs: CapitalLogEntry[];
  martingale?: PositionCategory[];
  lastModified?: number;
}

export interface PositionCategory {
  id: string;
  name: string;
  market: MarketType;
  allocationPercent: number;
  assets: Asset[];
}

export interface AppSettings {
  theme?: 'dark' | 'light';
  notifications?: boolean;
  usExchangeRate: number;
  enableSystemNotifications?: boolean;
  enableFees?: boolean;
  usBroker?: 'Firstrade' | 'IBKR' | 'Sub-brokerage';
  twFeeDiscount?: number;
}

export interface TransactionRecord {
  id: string;
  date: number | string;
  symbol: string;
  type: 'buy' | 'sell' | 'BUY' | 'SELL' | 'DIVIDEND';
  quantity?: number; // Made optional
  price: number;
  amount: number;
  fee: number;
  tax: number;
  isMartingale?: boolean;
  categoryName?: string;
  assetId?: string;
  exchangeRate?: number;
  lotId?: string; // Added
  originalCostTWD?: number; // Added

  // Extended properties used in TransactionHistory
  portfolioRatio?: number;
  realizedPnL?: number;
  name?: string;
  shares?: number;
}

export interface StrategyStats {
  totalReturn: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  tradesCount: number;
  avgReturn?: number;
  avgReturnLabel?: string;
  drawdownLabel?: string;
  winRateChange?: number;
  lastUpdated?: number;
}

export interface CapitalLogEntry {
  id: string;
  date: number | string;
  type: CapitalType;
  amount: number;
  note?: string;
  isMartingale?: boolean;
}
