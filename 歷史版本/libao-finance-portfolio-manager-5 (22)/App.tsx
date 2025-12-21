
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Briefcase, 
  RefreshCw, 
  History, 
  LayoutDashboard, 
  Settings, 
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
  ShieldAlert
} from 'lucide-react';
import { PortfolioState, CalculatedCategory, CalculatedAsset, TransactionRecord, AppSettings, NewsItem, AssetLot, Asset, MarketType } from './types';
import { DEFAULT_CATEGORIES, INITIAL_CAPITAL, DEFAULT_EXCHANGE_RATE } from './constants';
import SummaryTable from './components/SummaryTable';
import DetailTable from './components/DetailTable';
import TransactionHistory from './components/TransactionHistory';
import DividendLedger from './components/DividendLedger';
import SettingsModal from './components/SettingsModal';
import FeeSettingsModal from './components/FeeSettingsModal';
import IndustryAnalysis from './components/IndustryAnalysis';
import DividendModal, { ScannedDividend } from './components/DividendModal';
import CapitalModal from './components/CapitalModal';
import MonthlyPnLChart from './components/MonthlyPnLChart';
import TutorialModal from './components/TutorialModal';
import OnboardingModal from './components/OnboardingModal';
import NewsModal from './components/NewsModal';
import GuidedTour, { TourStep } from './components/GuidedTour';
import { stockService } from './services/StockService'; 
import { getIndustry } from './services/industryService';
import { 
  loginWithGoogle, 
  logoutUser, 
  subscribeToAuthChanges, 
  savePortfolioToCloud, 
  loadPortfolioFromCloud, 
  resetCloudPortfolio
} from './services/firebase';
import { useToast } from './contexts/ToastContext';
import { OrderData } from './components/OrderModal';

const maskValueFn = (val: string | number, isPrivacyMode: boolean) => isPrivacyMode ? '*******' : val;

