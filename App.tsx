
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Briefcase,
  RefreshCw,
  History,
  LayoutDashboard,
  Settings,
  Brain,
  Eye,
  EyeOff,
  Coins,
  LogIn,
  LogOut,
  Cloud,
  Menu,
  X,
  ChevronRight,
  Bell,
  MessageCircle,
  BookOpen,
  ChevronDown,
  Calculator,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Wallet,
  TrendingUp,
  PieChart,
  CloudOff,
  AlertCircle,
  Rocket,
  Shield,
  ArrowRight,
  Download,
  Share,
  MoreVertical,
  ShieldAlert,
  GraduationCap,
  Plus,
  ArrowLeft
} from 'lucide-react';
import { PortfolioState, PositionCategory, CalculatedCategory, CalculatedAsset, TransactionRecord, AppSettings, NewsItem, AssetLot, Asset, MarketType } from './types';
import { DEFAULT_CATEGORIES, INITIAL_CAPITAL, DEFAULT_EXCHANGE_RATE } from './constants';

import DetailTable from './components/DetailTable';
import TransactionHistory from './components/TransactionHistory';
import DividendLedger from './components/DividendLedger';
import SettingsModal from './components/SettingsModal';
import FeeSettingsModal from './components/FeeSettingsModal';

import DividendModal, { ScannedDividend } from './components/DividendModal';
import CapitalModal from './components/CapitalModal';
import MonthlyPnLChart from './components/MonthlyPnLChart';
import TutorialModal from './components/TutorialModal';
import OnboardingModal from './components/OnboardingModal';
import NewsModal from './components/NewsModal';
import GuidedTour, { TourStep } from './components/GuidedTour';
import SectionGate from './components/SectionGate';
// MarketInsiderDemo removed
import AIPicks from './components/AIPicks';

import AddCategoryModal from './components/AddCategoryModal';
import { stockService } from './services/StockService';
import { getIndustry, calculateIndustryAnalysis } from './services/industryService';
import { formatCurrency, formatTWD } from './utils/formatting';
import { scrubSensitiveData } from './utils/privacy';
import AdminPanel from './components/AdminPanel';
import MartingalePanel from './components/MartingalePanel';
import PersonalDashboard from './components/PersonalDashboard';
import PersonalSummary from './components/PersonalSummary';
import {
  loginWithGoogle,
  logoutUser,
  subscribeToAuthChanges,
  savePortfolioToCloud,
  loadPortfolioFromCloud,
  resetCloudPortfolio,
  syncUserProfile,
  updatePublicMartingale,
  subscribeToPublicMartingale,
  subscribeToUserRole
} from './services/firebase';
import { useToast } from './contexts/ToastContext';
import { OrderData } from './components/OrderModal';
import { UserRole, AccessTier, getTier } from './types';

const maskValueFn = (val: string | number, isPrivacyMode: boolean) => isPrivacyMode ? '*******' : val;

