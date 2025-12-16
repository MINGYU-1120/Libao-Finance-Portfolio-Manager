
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Briefcase, 
  DollarSign, 
  XCircle, 
  TrendingUp, 
  RefreshCw, 
  History, 
  LayoutDashboard, 
  Settings, 
  Clock, 
  PlayCircle, 
  PauseCircle, 
  Eye, 
  EyeOff, 
  Coins, 
  ArrowRightLeft, 
  LogIn, 
  LogOut, 
  Cloud, 
  CloudOff, 
  HelpCircle,
  Menu,
  X,
  User as UserIcon,
  ChevronRight,
  Bell,
  MessageCircle,
  BookOpen,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { PortfolioState, Asset, AssetLot, CalculatedCategory, CalculatedAsset, TransactionRecord, CapitalLogEntry, AppSettings, PositionCategory, NewsItem } from './types';
import { DEFAULT_CATEGORIES, INITIAL_CAPITAL, DEFAULT_EXCHANGE_RATE } from './constants';
import SummaryTable from './components/SummaryTable';
import DetailTable from './components/DetailTable';
import TransactionHistory from './components/TransactionHistory';
import DividendLedger from './components/DividendLedger';
import SettingsModal from './components/SettingsModal';
import IndustryAnalysis from './components/IndustryAnalysis';
import DividendModal, { ScannedDividend } from './components/DividendModal';
import CapitalModal from './components/CapitalModal';
import MonthlyPnLChart from './components/MonthlyPnLChart';
import TutorialModal from './components/TutorialModal';
import OnboardingModal from './components/OnboardingModal';
import NewsModal from './components/NewsModal';
import GuidedTour, { TourStep } from './components/GuidedTour'; // Import GuidedTour
import { OrderData } from './components/OrderModal';
import { stockService } from './services/StockService'; 
import { getIndustry } from './services/industryService';
import { 
  loginWithGoogle, 
  logoutUser, 
  subscribeToAuthChanges, 
  savePortfolioToCloud, 
  loadPortfolioFromCloud, 
  resetCloudPortfolio,
  isFirebaseReady 
} from './services/firebase';
import { useToast } from './contexts/ToastContext';

const maskValueFn = (val: string | number, isPrivacyMode: boolean) => isPrivacyMode ? '*******' : val;

