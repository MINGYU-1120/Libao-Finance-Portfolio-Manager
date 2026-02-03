export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  lastActive: number;
  createdAt?: number;
}

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

export interface NewsItem {
  id: number;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  sentiment_score?: number;
  related_stocks?: string[];
}

export interface AIPick {
  id: string;
  stock_symbol: string;
  prediction: string;
  confidence: number;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  timestamp: string; // ISO date string
  reasoning?: string;
  status?: 'active' | 'closed' | 'pending';
}

export interface AuditLog {
  id: string;
  timestamp: number;
  action: string;
  actorEmail: string;
  targetId: string;
  details: string;
}

export interface PortfolioState {
  totalValue: number;
  monthlyPnL: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown?: number; // Added to match usage if any
}

export type PositionCategory = 'conservative' | 'growth' | 'crypto' | 'cash';

export interface AppSettings {
  theme: 'dark' | 'light';
  notifications: boolean;
}

export interface TransactionRecord {
  id: string;
  date: number;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  amount: number;
  fee: number;
  tax: number;
  isMartingale?: boolean;
}

export interface StrategyStats {
  totalReturn: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  tradesCount: number;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  note?: string;
}

export interface CalculatedAsset extends Asset {
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  portfolioRatio: number;
}

export interface CalculatedCategory {
  id: string;
  name: string;
  market: string;
  projectedInvestment: number;
  remainingCash: number;
  investedAmount: number;
  investmentRatio: number;
}