const App: React.FC = () => {
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('viewer'); // NEW: Role State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isStartingFresh, setIsStartingFresh] = useState(false);

  // --- UI State ---
  const [showTutorial, setShowTutorial] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isTourForceOrderOpen, setIsTourForceOrderOpen] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false); // NEW: Admin Panel State
  const [isStatsEditModalOpen, setIsStatsEditModalOpen] = useState(false); // To pass down if needed
  const [martingaleActiveId, setMartingaleActiveId] = useState<string | null>(null);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [hasNewNews, setHasNewNews] = useState(false);
  const [pwaTab, setPwaTab] = useState<'iOS' | 'Android'>('iOS');
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const initialPortfolioState: PortfolioState = useMemo(() => ({
    totalCapital: INITIAL_CAPITAL,
    settings: {
      usExchangeRate: DEFAULT_EXCHANGE_RATE,
      enableFees: true,
      usBroker: 'Firstrade',
      twFeeDiscount: 6,
      enableSystemNotifications: false
    },
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    capitalLogs: [],
    martingale: [{
      id: "teacher-cat-1",
      name: "馬丁策略 (Martingale)",
      market: "TW",
      allocationPercent: 100, // Default 100% of Teacher's Portfolio
      assets: []
    }], // Teacher's Portfolio (Array)
    lastModified: Date.now()
  }), []);

  const [portfolio, setPortfolio] = useState<PortfolioState>(initialPortfolioState);
  const lastMartingaleDataRef = useRef<string>(''); // To prevent duplicate toasts
  const portfolioRef = useRef(portfolio);
  useEffect(() => { portfolioRef.current = portfolio; }, [portfolio]);

  const [viewMode, setViewMode] = useState<'PORTFOLIO' | 'HISTORY' | 'DIVIDENDS' | 'AI_PICKS' | 'VIP_PORTFOLIO' | 'ADMIN'>('PORTFOLIO');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFeeSettingsModal, setShowFeeSettingsModal] = useState(false);
  const [showDividendModal, setShowDividendModal] = useState(false);
  const [showCapitalModal, setShowCapitalModal] = useState(false);

  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [isScanningDividends, setIsScanningDividends] = useState(false);
  const [scannedDividends, setScannedDividends] = useState<ScannedDividend[]>([]);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const maskValue = (val: string | number) => maskValueFn(val, isPrivacyMode);

  const saveAndSetPortfolio = useCallback((newState: PortfolioState) => {
    try { localStorage.setItem('libao-portfolio', JSON.stringify(newState)); } catch (e) { console.error(e); }
    setPortfolio(newState);
    setIsDataLoaded(true);
  }, []);

  const fetchStockNews = useCallback(async () => {
    const assetsList: { symbol: string, name: string, market: 'TW' | 'US' }[] = [];
    const seen = new Set<string>();
    portfolioRef.current.categories.forEach(c => {
      c.assets.forEach(a => {
        const key = `${a.symbol}-${c.market}`;
        if (!seen.has(key)) {
          seen.add(key);
          assetsList.push({ symbol: a.symbol, name: a.name, market: c.market as 'TW' | 'US' });
        }
      });
    });
    if (assetsList.length === 0) return;
    setIsFetchingNews(true);
    try {
      const results = await Promise.all(
        assetsList.slice(0, 10).map(asset => stockService.getStockNews(asset.symbol, asset.market, asset.name))
      );
      const allNews = results.flat()
        .filter(n => !isNaN(new Date(n.pubDate).getTime()))
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      setNewsItems(allNews);
      if (allNews.length > 0) {
        const lastRead = localStorage.getItem('libao-news-last-read');
        if (!lastRead || new Date(allNews[0].pubDate).getTime() > parseInt(lastRead)) {
          setHasNewNews(true);
        }
      }
    } catch (e) {
      console.warn("News fetch failed", e);
    } finally {
      setIsFetchingNews(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsSyncing(true);
        try {
          // Sync User Profile (and fetch role)
          const role = await syncUserProfile(currentUser);
          console.log(`[App] Initial User Role: ${role}`);
          setUserRole(role);

          // Subscribe to Real-time Role Changes
          subscribeToUserRole(currentUser.uid, (newRole) => {
            console.log(`[App] Role updated realtime: ${newRole}`);
            setUserRole(newRole);
            showToast(`權限已更新為: ${newRole.toUpperCase()}`, "info");
          });

          // Load Portfolio
          const cloudData = await loadPortfolioFromCloud(currentUser.uid);
          if (cloudData) {
            saveAndSetPortfolio({ ...initialPortfolioState, ...cloudData, martingale: cloudData.martingale || initialPortfolioState.martingale });
            localStorage.setItem('libao-onboarding-v1', 'true');
            fetchStockNews();
          } else {
            const localData = localStorage.getItem('libao-portfolio');
            if (localData) {
              const parsed = JSON.parse(localData);
              setPortfolio({ ...initialPortfolioState, ...parsed, martingale: parsed.martingale || initialPortfolioState.martingale });
              setIsDataLoaded(true);
              await savePortfolioToCloud(currentUser.uid, parsed);
              fetchStockNews();
            } else {
              setShowOnboarding(true);
            }
          }
        } catch (e) { console.error(e); } finally { setIsSyncing(false); }
      } else {
        console.log("[App] User logged out, resetting state.");
        setUserRole('viewer'); // Reset role
        setPortfolio(initialPortfolioState); // Clear sensitive data
        setIsDataLoaded(false); // Force reload for next user
        setUserRole('viewer'); // Reset role
        setPortfolio(initialPortfolioState); // Clear sensitive data
        setIsDataLoaded(false); // Force reload for next user
        setActiveCategoryId(null);
        setMartingaleActiveId(null);
        setShowAdminPanel(false); // Fix: Close admin panel on logout

        // Load local only as fallback
        const localData = localStorage.getItem('libao-portfolio');
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            setPortfolio(parsed);
            setIsDataLoaded(true);
            fetchStockNews();
          } catch (e) { console.error(e); }
        }
      }
    });
    return () => unsubscribe();
  }, [saveAndSetPortfolio, fetchStockNews]);

  useEffect(() => {
    if (isDataLoaded && portfolio.transactions.length > 0) {
      // Auto-Migration: Fix Legacy Martingale Dividends
      const cats = Array.isArray(portfolio.martingale) ? portfolio.martingale : [];
      if (cats.length > 0) {
        let hasChanges = false;
        const newTxs = portfolio.transactions.map(t => {
          if (t.type === 'DIVIDEND') {
            // Strict Check: Only migrate if undefined (Legacy).
            // Do NOT overwrite if explicitly false (User created as Personal).
            if (t.isMartingale === undefined) {
              const isMartingaleCategory = cats.some(c => c.name === t.categoryName);
              if (isMartingaleCategory) {
                hasChanges = true;
                return { ...t, isMartingale: true };
              }
            }
          }
          return t;
        });

        if (hasChanges) {
          console.log("[Auto-Fix] Forced migration of Martingale dividends.");
          saveAndSetPortfolio({ ...portfolio, transactions: newTxs });
          showToast('已強制修復所有馬丁股息歸屬', 'success');
        }
      }
    }
  }, [isDataLoaded, portfolio.martingale]); // Run when data is loaded

  useEffect(() => {
    if (isDataLoaded) {
      const interval = setInterval(fetchStockNews, 30 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isDataLoaded, fetchStockNews]);

  const handleStartFresh = () => {
    setIsStartingFresh(true);
    setShowTutorial(true);
  };

  const handleLoginAction = async () => {
    // Note: Calling this as directly as possible to avoid losing user gesture context on mobile
    const loggedInUser = await loginWithGoogle();
    if (!loggedInUser) {
      setIsSyncing(false);
    } else {
      setIsSyncing(true); // Let the auth listener take over
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      localStorage.removeItem('libao-portfolio');
      localStorage.removeItem('libao-onboarding-v1');
      localStorage.removeItem('libao-tutorial-seen-v5');
      setPortfolio(initialPortfolioState);
      setIsDataLoaded(false);
      setIsStartingFresh(false);
      setActiveCategoryId(null);
      setViewMode('PORTFOLIO');
      setIsSidebarOpen(false);
      setUserRole('viewer'); // Reset Role
      showToast("已登出，資料已安全清除", "info");
    } catch (error) {
      showToast("登出失敗", "error");
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tourSteps: TourStep[] = useMemo(() => {
    const dashboardId = isMobile ? 'nav-mobile-dashboard' : 'nav-desktop-dashboard';
    const historyId = isMobile ? 'nav-mobile-history' : 'nav-desktop-history';
    const dividendId = isMobile ? 'nav-mobile-dividend' : 'nav-desktop-dividend';
    return [
      { targetId: dashboardId, title: '功能：持倉總覽', content: '這是您的首頁，顯示所有資產配置與即時損益。' },
      { targetId: historyId, title: '功能：交易紀錄', content: '每一筆買賣都會詳細記錄於此，並支援撤銷功能。' },
      { targetId: dividendId, title: '功能：股息帳本', content: '管理您的現金股利，並提供一鍵掃描功能自動補登。' },
      { targetId: 'tour-total-capital', title: '資金戰情室', content: '監控總本金與實時損益狀況。點擊「出/入金」可調整本金。' },
      { targetId: isMobile ? 'tour-summary-mobile-first' : 'tour-summary-table', title: '持倉配置表', content: 'Libao 核心！這裡設定各策略倉位 (如G倉、D倉) 的資金佔比，系統會自動算出剩餘可用現金。' },
      { targetId: isMobile ? 'tour-summary-mobile-first' : 'tour-summary-table', title: '進入倉位明細', content: '點擊倉位名稱或「明細」按鈕，可以查看具體持股。' },
      { targetId: 'detail-header', title: '倉位儀表板', content: '進入後，上方顯示此倉位的資金使用與損益概覽。' },
      { targetId: 'detail-add-btn', title: '新增交易', content: '點擊「下單」按鈕來記錄買入、賣出。' },
      { targetId: 'order-modal-content', title: '智慧下單介面', content: '輸入代號與投入比例，系統會自動計算手續費、稅金與對總資金的佔比影響。' },
    ];
  }, [isMobile]);

  const handleTourStepChange = (stepIndex: number) => {
    const step = tourSteps[stepIndex];
    if (!step) return;
    const isDetailStep = ['detail-header', 'detail-add-btn', 'order-modal-content'].includes(step.targetId);
    const isOrderStep = step.targetId === 'order-modal-content';
    if (step.title === '進入倉位明細' || isDetailStep) {
      if (activeCategoryId === null) {
        const firstId = portfolio.categories[0]?.id;
        if (firstId) setActiveCategoryId(firstId);
      }
    } else {
      if (activeCategoryId !== null) setActiveCategoryId(null);
    }
    if (isOrderStep) { setIsTourForceOrderOpen(true); } else { setIsTourForceOrderOpen(false); }
  };

  const handleTutorialClose = () => {
    setShowTutorial(false);
    localStorage.setItem('libao-tutorial-seen-v5', 'true');
    setViewMode('PORTFOLIO');
    setActiveCategoryId(null);
    setTimeout(() => { setIsTourActive(true); }, 600);
  };

  const handleTourComplete = () => {
    setIsTourActive(false);
    setIsTourForceOrderOpen(false);
    setActiveCategoryId(null);
    showToast("導覽完成！祝您投資順利。", "success");
  };

  const handleUpdatePrices = async (isManual: boolean) => {
    /* Implementation omitted for brevity in replacement tool, handled by rest of file */
    // Placeholder to allow subsequent code to work if not replaced
    if (isUpdatingPrices) return;
    if (isManual) showToast("更新股價中...", "info");
    setIsUpdatingPrices(true);
    let hasError = false;

    const assetsList: { symbol: string, market: 'TW' | 'US' }[] = [];
    const seen = new Set<string>();
    portfolio.categories.forEach(c => {
      c.assets.forEach(a => {
        const key = `${a.symbol}-${c.market}`;
        if (!seen.has(key)) {
          seen.add(key); // Use a properly typed Set or unique logic
          assetsList.push({ symbol: a.symbol, market: c.market as 'TW' | 'US' });
        }
      });
    });

    if (assetsList.length === 0) {
      setIsUpdatingPrices(false);
      return;
    }

    try {
      const results = await Promise.all(
        assetsList.map(a => stockService.getPrice(a.symbol, a.market))
      );
      const priceMap = new Map<string, number>();
      results.forEach((price, idx) => {
        if (price !== null) {
          const key = `${assetsList[idx].symbol}-${assetsList[idx].market}`;
          priceMap.set(key, price);
        } else {
          hasError = true;
        }
      });

      const newCategories = portfolio.categories.map(cat => ({
        ...cat,
        assets: cat.assets.map(asset => {
          const key = `${asset.symbol}-${cat.market}`;
          const newPrice = priceMap.get(key);
          return newPrice !== undefined ? { ...asset, currentPrice: newPrice } : asset;
        })
      }));

      saveAndSetPortfolio({ ...portfolio, categories: newCategories });
      if (isManual) {
        if (hasError) showToast("部份股價更新失敗 (可能是休市或網絡問題)", "error");
        else showToast("股價更新完成", "success");
      }
    } catch (e) {
      console.error(e);
      if (isManual) showToast("更新失敗", "error");
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  /* --- Calculation Logic --- */
  const calculatedData = useMemo(() => {
    const catsCopy = JSON.parse(JSON.stringify(portfolio.categories)) as typeof portfolio.categories;
    const rateUS = portfolio.settings.usExchangeRate;
    let totalInvested = 0;
    let totalMarketValue = 0;
    let totalRealizedPnL = 0;

    // Reset categories for recalculation
    const calculatedCats: CalculatedCategory[] = catsCopy.map(cat => {
      // Find Category-specific PnL (Realized) from Transactions
      const catRealizedPnL = portfolio.transactions
        .filter(t => t.categoryName === cat.name && (t.type === 'SELL' || t.type === 'DIVIDEND') && t.realizedPnL !== undefined && t.isMartingale !== true)
        .reduce((sum, t) => sum + (t.realizedPnL || 0), 0);

      totalRealizedPnL += catRealizedPnL;

      const projectedInvestment = Math.floor(portfolio.totalCapital * (cat.allocationPercent / 100));

      return {
        ...cat,
        projectedInvestment,
        investedAmount: 0,
        remainingCash: 0,
        investmentRatio: 0,
        realizedPnL: catRealizedPnL,
        assets: [] as CalculatedAsset[]
      };
    });

    // Asset Calculations
    calculatedCats.forEach((cat, idx) => {
      const originalAssets = portfolio.categories[idx].assets;
      const exchangeRate = cat.market === 'US' ? rateUS : 1;

      originalAssets.forEach(asset => {
        const costBasis = asset.shares * asset.avgCost * exchangeRate;
        const marketValue = asset.shares * asset.currentPrice * exchangeRate;
        const unrealizedPnL = marketValue - costBasis;
        const returnRate = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

        // Invested Amount Tracking
        cat.investedAmount += costBasis;
        totalInvested += costBasis;
        totalMarketValue += marketValue;

        // Push calculated asset
        const calcAsset: CalculatedAsset = {
          ...asset,
          costBasis,
          marketValue,
          unrealizedPnL,
          returnRate,
          portfolioRatio: 0,
          realizedPnL: 0
        };
        (cat as any).assets.push(calcAsset);
      });

      // Calculate ratios after processing all assets in category
      cat.remainingCash = cat.projectedInvestment - cat.investedAmount;
      cat.investmentRatio = cat.projectedInvestment > 0 ? (cat.investedAmount / cat.projectedInvestment) * 100 : 0;

      // Calculate asset portfolio ratios
      (cat as any).assets.forEach((a: CalculatedAsset) => {
        a.portfolioRatio = cat.projectedInvestment > 0 ? (a.costBasis / cat.projectedInvestment) * 100 : 0;
      });
    });

    const totalUnrealizedPnL = totalMarketValue - totalInvested;

    // --- Martingale Calculation (Array) ---
    const martingaleCats = Array.isArray(portfolio.martingale) ? portfolio.martingale : [];
    let martTotalInvested = 0;

    const calcMartingaleCategories: CalculatedCategory[] = martingaleCats.map(cat => {
      const marketRate = cat.market === 'US' ? rateUS : 1;
      const projected = portfolio.totalCapital > 0 ? Math.floor(portfolio.totalCapital * (cat.allocationPercent / 100)) : 0; // Or independent capital? User said separate. Let's assume % of total capital for now as per Overview. 
      // Actually, if it's "Teacher's Portfolio", maybe it shouldn't use User's Capital?
      // But for "Compare", applying Teacher's % to User's Capital makes sense. 

      let catInvested = 0;
      const calcAssets: CalculatedAsset[] = cat.assets.map(asset => {
        const costBasis = asset.shares * asset.avgCost * marketRate;
        const marketValue = asset.shares * asset.currentPrice * marketRate;
        const unrealizedPnL = marketValue - costBasis;
        const returnRate = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

        catInvested += costBasis;
        martTotalInvested += costBasis;

        return {
          ...asset,
          costBasis,
          marketValue,
          unrealizedPnL,
          returnRate,
          portfolioRatio: 0, // Recalc below
          realizedPnL: 0
        };
      });

      // Asset Ratios within Category
      calcAssets.forEach(a => {
        a.portfolioRatio = projected > 0 ? (a.costBasis / projected) * 100 : 0;
      });

      // Dynamic Realized PnL from Transactions (using same filter logic as chart)
      const catRealizedPnL = portfolio.transactions
        .filter(t => {
          if (t.categoryName !== cat.name) return false;
          if (t.type !== 'SELL' && t.type !== 'DIVIDEND') return false;

          // 1. Explicit Flag Preference
          if (t.isMartingale === true) return true;
          if (t.isMartingale === false) return false;

          // 2. Legacy Fallback
          if (t.portfolioRatio && t.portfolioRatio > 0) return false;
          return true;
        })
        .reduce((sum, t) => sum + (t.realizedPnL || 0), 0);

      return {
        ...cat,
        assets: calcAssets,
        projectedInvestment: projected,
        investedAmount: catInvested,
        remainingCash: projected - catInvested,
        investmentRatio: projected > 0 ? (catInvested / projected) * 100 : 0,
        realizedPnL: catRealizedPnL
      };
    });

    // Industry Analysis Data
    const industryData = calculateIndustryAnalysis(portfolio.categories, rateUS);

    // Monthly PnL Data
    // Group realized PnL by month (from transactions)
    const monthlyPnLMap = new Map<string, number>();
    portfolio.transactions.forEach(t => {
      if ((t.type === 'SELL' || t.type === 'DIVIDEND') && t.realizedPnL) {
        const date = new Date(t.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyPnLMap.set(key, (monthlyPnLMap.get(key) || 0) + t.realizedPnL);
      }
    });

    // Convert map to array and sort
    const monthlyPnLData = Array.from(monthlyPnLMap.entries())
      .map(([date, pnl]) => ({ month: date, value: pnl }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      categories: calculatedCats,
      totalInvested,
      totalMarketValue,
      totalUnrealizedPnL,
      totalRealizedPnL,
      industryData,
      monthlyPnLData,
      martingale: calcMartingaleCategories,
      martingaleIndustryData: calculateIndustryAnalysis(calcMartingaleCategories, rateUS)
    };

  }, [portfolio, portfolio.settings.usExchangeRate]);

  // Derived Totals
  const totalNetWorth = portfolio.totalCapital + calculatedData.totalUnrealizedPnL + calculatedData.totalRealizedPnL;
  const unrealizedRatio = portfolio.totalCapital > 0 ? (calculatedData.totalUnrealizedPnL / portfolio.totalCapital) * 100 : 0;
  const investedRatio = portfolio.totalCapital > 0 ? (calculatedData.totalInvested / portfolio.totalCapital) * 100 : 0;

  useEffect(() => {
    if (user && isDataLoaded) {
      const saveTimer = setTimeout(() => savePortfolioToCloud(user.uid, portfolio), 2000);
      return () => clearTimeout(saveTimer);
    }
  }, [portfolio, user, isDataLoaded]);

  // --- Martingale Sync Logic ---
  // 1. Admin: Auto-upload when martingale changes (Debounced)
  useEffect(() => {
    // Debug Log
    // console.log(`[Sync Check] Role: ${userRole}, DataLoaded: ${isDataLoaded}, MartingaleCount: ${portfolio.martingale?.length}`);

    if (userRole === 'admin' && portfolio.martingale && isDataLoaded) {
      console.log("[Sync] Admin detected, scheduling public update...");
      const timer = setTimeout(() => {
        console.log("[Sync] Executing updatePublicMartingale...");
        // Pass both categories and transactions (filtered for martingale inside service, but we pass all or filtered? Service filters.)
        updatePublicMartingale(portfolio.martingale as any, portfolio.transactions);
      }, 3000); // 3s debounce
      return () => clearTimeout(timer);
    }
  }, [portfolio.martingale, userRole, isDataLoaded]);

  // 2. Member: Auto-subscribe to changes
  useEffect(() => {
    let unsubscribe = () => { };
    const userTier = getTier(userRole);
    const hasAccess = userTier >= AccessTier.STANDARD;

    // ONLY non-admin members should subscribe. 
    // Admins manage the data locally and upload it; they don't need to listen to their own updates
    // which causes a "rollback" race condition when they edit Martingale categories/transactions.
    if (hasAccess) {
      if (userRole !== 'admin') {
        console.log("[Sync] Authorized member detected, subscribing to public martingale...");
        unsubscribe = subscribeToPublicMartingale((publicData) => {
          if (publicData) {
            const dataSig = `${publicData.categories.length}-${publicData.transactions.length}`;
            const isInitialLoad = !lastMartingaleDataRef.current;

            console.log("[Sync] Received Public Update. Sig:", dataSig);

            setPortfolio(prev => {
              const personalTxs = prev.transactions.filter(t => t.isMartingale !== true);
              const newMartingaleTxs = publicData.transactions.map(t => ({ ...t, isMartingale: true }));

              return {
                ...prev,
                martingale: publicData.categories,
                transactions: [...personalTxs, ...newMartingaleTxs]
              };
            });

            // Only show toast if data actually changed or it's the first load
            if (lastMartingaleDataRef.current !== dataSig) {
              lastMartingaleDataRef.current = dataSig;
              if (!isInitialLoad) {
                showToast(`策略同步完成：${publicData.categories.length} 個分類`, "success");
              }
            }
          } else {
            console.log("[Sync] Received null public data");
          }
        });
      }
    } else {
      // CLEAR Martingale data if user is NOT authorized (e.g. downgraded to viewer)
      if (isDataLoaded && (portfolio.martingale?.length > 0 || portfolio.transactions.some(t => t.isMartingale))) {
        console.log("[Sync] Unauthorized user, clearing martingale data...");
        setPortfolio(prev => ({
          ...prev,
          martingale: [],
          transactions: prev.transactions.filter(t => t.isMartingale !== true)
        }));
      }
    }
    return () => unsubscribe();
  }, [userRole, isDataLoaded]);

  // --- Handlers (Transaction, Order, etc.) ---
  // (Assuming these handleXXX exist in original code, I am preserving structure)
  // Re-implementing simplified versions if they were cut off in context or merging with existing.
  // Since I am replacing the top half, I need to make sure I don't break the bottom half references.
  // The 'handleUpdatePrices' was defined above.

  // Need to forward references to handlers that are used in JSX below but defined in the middle/bottom of file?
  // Actually, I replaced the top chunk including App component definition.
  // I need to ensure I don't lose the render part.

  // Wait, I see I am replacing lines 58-928. This covers ALMOST EVERYTHING including JSX.
  // I must be careful.
  // I see 'handleExecuteOrder', 'handleRevokeTransaction' etc are likely defined in the omitted part of file content view?
  // I only viewed up to line 300 and then 700+. I missed the middle!
  // I CANNOT replace 58-928 blindly. The middle part contains 'handleExecuteOrder', 'handleRevokeTransaction' etc.

  // I will ABORT this big replace.
  // I will do targeted replaces.





  const handleRefreshCategory = async (categoryId: string) => {
    if (isUpdatingPrices) return;
    const category = portfolio.categories.find(c => c.id === categoryId);
    if (!category || category.assets.length === 0) return;
    setIsUpdatingPrices(true);
    try {
      const assetsToUpdate = category.assets.map(a => ({ symbol: a.symbol, market: category.market as 'TW' | 'US' }));
      const priceMap = await stockService.getPrices(assetsToUpdate);
      const newState = {
        ...portfolio,
        categories: portfolio.categories.map(cat =>
          cat.id === categoryId
            ? { ...cat, assets: cat.assets.map(asset => ({ ...asset, currentPrice: priceMap[asset.symbol] || asset.currentPrice })) }
            : cat
        )
      };
      saveAndSetPortfolio(newState);
      showToast(`${category.name} 股價更新完成`, 'success');
      fetchStockNews();
    } catch (e) { showToast("更新失敗", 'error'); } finally { setIsUpdatingPrices(false); }
  };

  const handleUpdateAssetPrice = async (assetId: string, symbol: string, market: string) => {
    try {
      const price = await stockService.getPrice(symbol, market as any);
      if (price !== null) {
        const newState = {
          ...portfolio,
          categories: portfolio.categories.map(cat => ({
            ...cat,
            assets: cat.assets.map(asset => asset.id === assetId ? { ...asset, currentPrice: price } : asset)
          }))
        };
        saveAndSetPortfolio(newState);
      }
    } catch (e) { console.error(e); }
  };

  const handleExecuteOrder = (order: OrderData) => {
    try {
      console.log('Execute Order Processing:', order);
      const txId = uuidv4();
      const lotId = order.action === 'BUY' ? uuidv4() : undefined;
      const currentCategory = portfolio.categories.find(c => c.id === activeCategoryId);

      if (!currentCategory) {
        console.error('Order Failed: activeCategoryId is null or invalid', activeCategoryId);
        showToast("錯誤：找不到當前分類", "error");
        return;
      }

      // 計算預算，用於計算交易比例
      const projectedInvestment = Math.floor(portfolio.totalCapital * (currentCategory.allocationPercent / 100));

      const dateToSave = order.transactionDate
        ? new Date(order.transactionDate).toISOString()
        : new Date().toISOString();

      const newTx: TransactionRecord = {
        id: txId,
        date: dateToSave,
        assetId: order.assetId || uuidv4(),
        lotId: lotId,
        symbol: order.symbol,
        name: order.name,
        type: order.action as any,
        shares: order.shares,
        price: order.price,
        exchangeRate: order.exchangeRate,
        amount: order.totalAmount, // Restored
        fee: order.fee,
        tax: order.tax,
        categoryName: currentCategory.name,
        realizedPnL: 0,
        portfolioRatio: 0,
        isMartingale: false // Explicitly Personal
      };

      const nextCategories = portfolio.categories.map(cat => {
        if (cat.id !== activeCategoryId) return cat;
        let nextAssets = [...cat.assets];
        const assetIdx = nextAssets.findIndex(a => a.symbol === order.symbol);

        if (order.action === 'BUY') {
          const newLot: AssetLot = { id: lotId!, date: newTx.date, shares: order.shares, costPerShare: order.price, exchangeRate: order.exchangeRate };
          if (assetIdx > -1) {
            const asset = nextAssets[assetIdx];
            const updatedLots = [...asset.lots, newLot];
            const totalShares = asset.shares + order.shares;
            const totalOriginalCost = updatedLots.reduce((s, l) => s + (l.shares * l.costPerShare), 0);
            nextAssets[assetIdx] = { ...asset, shares: totalShares, avgCost: totalOriginalCost / totalShares, lots: updatedLots, currentPrice: order.price };
          } else {
            nextAssets.push({ id: newTx.assetId, symbol: order.symbol, name: order.name, shares: order.shares, avgCost: order.price, currentPrice: order.price, lots: [newLot] });
          }
          newTx.portfolioRatio = projectedInvestment > 0 ? (order.totalAmount / projectedInvestment) * 100 : 0;
        } else if (order.action === 'SELL') {
          if (assetIdx === -1) return cat;
          const asset = nextAssets[assetIdx];
          let remainingToSell = order.shares;
          let totalCostOfSoldSharesTWD = 0;
          let updatedLots = [...asset.lots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const processedLots = [];

          for (const lot of updatedLots) {
            if (remainingToSell <= 0) { processedLots.push(lot); continue; }
            if (lot.shares <= remainingToSell) {
              totalCostOfSoldSharesTWD += lot.shares * lot.costPerShare * lot.exchangeRate;
              remainingToSell -= lot.shares;
            } else {
              totalCostOfSoldSharesTWD += remainingToSell * lot.costPerShare * lot.exchangeRate;
              processedLots.push({ ...lot, shares: lot.shares - remainingToSell });
              remainingToSell = 0;
            }
          }

          const realizedPnL = order.totalAmount - totalCostOfSoldSharesTWD - order.fee - order.tax;
          newTx.realizedPnL = realizedPnL;
          newTx.originalCostTWD = totalCostOfSoldSharesTWD;

          newTx.portfolioRatio = projectedInvestment > 0 ? (totalCostOfSoldSharesTWD / projectedInvestment) * 100 : 0;

          const totalShares = asset.shares - order.shares;
          if (totalShares <= 0) { nextAssets = nextAssets.filter(a => a.symbol !== order.symbol); }
          else {
            const totalOriginalCostRemaining = processedLots.reduce((s, l) => s + (l.shares * l.costPerShare), 0);
            nextAssets[assetIdx] = { ...asset, shares: totalShares, lots: processedLots, avgCost: totalOriginalCostRemaining / totalShares, currentPrice: order.price };
          }
        }
        return { ...cat, assets: nextAssets };
      });

      saveAndSetPortfolio({ ...portfolio, categories: nextCategories, transactions: [newTx, ...portfolio.transactions] });
      showToast(order.action === 'BUY' ? "買入成功" : "賣出成功", "success");
      fetchStockNews();
    } catch (error) {
      console.error('handleExecuteOrder Failed:', error);
      alert(`下單失敗：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleRepairPortfolio = () => {
    try {
      showToast("正在修復資料...", "info");

      // 1. Reset categories assets
      let tempCategories = portfolio.categories.map(cat => ({
        ...cat,
        assets: [] as Asset[]
      }));

      // 2. Sort transactions chronologically
      const sortedTxs = [...portfolio.transactions].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // 3. Replay BUY/SELL transactions
      for (const tx of sortedTxs) {
        if (tx.type !== 'BUY' && tx.type !== 'SELL') continue;

        const catIdx = tempCategories.findIndex(c => c.name === tx.categoryName);
        if (catIdx === -1) continue;

        const cat = tempCategories[catIdx];
        let nextAssets = [...cat.assets];
        const assetIdx = nextAssets.findIndex(a => a.symbol === tx.symbol);

        if (tx.type === 'BUY') {
          const newLot: AssetLot = {
            id: tx.lotId || uuidv4(),
            date: tx.date,
            shares: tx.shares,
            costPerShare: tx.price,
            exchangeRate: tx.exchangeRate
          };

          if (assetIdx > -1) {
            const asset = nextAssets[assetIdx];
            const updatedLots = [...(asset.lots || []), newLot];
            const totalShares = asset.shares + tx.shares;
            const totalOriginalCost = updatedLots.reduce((s, l) => s + (l.shares * l.costPerShare), 0);
            nextAssets[assetIdx] = { ...asset, shares: totalShares, avgCost: totalOriginalCost / totalShares, lots: updatedLots };
          } else {
            nextAssets.push({
              id: tx.assetId,
              symbol: tx.symbol,
              name: tx.name,
              shares: tx.shares,
              avgCost: tx.price,
              currentPrice: tx.price,
              lots: [newLot]
            });
          }
        } else if (tx.type === 'SELL') {
          if (assetIdx === -1) continue;
          const asset = nextAssets[assetIdx];
          let remainingToSell = tx.shares;
          let updatedLots = [...(asset.lots || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const processedLots = [];

          for (const lot of updatedLots) {
            if (remainingToSell <= 0) { processedLots.push(lot); continue; }
            if (lot.shares <= remainingToSell) {
              remainingToSell -= lot.shares;
            } else {
              processedLots.push({ ...lot, shares: lot.shares - remainingToSell });
              remainingToSell = 0;
            }
          }

          const totalShares = asset.shares - tx.shares;
          if (totalShares <= 0) {
            nextAssets = nextAssets.filter(a => a.symbol !== tx.symbol);
          } else {
            const totalOriginalCostRemaining = processedLots.reduce((s, l) => s + (l.shares * l.costPerShare), 0);
            nextAssets[assetIdx] = {
              ...asset,
              shares: totalShares,
              lots: processedLots,
              avgCost: totalOriginalCostRemaining / totalShares
            };
          }
        }
        tempCategories[catIdx] = { ...cat, assets: nextAssets };
      }

      saveAndSetPortfolio({ ...portfolio, categories: tempCategories });
      showToast("資料修復完成！持股已從歷史紀錄重建。", "success");
    } catch (error) {
      console.error('handleRepairPortfolio Failed:', error);
      showToast("修復失敗：" + (error instanceof Error ? error.message : "未知錯誤"), "error");
    }
  };

  // Refactored Revoke Logic to support both Personal and Martingale categories
  const handleRevokeTransaction = (txId: string) => {
    const tx = portfolio.transactions.find(t => t.id === txId);
    if (!tx) return;

    // Helper to revert state within a list of categories
    const revertInCategories = (categories: any[]) => {
      return categories.map(cat => {
        if (cat.name !== tx.categoryName) return cat;

        let nextAssets = [...cat.assets];
        const assetIdx = nextAssets.findIndex(a => a.symbol === tx.symbol);

        if (tx.type === 'BUY') {
          if (assetIdx === -1) return cat; // Asset deleted, can't revert shares, but allowed to remove record.
          const asset = nextAssets[assetIdx];
          let nextLots = asset.lots.filter(l => l.id !== tx.lotId);
          if (nextLots.length === asset.lots.length) {
            nextLots = [...asset.lots].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(1);
          }

          const totalShares = asset.shares - tx.shares;
          if (totalShares <= 0) {
            nextAssets = nextAssets.filter(a => a.symbol !== tx.symbol);
          } else {
            const totalOriginalCost = nextLots.reduce((s, l) => s + (l.shares * l.costPerShare), 0);
            nextAssets[assetIdx] = { ...asset, shares: totalShares, lots: nextLots, avgCost: totalOriginalCost / totalShares };
          }
        }
        else if (tx.type === 'SELL') {
          // 精準還原：利用 originalCostTWD 計算出還原後的原始幣別成本
          const originalCostTWD = tx.originalCostTWD || (tx.shares * tx.price * tx.exchangeRate);
          const restoredCostPerShare = (originalCostTWD / tx.shares) / tx.exchangeRate;

          const restoredLot: AssetLot = {
            id: uuidv4(),
            date: tx.date,
            shares: tx.shares,
            costPerShare: restoredCostPerShare,
            exchangeRate: tx.exchangeRate
          };

          if (assetIdx > -1) {
            const asset = nextAssets[assetIdx];
            const updatedLots = [restoredLot, ...asset.lots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const totalShares = asset.shares + tx.shares;
            const totalOriginalCost = updatedLots.reduce((s, l) => s + (l.shares * l.costPerShare), 0);
            nextAssets[assetIdx] = { ...asset, shares: totalShares, lots: updatedLots, avgCost: totalOriginalCost / totalShares };
          } else {
            nextAssets.push({ id: tx.assetId, symbol: tx.symbol, name: tx.name, shares: tx.shares, avgCost: restoredCostPerShare, currentPrice: tx.price, lots: [restoredLot] });
          }
        }
        return { ...cat, assets: nextAssets };
      });
    };

    const nextTransactions = portfolio.transactions.filter(t => t.id !== txId);

    // Apply revert logic to BOTH Personal and Martingale lists
    const nextCategories = revertInCategories(portfolio.categories);
    const nextMartingale = Array.isArray(portfolio.martingale) ? revertInCategories(portfolio.martingale) : portfolio.martingale;

    saveAndSetPortfolio({
      ...portfolio,
      categories: nextCategories,
      martingale: nextMartingale,
      transactions: nextTransactions
    });
    showToast("交易已撤銷", "info");
    fetchStockNews();
  };



  const handleUpdateAllocation = (id: string, percent: number) => { saveAndSetPortfolio({ ...portfolio, categories: portfolio.categories.map(c => c.id === id ? { ...c, allocationPercent: percent } : c) }); };
  const handleUpdateSettings = (s: AppSettings) => { saveAndSetPortfolio({ ...portfolio, settings: s }); showToast("設定已儲存", 'success'); };

  const [dividendScanTarget, setDividendScanTarget] = useState<'my' | 'martingale'>('my');

  /* Automatic Dividend Scanning Logic */
  const handleManualAddDividend = (target: 'my' | 'martingale') => {
    setDividendScanTarget(target);
    setScannedDividends([]);
    setShowDividendModal(true);
  };

  const handleScanDividends = async (target: 'my' | 'martingale') => {
    if (isScanningDividends) return;
    setDividendScanTarget(target);
    showToast(`開始掃描${target === 'my' ? '個人' : '馬丁'}股息...`, "info");
    setIsScanningDividends(true);

    // 1. Identify distinct assets and their 'earliest buy date'
    const assetMap = new Map<string, { symbol: string, market: MarketType, name: string, categoryName: string, earliestBuy: number }>();

    const targetCategories = target === 'my'
      ? portfolio.categories
      : (Array.isArray(portfolio.martingale) ? portfolio.martingale : []);

    targetCategories.forEach(cat => {
      cat.assets.forEach(asset => {
        // Find earliest buy date for this asset from transaction history
        // Filter by target context
        const txs = portfolio.transactions.filter(t =>
          t.symbol === asset.symbol &&
          t.type === 'BUY' &&
          (target === 'my' ? t.isMartingale !== true : t.isMartingale === true)
        );

        if (txs.length === 0) return;

        const earliest = Math.min(...txs.map(t => new Date(t.date).getTime()));

        if (!assetMap.has(asset.symbol)) {
          assetMap.set(asset.symbol, {
            symbol: asset.symbol,
            market: cat.market as MarketType,
            name: asset.name,
            categoryName: cat.name,
            earliestBuy: earliest
          });
        }
      });
    });

    // OPEN MODAL IMMEDIATELY
    // If no assets, we still show the modal (empty).
    setScannedDividends([]);
    setShowDividendModal(true);

    if (assetMap.size === 0) {
      showToast("目前沒有持倉可供掃描", "info");
      setIsScanningDividends(false);
      return;
    }

    const suggestions: ScannedDividend[] = [];
    let processingCount = 0;

    try {
      // 2. Fetch Dividends for each asset
      for (const [symbol, info] of assetMap.entries()) {
        processingCount++;
        // Fetch dividends from earliest buy date
        const dividends = await stockService.getStockDividends(symbol, info.market, new Date(info.earliestBuy).toISOString());

        for (const div of dividends) {
          const exDate = new Date(div.date);
          const exDateStr = div.date; // ISO String

          // Deduplicate: Check if already exists in transaction history
          // Must match context (Personal vs Martingale)
          const exists = portfolio.transactions.some(t =>
            t.type === 'DIVIDEND' &&
            t.symbol === symbol &&
            new Date(t.date).toDateString() === exDate.toDateString() &&
            (target === 'my' ? t.isMartingale !== true : t.isMartingale === true)
          );

          if (exists) continue;

          // 3. Calculate Shares Held on Ex-Date
          // Only count shares belonging to the target context
          let sharesOnExDate = 0;
          const relevantTxs = portfolio.transactions
            .filter(t =>
              t.symbol === symbol &&
              new Date(t.date).getTime() < exDate.getTime() &&
              (target === 'my' ? t.isMartingale !== true : t.isMartingale === true)
            )
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          for (const tx of relevantTxs) {
            if (tx.type === 'BUY') sharesOnExDate += tx.shares;
            if (tx.type === 'SELL') sharesOnExDate -= tx.shares;
          }

          if (sharesOnExDate > 0) {
            suggestions.push({
              id: uuidv4(),
              assetId: targetCategories.flatMap(c => c.assets).find(a => a.symbol === symbol)?.id || uuidv4(),
              symbol: symbol,
              name: info.name,
              exDate: exDateStr,
              rate: div.rate,
              shares: sharesOnExDate,
              taxRate: info.market === 'US' ? 0.3 : 0, // Default tax rates
              categoryName: info.categoryName,
              market: info.market,
            });
          }
        }
      }

      setScannedDividends(suggestions);
      setShowDividendModal(true); // Always open modal
      if (suggestions.length > 0) {
        showToast(`掃描完成，發現 ${suggestions.length} 筆新配息`, "success");
      } else {
        showToast("掃描完成，暫無新配息紀錄", "info");
      }

    } catch (e) {
      console.error("Scan failed", e);
      showToast("掃描過程發生錯誤，請稍後再試", "error");
    } finally {
      setIsScanningDividends(false);
    }
  };

  /* Helper to check shares anytime (used by Manual Add in Modal) */
  const handleCheckShares = (assetId: string, dateStr: string) => {
    const targetDate = new Date(dateStr).getTime();
    // Use current scan target to find symbol
    // Search in correct category set
    const cats = dividendScanTarget === 'my'
      ? portfolio.categories
      : (Array.isArray(portfolio.martingale) ? portfolio.martingale : []);

    let symbol = '';
    for (const c of cats) {
      const a = c.assets.find(aa => aa.id === assetId);
      if (a) { symbol = a.symbol; break; }
    }
    if (!symbol) return 0;

    let shares = 0;
    const relevantTxs = portfolio.transactions
      .filter(t =>
        t.symbol === symbol &&
        new Date(t.date).getTime() < targetDate &&
        (dividendScanTarget === 'my' ? t.isMartingale !== true : t.isMartingale === true)
      );

    for (const tx of relevantTxs) {
      if (tx.type === 'BUY') shares += tx.shares;
      if (tx.type === 'SELL') shares -= tx.shares;
    }
    return shares;
  };

  const handleConfirmDividends = (dividends: ScannedDividend[]) => {
    if (dividends.length === 0) return;

    const newTransactions: TransactionRecord[] = dividends.map(d => {
      const grossAmount = d.shares * d.rate;
      const taxAmount = grossAmount * d.taxRate;
      const realizedPnL = grossAmount - taxAmount;

      return {
        id: uuidv4(),
        date: d.exDate,
        assetId: d.assetId,
        lotId: undefined,
        symbol: d.symbol,
        name: d.name,
        type: 'DIVIDEND',
        shares: d.shares,
        price: d.rate,
        exchangeRate: d.market === 'US' ? portfolio.settings.usExchangeRate : 1,
        amount: grossAmount,
        fee: 0,
        tax: taxAmount,
        categoryName: d.categoryName,
        realizedPnL: realizedPnL,
        portfolioRatio: 0,
        isMartingale: dividendScanTarget === 'martingale' // Explicitly set based on current target
      };
    });

    const newState = {
      ...portfolio,
      transactions: [...newTransactions, ...portfolio.transactions]
    };
    saveAndSetPortfolio(newState);
    showToast(`成功入帳 ${dividends.length} 筆配息`, 'success');
    fetchStockNews();
  };

  const handleResetDividends = (target: 'my' | 'martingale') => {
    const targetName = target === 'my' ? '個人' : '馬丁';
    if (!window.confirm(`確定要清空所有的「${targetName}」股息紀錄嗎？\n\n注意：\n1. 所有相關的股息收入將被移除。\n2. 資產的已實現損益將會減少。\n\n此操作無法復原！`)) {
      return;
    }

    const martNames = (Array.isArray(portfolio.martingale) ? portfolio.martingale : []).map(c => c.name);

    const newTransactions = portfolio.transactions.filter(t => {
      if (t.type !== 'DIVIDEND') return true; // Keep non-dividends

      // 1. Explicit Flag Preference
      if (t.isMartingale === true) {
        return target !== 'martingale'; // If target is mart, remove. If target is my, keep.
      }
      if (t.isMartingale === false) {
        return target !== 'my'; // If target is my, remove. If target is mart, keep.
      }

      // 2. Legacy/Fallback Naming Logic (Only for undefined isMartingale)
      const isMartName = martNames.includes(t.categoryName);
      if (target === 'martingale' && isMartName) return false;
      if (target === 'my' && !isMartName) return false;

      return true; // Keep others
    });

    saveAndSetPortfolio({ ...portfolio, transactions: newTransactions });
    showToast(`已清空${targetName}股息紀錄`, "success");
  };

  // --- Martingale Handlers (Array Support) ---
  const handleMartingaleExecuteOrder = (order: OrderData) => {
    // We need to know which Martingale Category this order belongs to. 
    // OrderData doesn't have categoryId usually? 
    // Wait, DetailTable passes `category` prop but internal Grid items don't know it?
    // Oh, `OrderModal` returns `OrderData`. 
    // We need to find which category contains this asset, OR pass categoryId.
    // For "Add Asset", we need a selected Category.
    // If MartingalePanel renders SummaryTable, user selects a Category -> DetailTable. 
    // So `activeCategoryId` (Martingale version) should be used.
    // Let's assume we implement `activeMartingaleId` state. 
    // BUT, for now, I will scan all Martingale categories to find the asset, OR use a simple heuristic if adding new.
    // Better: Allow `MartingalePanel` to handle the logic and call `savePortfolio`.
    // But centralized logic is here.

    // Implementing `handleMartingaleExecuteOrderWithCat`... 
    // Actually, I'll update the signature here and update MartingalePanel to call it with the extra arg.
  };

  const handleMartingaleUpdateAllocation = (id: string, percent: number) => {
    if (!Array.isArray(portfolio.martingale)) return;
    const newMart = portfolio.martingale.map(c => c.id === id ? { ...c, allocationPercent: percent } : c);
    saveAndSetPortfolio({ ...portfolio, martingale: newMart });
  };

  const handleAddMartingaleCategory = (name: string, market: 'TW' | 'US', allocation: number) => {
    const cats = Array.isArray(portfolio.martingale) ? portfolio.martingale : [];
    const newCat: PositionCategory = {
      id: uuidv4(),
      name: name.trim(),
      market: market,
      allocationPercent: allocation,
      assets: []
    };
    saveAndSetPortfolio({ ...portfolio, martingale: [...cats, newCat] });
    showToast("新增策略成功", "success");
  };

  // Handlers will be passed to MartingalePanel. 

  const handleMartingaleRefreshCategory = async (catId: string) => {
    if (isUpdatingPrices) return;
    setIsUpdatingPrices(true);
    try {
      const cats = Array.isArray(portfolio.martingale) ? portfolio.martingale : [];
      const cat = cats.find(c => c.id === catId);
      if (!cat) return;

      const assets = cat.assets.map(a => ({ symbol: a.symbol, market: cat.market as MarketType }));
      const priceMap = await stockService.getPrices(assets);

      const newCats = cats.map(c => c.id === catId ? {
        ...c,
        assets: c.assets.map(a => ({ ...a, currentPrice: priceMap[a.symbol] || a.currentPrice }))
      } : c);

      saveAndSetPortfolio({ ...portfolio, martingale: newCats });
      showToast("馬丁倉位更新完成", "success");
    } catch (e) { showToast("更新失敗", "error"); } finally { setIsUpdatingPrices(false); }
  };

  const handleMartingaleOperations = {
    onExecuteOrder: (categoryId: string, order: OrderData) => {
      const cats = Array.isArray(portfolio.martingale) ? [...portfolio.martingale] : [];
      const catIdx = cats.findIndex(c => c.id === categoryId);
      if (catIdx === -1) return;

      const cat = cats[catIdx];
      const txId = uuidv4();
      const lotId = order.action === 'BUY' ? uuidv4() : undefined;
      const dateToSave = order.transactionDate ? new Date(order.transactionDate).toISOString() : new Date().toISOString();

      // Transaction Record
      const newTransaction: TransactionRecord = {
        id: txId,
        date: dateToSave,
        assetId: order.assetId || uuidv4(), // If BUY new, ID might be generated inside nextAssets push. This is tricky. 
        // Logic below generates assetId if new. We should sync them.
        // For simplicity, let's assume if it's new asset, we generate ID here.
        // But the asset pushing logic below does `order.assetId || uuidv4()`.
        // Let's ensure new asset ID is consistent.

        lotId: lotId,
        symbol: order.symbol,
        name: order.name,
        type: order.action,
        shares: order.shares,
        price: order.price,
        exchangeRate: order.exchangeRate,
        amount: order.price * order.shares * order.exchangeRate,
        fee: 0, // Simplified for now
        tax: 0, // Simplified
        categoryName: cat.name,
        realizedPnL: 0,
        portfolioRatio: 0,
        isMartingale: true // Explicitly Martingale
      };

      // Calculate Portfolio Ratio (Add/Reduce %)
      // Formula: (Transaction Amount / Category Projected Investment) * 100
      // Projected Investment = Admin Total Capital * (Category Allocation / 100)
      const projectedInvestment = Math.floor(portfolio.totalCapital * (cat.allocationPercent / 100));
      if (projectedInvestment > 0) {
        // Use order.totalAmount if available, otherwise calculate
        const amountTWD = order.totalAmount || (order.price * order.shares * order.exchangeRate); // Fallback if totalAmount missing
        newTransaction.portfolioRatio = (amountTWD / projectedInvestment) * 100;
      }

      let nextAssets = [...cat.assets];
      const assetIdx = nextAssets.findIndex(a => a.symbol === order.symbol);

      // Calculate PnL if SELL
      if (order.action === 'SELL') {
        if (assetIdx > -1) {
          const asset = nextAssets[assetIdx];
          // Simple FIFO PnL approximation for record
          // Precise PnL requires the exact lots used, calculated below.
          // We'll defer pushing transaction until after we calculate PnL below.
        }
      }

      // ... (Insert Buy/Sell Logic reused or duplicated) ...
      // Duplicating for safety and speed.
      if (order.action === 'BUY') {
        const newLot: AssetLot = { id: lotId!, date: dateToSave, shares: order.shares, costPerShare: order.price, exchangeRate: order.exchangeRate };

        // Ensure asset ID consistency if new
        const finalAssetId = assetIdx > -1 ? nextAssets[assetIdx].id : (order.assetId || uuidv4());
        newTransaction.assetId = finalAssetId;

        if (assetIdx > -1) {
          const asset = nextAssets[assetIdx];
          const updatedLots = [...asset.lots, newLot];
          const totalShares = asset.shares + order.shares;
          const totalCost = updatedLots.reduce((s, l) => s + l.shares * l.costPerShare, 0);
          nextAssets[assetIdx] = { ...asset, shares: totalShares, avgCost: totalCost / totalShares, lots: updatedLots, currentPrice: order.price };
        } else {
          nextAssets.push({ id: finalAssetId, symbol: order.symbol, name: order.name, shares: order.shares, avgCost: order.price, currentPrice: order.price, lots: [newLot] });
        }
      } else if (order.action === 'SELL') {
        if (assetIdx === -1) return;
        const asset = nextAssets[assetIdx];
        newTransaction.assetId = asset.id;

        // FIFO Logic
        let remaining = order.shares;
        let lots = [...asset.lots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const keptLots = [];
        let realizedPnL = 0;
        let costBasisSold = 0;

        for (const l of lots) {
          if (remaining <= 0) { keptLots.push(l); continue; }

          const sharesSold = Math.min(l.shares, remaining);

          // Cost of these shares
          const cost = sharesSold * l.costPerShare * l.exchangeRate; // Base currency cost? 
          // Wait, costPerShare is usually Original Currency? Yes.
          // types.ts: costPerShare: number; // For US, this is in USD
          // exchangeRate: number; // FX rate at time of purchase

          // So Cost Basis (TWD) = sharesSold * costPerShare * exchangeRate
          const costBasisTWD = sharesSold * l.costPerShare * l.exchangeRate;

          // Proceeds (TWD) = sharesSold * sellPrice * sellExchangeRate
          const proceedsTWD = sharesSold * order.price * order.exchangeRate;

          realizedPnL += (proceedsTWD - costBasisTWD);
          costBasisSold += costBasisTWD;

          if (l.shares <= remaining) {
            remaining -= l.shares;
          } else {
            keptLots.push({ ...l, shares: l.shares - remaining });
            remaining = 0;
          }
        }

        newTransaction.realizedPnL = realizedPnL;
        // Optional: newTransaction.originalCostTWD = costBasisSold;

        // Recalculate Ratio for SELL based on COST BASIS (not proceeds), matching Personal logic
        const projectedInvestment = Math.floor(portfolio.totalCapital * (cat.allocationPercent / 100));
        if (projectedInvestment > 0) {
          newTransaction.portfolioRatio = (costBasisSold / projectedInvestment) * 100;
        }

        const totalShares = asset.shares - order.shares;
        if (totalShares <= 0) nextAssets = nextAssets.filter(a => a.symbol !== order.symbol);
        else {
          const totalCost = keptLots.reduce((s, l) => s + l.shares * l.costPerShare, 0);
          nextAssets[assetIdx] = { ...asset, shares: totalShares, lots: keptLots, avgCost: totalCost / totalShares };
        }
      }

      cats[catIdx] = { ...cat, assets: nextAssets };

      // Save Portfolio with new Transaction
      saveAndSetPortfolio({
        ...portfolio,
        martingale: cats,
        transactions: [newTransaction, ...portfolio.transactions]
      });
      showToast("更新馬丁倉位成功", "success");
    },
    onDeleteAsset: (categoryId: string, assetId: string) => {
      const cats = Array.isArray(portfolio.martingale) ? [...portfolio.martingale] : [];
      const cat = cats.find(c => c.id === categoryId);
      if (cat) {
        cat.assets = cat.assets.filter(a => a.id !== assetId);
        saveAndSetPortfolio({ ...portfolio, martingale: cats });
      }
    },
    onUpdatePrice: async (categoryId: string) => { // Batch update for category
      // ... implementation 
      // For brevity, just calling basic update logic
      handleMartingaleRefreshCategory(categoryId);
    },
    onUpdateAssetPrice: async (categoryId: string, assetId: string, symbol: string, market: string) => {
      // ... implementation
      // handleMartingaleUpdatePrice(assetId, symbol, market); // Need to find asset in cats array
      const price = await stockService.getPrice(symbol, market as any);
      if (!price) return;
      const cats = Array.isArray(portfolio.martingale) ? [...portfolio.martingale] : [];
      const cat = cats.find(c => c.id === categoryId);
      if (cat) {
        cat.assets = cat.assets.map(a => a.id === assetId ? { ...a, currentPrice: price } : a);
        saveAndSetPortfolio({ ...portfolio, martingale: cats });
        showToast("價格更新成功", "success");
      }
    },
    onDeleteCategory: (categoryId: string) => {
      if (!window.confirm("確定要刪除此策略嗎？所有相關持倉紀錄將被移除。")) return;
      const cats = Array.isArray(portfolio.martingale) ? portfolio.martingale.filter(c => c.id !== categoryId) : [];
      saveAndSetPortfolio({ ...portfolio, martingale: cats });
      showToast("策略已刪除", "info");
    },
    onMoveCategory: (categoryId: string, direction: 'up' | 'down') => {
      const cats = Array.isArray(portfolio.martingale) ? [...portfolio.martingale] : [];
      const idx = cats.findIndex(c => c.id === categoryId);
      if (idx === -1) return;

      if (direction === 'up' && idx > 0) {
        // Swap with previous
        [cats[idx], cats[idx - 1]] = [cats[idx - 1], cats[idx]];
      } else if (direction === 'down' && idx < cats.length - 1) {
        // Swap with next
        [cats[idx], cats[idx + 1]] = [cats[idx + 1], cats[idx]];
      } else {
        return; // No move needed
      }

      saveAndSetPortfolio({ ...portfolio, martingale: cats });
    }
  };

  const handleResetMartingale = () => {
    // Single detailed confirmation for better mobile compatibility
    const message = "⚠️ 警告：您確定要「重置」所有的馬丁持倉紀錄嗎？\n\n" +
      "此操作將會：\n" +
      "1. 清空所有馬丁策略內的「持倉數據」與「未實現損益」\n" +
      "2. 永久移除相關的歷史交易與股息紀錄\n" +
      "3. 保留「策略分類」與「預算配置」設定\n\n" +
      "一旦執行即無法復原！請確認您已備份重要資訊。";

    if (!window.confirm(message)) {
      return;
    }

    // Execute Reset
    const martNames = (Array.isArray(portfolio.martingale) ? portfolio.martingale : []).map(c => c.name);

    const newTransactions = portfolio.transactions.filter(t => {
      // 1. Explicit Flag Preference
      if (t.isMartingale === true) return false; // REMOVE Martingale
      if (t.isMartingale === false) return true; // KEEP Personal

      // 2. Legacy/Fallback Naming Logic
      const isMartName = martNames.includes(t.categoryName);
      if (isMartName) {
        // Strict Heuristic: If it has ratio > 0, it's a legacy Personal position
        if (t.portfolioRatio && t.portfolioRatio > 0) return true; // KEEP Personal
        return false; // REMOVE Martingale
      }

      return true; // Keep everything else
    });

    // 2. Clear Assets AND Realized PnL in Martingale Categories
    const resetMartingaleCategories = Array.isArray(portfolio.martingale)
      ? portfolio.martingale.map(c => ({
        ...c,
        assets: [], // Empty assets
        realizedPnL: 0, // Reset PnL
        investedAmount: 0, // Reset Invested
        remainingCash: Math.floor(portfolio.totalCapital * (c.allocationPercent / 100)) // Restore projected cash
      }))
      : [];

    saveAndSetPortfolio({
      ...portfolio,
      martingale: resetMartingaleCategories,
      transactions: newTransactions
    });

    showToast("馬丁倉位已完整重置", "success");
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!window.confirm("確定要刪除此分類嗎？包含的資產將會被移除。")) return;
    const newCats = portfolio.categories.filter(c => c.id !== categoryId);
    saveAndSetPortfolio({ ...portfolio, categories: newCats });
    if (activeCategoryId === categoryId) setActiveCategoryId(null);
    showToast("分類已刪除", "info");
  };

  if (!isDataLoaded && !user && !isStartingFresh) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]"></div>
        <div className="max-w-xl w-full z-10 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/10 mb-2">
              <Briefcase className="w-16 h-16 text-libao-gold" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Libao <span className="text-libao-gold">財經學院</span></h1>
            <p className="text-gray-400 text-lg md:text-xl font-medium">專業投資者的倉位管理與戰略分析工具</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button onClick={handleLoginAction} disabled={isSyncing} className="w-full py-4 bg-white text-gray-900 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50">
              {isSyncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Cloud className="w-6 h-6 text-blue-600" />}
              使用 Google 帳號同步
            </button>
            <button onClick={handleStartFresh} className="w-full py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95">
              <Rocket className="w-6 h-6 text-libao-gold" />
              建立新本地倉位
            </button>
          </div>
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/5">
            <div className="space-y-2"><Shield className="w-6 h-6 mx-auto text-green-400" /><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">安全同步</div></div>
            <div className="space-y-2"><TrendingUp className="w-6 h-6 mx-auto text-blue-400" /><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">即時分析</div></div>
            <div className="space-y-2"><PieChart className="w-6 h-6 mx-auto text-purple-400" /><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">資產配置</div></div>
          </div>
          <p className="text-[10px] text-gray-600 font-mono">Libao Portfolio Manager v5.5.0 • Authorized Students Only</p>
        </div>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Briefcase className="w-6 h-6 text-libao-gold absolute inset-0 m-auto" />
        </div>
        <p className="text-white font-bold animate-pulse">正在從雲端加密同步資料...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <GuidedTour
        isOpen={isTourActive}
        steps={tourSteps}
        onComplete={handleTourComplete}
        onSkip={() => { setIsTourActive(false); setIsTourForceOrderOpen(false); setActiveCategoryId(null); }}
        onStepChange={handleTourStepChange}
      />
      <OnboardingModal isOpen={showOnboarding} initialCategories={DEFAULT_CATEGORIES} onComplete={(cap, cats) => { saveAndSetPortfolio({ ...portfolio, totalCapital: cap, categories: cats }); setShowOnboarding(false); localStorage.setItem('libao-onboarding-v1', 'true'); setTimeout(() => { setIsTourActive(true); fetchStockNews(); }, 1000); }} />
      {showTutorial && (
        <TutorialModal isOpen={showTutorial} onClose={handleTutorialClose} onLoginRequest={handleLoginAction} isLoggedIn={!!user} />
      )}
      <NewsModal isOpen={showNewsModal} onClose={() => { setShowNewsModal(false); setHasNewNews(false); localStorage.setItem('libao-news-last-read', Date.now().toString()); }} newsItems={newsItems} isLoading={isFetchingNews} />
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={portfolio.settings}
        onUpdateSettings={handleUpdateSettings}
        fullPortfolio={portfolio}
        onImportData={(d) => { saveAndSetPortfolio(d); }}
        onResetPortfolio={async () => {
          if (confirm("確定重置?")) {
            if (user) await resetCloudPortfolio(user.uid);
            localStorage.clear();
            window.location.reload();
          }
        }}
        onRepairData={() => {
          handleRepairPortfolio();

          // One-Off Migration: Label Legacy Martingale Dividends
          // If a dividend has a category name matching a Martingale category, force explicit true.
          // This bypasses the logic where Personal Asset ID claims ownership.
          const cats = Array.isArray(portfolio.martingale) ? portfolio.martingale : [];
          if (cats.length > 0) {
            let infoMsg = '';
            const newTxs = portfolio.transactions.map(t => {
              if (t.type === 'DIVIDEND' && t.isMartingale === undefined) {
                const isMartingaleCategory = cats.some(c => c.name === t.categoryName);
                if (isMartingaleCategory) {
                  infoMsg = '修復舊有馬丁股息';
                  return { ...t, isMartingale: true };
                }
              }
              return t;
            });

            // Only save if changed (JSON stringify check is crude but effective for simple deep eq)
            if (JSON.stringify(newTxs) !== JSON.stringify(portfolio.transactions)) {
              saveAndSetPortfolio({ ...portfolio, transactions: newTxs });
              showToast(infoMsg || '資料修復與遷移完成', 'success');
            } else {
              showToast('資料完整，無需修復', 'info');
            }
          }
        }}
      />
      <FeeSettingsModal isOpen={showFeeSettingsModal} onClose={() => setShowFeeSettingsModal(false)} settings={portfolio.settings} onUpdateSettings={handleUpdateSettings} />
      <DividendModal
        isOpen={showDividendModal}
        onClose={() => setShowDividendModal(false)}
        scannedDividends={scannedDividends}
        availableAssets={
          dividendScanTarget === 'my'
            ? portfolio.categories.flatMap(c => c.assets.map(a => ({ id: a.id, symbol: a.symbol, name: a.name, categoryName: c.name, market: c.market })))
            : (Array.isArray(portfolio.martingale) ? portfolio.martingale.flatMap(c => c.assets.map(a => ({ id: a.id, symbol: a.symbol, name: a.name, categoryName: c.name, market: c.market }))) : [])
        }
        usExchangeRate={portfolio.settings.usExchangeRate}
        onCheckShares={handleCheckShares}
        onConfirm={handleConfirmDividends}
        isLoading={isScanningDividends}
      />  <CapitalModal isOpen={showCapitalModal} onClose={() => setShowCapitalModal(false)} capitalLogs={portfolio.capitalLogs} onAddLog={(l) => { const newState = { ...portfolio, capitalLogs: [...portfolio.capitalLogs, { ...l, id: uuidv4() }] }; newState.totalCapital = newState.capitalLogs.reduce((s, log) => log.type === 'DEPOSIT' ? s + log.amount : s - log.amount, 0); saveAndSetPortfolio(newState); }} onDeleteLog={(id) => { const newState = { ...portfolio, capitalLogs: portfolio.capitalLogs.filter(l => l.id !== id) }; newState.totalCapital = newState.capitalLogs.reduce((s, log) => log.type === 'DEPOSIT' ? s + log.amount : s - log.amount, 0); saveAndSetPortfolio(newState); }} isPrivacyMode={isPrivacyMode} />


      <nav className="bg-gray-900 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setActiveCategoryId(null); setViewMode('PORTFOLIO'); setShowAdminPanel(false); }}>
              <Briefcase className="w-8 h-8 text-libao-gold" />
              <span className="font-bold text-xl tracking-tight">Libao <span className="text-gray-400 text-sm font-normal hidden sm:inline">財經學院</span></span>
            </div>
            <div className="hidden lg:flex items-center bg-gray-800 rounded-lg p-1 mx-4">
              {/* VIP Gold Chip Button - Move to Front */}
              {(userRole === 'admin' || userRole === 'member' || userRole === 'vip') && (
                <button
                  id="nav-desktop-vip"
                  onClick={() => { setViewMode('VIP_PORTFOLIO'); setShowAdminPanel(false); }}
                  className={`
                    relative px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all mr-2 border
                    ${viewMode === 'VIP_PORTFOLIO'
                      ? 'bg-gradient-to-r from-yellow-700 to-yellow-900 text-yellow-100 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]'
                      : 'bg-gray-900/50 text-yellow-500 border-yellow-500/30 hover:bg-yellow-900/20 hover:border-yellow-500/80 hover:shadow-[0_0_10px_rgba(234,179,8,0.3)]'}
                  `}
                >
                  <Briefcase className={`w-4 h-4 ${viewMode === 'VIP_PORTFOLIO' ? 'text-yellow-200' : 'text-yellow-500'}`} />
                  <span className={`${viewMode === 'VIP_PORTFOLIO' ? 'text-yellow-100' : 'text-yellow-500'}`}>馬丁持倉</span>
                  {/* Gold Glow Ping */}
                  <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                  </span>
                </button>
              )}
              <button id="nav-desktop-dashboard" onClick={() => { setViewMode('PORTFOLIO'); setActiveCategoryId(null); setShowAdminPanel(false); }} className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'PORTFOLIO' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                <LayoutDashboard className="w-4 h-4" /> 我的持倉
              </button>
              <button id="nav-desktop-history" onClick={() => { setViewMode('HISTORY'); setShowAdminPanel(false); }} className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'HISTORY' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                <History className="w-4 h-4" /> 交易紀錄
              </button>
              <button id="nav-desktop-dividend" onClick={() => { setViewMode('DIVIDENDS'); setShowAdminPanel(false); }} className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'DIVIDENDS' ? 'bg-purple-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                <Coins className="w-4 h-4" /> 股息帳本
              </button>
              <button id="nav-desktop-aipicks" onClick={() => { setViewMode('AI_PICKS'); setShowAdminPanel(false); }} className={`relative px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all overflow-hidden group ${viewMode === 'AI_PICKS' ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400 ring-offset-2 ring-offset-gray-900' : 'text-gray-300 hover:text-white'}`}>
                {/* Ping Effect */}
                <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
                <Brain className={`w-4 h-4 ${viewMode === 'AI_PICKS' ? 'text-white' : 'text-indigo-400 group-hover:text-indigo-300'}`} />
                <span className={viewMode === 'AI_PICKS' ? '' : 'bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent group-hover:text-white transition-all'}>AI 選股</span>
              </button>
            </div>
            {/* Right Side Grouping */}
            <div className="flex items-center gap-2 md:gap-4">
              {userRole === 'admin' && (
                <button
                  onClick={() => setViewMode('ADMIN')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'ADMIN' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  <Shield className="w-4 h-4" /> 管理
                </button>
              )}
              <div id="nav-desktop-academy" className="relative group ml-1 hidden lg:block">
                <button className="px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 text-gray-400 hover:text-white">
                  <BookOpen className="w-4 h-4" /> 學院資源 <ChevronDown className="w-3 h-3 group-hover:rotate-180 transition-transform" />
                </button>
                <div className="absolute top-full right-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[60]">
                  <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-48 py-1">
                    <a href="https://line.me/R/ti/p/@607dxbdr" target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"><MessageCircle className="w-4 h-4 text-green-500" /> LINE 官方帳號</a>
                    <a href="https://libao-finance-school.mykajabi.com/products/6/categories" target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"><BookOpen className="w-4 h-4 text-blue-500" /> 投資組合參考</a>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <div className="md:hidden mr-1">
                  {user ? (
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-green-400 bg-green-400/10 rounded-full"><Cloud className="w-5 h-5" /></button>
                  ) : (
                    <button onClick={handleLoginAction} className="p-2 text-gray-400 bg-gray-400/10 rounded-full"><CloudOff className="w-5 h-5" /></button>
                  )}
                </div>
                <button id="tour-news-btn" onClick={() => { setShowNewsModal(true); setHasNewNews(false); }} className="p-2 text-gray-300 hover:text-white relative"><Bell className="w-5 h-5" />{hasNewNews && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-900"></span>}</button>
                <button id="tour-privacy-btn" onClick={() => setIsPrivacyMode(!isPrivacyMode)} className="p-2 text-gray-300 hover:text-white">{isPrivacyMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                <button id="tour-update-btn" onClick={() => handleUpdatePrices(false)} className="p-2 text-gray-300 hover:text-white"><RefreshCw className={`w-5 h-5 ${isUpdatingPrices ? 'animate-spin' : ''}`} /></button>
                <button id="tour-menu-btn" onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-300 hover:text-white"><Menu className="w-6 h-6" /></button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="absolute top-0 right-0 h-full w-80 bg-gray-900 text-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 bg-gray-800/80 border-b border-gray-700/50 shrink-0">
              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-libao-gold" />雲端同步帳號</span>
                <button onClick={() => setIsSidebarOpen(false)} className="hover:bg-gray-700 p-1 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-xl border border-gray-700">
                    <img src={user.photoURL} className="w-12 h-12 rounded-full border-2 border-green-500 shadow-sm" />
                    <div className="text-xs truncate overflow-hidden flex-1">
                      <div className="font-bold text-white text-sm">{user.displayName || '使用者'}</div>
                      <div className="text-gray-400">{user.email}</div>
                      <div className="flex items-center gap-1 text-green-400 mt-1 font-bold"><Cloud className="w-3 h-3" /> 資料已安全同步</div>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="w-full py-2.5 bg-red-500/10 text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"><LogOut className="w-4 h-4" /> 登出帳號</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400 leading-relaxed">登入 Google 帳號即可備份您的投資持倉。</p>
                  <button onClick={handleLoginAction} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"><LogIn className="w-4 h-4" /> 立即登入</button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-900">
              <div className="space-y-4">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">功能列表</div>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => { setViewMode('PORTFOLIO'); setIsSidebarOpen(false); setShowAdminPanel(false); }} className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${viewMode === 'PORTFOLIO' ? 'bg-gray-700 text-white shadow-sm' : 'bg-gray-800 hover:bg-gray-700'}`}>
                    <div className="flex items-center gap-3"><LayoutDashboard className={`w-5 h-5 ${viewMode === 'PORTFOLIO' ? 'text-libao-gold' : 'text-gray-400'}`} /><span className="text-sm font-medium">我的持倉</span></div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>

                  {(userRole === 'admin' || userRole === 'member' || userRole === 'vip') && (
                    <button onClick={() => { setViewMode('VIP_PORTFOLIO'); setIsSidebarOpen(false); setShowAdminPanel(false); }} className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all border ${viewMode === 'VIP_PORTFOLIO' ? 'bg-gradient-to-r from-yellow-700 to-yellow-900 text-yellow-100 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-gray-800 border-transparent hover:border-yellow-500/50 hover:bg-yellow-900/10'}`}>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Briefcase className={`w-5 h-5 ${viewMode === 'VIP_PORTFOLIO' ? 'text-yellow-200' : 'text-yellow-500'}`} />
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                          </span>
                        </div>
                        <span className="text-sm font-bold">馬丁持倉</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${viewMode === 'VIP_PORTFOLIO' ? 'text-yellow-200' : 'text-gray-600'}`} />
                    </button>
                  )}

                  <button onClick={() => { setViewMode('HISTORY'); setIsSidebarOpen(false); setShowAdminPanel(false); }} className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${viewMode === 'HISTORY' ? 'bg-gray-700 text-white shadow-sm' : 'bg-gray-800 hover:bg-gray-700'}`}>
                    <div className="flex items-center gap-3"><History className={`w-5 h-5 ${viewMode === 'HISTORY' ? 'text-libao-gold' : 'text-gray-400'}`} /><span className="text-sm font-medium">交易紀錄</span></div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>

                  <button onClick={() => { setViewMode('DIVIDENDS'); setIsSidebarOpen(false); setShowAdminPanel(false); }} className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${viewMode === 'DIVIDENDS' ? 'bg-purple-900/30 text-purple-200 border border-purple-500/50 shadow-sm' : 'bg-gray-800 hover:bg-gray-700'}`}>
                    <div className="flex items-center gap-3"><Coins className={`w-5 h-5 ${viewMode === 'DIVIDENDS' ? 'text-purple-400' : 'text-gray-400'}`} /><span className="text-sm font-medium">股息帳本</span></div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>

                  <button onClick={() => { setViewMode('AI_PICKS'); setIsSidebarOpen(false); setShowAdminPanel(false); }} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all">
                    <div className="flex items-center gap-3"><Brain className="w-5 h-5 text-indigo-500" /><span className="text-sm font-medium">AI 選股</span></div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">偏好設定</div>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => { setShowFeeSettingsModal(true); setIsSidebarOpen(false); }} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all group">
                    <div className="flex items-center gap-3"><Calculator className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" /><span className="text-sm font-medium">手續費設定</span></div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                  <button onClick={() => { setShowSettingsModal(true); setIsSidebarOpen(false); }} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all group">
                    <div className="flex items-center gap-3"><Settings className="w-5 h-5 text-gray-400 group-hover:rotate-45 transition-transform" /><span className="text-sm font-medium">系統備份與匯率</span></div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
              {userRole === 'admin' && (
                <div className="space-y-4">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">管理員專區</div>
                  <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => { setViewMode('ADMIN'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all group ${viewMode === 'ADMIN' ? 'bg-gray-700 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}>
                      <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-yellow-500 group-hover:scale-110 transition-transform" /><span className="text-sm font-medium">管理員面板</span></div>
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">學院資源</div>
                <div className="grid grid-cols-1 gap-2">
                  <a href="https://line.me/R/ti/p/@607dxbdr" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between p-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all">
                    <div className="flex items-center gap-3"><MessageCircle className="w-5 h-5 text-green-500" /><span className="text-sm font-medium">LINE 官方帳號</span></div>
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </a>
                  <a href="https://libao-finance-school.mykajabi.com/products/6/categories" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between p-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all">
                    <div className="flex items-center gap-3"><BookOpen className="w-5 h-5 text-blue-500" /><span className="text-sm font-medium">投資組合參考</span></div>
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </a>
                </div>
              </div>
              <div className="space-y-4">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">裝置安裝</div>
                <button onClick={() => setShowInstallGuide(!showInstallGuide)} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all">
                  <div className="flex items-center gap-3"><Download className="w-5 h-5 text-orange-400" /><span className="text-sm font-medium">加到手機主畫面</span></div>
                  <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showInstallGuide ? 'rotate-180' : ''}`} />
                </button>
                {showInstallGuide && (
                  <div className="p-4 bg-gray-950 rounded-xl border border-gray-800 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex bg-gray-800 p-1 rounded-lg">
                      <button onClick={() => setPwaTab('iOS')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${pwaTab === 'iOS' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500'}`}>iOS</button>
                      <button onClick={() => setPwaTab('Android')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${pwaTab === 'Android' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500'}`}>Android</button>
                    </div>
                    <div className="space-y-3 text-xs text-gray-400">
                      {pwaTab === 'iOS' ? (
                        <>
                          <p className="flex items-center gap-2">1. 使用 Safari 開啟並點擊 <Share className="w-4 h-4 text-blue-500" /></p>
                          <p className="flex items-center gap-2">2. 滑動至下方選擇「加入主畫面」</p>
                        </>
                      ) : (
                        <>
                          <p className="flex items-center gap-2">1. 點擊 Chrome 右上角 <MoreVertical className="w-4 h-4" /></p>
                          <p className="flex items-center gap-2">2. 選擇「安裝應用程式」或「加到主畫面」</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">支援與導覽</div>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => { setIsSidebarOpen(false); setViewMode('PORTFOLIO'); setActiveCategoryId(null); setTimeout(() => setIsTourActive(true), 500); }} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all group">
                    <div className="flex items-center gap-3"><HelpCircle className="w-5 h-5 text-blue-400" /><span className="text-sm font-bold text-blue-100">功能導覽</span></div>
                    <ChevronRight className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 text-center bg-gray-900">
              <div className="text-[10px] text-gray-600 font-mono">Libao Portfolio Manager v5.6.5</div>
            </div>
          </div>
        </div>
      )}

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-24 md:pb-8 ${activeCategoryId ? 'py-0' : 'py-8'}`}>
        {viewMode === 'PORTFOLIO' && (
          <>

            <div id="tour-summary-table">
              {activeCategoryId ? (
                <DetailTable category={calculatedData.categories.find(c => c.id === activeCategoryId)!} assets={calculatedData.categories.find(c => c.id === activeCategoryId)!.assets} totalCapital={portfolio.totalCapital} onBack={() => setActiveCategoryId(null)} onExecuteOrder={handleExecuteOrder} onUpdateAssetPrice={handleUpdateAssetPrice} onUpdateCategoryPrices={handleRefreshCategory} onUpdateAssetNote={() => { }} defaultExchangeRate={portfolio.settings.usExchangeRate} isPrivacyMode={isPrivacyMode} settings={portfolio.settings} forceShowOrderModal={isTourForceOrderOpen} />
              ) : (
                <>
                  <PersonalDashboard
                    categories={calculatedData.categories}
                    totalCapital={portfolio.totalCapital}
                    transactions={portfolio.transactions}
                    industryData={calculatedData.industryData}
                    onDeposit={() => setShowCapitalModal(true)}
                    onReset={() => {
                      if (confirm('確定要重置所有倉位資料嗎？此操作無法復原。')) {
                        setPortfolio(initialPortfolioState);
                        savePortfolioToCloud(user!.uid, initialPortfolioState); // Force save
                      }
                    }}
                    isPrivacyMode={isPrivacyMode}
                  />
                  <PersonalSummary
                    categories={calculatedData.categories}
                    totalCapital={portfolio.totalCapital}
                    onUpdateAllocation={handleUpdateAllocation}
                    onSelectCategory={setActiveCategoryId}
                    onRefreshCategory={handleRefreshCategory}
                    onDeleteCategory={handleDeleteCategory}
                    onMoveCategory={(id, dir) => {
                      const idx = portfolio.categories.findIndex(c => c.id === id);
                      if (idx === -1) return;
                      const newCats = [...portfolio.categories];
                      if (dir === 'up' && idx > 0) {
                        [newCats[idx], newCats[idx - 1]] = [newCats[idx - 1], newCats[idx]];
                      } else if (dir === 'down' && idx < newCats.length - 1) {
                        [newCats[idx], newCats[idx + 1]] = [newCats[idx + 1], newCats[idx]];
                      }
                      saveAndSetPortfolio({ ...portfolio, categories: newCats });
                    }}
                    onAddCategory={() => setIsAddCategoryModalOpen(true)}
                    isPrivacyMode={isPrivacyMode}
                  />

                  {/* Restore Teaser for Unauthorized Users */}
                  {(userRole !== 'admin' && userRole !== 'member' && userRole !== 'vip') && (calculatedData as any).martingale && (
                    <div className="mt-12 relative border-t-4 border-libao-gold/20 pt-8">
                      <SectionGate
                        sectionKey="martingale"
                        title="馬丁個人持倉（Model Portfolio）"
                        userRole={userRole}
                        allowPartial={true}
                      >
                        <MartingalePanel
                          categories={scrubSensitiveData((calculatedData as any).martingale)}
                          totalCapital={portfolio.totalCapital}
                          userRole={userRole}
                          isPrivacyMode={isPrivacyMode}
                          settings={portfolio.settings}
                          onUpdateAllocation={handleMartingaleUpdateAllocation}
                          onAddCategory={() => setIsAddCategoryModalOpen(true)}
                          operations={handleMartingaleOperations}
                          activeCategoryId={martingaleActiveId}
                          onSetActiveCategory={setMartingaleActiveId}
                          transactions={[]}
                          industryData={[]}
                        />
                      </SectionGate>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
        {/* Modals outside main flow */}
        <AddCategoryModal
          isOpen={isAddCategoryModalOpen}
          onClose={() => setIsAddCategoryModalOpen(false)}
          onConfirm={handleAddMartingaleCategory}
        />
        {viewMode === 'HISTORY' && (
          <TransactionHistory
            transactions={portfolio.transactions}
            portfolio={portfolio}
            onRevoke={handleRevokeTransaction}
            isPrivacyMode={isPrivacyMode}
            userRole={userRole}
            martingaleCategories={(portfolio.martingale || []).map((c: any) => c.name)}
          />
        )}
        {viewMode === 'DIVIDENDS' && (
          <DividendLedger
            transactions={portfolio.transactions}
            onScan={handleScanDividends}
            onManualAdd={handleManualAddDividend}
            onRevoke={handleRevokeTransaction}
            onReset={handleResetDividends}
            isPrivacyMode={isPrivacyMode}
            userRole={userRole}
            martingaleCategories={(portfolio.martingale || []).map((c: any) => c.name)}
            personalCategories={portfolio.categories}
          />
        )}
        {viewMode === 'AI_PICKS' && (
          <AIPicks userRole={userRole} />
        )}

        {/* New Independnet View for VIP Portfolio */}
        {viewMode === 'VIP_PORTFOLIO' && (calculatedData as any).martingale && (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6 flex items-center justify-between">
              <button onClick={() => setViewMode('PORTFOLIO')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> 返回儀表板
              </button>
              {/* Add Strategy Button moved nicely into Summary Header via MartingalePanel -> MartingaleSummary */}
            </div>

            <MartingalePanel
              categories={(calculatedData as any).martingale}
              totalCapital={portfolio.totalCapital}
              userRole={userRole}
              isPrivacyMode={isPrivacyMode}
              settings={portfolio.settings}
              onUpdateAllocation={handleMartingaleUpdateAllocation}
              onAddCategory={() => setIsAddCategoryModalOpen(true)}
              operations={handleMartingaleOperations}
              activeCategoryId={martingaleActiveId}
              onSetActiveCategory={setMartingaleActiveId}
              transactions={portfolio.transactions.filter(t => {
                const matchesMartingale = (portfolio.martingale || []).some((c: any) => c.name === t.categoryName);
                if (!matchesMartingale) return false;

                // 1. Explicit Flag Preference (STRICT)
                if (t.isMartingale === true) return true;
                if (t.isMartingale === false) return false;

                // 2. Legacy Fallback (Heuristic)
                // If it has a ratio, it's from a personal category position
                if (t.portfolioRatio && t.portfolioRatio > 0) return false;
                return true;
              })}
              industryData={(calculatedData as any).martingaleIndustryData}
              onDeposit={() => setShowCapitalModal(true)}
              onReset={handleResetMartingale}
            />
          </div>
        )}
        {viewMode === 'ADMIN' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AdminPanel currentUser={user} />
          </div>
        )}
      </main >

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 z-40">
        <button id="nav-mobile-dashboard" onClick={() => { setViewMode('PORTFOLIO'); setActiveCategoryId(null); setShowAdminPanel(false); }} className={`flex flex-col items-center gap-1 ${viewMode === 'PORTFOLIO' ? 'text-blue-600' : 'text-gray-400'}`}><LayoutDashboard className="w-6 h-6" /><span className="text-[10px]">持倉</span></button>
        <button id="nav-mobile-history" onClick={() => { setViewMode('HISTORY'); setShowAdminPanel(false); }} className={`flex flex-col items-center gap-1 ${viewMode === 'HISTORY' ? 'text-blue-600' : 'text-gray-400'}`}><History className="w-6 h-6" /><span className="text-[10px]">紀錄</span></button>
        <button id="nav-mobile-dividend" onClick={() => { setViewMode('DIVIDENDS'); setShowAdminPanel(false); }} className={`flex flex-col items-center gap-1 ${viewMode === 'DIVIDENDS' ? 'text-purple-600' : 'text-gray-400'}`}><Coins className="w-6 h-6" /><span className="text-[10px]">股息</span></button>
        <button id="nav-mobile-ai" onClick={() => { setViewMode('AI_PICKS'); setShowAdminPanel(false); }} className={`flex flex-col items-center gap-1 ${viewMode === 'AI_PICKS' ? 'text-indigo-600' : 'text-gray-400'}`}><Brain className="w-6 h-6" /><span className="text-[10px]">AI選股</span></button>
      </div>
    </div >
  );
};

export default App;