const App: React.FC = () => {
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isFirebaseEnabled, setIsFirebaseEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Guard flag to prevent saving empty state to cloud before data is loaded
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // --- UI State ---
  const [showTutorial, setShowTutorial] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // --- Guided Tour State ---
  const [isTourActive, setIsTourActive] = useState(false);
  
  // --- News State ---
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [hasNewNews, setHasNewNews] = useState(false);
  
  // --- Initialization Logic ---
  const initialPortfolioState: PortfolioState = {
      totalCapital: INITIAL_CAPITAL,
      settings: { 
        usExchangeRate: DEFAULT_EXCHANGE_RATE,
        enableFees: true,
        usBroker: 'Firstrade',
        twFeeDiscount: 6, // Default 60%
        enableSystemNotifications: false
      },
      categories: DEFAULT_CATEGORIES,
      transactions: [],
      capitalLogs: [], 
      lastModified: Date.now()
  };

  const [portfolio, setPortfolio] = useState<PortfolioState>(initialPortfolioState);

  const portfolioRef = useRef(portfolio);
  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  const [viewMode, setViewMode] = useState<'PORTFOLIO' | 'HISTORY' | 'DIVIDENDS'>('PORTFOLIO');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDividendModal, setShowDividendModal] = useState(false);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [scannedDividends, setScannedDividends] = useState<ScannedDividend[]>([]);
  const [isScanningDividends, setIsScanningDividends] = useState(false);

  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  
  const maskValue = (val: string | number) => maskValueFn(val, isPrivacyMode);

  // --- Helper: Synchronous Save ---
  const saveAndSetPortfolio = useCallback((newState: PortfolioState) => {
      try {
          localStorage.setItem('libao-portfolio', JSON.stringify(newState));
      } catch (e) {
          console.error("Save Error", e);
      }
      setPortfolio(newState);
  }, []);

  // --- Mobile Detect for Tour ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- News Fetching Logic ---
  const fetchStockNews = useCallback(async () => {
    // Only fetch if we have assets
    const uniqueAssets = new Set<string>();
    const assetsList: {symbol: string, market: 'TW' | 'US'}[] = [];
    
    portfolioRef.current.categories.forEach(c => {
      c.assets.forEach(a => {
        const key = `${a.symbol}-${c.market}`;
        if (!uniqueAssets.has(key)) {
          uniqueAssets.add(key);
          assetsList.push({ symbol: a.symbol, market: c.market as 'TW'|'US' });
        }
      });
    });

    if (assetsList.length === 0) return;

    setIsFetchingNews(true);
    try {
      const allNews: NewsItem[] = [];
      const promises = assetsList.map(async (asset) => {
         return await stockService.getStockNews(asset.symbol, asset.market);
      });
      
      const results = await Promise.all(promises);
      results.forEach(newsList => allNews.push(...newsList));
      
      const validNews = allNews.filter(n => {
         const t = new Date(n.pubDate).getTime();
         return !isNaN(t) && t > 0;
      });

      const sorted = validNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      setNewsItems(sorted);
      
      if (sorted.length > 0) {
         const lastReadTimestamp = localStorage.getItem('libao-news-last-read');
         const latestNewsTimestamp = new Date(sorted[0].pubDate).getTime();
         
         if (!lastReadTimestamp || latestNewsTimestamp > parseInt(lastReadTimestamp, 10)) {
             setHasNewNews(true);
             if (portfolioRef.current.settings.enableSystemNotifications && 
                 "Notification" in window && 
                 Notification.permission === 'granted') {
                 
                 const latestItem = sorted[0];
                 new Notification(`Libao 發現 ${sorted.length} 則相關新聞`, {
                    body: `最新：[${latestItem.symbol}] ${latestItem.title}`,
                    icon: '/icon.png',
                    tag: 'libao-news'
                 });
             }
         } else {
             setHasNewNews(false);
         }
      } else {
         setHasNewNews(false);
      }

    } catch (e) {
      console.warn("News fetch failed", e);
    } finally {
      setIsFetchingNews(false);
    }
  }, []);

  // --- Tour Steps Definition (Dynamic) ---
  const tourSteps: TourStep[] = useMemo(() => {
    const steps: TourStep[] = [
      {
          targetId: 'tour-total-capital',
          title: '步驟 1：資金總覽',
          content: '這裡是您的戰情中心！查看您的總資金、已投入金額與未實現損益。點擊右上角的「出/入金」按鈕可記錄資金變動。',
      },
      {
          // On mobile, target only the first card to avoid massive overlays
          targetId: isMobile ? 'tour-summary-mobile-first' : 'tour-summary-table',
          title: '步驟 2：資產配置',
          content: 'Libao 核心功能。在此監控各個「倉位 (如G倉、D倉)」的資金佔比。您可以直接修改百分比，系統會自動計算預計投入金額。',
      },
      {
          targetId: 'tour-news-btn',
          title: '步驟 3：個股新聞',
          content: '點擊鈴鐺圖示，隨時掌握持倉股票的最新相關新聞。',
      },
      {
          targetId: 'tour-update-btn',
          title: '步驟 4：即時股價',
          content: '點擊此按鈕可手動更新所有持倉的最新股價。我們也支援 60 秒自動更新功能 (於選單中設定)。',
      },
      {
          targetId: 'tour-menu-btn',
          title: '步驟 5：功能選單',
          content: '點擊選單按鈕，可找到「系統設定」、「備份還原」與更多進階功能。',
      }
    ];
    return steps;
  }, [isMobile]);

  // --- Initial Flow Control ---
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('libao-tutorial-seen-v5');
    const isOnboarded = localStorage.getItem('libao-onboarding-v1');
    const localData = localStorage.getItem('libao-portfolio');
    
    if (isOnboarded && localData) {
        try {
            const parsed = JSON.parse(localData);
            if (!parsed.settings) parsed.settings = initialPortfolioState.settings;
            else {
               parsed.settings.enableSystemNotifications = parsed.settings.enableSystemNotifications ?? false;
               if (parsed.settings.twFeeDiscount === undefined) parsed.settings.twFeeDiscount = 6;
            }
            
            setPortfolio(parsed);
            setIsDataLoaded(true);
            setTimeout(() => fetchStockNews(), 2000);
        } catch(e) { console.error(e); }
        return;
    }

    // Only show if clean slate
    if (!hasSeenTutorial) {
       setShowTutorial(true);
    } 
  }, [fetchStockNews]);

  const handleOnboardingComplete = (capital: number, categories: PositionCategory[]) => {
      const newState: PortfolioState = {
          ...portfolioRef.current,
          totalCapital: capital,
          categories: categories,
          capitalLogs: [{
              id: uuidv4(),
              date: new Date().toISOString(),
              type: 'DEPOSIT',
              amount: capital,
              note: '初始資金 (Setup)'
          }],
          lastModified: Date.now()
      };
      
      saveAndSetPortfolio(newState);
      localStorage.setItem('libao-onboarding-v1', 'true');
      setIsDataLoaded(true); 
      
      if (user) {
          savePortfolioToCloud(user.uid, newState);
      }
      
      setShowOnboarding(false);
      
      // Trigger Tour after Onboarding if first time
      setTimeout(() => setIsTourActive(true), 500);
  };

  const handleTutorialLogin = async () => {
     localStorage.setItem('libao-tutorial-seen-v5', 'true');
     setShowTutorial(false);
     const loggedInUser = await loginWithGoogle();
     // ... logic handled by effect
  };

  const handleTutorialClose = () => {
     setShowTutorial(false);
     localStorage.setItem('libao-tutorial-seen-v5', 'true');
     // Start Tour after closing modal
     setIsTourActive(true);
  };

  // --- Auth & Sync Logic ---
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsSyncing(true);
        try {
          const cloudData = await loadPortfolioFromCloud(currentUser.uid);
          
          if (cloudData) {
             console.log(`[Sync] Loading from Cloud...`);
             if (cloudData.settings) {
                 cloudData.settings.enableSystemNotifications = cloudData.settings.enableSystemNotifications ?? false;
                 if (cloudData.settings.twFeeDiscount === undefined) cloudData.settings.twFeeDiscount = 6;
             }
             saveAndSetPortfolio(cloudData);
             showToast(`歡迎回來，已同步雲端資料`, 'success');
             setIsDataLoaded(true);
             localStorage.setItem('libao-onboarding-v1', 'true'); 
             setShowTutorial(false);
             setShowOnboarding(false);
             setTimeout(() => fetchStockNews(), 2000);
          } else {
             const localData = localStorage.getItem('libao-portfolio');
             if (localData && localStorage.getItem('libao-onboarding-v1')) {
                 setIsDataLoaded(true);
                 await savePortfolioToCloud(currentUser.uid, portfolioRef.current);
                 showToast("本地資料已同步至雲端", 'success');
             } else {
                 setShowOnboarding(true);
             }
          }
        } catch (e) {
          console.error("Sync failed", e);
        } finally {
          setIsSyncing(false);
        }
      }
    });
    return () => unsubscribe();
  }, [saveAndSetPortfolio, fetchStockNews]); 

  const handleLogout = async () => {
     if(!window.confirm("確定要登出嗎？...")) return;
     // ... (Keep existing logic)
     setIsSyncing(true);
     try {
         if (user && isDataLoaded) await savePortfolioToCloud(user.uid, portfolioRef.current);
         await logoutUser();
         localStorage.removeItem('libao-portfolio');
         localStorage.removeItem('libao-onboarding-v1');
         setUser(null);
         setPortfolio(initialPortfolioState);
         setIsDataLoaded(false);
         setNewsItems([]);
         setHasNewNews(false);
         setShowOnboarding(false);
         setShowTutorial(true); 
         showToast("已安全登出", 'success');
     } catch(e) {
         console.error(e);
     } finally {
         setIsSyncing(false);
     }
  };

  const handleResetPortfolio = async () => {
    if (!window.confirm("⚠️ 確定要重置所有資料嗎？此動作無法復原。\n\n(您的雲端備份與本地紀錄都將被清除，並重新回到初始設定狀態)")) return;
    
    setIsSyncing(true);
    try {
      if (user && isFirebaseEnabled) {
        await resetCloudPortfolio(user.uid);
      }
      localStorage.removeItem('libao-portfolio');
      localStorage.removeItem('libao-onboarding-v1');
      localStorage.removeItem('libao-tutorial-seen-v5'); 
      
      setPortfolio(initialPortfolioState);
      setIsDataLoaded(false);
      setShowSettingsModal(false);
      setShowOnboarding(true); 
      
      showToast("系統已完全重置", 'success');
    } catch (e) {
      console.error(e);
      showToast("重置失敗，請稍後再試", 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // ... (Keep other handlers like handleUpdatePrices, handleImportData, etc. exactly as is)
  useEffect(() => { /* Auto Save Logic */ }, [portfolio, user, isFirebaseEnabled, isDataLoaded]);
  const handleUpdatePrices = async (isSilent = false) => { 
    if (isUpdatingPrices) return;
    const currentPortfolio = portfolioRef.current; 
    const allAssets: {symbol: string, market: 'TW' | 'US'}[] = [];
    currentPortfolio.categories.forEach(c => {
      c.assets.forEach(a => {
        allAssets.push({ symbol: a.symbol, market: c.market });
      });
    });
    
    if (allAssets.length === 0) {
      if (!isSilent) showToast("目前沒有持倉可更新", 'info');
      return;
    }
    setIsUpdatingPrices(true);
    try {
      const priceMap = await stockService.getPrices(allAssets);
      const newState = {
        ...currentPortfolio,
        lastModified: Date.now(), 
        categories: currentPortfolio.categories.map(cat => ({
          ...cat,
          assets: cat.assets.map(asset => {
            const newPrice = priceMap[asset.symbol] || priceMap[asset.symbol.toUpperCase()];
            if (newPrice) {
              return { ...asset, currentPrice: newPrice };
            }
            return asset;
          })
        }))
      };
      saveAndSetPortfolio(newState);
      setLastUpdated(new Date());
      if (!isSilent) showToast("即時股價更新完成", 'success');
      if(!isSilent) fetchStockNews();
    } catch (e) {
      if (!isSilent) showToast("股價更新失敗", 'error');
    } finally {
      setIsUpdatingPrices(false);
    }
  };
  // ... (keep useEffect for auto refresh) ...
  const latestUpdatePricesRef = useRef(handleUpdatePrices);
  useEffect(() => { latestUpdatePricesRef.current = handleUpdatePrices; });
  useEffect(() => {
    if (isAutoRefresh) {
      latestUpdatePricesRef.current(true);
      autoRefreshIntervalRef.current = setInterval(() => { latestUpdatePricesRef.current(true); }, 60000);
    } else { if (autoRefreshIntervalRef.current) { clearInterval(autoRefreshIntervalRef.current); autoRefreshIntervalRef.current = null; } }
    return () => { if (autoRefreshIntervalRef.current) clearInterval(autoRefreshIntervalRef.current); };
  }, [isAutoRefresh]);

  const calculatedData = useMemo(() => {
    // ... (Keep existing calculation logic)
    let totalRealizedPnL = portfolio.transactions.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    let totalMarketValue = 0;
    const industryMap: Record<string, number> = {};
    const getRealizedPnL = (filterFn: (t: TransactionRecord) => boolean) => {
      return portfolio.transactions.filter(filterFn).reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    };

    const categories: CalculatedCategory[] = portfolio.categories.map(cat => {
      const projectedInvestment = Math.floor(portfolio.totalCapital * (cat.allocationPercent / 100));
      const currentExchangeRate = cat.market === 'US' ? portfolio.settings.usExchangeRate : 1;
      
      const calculatedAssets: CalculatedAsset[] = cat.assets.map(asset => {
        const costBasis = asset.lots.reduce((sum, lot) => sum + (lot.shares * lot.costPerShare * lot.exchangeRate), 0);
        const marketValue = asset.shares * asset.currentPrice * currentExchangeRate;
        const unrealizedPnL = Math.round(marketValue - costBasis);
        const returnRate = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
        
        let totalShares = asset.lots.reduce((s, l) => s + l.shares, 0);
        let totalOriginalCost = asset.lots.reduce((s, l) => s + (l.shares * l.costPerShare), 0);
        const avgCost = totalShares > 0 ? totalOriginalCost / totalShares : 0;
        const assetRealized = getRealizedPnL(t => t.assetId === asset.id);
        const portfolioRatio = projectedInvestment > 0 ? (costBasis / projectedInvestment) * 100 : 0;
        
        const industry = getIndustry(asset.symbol, cat.market);
        industryMap[industry] = (industryMap[industry] || 0) + marketValue;

        return {
          ...asset,
          avgCost: Math.round(avgCost * 100) / 100,
          costBasis: Math.round(costBasis),
          marketValue: Math.round(marketValue),
          unrealizedPnL,
          returnRate,
          portfolioRatio,
          realizedPnL: assetRealized
        };
      });

      const investedAmount = calculatedAssets.reduce((sum, a) => sum + a.costBasis, 0);
      const categoryMarketValue = calculatedAssets.reduce((sum, a) => sum + a.marketValue, 0);
      totalMarketValue += categoryMarketValue;
      const categoryRealizedPnL = getRealizedPnL(t => t.categoryName === cat.name);

      let cashFlow = projectedInvestment;
      const catTransactions = portfolio.transactions.filter(t => t.categoryName === cat.name);
      catTransactions.forEach(t => {
        if (t.type === 'BUY') {
           cashFlow -= (t.amount + (t.fee || 0));
        } else if (t.type === 'SELL') {
           cashFlow += (t.amount - (t.fee || 0) - (t.tax || 0));
        } else if (t.type === 'DIVIDEND') {
           cashFlow += (t.amount - (t.tax || 0));
        }
      });
      
      const remainingCash = Math.round(cashFlow);
      const investmentRatio = projectedInvestment > 0 ? (investedAmount / projectedInvestment) * 100 : 0;

      return {
        ...cat,
        projectedInvestment,
        investedAmount,
        remainingCash,
        investmentRatio,
        realizedPnL: categoryRealizedPnL,
        assets: calculatedAssets
      };
    });

    const totalInvested = categories.reduce((sum, c) => sum + c.investedAmount, 0);
    const totalUnrealizedPnL = categories.reduce((sum, c) => sum + (c as any).assets.reduce((as: number, a: CalculatedAsset) => as + a.unrealizedPnL, 0), 0);

    const industryData = Object.entries(industryMap)
      .map(([name, value]) => ({
        name,
        value,
        percent: totalMarketValue > 0 ? (value / totalMarketValue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    const monthlyDataMap = new Map<string, number>();
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
       const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
       const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
       monthlyDataMap.set(key, 0);
    }

    portfolio.transactions.forEach(t => {
       if ((t.type === 'SELL' || t.type === 'DIVIDEND') && t.realizedPnL) {
          const date = new Date(t.date);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyDataMap.has(key)) {
             monthlyDataMap.set(key, (monthlyDataMap.get(key) || 0) + t.realizedPnL);
          }
       }
    });

    const monthlyPnLData = Array.from(monthlyDataMap.entries())
       .map(([month, value]) => ({ month, value }))
       .sort((a, b) => a.month.localeCompare(b.month));

    return {
      categories,
      totalInvested,
      totalUnrealizedPnL,
      totalRealizedPnL,
      totalMarketValue,
      industryData,
      monthlyPnLData
    };
  }, [portfolio]);

  // ... (Keep existing simple handlers) ...
  const syncTotalCapital = (logs: CapitalLogEntry[]) => logs.reduce((sum, log) => log.type === 'DEPOSIT' ? sum + log.amount : sum - log.amount, 0);
  const handleAddCapitalLog = (entry: Omit<CapitalLogEntry, 'id'>) => {
     // ... copy logic from original App.tsx
     const prev = portfolioRef.current;
     const newLog = { ...entry, id: uuidv4() };
     const newLogs = [...prev.capitalLogs, newLog];
     const newState = {
         ...prev,
         capitalLogs: newLogs,
         totalCapital: syncTotalCapital(newLogs),
         lastModified: Date.now()
     };
     saveAndSetPortfolio(newState);
     showToast(`${entry.type === 'DEPOSIT' ? '入金' : '出金'}成功！`, 'success');
  };
  const handleDeleteCapitalLog = (id: string) => { 
      if(!window.confirm("確定要刪除此筆資金紀錄嗎？總投入資金將會重新計算。")) return;
      const prev = portfolioRef.current;
      const newLogs = prev.capitalLogs.filter(l => l.id !== id);
      const newState = {
          ...prev,
          capitalLogs: newLogs,
          totalCapital: syncTotalCapital(newLogs),
          lastModified: Date.now()
      };
      saveAndSetPortfolio(newState);
      showToast("資金紀錄已刪除", 'info');
  };
  const handleUpdateAllocation = (id: string, percent: number) => { 
    const prev = portfolioRef.current;
    const newState = {
      ...prev,
      lastModified: Date.now(),
      categories: prev.categories.map(c => c.id === id ? { ...c, allocationPercent: percent } : c)
    };
    saveAndSetPortfolio(newState);
  };
  const handleUpdateSettings = (newSettings: AppSettings) => {
    const prev = portfolioRef.current;
    const newState = { ...prev, settings: newSettings, lastModified: Date.now() };
    saveAndSetPortfolio(newState);
    showToast("系統設定已更新", 'success');
  };
  const handleImportData = (data: PortfolioState) => {
    if (!data.capitalLogs && data.totalCapital > 0) {
        data.capitalLogs = [{ id: uuidv4(), date: new Date().toISOString(), type: 'DEPOSIT', amount: data.totalCapital, note: '匯入資料補登' }];
    }
    if (!data.settings.usBroker) { data.settings.enableFees = true; data.settings.usBroker = 'Firstrade'; }
    data.lastModified = Date.now();
    saveAndSetPortfolio(data);
    setIsDataLoaded(true);
    showToast("資料匯入成功！", 'success');
  };
  const handleDeleteAsset = (assetId: string) => { 
    if (!activeCategoryId) return;
    if (!window.confirm('確定要刪除此持倉嗎? 注意：這將不會保留歷史交易紀錄，若要記錄請使用「賣出」。')) return;
    const prev = portfolioRef.current;
    const newState = {
      ...prev,
      lastModified: Date.now(),
      categories: prev.categories.map(c => {
        if (c.id === activeCategoryId) {
          return { ...c, assets: c.assets.filter(a => a.id !== assetId) };
        }
        return c;
      })
    };
    saveAndSetPortfolio(newState);
    showToast("持倉資料已刪除", 'info');
  };
  const handleUpdateAssetNote = (assetId: string, note: string) => { 
    if (!activeCategoryId) return;
    const prev = portfolioRef.current;
    const newState = {
      ...prev,
      lastModified: Date.now(),
      categories: prev.categories.map(c => {
        if (c.id === activeCategoryId) {
          return { ...c, assets: c.assets.map(a => a.id === assetId ? { ...a, note } : a) };
        }
        return c;
      })
    };
    saveAndSetPortfolio(newState);
    showToast("筆記已儲存", 'success');
  };
  
  // ... (Keep complex transaction logic batchExecute, etc.) ...
  const batchExecuteTransactions = (orders: {order: OrderData, catId: string}[]) => {
    // ... copy exact logic from original
    const now = new Date();
    let prev = { ...portfolioRef.current };
    for (const { order, catId } of orders) {
      let newTransactions = [...prev.transactions];
      const newCategories = prev.categories.map(cat => {
        if (cat.id !== catId) return cat;
        const catBudget = Math.floor(prev.totalCapital * (cat.allocationPercent / 100));
        let tradeRatio = 0;
        let newAssets = [...cat.assets];
        const existingAssetIndex = newAssets.findIndex(
          a => (order.assetId && a.id === order.assetId) || a.symbol === order.symbol
        );
        if (order.action === 'BUY') {
          tradeRatio = catBudget > 0 ? (order.totalAmount / catBudget) * 100 : 0;
        } else if (order.action === 'SELL' && existingAssetIndex >= 0) {
          const existing = newAssets[existingAssetIndex];
          if (existing.shares > 0) {
            const currentCostBasis = existing.lots.reduce((sum, lot) => sum + (lot.shares * lot.costPerShare * lot.exchangeRate), 0);
            const currentAlloc = catBudget > 0 ? (currentCostBasis / catBudget) * 100 : 0;
            tradeRatio = (order.shares / existing.shares) * currentAlloc;
          }
        }
        const newTx: TransactionRecord = {
          id: uuidv4(),
          date: order.action === 'DIVIDEND' ? now.toISOString() : now.toISOString(),
          assetId: existingAssetIndex >= 0 ? newAssets[existingAssetIndex].id : (order.assetId || uuidv4()),
          symbol: order.symbol,
          name: order.name,
          type: order.action,
          shares: order.shares,
          price: order.price, 
          exchangeRate: order.exchangeRate,
          amount: order.totalAmount, 
          fee: order.fee,
          tax: order.tax,
          categoryName: cat.name,
          realizedPnL: 0, 
          portfolioRatio: tradeRatio
        };
        if (order.action === 'BUY') {
          const newLotId = uuidv4();
          newTx.lotId = newLotId; 
          const newLot: AssetLot = {
            id: newLotId,
            date: now.toISOString(),
            shares: order.shares,
            costPerShare: order.price,
            exchangeRate: order.exchangeRate
          };
          if (existingAssetIndex >= 0) {
            const existing = newAssets[existingAssetIndex];
            newTx.assetId = existing.id;
            const updatedLots = [...existing.lots, newLot];
            newAssets[existingAssetIndex] = { ...existing, shares: existing.shares + order.shares, lots: updatedLots };
          } else {
            newAssets.push({ id: newTx.assetId, symbol: order.symbol, name: order.name, shares: order.shares, avgCost: order.price, currentPrice: order.price, lots: [newLot] });
          }
        } else if (order.action === 'SELL') {
          if (existingAssetIndex >= 0) {
            const existing = newAssets[existingAssetIndex];
            newTx.assetId = existing.id;
            let remainingSharesToSell = order.shares;
            let realizedPnL = 0;
            let currentLots = [...existing.lots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const updatedLots: AssetLot[] = [];
            const sellValuePerShareTWD = order.price * order.exchangeRate;
            for (const lot of currentLots) {
              if (remainingSharesToSell <= 0) { updatedLots.push(lot); continue; }
              const lotCostPerShareTWD = lot.costPerShare * lot.exchangeRate;
              const profitPerShareTWD = sellValuePerShareTWD - lotCostPerShareTWD;
              if (lot.shares <= remainingSharesToSell) {
                realizedPnL += profitPerShareTWD * lot.shares;
                remainingSharesToSell -= lot.shares;
              } else {
                realizedPnL += profitPerShareTWD * remainingSharesToSell;
                updatedLots.push({ ...lot, shares: lot.shares - remainingSharesToSell });
                remainingSharesToSell = 0;
              }
            }
            newTx.realizedPnL = Math.round(realizedPnL - order.fee - order.tax);
            const remainingTotalShares = existing.shares - order.shares;
            if (remainingTotalShares <= 0) {
              newAssets = newAssets.filter((_, idx) => idx !== existingAssetIndex);
            } else {
              newAssets[existingAssetIndex] = { ...existing, shares: remainingTotalShares, lots: updatedLots };
            }
          }
        } else if (order.action === 'DIVIDEND') {
           newTx.realizedPnL = Math.round(order.totalAmount - order.tax);
           if (existingAssetIndex >= 0) newTx.assetId = newAssets[existingAssetIndex].id;
        }
        newTransactions.push(newTx);
        return { ...cat, assets: newAssets };
      });
      prev = { ...prev, categories: newCategories, transactions: newTransactions };
    }
    const finalState = { ...prev, lastModified: Date.now() };
    saveAndSetPortfolio(finalState);
  };

  const handleExecuteOrder = (order: OrderData) => {
    if (!activeCategoryId) return;
    batchExecuteTransactions([{ order, catId: activeCategoryId }]);
    if (order.action === 'DIVIDEND') {
       showToast(`股息入帳成功：${order.name}`, 'success');
    } else {
       showToast(`${order.action === 'BUY' ? '買入' : '賣出'}委託成功：${order.symbol}`, 'success');
    }
  };
  const handleConfirmDividends = (dividends: ScannedDividend[]) => {
    const orders: {order: OrderData, catId: string}[] = [];
    dividends.forEach(div => {
       const cat = portfolioRef.current.categories.find(c => c.name === div.categoryName);
       if (cat) {
          const exRate = div.market === 'US' ? portfolioRef.current.settings.usExchangeRate : 1;
          const grossOriginal = div.rate * div.shares;
          const grossTWD = grossOriginal * exRate;
          const taxOriginal = grossOriginal * div.taxRate;
          const taxTWD = taxOriginal * exRate;
          orders.push({
             order: {
               assetId: div.assetId,
               symbol: div.symbol,
               name: div.name,
               action: 'DIVIDEND',
               price: 0,
               shares: 0,
               exchangeRate: exRate,
               totalAmount: grossTWD,
               fee: 0,
               tax: taxTWD,
             },
             catId: cat.id
          });
       }
    });
    if (orders.length > 0) {
       batchExecuteTransactions(orders);
       showToast(`已確認 ${orders.length} 筆股息入帳`, 'success');
    }
  };
  
  const getSharesAtDate = useCallback((assetId: string, dateStr: string): number => {
      const targetDate = new Date(dateStr);
      const txs = portfolioRef.current.transactions
        .filter(t => (t.assetId === assetId) && new Date(t.date) < targetDate)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let sharesOwned = 0;
      txs.forEach(t => {
         if (t.type === 'BUY') sharesOwned += t.shares;
         else if (t.type === 'SELL') sharesOwned -= t.shares;
      });
      return sharesOwned;
  }, []);

  const handleRevokeTransaction = (txId: string) => {
    const prev = portfolioRef.current;
    const tx = prev.transactions.find(t => t.id === txId);
    if (!tx) return;
    const newCategories = prev.categories.map(cat => {
        if (cat.name !== tx.categoryName) return cat;
        let newAssets = [...cat.assets];
        const assetIndex = newAssets.findIndex(a => a.id === tx.assetId || a.symbol === tx.symbol);
        if (tx.type === 'BUY') {
          if (assetIndex === -1) return cat; 
          const asset = newAssets[assetIndex];
          const newLots = asset.lots.filter(l => l.id !== tx.lotId);
          const newShares = asset.shares - tx.shares;
          if (newLots.length === 0 && newShares <= 0) {
            newAssets.splice(assetIndex, 1);
          } else {
            newAssets[assetIndex] = { ...asset, shares: newShares, lots: newLots };
          }
        } else if (tx.type === 'SELL') {
          const realizedPnL = tx.realizedPnL || 0;
          const exchangeRateSafe = tx.exchangeRate || 1; 
          const totalRevenueTWD = tx.price * exchangeRateSafe * tx.shares;
          const totalCostBasisTWD = totalRevenueTWD - realizedPnL - (tx.fee || 0) - (tx.tax || 0);
          const originalCostPerShare = tx.shares > 0 ? (totalCostBasisTWD / tx.shares) / exchangeRateSafe : 0;
          const restoredLot: AssetLot = {
            id: uuidv4(), 
            date: tx.date, 
            shares: tx.shares,
            costPerShare: originalCostPerShare,
            exchangeRate: exchangeRateSafe
          };
          if (assetIndex === -1) {
             newAssets.push({ id: tx.assetId || uuidv4(), symbol: tx.symbol, name: tx.name, shares: tx.shares, avgCost: originalCostPerShare, currentPrice: tx.price, lots: [restoredLot] });
          } else {
            const asset = newAssets[assetIndex];
            newAssets[assetIndex] = { ...asset, shares: asset.shares + tx.shares, lots: [...asset.lots, restoredLot] };
          }
        }
        return { ...cat, assets: newAssets };
    });
    const newState = { ...prev, categories: newCategories, transactions: prev.transactions.filter(t => t.id !== txId), lastModified: Date.now() };
    saveAndSetPortfolio(newState);
    showToast("交易已撤銷，庫存已還原", 'info');
  };

  const handleRefreshSingleAsset = async (assetId: string, symbol: string, market: string) => {
    try {
      const price = await stockService.getPrice(symbol, market as 'TW'|'US');
      if (price) {
        const prev = portfolioRef.current;
        const newState = {
          ...prev,
          lastModified: Date.now(),
          categories: prev.categories.map(cat => ({
            ...cat,
            assets: cat.assets.map(a => a.id === assetId ? { ...a, currentPrice: price } : a)
          }))
        };
        saveAndSetPortfolio(newState);
        setLastUpdated(new Date());
        showToast(`已更新 ${symbol} 股價`, 'success');
      } else { throw new Error("No price"); }
    } catch (e) { showToast("更新失敗", 'error'); }
  };

  const handleRefreshCategory = async (categoryId: string) => {
    const category = portfolio.categories.find(c => c.id === categoryId);
    if (!category || category.assets.length ===0) return;
    try {
      const assetsToFetch = category.assets.map(a => ({ symbol: a.symbol, market: category.market as 'TW'|'US' }));
      const priceMap = await stockService.getPrices(assetsToFetch);
      const prev = portfolioRef.current;
      const newState = {
        ...prev,
        lastModified: Date.now(),
        categories: prev.categories.map(cat => {
          if (cat.id !== categoryId) return cat;
          return {
            ...cat,
            assets: cat.assets.map(asset => {
              const newPrice = priceMap[asset.symbol] || priceMap[asset.symbol.toUpperCase()];
              return newPrice ? { ...asset, currentPrice: newPrice } : asset;
            })
          };
        })
      };
      saveAndSetPortfolio(newState);
      setLastUpdated(new Date());
      showToast(`${category.name} 股價更新完成`, 'success');
    } catch(e) { showToast("更新失敗", 'error'); }
  };

  const handleScanDividends = async () => {
    setIsScanningDividends(true);
    setShowDividendModal(true);
    setScannedDividends([]);
    try {
        const uniqueAssets: { id: string; symbol: string; name: string; categoryName: string; market: 'TW' | 'US' }[] = [];
        const seen = new Set<string>();
        portfolioRef.current.categories.forEach(c => {
           c.assets.forEach(a => {
               const key = `${a.symbol}-${c.market}`;
               if (!seen.has(key)) { seen.add(key); uniqueAssets.push({ id: a.id, symbol: a.symbol, name: a.name, categoryName: c.name, market: c.market as 'TW' | 'US' }); }
           });
        });
        const results: ScannedDividend[] = [];
        await Promise.all(uniqueAssets.map(async (asset) => {
            try {
                const divs = await stockService.getDividends(asset.symbol, asset.market);
                for (const div of divs) {
                    const sharesHeld = getSharesAtDate(asset.id, div.date);
                    if (sharesHeld > 0) {
                        const alreadyRecorded = portfolioRef.current.transactions.some(t => t.type === 'DIVIDEND' && t.symbol === asset.symbol && t.date.split('T')[0] === div.date.split('T')[0]);
                        if (!alreadyRecorded) {
                             results.push({ id: uuidv4(), assetId: asset.id, symbol: asset.symbol, name: asset.name, exDate: div.date, rate: div.amount, shares: sharesHeld, taxRate: asset.market === 'US' ? 0.3 : 0, categoryName: asset.categoryName, market: asset.market });
                        }
                    }
                }
            } catch (e) { console.warn(`Error scanning dividends for ${asset.symbol}`, e); }
        }));
        results.sort((a, b) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime());
        setScannedDividends(results);
        if (results.length === 0) { showToast("掃描完成，無新的配息紀錄", 'info'); } else { showToast(`掃描完成，發現 ${results.length} 筆配息`, 'success'); }
    } catch (e) { console.error("Scan failed", e); showToast("配息掃描失敗", 'error'); } finally { setIsScanningDividends(false); }
  };

  const activeCategory = activeCategoryId ? calculatedData.categories.find(c => c.id === activeCategoryId) : null;
  const allAvailableAssets = useMemo(() => {
     const list: { id: string; symbol: string; name: string; categoryName: string; market: 'TW' | 'US' }[] = [];
     portfolio.categories.forEach(c => {
         c.assets.forEach(a => { list.push({ id: a.id, symbol: a.symbol, name: a.name, categoryName: c.name, market: c.market }); });
     });
     return list;
  }, [portfolio.categories]);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      
      {/* Guided Tour Component */}
      <GuidedTour 
        isOpen={isTourActive}
        steps={tourSteps}
        onComplete={() => setIsTourActive(false)}
        onSkip={() => setIsTourActive(false)}
      />

      {/* Modals */}
      <OnboardingModal 
        isOpen={showOnboarding}
        initialCategories={DEFAULT_CATEGORIES}
        onComplete={handleOnboardingComplete}
      />

      {/* Conditionally Render Tutorial to reset state on close/open */}
      {showTutorial && (
        <TutorialModal 
          isOpen={showTutorial} 
          onClose={handleTutorialClose} 
          onLoginRequest={handleTutorialLogin}
          isLoggedIn={!!user}
        />
      )}

      <NewsModal 
        isOpen={showNewsModal}
        onClose={() => { setShowNewsModal(false); setHasNewNews(false); if (newsItems.length > 0) { const timestamps = newsItems.map(n => new Date(n.pubDate).getTime()).filter(t => !isNaN(t) && t > 0); if (timestamps.length > 0) { const latestTime = Math.max(...timestamps); localStorage.setItem('libao-news-last-read', latestTime.toString()); }}}}
        newsItems={newsItems}
        isLoading={isFetchingNews}
      />

      <SettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={portfolio.settings}
        onUpdateSettings={handleUpdateSettings}
        fullPortfolio={portfolio}
        onImportData={handleImportData}
        onResetPortfolio={handleResetPortfolio}
      />

      <DividendModal 
        isOpen={showDividendModal}
        onClose={() => setShowDividendModal(false)}
        scannedDividends={scannedDividends}
        availableAssets={allAvailableAssets}
        usExchangeRate={portfolio.settings.usExchangeRate}
        onCheckShares={getSharesAtDate}
        onConfirm={handleConfirmDividends}
        isLoading={isScanningDividends}
      />

      <CapitalModal 
        isOpen={showCapitalModal}
        onClose={() => setShowCapitalModal(false)}
        capitalLogs={portfolio.capitalLogs || []}
        onAddLog={handleAddCapitalLog}
        onDeleteLog={handleDeleteCapitalLog}
        isPrivacyMode={isPrivacyMode}
      />

      {/* Nav */}
      <nav className="bg-gray-900 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setActiveCategoryId(null); setViewMode('PORTFOLIO')}}>
              <Briefcase className="w-8 h-8 text-libao-gold" />
              <div>
                <span className="font-bold text-xl tracking-tight hidden sm:inline">Libao</span>
                <span className="text-gray-400 text-sm ml-1 hidden sm:inline">財經學院</span>
                <span className="font-bold text-lg sm:hidden">Libao</span>
              </div>
            </div>
            
            {/* Desktop Center Menu (Restored) */}
            <div className="hidden lg:flex items-center bg-gray-800 rounded-lg p-1 mx-4">
              <button onClick={() => { setActiveCategoryId(null); setViewMode('PORTFOLIO'); }} className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'PORTFOLIO' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                <LayoutDashboard className="w-4 h-4" /> 持倉總覽
              </button>
              <button onClick={() => { setActiveCategoryId(null); setViewMode('HISTORY'); }} className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'HISTORY' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                <History className="w-4 h-4" /> 交易紀錄
              </button>
              <button onClick={() => { setActiveCategoryId(null); setViewMode('DIVIDENDS'); }} className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'DIVIDENDS' ? 'bg-purple-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                <Coins className="w-4 h-4" /> 股息帳本
              </button>
              
              {/* Academy Resources Dropdown */}
              <div className="relative group ml-1">
                 <button className="px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                    <BookOpen className="w-4 h-4" /> 學院資源 <ChevronDown className="w-3 h-3 group-hover:rotate-180 transition-transform" />
                 </button>
                 <div className="absolute top-full right-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[60]">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-48 py-1">
                       <a href="https://line.me/R/ti/p/@607dxbdr" target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-green-600 flex items-center gap-2 transition-colors"><MessageCircle className="w-4 h-4 text-green-500"/> LINE 官方帳號</a>
                       <a href="https://libao-finance-school.mykajabi.com/products/6/categories" target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2 border-t border-gray-100 transition-colors"><BookOpen className="w-4 h-4 text-blue-500"/> 投資組合參考</a>
                    </div>
                 </div>
              </div>
            </div>

            {/* Right Toolbar (Unified for Mobile & Desktop) */}
            <div className="flex items-center gap-1 md:gap-2">
               {/* News Button */}
               <div className="relative" id="tour-news-btn">
                 <button onClick={() => setShowNewsModal(true)} className={`p-2 rounded-full hover:bg-gray-800 text-gray-300 hover:text-white transition-all ${hasNewNews ? 'animate-pulse text-yellow-400' : ''}`} title="持股新聞">
                   <Bell className={`w-5 h-5 md:w-4 md:h-4 ${hasNewNews ? 'fill-yellow-400' : ''}`} />
                 </button>
                 {hasNewNews && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-900"></span>}
               </div>

               {/* User Login/Profile (Restored for Desktop) */}
               {isFirebaseEnabled && (
                <div className="hidden md:flex items-center mr-1 border-r border-gray-700 pr-3">
                  {user ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end mr-1">
                         <span className="text-xs font-bold text-green-400 flex items-center gap-1"><Cloud className="w-3 h-3" /> 已同步</span>
                         <span className="text-[10px] text-gray-400 max-w-[80px] truncate">{user.displayName || user.email}</span>
                      </div>
                      <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="User" className="w-8 h-8 rounded-full border border-gray-600"/>
                      <button onClick={handleLogout} className="text-gray-400 hover:text-white p-1" title="登出"><LogOut className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={handleTutorialLogin} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all"><LogIn className="w-3 h-3" /> 登入同步</button>
                  )}
                </div>
               )}

               {/* Privacy Toggle */}
               <button onClick={() => setIsPrivacyMode(!isPrivacyMode)} className={`p-2 rounded-full hover:bg-gray-800 transition-all ${isPrivacyMode ? 'text-yellow-400' : 'text-gray-300 hover:text-white'}`} title={isPrivacyMode ? "顯示金額" : "隱藏金額"}>
                 {isPrivacyMode ? <EyeOff className="w-5 h-5 md:w-4 md:h-4" /> : <Eye className="w-5 h-5 md:w-4 md:h-4" />}
               </button>

               {/* Manual Update */}
               <button 
                id="tour-update-btn" 
                onClick={() => handleUpdatePrices(false)}
                disabled={isUpdatingPrices}
                className={`p-2 rounded-full hover:bg-gray-800 text-gray-300 hover:text-white transition-all disabled:opacity-50 ${isUpdatingPrices ? 'text-green-400' : ''}`}
                title="手動更新股價"
              >
                <RefreshCw className={`w-5 h-5 md:w-4 md:h-4 ${isUpdatingPrices ? 'animate-spin' : ''}`} /> 
              </button>

               {/* Hamburger Menu (Always Visible) */}
               <button 
                 id="tour-menu-btn"
                 onClick={() => setIsSidebarOpen(true)} 
                 className="p-2 ml-1 text-gray-300 hover:text-white active:scale-95 transition-transform rounded-full hover:bg-gray-800"
                 title="更多功能"
               >
                  <Menu className="w-7 h-7 md:w-6 md:h-6" />
               </button>
            </div>
          </div>
          
          {/* Mobile Bottom Tabs (Only visible on small screens) */}
          <div className="md:hidden flex border-t border-gray-800 mt-2">
            <button onClick={() => { setActiveCategoryId(null); setViewMode('PORTFOLIO'); }} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${viewMode === 'PORTFOLIO' ? 'text-libao-gold border-b-2 border-libao-gold' : 'text-gray-400'}`}><LayoutDashboard className="w-4 h-4" /> 持倉</button>
            <button onClick={() => { setActiveCategoryId(null); setViewMode('HISTORY'); }} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${viewMode === 'HISTORY' ? 'text-libao-gold border-b-2 border-libao-gold' : 'text-gray-400'}`}><History className="w-4 h-4" /> 紀錄</button>
            <button onClick={() => { setActiveCategoryId(null); setViewMode('DIVIDENDS'); }} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${viewMode === 'DIVIDENDS' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}><Coins className="w-4 h-4" /> 股息</button>
          </div>
        </div>
      </nav>

      {/* Sidebar (Unified for Mobile & Desktop) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100]">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSidebarOpen(false)}></div>
           
           {/* Drawer Content */}
           <div className="absolute top-0 right-0 h-full w-[80%] max-w-[300px] bg-gray-900 text-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                 <span className="font-bold text-lg flex items-center gap-2"><Menu className="w-5 h-5 text-gray-400"/>選單</span>
                 <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-gray-800 rounded-full"><X className="w-6 h-6 text-gray-400" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                 {/* Profile Section */}
                 {user ? (
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
                       <div className="flex items-center gap-3 mb-4">
                          <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} className="w-12 h-12 rounded-full border-2 border-gray-600" />
                          <div className="overflow-hidden">
                             <div className="font-bold text-white truncate">{user.displayName || 'User'}</div>
                             <div className="text-xs text-gray-400 truncate">{user.email}</div>
                          </div>
                       </div>
                       <div className="flex items-center gap-2 text-xs text-green-400 mb-4 bg-black/20 p-2 rounded border border-white/5">
                          <Cloud className="w-3 h-3" /> 資料已同步至雲端
                       </div>
                       <button onClick={handleLogout} className="w-full py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                          <LogOut className="w-4 h-4" /> 登出帳號
                       </button>
                    </div>
                 ) : (
                    <div className="bg-blue-900/20 p-5 rounded-xl border border-blue-500/30 text-center">
                       <UserIcon className="w-10 h-10 mx-auto text-blue-400 mb-2 opacity-80" />
                       <p className="text-sm text-blue-200 mb-3 font-medium">登入以同步資料，永久保存</p>
                       <button onClick={() => { handleTutorialLogin(); setIsSidebarOpen(false); }} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg flex items-center justify-center gap-2">
                          <LogIn className="w-4 h-4" /> 立即登入
                       </button>
                    </div>
                 )}

                 {/* View Navigation (Mobile mainly, but functional on desktop if needed) */}
                 <div className="space-y-1 lg:hidden">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">檢視模式</div>
                    <button onClick={() => { setActiveCategoryId(null); setViewMode('PORTFOLIO'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${viewMode === 'PORTFOLIO' ? 'bg-gray-800 text-white' : 'hover:bg-gray-800 text-gray-400'}`}>
                        <LayoutDashboard className="w-5 h-5" /> <span className="text-sm font-medium">持倉總覽</span>
                    </button>
                    <button onClick={() => { setActiveCategoryId(null); setViewMode('HISTORY'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${viewMode === 'HISTORY' ? 'bg-gray-800 text-white' : 'hover:bg-gray-800 text-gray-400'}`}>
                        <History className="w-5 h-5" /> <span className="text-sm font-medium">交易紀錄</span>
                    </button>
                    <button onClick={() => { setActiveCategoryId(null); setViewMode('DIVIDENDS'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${viewMode === 'DIVIDENDS' ? 'bg-purple-900/30 text-purple-300' : 'hover:bg-gray-800 text-gray-400'}`}>
                        <Coins className="w-5 h-5" /> <span className="text-sm font-medium">股息帳本</span>
                    </button>
                 </div>

                 {/* Toggles Group */}
                 <div className="space-y-1">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">功能開關</div>
                    
                    <button onClick={() => setIsPrivacyMode(!isPrivacyMode)} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 transition-colors bg-gray-800/40 border border-gray-800">
                       <div className="flex items-center gap-3">
                          {isPrivacyMode ? <EyeOff className="w-5 h-5 text-yellow-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                          <span className="text-sm font-medium">隱私模式 (隱藏金額)</span>
                       </div>
                       <div className={`w-9 h-5 rounded-full relative transition-colors ${isPrivacyMode ? 'bg-yellow-500' : 'bg-gray-600'}`}>
                          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isPrivacyMode ? 'left-5' : 'left-1'}`}></div>
                       </div>
                    </button>

                    <button onClick={() => setIsAutoRefresh(!isAutoRefresh)} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 transition-colors bg-gray-800/40 border border-gray-800">
                       <div className="flex items-center gap-3">
                          {isAutoRefresh ? <PauseCircle className="w-5 h-5 text-green-400" /> : <PlayCircle className="w-5 h-5 text-gray-400" />}
                          <span className="text-sm font-medium">自動更新股價 (60s)</span>
                       </div>
                       <div className={`w-9 h-5 rounded-full relative transition-colors ${isAutoRefresh ? 'bg-green-500' : 'bg-gray-600'}`}>
                          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isAutoRefresh ? 'left-5' : 'left-1'}`}></div>
                       </div>
                    </button>
                 </div>

                 {/* Academy Resources & Actions */}
                 <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-1">學院資源</div>
                    <a href="https://line.me/R/ti/p/@607dxbdr" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 active:bg-gray-700 transition-colors group">
                       <div className="flex items-center gap-3"><div className="p-2 bg-gray-800 rounded-full group-hover:bg-gray-700"><MessageCircle className="w-4 h-4 text-green-400" /></div><span className="text-sm font-medium">LINE 官方帳號</span></div><ChevronRight className="w-4 h-4 text-gray-600" />
                    </a>
                    <a href="https://libao-finance-school.mykajabi.com/products/6/categories" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 active:bg-gray-700 transition-colors group">
                       <div className="flex items-center gap-3"><div className="p-2 bg-gray-800 rounded-full group-hover:bg-gray-700"><BookOpen className="w-4 h-4 text-blue-400" /></div><span className="text-sm font-medium">投資組合參考 (會員限定)</span></div><ChevronRight className="w-4 h-4 text-gray-600" />
                    </a>
                 </div>

                 <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-1">系統操作</div>
                    <button onClick={() => { setShowSettingsModal(true); setIsSidebarOpen(false); }} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 active:bg-gray-700 transition-colors group">
                       <div className="flex items-center gap-3"><div className="p-2 bg-gray-800 rounded-full group-hover:bg-gray-700"><Settings className="w-4 h-4 text-gray-300" /></div><span className="text-sm font-medium">系統設定 / 備份 / 重置</span></div><ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                    <button onClick={() => { setShowTutorial(true); setIsSidebarOpen(false); }} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 active:bg-gray-700 transition-colors group">
                       <div className="flex items-center gap-3"><div className="p-2 bg-gray-800 rounded-full group-hover:bg-gray-700"><HelpCircle className="w-4 h-4 text-yellow-400" /></div><span className="text-sm font-medium">操作教學</span></div><ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                 </div>
              </div>
              <div className="p-4 text-center text-[10px] text-gray-600 border-t border-gray-800 bg-black/20">v4.0.0 Libao Finance Academy</div>
           </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'DIVIDENDS' ? (
           <DividendLedger 
             transactions={portfolio.transactions}
             onScan={handleScanDividends}
             onRevoke={handleRevokeTransaction}
             isPrivacyMode={isPrivacyMode}
           />
        ) : viewMode === 'HISTORY' ? (
          <TransactionHistory 
            transactions={portfolio.transactions} 
            portfolio={portfolio}
            onRevoke={handleRevokeTransaction}
            isPrivacyMode={isPrivacyMode}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
              {/* Industry Analysis (Left) */}
              <div className="md:col-span-4 lg:col-span-3 order-3 md:order-1">
                <IndustryAnalysis 
                  data={calculatedData.industryData} 
                  totalValue={calculatedData.totalMarketValue}
                  isPrivacyMode={isPrivacyMode}
                />
              </div>

              {/* Middle & Right: Stats + Chart */}
              <div className="md:col-span-8 lg:col-span-9 order-1 md:order-2 flex flex-col gap-4">
                
                {/* Top Stats Cards */}
                {/* Moved ID tour-total-capital to the parent container to highlight all cards */}
                <div id="tour-total-capital" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                       <div>
                          <div className="text-gray-500 text-sm font-medium flex items-center gap-1 mb-1">
                              <DollarSign className="w-4 h-4" /> 總投入本金
                          </div>
                          <div className="text-xl font-bold font-mono text-gray-800">
                              NT$ {maskValue(portfolio.totalCapital.toLocaleString())}
                          </div>
                       </div>
                       <button onClick={() => setShowCapitalModal(true)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold text-gray-600 hover:text-blue-600 transition-colors border border-gray-200">
                          出/入金
                       </button>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="text-gray-500 text-sm font-medium mb-1">總已投入 (TWD)</div>
                    <div className="text-xl font-bold text-gray-800 font-mono">
                        NT${maskValue(calculatedData.totalInvested.toLocaleString())}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      使用率: {portfolio.totalCapital > 0 ? ((calculatedData.totalInvested / portfolio.totalCapital) * 100).toFixed(1) : 0}%
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl shadow-sm border ${calculatedData.totalUnrealizedPnL >= 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                    <div className={`text-sm font-medium mb-1 flex items-center gap-1 ${calculatedData.totalUnrealizedPnL >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                      <TrendingUp className="w-4 h-4" /> 未實現損益
                    </div>
                    <div className={`text-xl font-bold font-mono ${calculatedData.totalUnrealizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {isPrivacyMode ? '*******' : (calculatedData.totalUnrealizedPnL > 0 ? '+' : '') + calculatedData.totalUnrealizedPnL.toLocaleString()}
                    </div>
                    <div className={`text-xs font-bold mt-1 ${calculatedData.totalUnrealizedPnL >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {(calculatedData.totalInvested > 0 ? (calculatedData.totalUnrealizedPnL / calculatedData.totalInvested) * 100 : 0).toFixed(2)}%
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl shadow-sm border bg-white border-gray-200`}>
                    <div className="text-gray-500 text-sm font-medium mb-1 flex items-center gap-1">
                      <History className="w-4 h-4" /> 總已實現損益
                    </div>
                    <div className={`text-xl font-bold font-mono ${calculatedData.totalRealizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {isPrivacyMode ? '*******' : (calculatedData.totalRealizedPnL > 0 ? '+' : '') + calculatedData.totalRealizedPnL.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Monthly PnL Chart */}
                <div className="flex-1 min-h-[220px]">
                   <MonthlyPnLChart 
                      data={calculatedData.monthlyPnLData} 
                      isPrivacyMode={isPrivacyMode}
                   />
                </div>
              </div>
            </div>
            
            {/* Added ID wrapper for Summary Table Tour Step */}
            <div id="tour-summary-table">
                {activeCategoryId && activeCategory ? (
                  <DetailTable 
                    category={activeCategory}
                    assets={(activeCategory as any).assets}
                    totalCapital={portfolio.totalCapital}
                    onBack={() => setActiveCategoryId(null)}
                    onExecuteOrder={handleExecuteOrder}
                    onDeleteAsset={handleDeleteAsset}
                    onUpdateAssetPrice={handleRefreshSingleAsset}
                    onUpdateCategoryPrices={handleRefreshCategory}
                    onUpdateAssetNote={handleUpdateAssetNote}
                    defaultExchangeRate={portfolio.settings.usExchangeRate}
                    isPrivacyMode={isPrivacyMode}
                    settings={portfolio.settings}
                  />
                ) : (
                  <SummaryTable 
                    categories={calculatedData.categories}
                    totalCapital={portfolio.totalCapital}
                    onUpdateAllocation={handleUpdateAllocation}
                    onSelectCategory={setActiveCategoryId}
                    onRefreshCategory={handleRefreshCategory}
                    isPrivacyMode={isPrivacyMode}
                  />
                )}
            </div>
          </>
        )}
      </main>

      {/* Syncing Indicator */}
      {isSyncing && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-[200] text-sm animate-pulse">
           <Cloud className="w-4 h-4" /> 同步雲端資料中...
        </div>
      )}

      <footer className="text-center text-gray-400 text-sm py-8">
        <p>&copy; {new Date().getFullYear()} Libao Finance Academy.</p>
      </footer>
    </div>
  );
};

export default App;
