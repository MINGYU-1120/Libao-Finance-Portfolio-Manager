
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
  HelpCircle 
} from 'lucide-react';
import { PortfolioState, Asset, AssetLot, CalculatedCategory, CalculatedAsset, TransactionRecord, CapitalLogEntry, AppSettings, PositionCategory } from './types';
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
import { OrderData } from './components/OrderModal';
import { stockService } from './services/StockService'; 
import { getIndustry } from './services/industryService';
import { 
  loginWithGoogle, 
  logoutUser, 
  subscribeToAuthChanges, 
  savePortfolioToCloud, 
  loadPortfolioFromCloud, 
  isFirebaseReady 
} from './services/firebase';
import { useToast } from './contexts/ToastContext';

const maskValueFn = (val: string | number, isPrivacyMode: boolean) => isPrivacyMode ? '*******' : val;

const App: React.FC = () => {
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isFirebaseEnabled, setIsFirebaseEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- UI State ---
  const [showTutorial, setShowTutorial] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // --- Initialization Logic ---
  const [portfolio, setPortfolio] = useState<PortfolioState>(() => {
    // Basic default state
    return {
      totalCapital: INITIAL_CAPITAL,
      settings: { 
        usExchangeRate: DEFAULT_EXCHANGE_RATE,
        enableFees: true,
        usBroker: 'Firstrade'
      },
      categories: DEFAULT_CATEGORIES,
      transactions: [],
      capitalLogs: [], 
      lastModified: Date.now()
    };
  });

  const portfolioRef = useRef(portfolio);
  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  const [viewMode, setViewMode] = useState<'PORTFOLIO' | 'HISTORY' | 'DIVIDENDS'>('PORTFOLIO');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDividendModal, setShowDividendModal] = useState(false);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [showTutorialManual, setShowTutorialManual] = useState(false); // For manual trigger
  
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [scannedDividends, setScannedDividends] = useState<ScannedDividend[]>([]);
  const [isScanningDividends, setIsScanningDividends] = useState(false);

  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  
  const maskValue = (val: string | number) => maskValueFn(val, isPrivacyMode);

  // --- Initial Flow Control ---
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('libao-tutorial-seen-v5');
    const isOnboarded = localStorage.getItem('libao-onboarding-v1');
    const localData = localStorage.getItem('libao-portfolio');
    
    // Priority 1: If user has finished onboarding previously, just load data, do nothing else.
    if (isOnboarded && localData) {
        try {
            const parsed = JSON.parse(localData);
            setPortfolio(parsed);
        } catch(e) { console.error(e); }
        return;
    }

    // Priority 2: If fresh user (no local flag), show Tutorial
    if (!hasSeenTutorial) {
       setShowTutorial(true);
    } else {
       // Priority 3: Seen tutorial but not onboarded (e.g. cancelled login) -> Show Onboarding if no data
       if (!localData) {
          setShowOnboarding(true);
       }
    }
  }, []);

  // --- Helper: Synchronous Save ---
  const saveAndSetPortfolio = useCallback((newState: PortfolioState) => {
      try {
          localStorage.setItem('libao-portfolio', JSON.stringify(newState));
      } catch (e) {
          console.error("Save Error", e);
      }
      setPortfolio(newState);
  }, []);

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
      
      // Save locally
      saveAndSetPortfolio(newState);
      localStorage.setItem('libao-onboarding-v1', 'true');
      
      // Sync to cloud if logged in
      if (user) {
          savePortfolioToCloud(user.uid, newState);
      }
      
      // Force reload to clear all states cleanly and enter app
      window.location.reload();
  };

  const handleTutorialLogin = async () => {
     // Mark tutorial as seen immediately so it doesn't pop up again
     localStorage.setItem('libao-tutorial-seen-v5', 'true');
     setShowTutorial(false);
     
     // Trigger Google Login
     const loggedInUser = await loginWithGoogle();
     
     if (!loggedInUser) {
        // User cancelled login -> Show Onboarding for local usage
        const isOnboarded = localStorage.getItem('libao-onboarding-v1');
        if (!isOnboarded) {
           setShowOnboarding(true);
        }
     }
     // If success, the Auth Listener below handles the logic
  };

  const handleTutorialClose = () => {
     // User skipped tutorial
     setShowTutorial(false);
     localStorage.setItem('libao-tutorial-seen-v5', 'true');
     
     // If no data, show onboarding
     const localData = localStorage.getItem('libao-portfolio');
     if (!localData) {
        setShowOnboarding(true);
     }
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
             // === RETURNING USER ===
             // Cloud data exists. Load it, skip onboarding.
             saveAndSetPortfolio(cloudData);
             localStorage.setItem('libao-onboarding-v1', 'true'); 
             
             // Close everything
             setShowTutorial(false);
             setShowOnboarding(false);
             
             showToast(`歡迎回來，${currentUser.displayName}`, 'success');
          } else {
             // === NEW USER (Logged in but no data) ===
             // Check if local data is meaningful
             const localData = localStorage.getItem('libao-portfolio');
             if (localData && localStorage.getItem('libao-onboarding-v1')) {
                 // User has local setup -> Upload
                 await savePortfolioToCloud(currentUser.uid, portfolioRef.current);
                 showToast("本地資料已同步至雲端", 'success');
             } else {
                 // True new user -> Show Onboarding
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
  }, [saveAndSetPortfolio]); 

  const handleLogout = async () => {
     // Updated Text: Reassure user that cloud data is safe
     if(!window.confirm("確定要登出嗎？\n\n您的資料將安全地保存在雲端 (若已同步)。\n登出後，此裝置上的暫存資料將被清除以確保隱私安全。")) return;
     
     await logoutUser();
     localStorage.clear(); 
     window.location.reload(); 
  };

  useEffect(() => {
    // Auto-save backup
    try {
      localStorage.setItem('libao-portfolio', JSON.stringify(portfolio));
    } catch (e) { console.error(e); }

    if (user && isFirebaseEnabled) {
      const timeoutId = setTimeout(() => {
        savePortfolioToCloud(user.uid, portfolio);
      }, 500); 
      return () => clearTimeout(timeoutId);
    }
  }, [portfolio, user, isFirebaseEnabled]);

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
    } catch (e) {
      if (!isSilent) showToast("股價更新失敗", 'error');
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const latestUpdatePricesRef = useRef(handleUpdatePrices);
  useEffect(() => {
    latestUpdatePricesRef.current = handleUpdatePrices;
  });

  useEffect(() => {
    if (isAutoRefresh) {
      latestUpdatePricesRef.current(true);
      autoRefreshIntervalRef.current = setInterval(() => {
        latestUpdatePricesRef.current(true);
      }, 60000);
    } else {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    }
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [isAutoRefresh]);

  const calculatedData = useMemo(() => {
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

  const syncTotalCapital = (logs: CapitalLogEntry[]) => {
      return logs.reduce((sum, log) => {
          return log.type === 'DEPOSIT' ? sum + log.amount : sum - log.amount;
      }, 0);
  };

  const handleAddCapitalLog = (entry: Omit<CapitalLogEntry, 'id'>) => {
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
        data.capitalLogs = [{
            id: uuidv4(),
            date: new Date().toISOString(),
            type: 'DEPOSIT',
            amount: data.totalCapital,
            note: '匯入資料補登'
        }];
    }
    if (!data.settings.usBroker) {
       data.settings.enableFees = true;
       data.settings.usBroker = 'Firstrade';
    }
    data.lastModified = Date.now();
    saveAndSetPortfolio(data);
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
          return {
            ...c,
            assets: c.assets.filter(a => a.id !== assetId)
          };
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
          return {
            ...c,
            assets: c.assets.map(a => a.id === assetId ? { ...a, note } : a)
          };
        }
        return c;
      })
    };
    saveAndSetPortfolio(newState);
    showToast("筆記已儲存", 'success');
  };

  const batchExecuteTransactions = (orders: {order: OrderData, catId: string}[]) => {
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

        const txLotId = order.action === 'BUY' ? uuidv4() : undefined;
        const newTx: TransactionRecord = {
          id: uuidv4(),
          date: order.action === 'DIVIDEND' ? now.toISOString() : now.toISOString(),
          assetId: existingAssetIndex >= 0 ? newAssets[existingAssetIndex].id : (order.assetId || uuidv4()),
          lotId: txLotId,
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
          const newLot: AssetLot = {
            id: txLotId!,
            date: now.toISOString(),
            shares: order.shares,
            costPerShare: order.price,
            exchangeRate: order.exchangeRate
          };
          if (existingAssetIndex >= 0) {
            const existing = newAssets[existingAssetIndex];
            newTx.assetId = existing.id;
            const updatedLots = [...existing.lots, newLot];
            newAssets[existingAssetIndex] = {
              ...existing,
              shares: existing.shares + order.shares,
              lots: updatedLots
            };
          } else {
            newAssets.push({
              id: newTx.assetId,
              symbol: order.symbol,
              name: order.name,
              shares: order.shares,
              avgCost: order.price,
              currentPrice: order.price,
              lots: [newLot]
            });
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
              if (remainingSharesToSell <= 0) {
                updatedLots.push(lot);
                continue;
              }
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
      
      prev = { 
        ...prev, 
        categories: newCategories, 
        transactions: newTransactions
      };
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
             newAssets.push({
               id: tx.assetId || uuidv4(),
               symbol: tx.symbol,
               name: tx.name,
               shares: tx.shares,
               avgCost: originalCostPerShare, 
               currentPrice: tx.price, 
               lots: [restoredLot]
             });
          } else {
            const asset = newAssets[assetIndex];
            newAssets[assetIndex] = { ...asset, shares: asset.shares + tx.shares, lots: [...asset.lots, restoredLot] };
          }
        }
        return { ...cat, assets: newAssets };
    });

    const newState = { 
        ...prev, 
        categories: newCategories, 
        transactions: prev.transactions.filter(t => t.id !== txId),
        lastModified: Date.now() 
    };
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
      } else {
        throw new Error("No price");
      }
    } catch (e) {
      showToast("更新失敗", 'error');
    }
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
    } catch(e) {
      showToast("更新失敗", 'error');
    }
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
               if (!seen.has(key)) {
                   seen.add(key);
                   uniqueAssets.push({
                       id: a.id,
                       symbol: a.symbol,
                       name: a.name,
                       categoryName: c.name,
                       market: c.market as 'TW' | 'US'
                   });
               }
           });
        });

        const results: ScannedDividend[] = [];

        await Promise.all(uniqueAssets.map(async (asset) => {
            try {
                const divs = await stockService.getDividends(asset.symbol, asset.market);
                for (const div of divs) {
                    const sharesHeld = getSharesAtDate(asset.id, div.date);
                    if (sharesHeld > 0) {
                        const alreadyRecorded = portfolioRef.current.transactions.some(t => 
                            t.type === 'DIVIDEND' && 
                            t.symbol === asset.symbol && 
                            t.date.split('T')[0] === div.date.split('T')[0]
                        );

                        if (!alreadyRecorded) {
                             results.push({
                                 id: uuidv4(),
                                 assetId: asset.id,
                                 symbol: asset.symbol,
                                 name: asset.name,
                                 exDate: div.date,
                                 rate: div.amount,
                                 shares: sharesHeld,
                                 taxRate: asset.market === 'US' ? 0.3 : 0,
                                 categoryName: asset.categoryName,
                                 market: asset.market
                             });
                        }
                    }
                }
            } catch (e) {
                console.warn(`Error scanning dividends for ${asset.symbol}`, e);
            }
        }));

        results.sort((a, b) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime());
        setScannedDividends(results);
        if (results.length === 0) {
            showToast("掃描完成，無新的配息紀錄", 'info');
        } else {
            showToast(`掃描完成，發現 ${results.length} 筆配息`, 'success');
        }

    } catch (e) {
        console.error("Scan failed", e);
        showToast("配息掃描失敗", 'error');
    } finally {
        setIsScanningDividends(false);
    }
  };

  const activeCategory = activeCategoryId 
    ? calculatedData.categories.find(c => c.id === activeCategoryId) 
    : null;
  const allAvailableAssets = useMemo(() => {
     const list: { id: string; symbol: string; name: string; categoryName: string; market: 'TW' | 'US' }[] = [];
     portfolio.categories.forEach(c => {
         c.assets.forEach(a => {
             list.push({ id: a.id, symbol: a.symbol, name: a.name, categoryName: c.name, market: c.market });
         });
     });
     return list;
  }, [portfolio.categories]);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      
      {/* Modals */}
      <OnboardingModal 
        isOpen={showOnboarding}
        initialCategories={DEFAULT_CATEGORIES}
        onComplete={handleOnboardingComplete}
      />

      <TutorialModal 
        isOpen={showTutorial} 
        onClose={handleTutorialClose} 
        onLoginRequest={handleTutorialLogin}
      />

      <SettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={portfolio.settings}
        onUpdateSettings={handleUpdateSettings}
        fullPortfolio={portfolio}
        onImportData={handleImportData}
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
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setActiveCategoryId(null); setViewMode('PORTFOLIO')}}>
              <Briefcase className="w-8 h-8 text-libao-gold" />
              <div>
                <span className="font-bold text-xl tracking-tight hidden sm:inline">Libao</span>
                <span className="text-gray-400 text-sm ml-1 hidden sm:inline">財經學院</span>
                <span className="font-bold text-lg sm:hidden">Libao</span>
              </div>
            </div>
            
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
            </div>

            <div className="flex items-center gap-2">
              
              {/* Help Button - Now Visible on Mobile */}
              <button 
                onClick={() => setShowTutorial(true)}
                className="p-2 rounded-full border border-gray-700 bg-gray-800 text-gray-300 hover:text-white transition-colors mr-2 flex items-center justify-center"
                title="操作教學"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Auth Button */}
              {isFirebaseEnabled && (
                <div className="mr-2 border-r border-gray-700 pr-3">
                  {user ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end mr-1">
                         <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                           <Cloud className="w-3 h-3" /> 已同步
                         </span>
                         <span className="text-[10px] text-gray-400 max-w-[80px] truncate">{user.displayName || user.email}</span>
                      </div>
                      <img 
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} 
                        alt="User" 
                        className="w-8 h-8 rounded-full border border-gray-600"
                      />
                      <button 
                        onClick={handleLogout}
                        className="text-gray-400 hover:text-white p-1"
                        title="登出"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleTutorialLogin}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all"
                    >
                      <LogIn className="w-3 h-3" /> 登入同步
                    </button>
                  )}
                </div>
              )}

              <button 
                onClick={() => setIsPrivacyMode(!isPrivacyMode)}
                className={`p-2 rounded-full border transition-all mr-1 ${isPrivacyMode ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-gray-800 text-gray-300 border-gray-700 hover:text-white'}`}
                title={isPrivacyMode ? "顯示金額" : "隱藏金額"}
              >
                {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>

              <div className="hidden md:flex items-center bg-gray-800 rounded-full px-3 py-1 border border-gray-700 mr-2">
                 <button 
                  onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                  className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors ${isAutoRefresh ? 'text-green-400' : 'text-gray-500'}`}
                 >
                   {isAutoRefresh ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                   {isAutoRefresh ? 'Auto On (60s)' : 'Auto Off'}
                 </button>
                 {lastUpdated && (
                   <span className="ml-3 pl-3 border-l border-gray-600 text-[10px] text-gray-400 flex items-center gap-1">
                     <Clock className="w-3 h-3" />
                     {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </span>
                 )}
              </div>

               <button 
                onClick={() => handleUpdatePrices(false)}
                disabled={isUpdatingPrices}
                className={`bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white p-2 sm:px-3 sm:py-2 rounded-full text-sm font-medium flex items-center gap-2 border border-gray-700 transition-all disabled:opacity-50 ${isUpdatingPrices || isAutoRefresh ? 'ring-2 ring-green-500/30' : ''}`}
                title="手動更新股價"
              >
                <RefreshCw className={`w-4 h-4 ${isUpdatingPrices ? 'animate-spin text-green-400' : ''}`} /> 
                <span className="hidden sm:inline">{isUpdatingPrices ? '更新中' : '更新'}</span>
              </button>
              
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white p-2 rounded-full border border-gray-700 transition-all"
                title="系統設定 / 備份"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="md:hidden flex border-t border-gray-800 mt-2">
            <button onClick={() => { setActiveCategoryId(null); setViewMode('PORTFOLIO'); }} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${viewMode === 'PORTFOLIO' ? 'text-libao-gold border-b-2 border-libao-gold' : 'text-gray-400'}`}>
                <LayoutDashboard className="w-4 h-4" /> 持倉
            </button>
            <button onClick={() => { setActiveCategoryId(null); setViewMode('HISTORY'); }} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${viewMode === 'HISTORY' ? 'text-libao-gold border-b-2 border-libao-gold' : 'text-gray-400'}`}>
                <History className="w-4 h-4" /> 紀錄
            </button>
            <button onClick={() => { setActiveCategoryId(null); setViewMode('DIVIDENDS'); }} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${viewMode === 'DIVIDENDS' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}>
                <Coins className="w-4 h-4" /> 股息
            </button>
          </div>
        </div>
      </nav>

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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                       <button 
                          onClick={() => setShowCapitalModal(true)}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold text-gray-600 hover:text-blue-600 transition-colors border border-gray-200"
                       >
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