const App: React.FC = () => {
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
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
      lastModified: Date.now()
  }), []);

  const [portfolio, setPortfolio] = useState<PortfolioState>(initialPortfolioState);
  const portfolioRef = useRef(portfolio);
  useEffect(() => { portfolioRef.current = portfolio; }, [portfolio]);

  const [viewMode, setViewMode] = useState<'PORTFOLIO' | 'HISTORY' | 'DIVIDENDS'>('PORTFOLIO');
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
    const assetsList: {symbol: string, name: string, market: 'TW' | 'US'}[] = [];
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
          const cloudData = await loadPortfolioFromCloud(currentUser.uid);
          if (cloudData) {
             saveAndSetPortfolio(cloudData);
             localStorage.setItem('libao-onboarding-v1', 'true'); 
             fetchStockNews();
          } else {
             const localData = localStorage.getItem('libao-portfolio');
             if (localData) {
                const parsed = JSON.parse(localData);
                setPortfolio(parsed);
                setIsDataLoaded(true);
                await savePortfolioToCloud(currentUser.uid, parsed);
                fetchStockNews();
             } else {
                setShowOnboarding(true);
             }
          }
        } catch (e) { console.error(e); } finally { setIsSyncing(false); }
      } else {
        const localData = localStorage.getItem('libao-portfolio');
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                setPortfolio(parsed);
                setIsDataLoaded(true);
                fetchStockNews();
            } catch(e) { console.error(e); }
        }
      }
    });
    return () => unsubscribe();
  }, [saveAndSetPortfolio, fetchStockNews]);

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
    setIsSyncing(true);
    const loggedInUser = await loginWithGoogle();
    if (!loggedInUser) setIsSyncing(false);
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

  useEffect(() => {
    if (user && isDataLoaded) {
      const saveTimer = setTimeout(() => savePortfolioToCloud(user.uid, portfolio), 2000);
      return () => clearTimeout(saveTimer);
    }
  }, [portfolio, user, isDataLoaded]);

  const handleUpdatePrices = async (isSilent = false) => {
    if (isUpdatingPrices) return;
    const allAssets: {symbol: string, market: MarketType}[] = [];
    portfolioRef.current.categories.forEach(c => c.assets.forEach(a => allAssets.push({ symbol: a.symbol, market: c.market as MarketType })));
    if (allAssets.length === 0) { if (!isSilent) showToast("目前沒有持倉", 'info'); return; }
    setIsUpdatingPrices(true);
    try {
      const priceMap = await stockService.getPrices(allAssets);
      const newState = { ...portfolioRef.current, categories: portfolioRef.current.categories.map(cat => ({ ...cat, assets: cat.assets.map(asset => ({ ...asset, currentPrice: priceMap[asset.symbol] || asset.currentPrice })) })) };
      saveAndSetPortfolio(newState); if(!isSilent) { showToast("股價更新完成", 'success'); fetchStockNews(); }
    } catch (e) { if (!isSilent) showToast("更新失敗", 'error'); } finally { setIsUpdatingPrices(false); }
  };

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
    const txId = uuidv4();
    const lotId = order.action === 'BUY' ? uuidv4() : undefined;
    const currentCategory = portfolio.categories.find(c => c.id === activeCategoryId);
    if (!currentCategory) return;
    const newTx: TransactionRecord = {
      id: txId, date: new Date().toISOString(), assetId: order.assetId || uuidv4(), lotId: lotId, symbol: order.symbol, name: order.name, type: order.action, shares: order.shares, price: order.price, exchangeRate: order.exchangeRate, amount: order.totalAmount, fee: order.fee, tax: order.tax, categoryName: currentCategory.name, realizedPnL: 0 
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
          const totalCostTWD = updatedLots.reduce((s, l) => s + (l.shares * l.costPerShare * l.exchangeRate), 0);
          nextAssets[assetIdx] = { ...asset, shares: totalShares, avgCost: totalCostTWD / totalShares, lots: updatedLots, currentPrice: order.price };
        } else {
          nextAssets.push({ id: newTx.assetId, symbol: order.symbol, name: order.name, shares: order.shares, avgCost: order.price, currentPrice: order.price, lots: [newLot] });
        }
      } else if (order.action === 'SELL') {
        if (assetIdx === -1) return cat;
        const asset = nextAssets[assetIdx];
        let remainingToSell = order.shares;
        let totalCostOfSoldSharesTWD = 0;
        let updatedLots = [...asset.lots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const processedLots = [];
        for (const lot of updatedLots) {
          if (remainingToSell <= 0) { processedLots.push(lot); continue; }
          if (lot.shares <= remainingToSell) { totalCostOfSoldSharesTWD += lot.shares * lot.costPerShare * lot.exchangeRate; remainingToSell -= lot.shares; }
          else { totalCostOfSoldSharesTWD += remainingToSell * lot.costPerShare * lot.exchangeRate; processedLots.push({ ...lot, shares: lot.shares - remainingToSell }); remainingToSell = 0; }
        }
        const realizedPnL = order.totalAmount - totalCostOfSoldSharesTWD - order.fee - order.tax;
        newTx.realizedPnL = realizedPnL;
        newTx.originalCostTWD = totalCostOfSoldSharesTWD; // 關鍵修正：記錄賣出部分的原始成本
        const totalShares = asset.shares - order.shares;
        if (totalShares <= 0) { nextAssets = nextAssets.filter(a => a.symbol !== order.symbol); }
        else {
          const totalCostRemainingTWD = processedLots.reduce((s, l) => s + (l.shares * l.costPerShare * l.exchangeRate), 0);
          nextAssets[assetIdx] = { ...asset, shares: totalShares, lots: processedLots, avgCost: totalCostRemainingTWD / totalShares, currentPrice: order.price };
        }
      }
      return { ...cat, assets: nextAssets };
    });
    saveAndSetPortfolio({ ...portfolio, categories: nextCategories, transactions: [newTx, ...portfolio.transactions] });
    showToast(order.action === 'BUY' ? "買入成功" : "賣出成功", "success");
    fetchStockNews();
  };

  /**
   * 修正後的撤銷交易邏輯：增強對連鎖撤銷的支援，並確保成本百分比還原
   */
  const handleRevokeTransaction = (txId: string) => {
    const tx = portfolio.transactions.find(t => t.id === txId);
    if (!tx) return;

    const nextTransactions = portfolio.transactions.filter(t => t.id !== txId);
    const nextCategories = portfolio.categories.map(cat => {
      if (cat.name !== tx.categoryName) return cat;

      let nextAssets = [...cat.assets];
      const assetIdx = nextAssets.findIndex(a => a.symbol === tx.symbol);

      if (tx.type === 'BUY') {
        if (assetIdx === -1) return cat; 
        const asset = nextAssets[assetIdx];
        
        // 修正：優先移除符合 ID 的 Lot，若找不到則移除該資產最新的一個 Lot
        let nextLots = asset.lots.filter(l => l.id !== tx.lotId);
        if (nextLots.length === asset.lots.length) {
           nextLots = [...asset.lots].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(1);
        }

        const totalShares = asset.shares - tx.shares;
        if (totalShares <= 0) {
          nextAssets = nextAssets.filter(a => a.symbol !== tx.symbol);
        } else {
          const totalCostTWD = nextLots.reduce((s, l) => s + (l.shares * l.costPerShare * l.exchangeRate), 0);
          nextAssets[assetIdx] = { 
            ...asset, 
            shares: totalShares, 
            lots: nextLots, 
            avgCost: totalCostTWD / totalShares 
          };
        }
      } 
      else if (tx.type === 'SELL') {
        // 修正：使用 tx.originalCostTWD 來還原原始批次的成本，而非使用賣出價
        // 這能解決「撤銷賣出後，持股比例沒回到賣出前」的問題。
        const originalCostPerShare = (tx.originalCostTWD || (tx.shares * tx.price * tx.exchangeRate)) / tx.shares;
        
        const restoredLot: AssetLot = { 
          id: uuidv4(), 
          date: tx.date, 
          shares: tx.shares, 
          costPerShare: originalCostPerShare / tx.exchangeRate, 
          exchangeRate: tx.exchangeRate 
        };

        if (assetIdx > -1) {
          const asset = nextAssets[assetIdx];
          const updatedLots = [restoredLot, ...asset.lots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const totalShares = asset.shares + tx.shares;
          const totalCostTWD = updatedLots.reduce((s, l) => s + (l.shares * l.costPerShare * l.exchangeRate), 0);
          nextAssets[assetIdx] = { 
            ...asset, 
            shares: totalShares, 
            lots: updatedLots, 
            avgCost: totalCostTWD / totalShares 
          };
        } else {
          nextAssets.push({ 
            id: tx.assetId, 
            symbol: tx.symbol, 
            name: tx.name, 
            shares: tx.shares, 
            avgCost: originalCostPerShare / tx.exchangeRate, 
            currentPrice: tx.price, 
            lots: [restoredLot] 
          });
        }
      }
      return { ...cat, assets: nextAssets };
    });

    saveAndSetPortfolio({ ...portfolio, categories: nextCategories, transactions: nextTransactions });
    showToast("交易已撤銷", "info");
    fetchStockNews();
  };

  const calculatedData = useMemo(() => {
    let totalMarketValue = 0;
    const industryMap: Record<string, number> = {};
    const getRealizedPnL = (filterFn: (t: TransactionRecord) => boolean) => portfolio.transactions.filter(filterFn).reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const categories: CalculatedCategory[] = portfolio.categories.map(cat => {
      const projectedInvestment = Math.floor(portfolio.totalCapital * (cat.allocationPercent / 100));
      const currentExchangeRate = cat.market === 'US' ? portfolio.settings.usExchangeRate : 1;
      const calculatedAssets: CalculatedAsset[] = cat.assets.map(asset => {
        const costBasis = asset.lots.reduce((sum, lot) => sum + (lot.shares * lot.costPerShare * lot.exchangeRate), 0);
        const marketValue = asset.shares * asset.currentPrice * currentExchangeRate;
        const unrealizedPnL = Math.round(marketValue - costBasis);
        const industry = getIndustry(asset.symbol, cat.market as MarketType);
        industryMap[industry] = (industryMap[industry] || 0) + marketValue;
        return { ...asset, costBasis: Math.round(costBasis), marketValue: Math.round(marketValue), unrealizedPnL, returnRate: costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0, portfolioRatio: projectedInvestment > 0 ? (costBasis / projectedInvestment) * 100 : 0, realizedPnL: getRealizedPnL(t => t.assetId === asset.id) };
      });
      const investedAmount = calculatedAssets.reduce((sum, a) => sum + a.costBasis, 0);
      totalMarketValue += calculatedAssets.reduce((sum, a) => sum + a.marketValue, 0);
      return { ...cat, projectedInvestment, investedAmount, remainingCash: Math.round(projectedInvestment - investedAmount), investmentRatio: projectedInvestment > 0 ? (investedAmount / projectedInvestment) * 100 : 0, realizedPnL: getRealizedPnL(t => t.categoryName === cat.name), assets: calculatedAssets };
    });
    const monthlyDataMap = new Map<string, number>();
    const today = new Date();
    for (let i = 5; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); monthlyDataMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0); }
    portfolio.transactions.forEach(t => { if (t.realizedPnL) { const d = new Date(t.date); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (monthlyDataMap.has(k)) monthlyDataMap.set(k, (monthlyDataMap.get(k) || 0) + t.realizedPnL); } });
    return { 
      categories, 
      totalInvested: categories.reduce((sum, c) => sum + c.investedAmount, 0), 
      totalUnrealizedPnL: categories.reduce((sum, c) => sum + c.assets.reduce((as, a) => as + a.unrealizedPnL, 0), 0), 
      totalRealizedPnL: portfolio.transactions.reduce((sum, t) => sum + (t.realizedPnL || 0), 0), 
      totalMarketValue, 
      industryData: Object.entries(industryMap).map(([name, value]) => ({ name, value, percent: totalMarketValue > 0 ? (value / totalMarketValue) * 100 : 0 })).sort((a, b) => b.value - a.value), 
      monthlyPnLData: Array.from(monthlyDataMap.entries()).map(([month, value]) => ({ month, value })) 
    };
  }, [portfolio]);

  const totalNetWorth = portfolio.totalCapital + calculatedData.totalRealizedPnL + calculatedData.totalUnrealizedPnL;
  const investedRatio = totalNetWorth > 0 ? (calculatedData.totalInvested / totalNetWorth) * 100 : 0;
  const unrealizedRatio = calculatedData.totalInvested > 0 ? (calculatedData.totalUnrealizedPnL / calculatedData.totalInvested) * 100 : 0;

  const handleUpdateAllocation = (id: string, percent: number) => { saveAndSetPortfolio({ ...portfolio, categories: portfolio.categories.map(c => c.id === id ? { ...c, allocationPercent: percent } : c) }); };
  const handleUpdateSettings = (s: AppSettings) => { saveAndSetPortfolio({ ...portfolio, settings: s }); showToast("設定已儲存", 'success'); };

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
                {isSyncing ? <RefreshCw className="w-6 h-6 animate-spin"/> : <Cloud className="w-6 h-6 text-blue-600" />}
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
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} settings={portfolio.settings} onUpdateSettings={handleUpdateSettings} fullPortfolio={portfolio} onImportData={(d) => { saveAndSetPortfolio(d); }} onResetPortfolio={async () => { if(confirm("確定重置?")) { if(user) await resetCloudPortfolio(user.uid); localStorage.clear(); window.location.reload(); } }} />
      <FeeSettingsModal isOpen={showFeeSettingsModal} onClose={() => setShowFeeSettingsModal(false)} settings={portfolio.settings} onUpdateSettings={handleUpdateSettings} />
      <DividendModal isOpen={showDividendModal} onClose={() => setShowDividendModal(false)} scannedDividends={scannedDividends} availableAssets={portfolio.categories.flatMap(c => c.assets.map(a => ({ ...a, categoryName: c.name, market: c.market as any })))} usExchangeRate={portfolio.settings.usExchangeRate} onCheckShares={() => 100} onConfirm={() => {}} isLoading={isScanningDividends} />
      <CapitalModal isOpen={showCapitalModal} onClose={() => setShowCapitalModal(false)} capitalLogs={portfolio.capitalLogs} onAddLog={(l) => { const newState = { ...portfolio, capitalLogs: [...portfolio.capitalLogs, { ...l, id: uuidv4() }] }; newState.totalCapital = newState.capitalLogs.reduce((s, log) => log.type === 'DEPOSIT' ? s + log.amount : s - log.amount, 0); saveAndSetPortfolio(newState); }} onDeleteLog={(id) => { const newState = { ...portfolio, capitalLogs: portfolio.capitalLogs.filter(l => l.id !== id) }; newState.totalCapital = newState.capitalLogs.reduce((s, log) => log.type === 'DEPOSIT' ? s + log.amount : s - log.amount, 0); saveAndSetPortfolio(newState); }} isPrivacyMode={isPrivacyMode} />

      <nav className="bg-gray-900 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setActiveCategoryId(null); setViewMode('PORTFOLIO')}}>
              <Briefcase className="w-8 h-8 text-libao-gold" />
              <span className="font-bold text-xl tracking-tight">Libao <span className="text-gray-400 text-sm font-normal hidden sm:inline">財經學院</span></span>
            </div>
            <div className="hidden lg:flex items-center bg-gray-800 rounded-lg p-1 mx-4">
              <button id="nav-desktop-dashboard" onClick={() => { setViewMode('PORTFOLIO'); setActiveCategoryId(null); }} className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'PORTFOLIO' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                <LayoutDashboard className="w-4 h-4" /> 持倉總覽
              </button>
              <button id="nav-desktop-history" onClick={() => { setViewMode('HISTORY'); }} className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'HISTORY' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                <History className="w-4 h-4" /> 交易紀錄
              </button>
              <button id="nav-desktop-dividend" onClick={() => { setViewMode('DIVIDENDS'); }} className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'DIVIDENDS' ? 'bg-purple-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                <Coins className="w-4 h-4" /> 股息帳本
              </button>
              <div id="nav-desktop-academy" className="relative group ml-1">
                 <button className="px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 text-gray-400 hover:text-white">
                    <BookOpen className="w-4 h-4" /> 學院資源 <ChevronDown className="w-3 h-3 group-hover:rotate-180 transition-transform" />
                 </button>
                 <div className="absolute top-full right-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[60]">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-48 py-1">
                       <a href="https://line.me/R/ti/p/@607dxbdr" target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"><MessageCircle className="w-4 h-4 text-green-500"/> LINE 官方帳號</a>
                       <a href="https://libao-finance-school.mykajabi.com/products/6/categories" target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"><BookOpen className="w-4 h-4 text-blue-500"/> 投資組合參考</a>
                    </div>
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
      </nav>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100]">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsSidebarOpen(false)}></div>
           <div className="absolute top-0 right-0 h-full w-80 bg-gray-900 text-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 bg-gray-800/80 border-b border-gray-700/50 shrink-0">
                 <div className="flex justify-between items-center mb-6">
                    <span className="font-bold text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-libao-gold"/>雲端同步帳號</span>
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
                       <button onClick={() => {setIsSidebarOpen(false); setViewMode('PORTFOLIO'); setActiveCategoryId(null); setTimeout(() => setIsTourActive(true), 500);}} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all group">
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

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 ${activeCategoryId ? 'py-0' : 'py-8'}`}>
          {viewMode === 'PORTFOLIO' && (
              <>
                  {!activeCategoryId && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                       <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-6 order-1 md:order-2">
                          <div id="tour-total-capital" className="flex flex-col gap-4">
                              <div className="bg-gradient-to-r from-gray-900 to-indigo-900 p-6 rounded-2xl shadow-xl border border-gray-800 relative overflow-hidden">
                                 <div className="relative z-10 flex justify-between items-center">
                                    <div>
                                       <div className="text-indigo-300 text-[10px] sm:text-xs font-bold mb-1 tracking-wider uppercase">總資產淨值 (Net Worth)</div>
                                       <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">NT$ {maskValue(Math.round(totalNetWorth).toLocaleString())}</div>
                                    </div>
                                    <Briefcase className="w-10 h-10 sm:w-12 sm:h-12 text-libao-gold opacity-30" />
                                 </div>
                                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                              </div>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                  <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                                     <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1"><Wallet className="w-3 h-3"/> 投入本金</div>
                                     <div className="text-base sm:text-xl font-mono font-bold">
                                         <div className="truncate mb-1">NT$ {maskValue(portfolio.totalCapital.toLocaleString())}</div>
                                         <button onClick={() => setShowCapitalModal(true)} className="text-[9px] sm:text-[10px] bg-indigo-50 px-2 py-1 rounded text-indigo-600 font-bold hover:bg-indigo-100 border border-indigo-100 transition-colors w-fit">出/入金</button>
                                     </div>
                                  </div>
                                  <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                                     <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1"><TrendingUp className="w-3 h-3 text-red-500"/> 未實現損益</div>
                                     <div className={`text-base sm:text-xl font-mono font-bold ${calculatedData.totalUnrealizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                         {calculatedData.totalUnrealizedPnL > 0 ? '+' : ''}{maskValue(calculatedData.totalUnrealizedPnL.toLocaleString())}
                                         <span className="text-xs block font-bold opacity-80 mt-1">{unrealizedRatio > 0 ? '+' : ''}{unrealizedRatio.toFixed(2)}%</span>
                                     </div>
                                  </div>
                                  <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
                                     <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1"><History className="w-3 h-3 text-indigo-500"/> 已實現損益</div>
                                     <div className={`text-base sm:text-xl font-mono font-bold ${calculatedData.totalRealizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                         {calculatedData.totalRealizedPnL > 0 ? '+' : ''}{maskValue(calculatedData.totalRealizedPnL.toLocaleString())}
                                     </div>
                                  </div>
                                  <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-200 ring-1 ring-indigo-50 lg:ring-2">
                                     <div className="text-gray-500 text-[10px] font-bold mb-2 uppercase flex items-center gap-1"><Coins className="w-3 h-3 text-indigo-600"/> 已投入資金</div>
                                     <div className="text-base sm:text-xl font-mono font-bold text-indigo-700">
                                         NT$ {maskValue(calculatedData.totalInvested.toLocaleString())}
                                         <span className="text-xs block font-bold text-indigo-400 mt-1">佔比 {investedRatio.toFixed(1)}%</span>
                                     </div>
                                  </div>
                              </div>
                          </div>
                          <MonthlyPnLChart data={calculatedData.monthlyPnLData} isPrivacyMode={isPrivacyMode} />
                       </div>
                       <div className="md:col-span-4 lg:col-span-3 order-2 md:order-1">
                          <IndustryAnalysis data={calculatedData.industryData} totalValue={calculatedData.totalMarketValue} isPrivacyMode={isPrivacyMode} />
                       </div>
                    </div>
                  )}
                  <div id="tour-summary-table">
                      {activeCategoryId ? (
                        <DetailTable category={calculatedData.categories.find(c => c.id === activeCategoryId)!} assets={calculatedData.categories.find(c => c.id === activeCategoryId)!.assets} totalCapital={portfolio.totalCapital} onBack={() => setActiveCategoryId(null)} onExecuteOrder={handleExecuteOrder} onDeleteAsset={() => {}} onUpdateAssetPrice={handleUpdateAssetPrice} onUpdateCategoryPrices={handleRefreshCategory} onUpdateAssetNote={() => {}} defaultExchangeRate={portfolio.settings.usExchangeRate} isPrivacyMode={isPrivacyMode} settings={portfolio.settings} forceShowOrderModal={isTourForceOrderOpen} />
                      ) : (
                        <SummaryTable categories={calculatedData.categories} totalCapital={portfolio.totalCapital} onUpdateAllocation={handleUpdateAllocation} onSelectCategory={setActiveCategoryId} onRefreshCategory={handleRefreshCategory} isPrivacyMode={isPrivacyMode} />
                      )}
                  </div>
              </>
          )}
          {viewMode === 'HISTORY' && (
              <TransactionHistory transactions={portfolio.transactions} portfolio={portfolio} onRevoke={handleRevokeTransaction} isPrivacyMode={isPrivacyMode} />
          )}
          {viewMode === 'DIVIDENDS' && (
              <DividendLedger transactions={portfolio.transactions} onScan={() => setShowDividendModal(true)} onRevoke={handleRevokeTransaction} isPrivacyMode={isPrivacyMode} />
          )}
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 z-40">
          <button id="nav-mobile-dashboard" onClick={() => { setViewMode('PORTFOLIO'); setActiveCategoryId(null); }} className={`flex flex-col items-center gap-1 ${viewMode === 'PORTFOLIO' ? 'text-blue-600' : 'text-gray-400'}`}><LayoutDashboard className="w-6 h-6" /><span className="text-[10px]">持倉</span></button>
          <button id="nav-mobile-history" onClick={() => { setViewMode('HISTORY'); }} className={`flex flex-col items-center gap-1 ${viewMode === 'HISTORY' ? 'text-blue-600' : 'text-gray-400'}`}><History className="w-6 h-6" /><span className="text-[10px]">紀錄</span></button>
          <button id="nav-mobile-dividend" onClick={() => { setViewMode('DIVIDENDS'); }} className={`flex flex-col items-center gap-1 ${viewMode === 'DIVIDENDS' ? 'text-purple-600' : 'text-gray-400'}`}><Coins className="w-6 h-6" /><span className="text-[10px]">股息</span></button>
      </div>
    </div>
  );
};

export default App;
