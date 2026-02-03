import React, { useState, useEffect } from 'react';
import { AIPick, UserRole, StrategyStats, AccessTier, getTier } from '../types';
import { addAIPick, getAIPicks, deleteAIPick, updateAIPick, getSectionMinTier, getStrategyStats, updateStrategyStats } from '../services/firebase';
import { Brain, Lock, Plus, Trash2, TrendingUp, TrendingDown, Target, ShieldCheck, Crown, Activity, BarChart2, Layers } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import StockChartPanel from './StockChartPanel';
import StatsEditModal from './StatsEditModal';
import StrategyPerformanceChart from './StrategyPerformanceChart';

import { ArrowRight, RefreshCw, Search, Edit3 } from 'lucide-react';
import { stockService } from '../services/StockService';
import { ALL_STOCKS, StockItem } from '../data/stockList';

interface AIPicksProps {
    userRole: UserRole;
}

// Add onRepair prop
const PickItem: React.FC<{ pick: AIPick, selectedPick: AIPick | null, onSelect: (p: AIPick) => void, onRepair?: (p: AIPick) => void, userRole?: UserRole }> = ({ pick, selectedPick, onSelect, onRepair, userRole }) => (
    <div
        onClick={() => onSelect(pick)}
        className={`p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-indigo-50/50 ${selectedPick?.id === pick.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
    >
        <div className="flex justify-between items-start mb-1">
            <div>
                <div className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                    {pick.symbol.split(':').pop()} <span className="font-normal text-gray-500 text-base">{pick.name}</span>
                </div>
                <div className="text-sm text-gray-400 font-mono mt-0.5">{pick.date}</div>
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-bold ${pick.market === 'US' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                {pick.market}
            </div>
        </div>
        <div className="flex justify-between items-center mt-2">
            <div className="text-sm text-gray-500 flex items-center gap-2">
                <span>進場:</span>
                {pick.entryPrice ? (
                    <span className="font-mono text-gray-900">{pick.entryPrice}</span>
                ) : (
                    <div className="flex items-center gap-1">
                        <span className="text-orange-400">待開盤</span>
                        {userRole === 'admin' && onRepair && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRepair(pick);
                                }}
                                className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs rounded-full flex items-center gap-1 transition shadow-sm"
                                title="嘗試重新抓取開盤價"
                            >
                                <RefreshCw className="w-3 h-3" /> 抓取價格
                            </button>
                        )}
                    </div>
                )}
                {pick.currentPrice && (
                    <span className="ml-2 text-gray-400">現價: {pick.currentPrice}</span>
                )}
            </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
            {pick.status === 'ACTIVE' && pick.returnSinceEntry !== undefined && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${pick.returnSinceEntry >= 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {pick.returnSinceEntry > 0 ? '+' : ''}{pick.returnSinceEntry.toFixed(1)}%
                </span>
            )}
            {pick.status === 'CLOSED' && pick.realizedReturn !== undefined && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${pick.realizedReturn >= 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    結算 {pick.realizedReturn > 0 ? '+' : ''}{pick.realizedReturn.toFixed(1)}%
                </span>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pick.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {pick.status === 'ACTIVE' ? '追蹤中' : '已結算'}
            </span>
        </div>
    </div>
);

const DEMO_PICKS: AIPick[] = [
    { id: 'd0', stock_symbol: 'AAPL', symbol: 'NASDAQ:AAPL', name: 'Apple Inc.', date: new Date().toISOString().split('T')[0], market: 'US', entryPrice: 175.5, status: 'ACTIVE', returnSinceEntry: 3.2, exitCondition: '跌破 20MA', analysis: 'DEMO: Strong iPhone sales in emerging markets.', timestamp: Date.now(), prediction: 'Bullish', confidence: 0.85 },
    { id: 'd1', stock_symbol: '2330', symbol: '2330', name: '台積電', date: '2024-03-15', market: 'TW', entryPrice: 750, status: 'ACTIVE', returnSinceEntry: 15.2, exitCondition: '跌破 20MA', analysis: 'DEMO: Strong AI demand driving growth.', timestamp: Date.now(), prediction: 'Bullish', confidence: 0.9 },
    { id: 'd2', stock_symbol: 'NVDA', symbol: 'NASDAQ:NVDA', name: 'NVIDIA', date: '2024-03-14', market: 'US', entryPrice: 850, status: 'ACTIVE', returnSinceEntry: 25.4, exitCondition: '跌破 10MA', analysis: 'DEMO: Data center revenue exploding.', timestamp: Date.now(), prediction: 'Bullish', confidence: 0.95 },
    { id: 'd3', stock_symbol: '2454', symbol: '2454', name: '聯發科', date: '2024-02-20', market: 'TW', entryPrice: 1100, exitPrice: 1250, status: 'CLOSED', realizedReturn: 13.6, exitCondition: '跌破 5MA', analysis: 'DEMO: Success in flagship mobile chips.', exitDate: '2024-03-10', timestamp: Date.now(), prediction: 'Neutral', confidence: 0.75 },
];

const DEMO_STATS: StrategyStats = {
    totalReturn: 15.4,
    winRate: 68,
    profitFactor: 1.5,
    tradesCount: 42,
    maxDrawdown: -12.5,
    avgReturn: 15.4,
    avgReturnLabel: "年化報酬",
    drawdownLabel: "最大回撤",
    winRateChange: 2.1,
    lastUpdated: Date.now()
};

const AIPicks: React.FC<AIPicksProps> = ({ userRole }) => {
    const { showToast } = useToast();
    // Animation States
    const [animationStage, setAnimationStage] = useState<'IDLE' | 'SCANNING' | 'RESULT' | 'CONTENT'>('SCANNING');
    const [loadingText, setLoadingText] = useState('AI 正在分析大盤趨勢...');

    // Permission State
    const [minTier, setMinTier] = useState<AccessTier>(AccessTier.STANDARD);
    const [isPermissionLoading, setIsPermissionLoading] = useState(true);

    // Data States
    const [picks, setPicks] = useState<AIPick[]>([]);
    const [selectedPick, setSelectedPick] = useState<AIPick | null>(null);
    const [activeTab, setActiveTab] = useState<'NEW' | 'ACTIVE' | 'HISTORY'>('NEW');
    const [stats, setStats] = useState<StrategyStats | null>(null);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

    // Admin Form States
    const [isAdding, setIsAdding] = useState(false);
    const [newPick, setNewPick] = useState<Partial<AIPick>>({
        date: new Date().toISOString().split('T')[0],
        market: 'TW',
        symbol: '',
        name: '',
        analysis: '',
        status: 'ACTIVE',
        exitCondition: '跌破 20MA',
        entryPrice: 0,
    });

    // Autocomplete State
    const [suggestions, setSuggestions] = useState<StockItem[]>([]);

    // --- PERMISSION LOGIC ---
    // Admin Toggle for Demo View
    const [isDebugDemo, setIsDebugDemo] = useState(false);

    // Check Tier
    const userTier = getTier(userRole);
    const canView = !isDebugDemo && userTier >= minTier; // Only view if tier sufficient

    const blurClass = !canView ? 'blur-[4px] select-none pointer-events-none opacity-60' : '';
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSearchField, setActiveSearchField] = useState<'symbol' | 'name' | null>(null);
    const [isSearchingOnline, setIsSearchingOnline] = useState(false);
    const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Hybrid Search Logic (Same as OrderModal)
    const runHybridSearch = (query: string, field: 'symbol' | 'name') => {
        const upQuery = query.toUpperCase();
        const market = newPick.market as 'TW' | 'US';

        const localResults = ALL_STOCKS.filter(s =>
            s.market === market &&
            (s.symbol.includes(upQuery) || s.name.includes(query) || s.name.toUpperCase().includes(upQuery))
        ).slice(0, 20);

        setSuggestions(localResults);
        setShowSuggestions(true);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (query.length >= 1) {
            setIsSearchingOnline(true);
            searchTimeoutRef.current = setTimeout(async () => {
                try {
                    const onlineResults = await stockService.searchStocks(query, market);
                    setSuggestions(prev => {
                        const currentSymbols = new Set(prev.map(p => p.symbol));
                        const newItems = onlineResults.filter(r => !currentSymbols.has(r.symbol));
                        const combined = [...prev, ...newItems].slice(0, 50);
                        return combined.sort((a, b) => {
                            if (a.symbol === upQuery) return -1;
                            if (b.symbol === upQuery) return 1;
                            return 0;
                        });
                    });
                } catch (e) {
                    console.error("Online search failed", e);
                } finally {
                    setIsSearchingOnline(false);
                }
            }, 400);
        } else {
            setIsSearchingOnline(false);
        }
    };

    const handleSymbolChange = (val: string) => {
        const upVal = val.toUpperCase();
        setNewPick(prev => ({ ...prev, symbol: upVal }));

        if (upVal.length > 0) {
            setActiveSearchField('symbol');
            runHybridSearch(upVal, 'symbol');

            // Auto fetch open price for new symbol
            if (newPick.date && upVal.length >= 2) {
                stockService.getHistoricalOpen(upVal, newPick.market as any, newPick.date).then(price => {
                    if (price) setNewPick(prev => ({ ...prev, entryPrice: price }));
                });
            }
        } else {
            setShowSuggestions(false);
        }
    };

    const handleNameChange = (val: string) => {
        setNewPick(prev => ({ ...prev, name: val }));
        if (val.length > 0) {
            setActiveSearchField('name');
            runHybridSearch(val, 'name');
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (item: StockItem) => {
        setNewPick(prev => ({ ...prev, symbol: item.symbol, name: item.name, market: item.market }));
        setShowSuggestions(false);
        setActiveSearchField(null);

        // Auto fetch open price
        if (newPick.date) {
            stockService.getHistoricalOpen(item.symbol, item.market, newPick.date).then(price => {
                if (price) setNewPick(prev => ({ ...prev, symbol: item.symbol, name: item.name, market: item.market, entryPrice: price }));
            });
        }
    };

    // 1. Initial Animation Sequence
    useEffect(() => {
        const sequence = async () => {
            // Stage 1: Scanning
            setLoadingText('AI 正在分析大盤趨勢...');
            await new Promise(r => setTimeout(r, 800)); // Faster for pros

            // Stage 2: Result Disclaimer (Skipped for "Pro" feel reuse or simplified)
            // Keeping original flow but faster
            setAnimationStage('RESULT');
            await new Promise(r => setTimeout(r, 1500));

            // Stage 3: Content & Permissions
            // Stage 3: Content & Permissions
            const tier = await getSectionMinTier('ai_picks');
            setMinTier(tier);
            setIsPermissionLoading(false);

            setAnimationStage('CONTENT');
            fetchPicks();
        };

        sequence();
    }, []);

    const fetchPicks = async () => {
        try {
            let data = await getAIPicks(50);

            // 1. Fetch Real-time Prices for Active Picks
            const activeAssets = data
                .filter(p => p.status === 'ACTIVE' && p.symbol)
                .map(p => ({ symbol: p.symbol, market: p.market }));

            if (activeAssets.length > 0) {
                try {
                    const priceMap = await stockService.getPrices(activeAssets);

                    data = data.map(p => {
                        if (p.status !== 'ACTIVE') return p;

                        // key is raw symbol based on getPrices implementation
                        const currentPrice = priceMap[p.symbol];

                        if (currentPrice && p.entryPrice && p.entryPrice > 0) {
                            const returnSinceEntry = ((currentPrice - p.entryPrice) / p.entryPrice) * 100;
                            return { ...p, currentPrice, returnSinceEntry };
                        }
                        return { ...p, currentPrice };
                    });
                } catch (err) { console.error("Failed to fetch current prices", err); }
            }

            if (!canView) {
                setPicks(DEMO_PICKS);
                setStats(DEMO_STATS);
                // Find AAPL for visualization (US stocks are more reliable for demo charts)
                const demoDefault = DEMO_PICKS.find(p => p.symbol.includes('AAPL'));
                if (demoDefault) setSelectedPick(demoDefault);
                else setSelectedPick(DEMO_PICKS[0]);
                return;
            }

            setPicks(data);
            if (data.length > 0) {
                // Keep existing selection if possible, otherwise DON'T select auto-select
                // This allows the "Strategy Dashboard" to be the default view if nothing is selected
                if (selectedPick) {
                    const updated = data.find(d => d.id === selectedPick.id);
                    if (updated) setSelectedPick(updated);
                    else setSelectedPick(null); // If selected was deleted, go to dashboard
                }
                // else: Do nothing, stay on Dashboard (null)
            }

            // Auto-Repair Entry Prices (Admin Only)
            if (userTier >= AccessTier.ADMIN) {
                const missingPrices = data.filter(p => p.status === 'ACTIVE' && (!p.entryPrice || p.entryPrice === 0));
                if (missingPrices.length > 0) {
                    // Process sequentially in background
                    (async () => {
                        let needsRefresh = false;
                        for (const pick of missingPrices) {
                            try {
                                const openPrice = await stockService.getHistoricalOpen(pick.symbol, pick.market, pick.date);
                                if (openPrice) {
                                    await updateAIPick({ ...pick, entryPrice: openPrice });
                                    needsRefresh = true;
                                }
                            } catch (e) { console.error(e); }
                        }
                        if (needsRefresh) {
                            console.log("Prices repaired. Refreshing UI...");
                            showToast("已自動修復缺失的開盤價", "success");
                            // Trigger re-fetch to show new prices immediately
                            fetchPicks();
                        }
                    })();
                }
            }

            // 2. Dynamic Stats Calculation (Client-Side) - Fix for "This Year" Accuracy
            const storedStats = await getStrategyStats();

            // Calculate "This Year" stats locally based on fetched data
            const currentYear = new Date().getFullYear().toString();
            const closedPicks = data.filter(p => p.status === 'CLOSED');
            // Use exitDate if available, otherwise date
            const thisYearPicks = closedPicks.filter(p => (p.exitDate || p.date || '').startsWith(currentYear));

            let dynamicWinRate = 0;
            let dynamicAvgReturn = 0;

            if (thisYearPicks.length > 0) {
                const wins = thisYearPicks.filter(p => (p.realizedReturn || 0) > 0).length;
                dynamicWinRate = Math.round((wins / thisYearPicks.length) * 100);
                const totalRet = thisYearPicks.reduce((sum, p) => sum + (p.realizedReturn || 0), 0);
                dynamicAvgReturn = Number((totalRet / thisYearPicks.length).toFixed(1));
            }

            setStats({
                totalReturn: storedStats?.totalReturn || 0,
                winRate: dynamicWinRate,
                profitFactor: storedStats?.profitFactor || 0,
                tradesCount: storedStats?.tradesCount || 0,
                avgReturn: dynamicAvgReturn,
                maxDrawdown: storedStats?.maxDrawdown || 0,
                lastUpdated: Date.now()
            });

        } catch (error) {
            console.error(error);
            showToast("載入失敗", "error");
        }
    };

    const handleAddPick = async () => {
        if (!newPick.symbol || !newPick.name || !newPick.analysis) {
            showToast("請填寫完整資訊", "error");
            return;
        }

        setIsAdding(true);
        try {
            await addAIPick({
                date: newPick.date!,
                stock_symbol: newPick.symbol.replace('NASDAQ:', '').replace('NYSE:', ''), // Extract raw symbol
                symbol: newPick.symbol.toUpperCase(),
                name: newPick.name,
                market: newPick.market as 'TW' | 'US',
                analysis: newPick.analysis,
                prediction: 'Bullish', // Default or add input
                confidence: 0.8, // Default or add input
                timestamp: Date.now(),
                // New Quant Fields
                entryPrice: Number(newPick.entryPrice) || 0,
                exitCondition: newPick.exitCondition || '跌破 20MA',
                status: newPick.status || 'ACTIVE'
            });
            showToast("策略訊號已發布", "success");
            setNewPick({
                date: new Date().toISOString().split('T')[0],
                market: 'TW',
                symbol: '',
                name: '',
                analysis: '',
                status: 'ACTIVE',
                entryPrice: 0,
                exitCondition: '跌破 20MA'
            });
            fetchPicks();
        } catch (error: any) {
            console.error("Add pick error:", error);
            showToast(error.message || "發布失敗", "error");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("確定刪除此策略訊號？")) return;
        try {
            await deleteAIPick(id);
            showToast("已刪除", "info");
            fetchPicks();
            if (selectedPick?.id === id) setSelectedPick(null);
        } catch (error) {
            showToast("刪除失敗", "error");
        }
    };

    const handleClosePosition = async () => {
        if (!selectedPick) return;

        // Warn if entry price is missing
        if (!selectedPick.entryPrice || selectedPick.entryPrice === 0) {
            showToast("提示：缺少進場價格，報酬率可能為 0", "info");
        }

        const exitPriceInput = prompt("請輸入出場價格 (Exit Price):", selectedPick.currentPrice?.toString() || "");
        if (!exitPriceInput) return;

        const exitPrice = Number(exitPriceInput);
        if (isNaN(exitPrice) || exitPrice <= 0) {
            showToast("價格格式錯誤", "error");
            return;
        }

        const entry = selectedPick.entryPrice || exitPrice; // Fallback so we don't divide by zero
        const realizedReturn = entry > 0 ? ((exitPrice - entry) / entry) * 100 : 0;

        try {
            await updateAIPick({
                ...selectedPick,
                status: 'CLOSED',
                exitPrice,
                exitDate: new Date().toISOString().split('T')[0],
                realizedReturn
            });
            showToast(`已結算訊號，報酬率: ${realizedReturn.toFixed(1)}%`, "success");
            fetchPicks();
        } catch (e) {
            showToast("結算失敗", "error");
        }
    };

    const handleEditEntryPrice = async () => {
        if (!selectedPick) return;
        const newPriceInput = prompt("修正進場價格 (Entry Price):", selectedPick.entryPrice?.toString() || "");
        if (!newPriceInput) return;

        const newPrice = Number(newPriceInput);
        if (isNaN(newPrice) || newPrice <= 0) {
            showToast("價格格式錯誤", "error");
            return;
        }

        try {
            await updateAIPick({ ...selectedPick, entryPrice: newPrice });
            showToast("進場價格已更新", "success");
            fetchPicks();
            // Update local state immediately for responsiveness
            setSelectedPick({ ...selectedPick, entryPrice: newPrice });
        } catch (e) {
            showToast("更新失敗", "error");
        }
    };

    const handleRepairPrice = async (pick: AIPick) => {
        if (!confirm(`確定要重新抓取 ${pick.symbol} 的開盤價嗎？`)) return;

        try {
            showToast("抓取中...", "info");
            const price = await stockService.getHistoricalOpen(pick.symbol, pick.market, pick.date);

            if (price) {
                await updateAIPick({ ...pick, entryPrice: price });
                showToast(`成功！價格更新為: ${price}`, "success");
                fetchPicks(); // Refresh UI
            } else {
                showToast("抓取失敗: 找不到此日期的開盤價 (請確認是否已開盤)", "error");
            }
        } catch (e) {
            console.error("Manual repair failed", e);
            showToast("抓取過程發生錯誤", "error");
        }
    };

    // --- Render Stages ---

    if (animationStage === 'SCANNING') {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-gray-50">
                <div className="relative mb-8">
                    <div className="w-20 h-20 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <Brain className="absolute inset-0 m-auto text-indigo-600 w-8 h-8 animate-pulse" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 tracking-widest uppercase">{loadingText}</h2>
                <div className="mt-2 text-xs text-gray-400 font-mono">QUANT STRATEGY ENGINE v2.0</div>
            </div>
        );
    }

    if (animationStage === 'RESULT') {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-500">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl shadow-2xl mb-6 transform rotate-3">
                    <Activity className="w-16 h-16 text-white" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 leading-tight mb-2">
                    策略運算完成
                </h1>
                <p className="text-gray-500 font-medium">量化分析結果已備妥</p>
            </div>
        );
    }

    // --- CONTENT STAGE ---
    // canView is now defined at the top of the component
    // const canView = allowedRoles.includes(userRole); -- REMOVED

    // --- PRO DASHBOARD ---
    const today = new Date().toLocaleDateString('en-CA');

    return (
        <div className="relative max-w-7xl mx-auto p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 group/paywall">

            {/* PAYWALL OVERLAY */}
            {!canView && (
                <div className="absolute inset-0 z-50 flex items-center justify-center opacity-0 group-hover/paywall:opacity-100 transition-opacity duration-300 pointer-events-none group-hover/paywall:pointer-events-auto backdrop-blur-[2px]">
                    <div className="bg-gray-900/90 p-8 rounded-3xl shadow-2xl max-w-lg text-center transform scale-95 group-hover/paywall:scale-100 transition duration-300">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 mb-6 shadow-lg shadow-yellow-900/50">
                            <Crown className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4">Institutional Grade Access</h2>
                        <p className="text-gray-300 mb-8 leading-relaxed">
                            解鎖完整 AI 量化選股策略<br />
                            <span className="text-sm text-gray-500">包含進場點位、出場邏輯與即時庫存動態</span>
                        </p>
                        <button className="px-8 py-3 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-100 transition shadow-lg transform active:scale-95">
                            立即升級會員
                        </button>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT */}
            <div className="transition duration-500">

                {/* 1. Top Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative group/stats">
                    {userRole === 'admin' && (
                        <button
                            onClick={() => setIsStatsModalOpen(true)}
                            className="absolute -top-2 -right-2 bg-gray-900 text-white p-1.5 rounded-full shadow-lg z-10 opacity-0 group-hover/stats:opacity-100 transition-opacity"
                            title="編輯績效數據"
                        >
                            <Edit3 className="w-3 h-3" />
                        </button>
                    )}

                    <StatsEditModal
                        isOpen={isStatsModalOpen}
                        onClose={() => setIsStatsModalOpen(false)}
                        currentStats={stats}
                        onSave={async (newStats) => {
                            setStats(newStats);
                            await updateStrategyStats(newStats);
                            showToast("績效數據已更新", "success");
                        }}
                    />

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">今年度勝率 (Win Rate)</div>
                        <div className={`text-2xl font-black text-gray-800 ${blurClass}`}>{stats?.winRate || 0}%</div>
                        <div className="text-xs text-gray-400 font-mono mt-1">Winning Trades / Total</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">平均報酬 (Avg Return)</div>
                        <div className={`text-2xl font-black ${(() => {
                            const closedPicks = picks.filter(p => p.status === 'CLOSED');
                            if (closedPicks.length === 0) return 'text-gray-800';
                            const avg = closedPicks.reduce((sum, p) => sum + (p.realizedReturn || 0), 0) / closedPicks.length;
                            return avg >= 0 ? 'text-red-500' : 'text-green-500';
                        })()} ${blurClass}`}>
                            {(() => {
                                const closedPicks = picks.filter(p => p.status === 'CLOSED');
                                if (closedPicks.length === 0) return 0;
                                const avg = closedPicks.reduce((sum, p) => sum + (p.realizedReturn || 0), 0) / closedPicks.length;
                                return (avg > 0 ? '+' : '') + avg.toFixed(1);
                            })()}%
                        </div>
                        <div className="text-xs text-gray-400 font-mono mt-1">每筆平均</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">單筆極值 (Best / Worst)</div>
                        <div className={`flex items-baseline gap-2 ${blurClass}`}>
                            <span className="text-xl font-black text-red-500">
                                +{picks.filter(p => p.status === 'CLOSED').reduce((max, p) => Math.max(max, p.realizedReturn || 0), 0).toFixed(0)}%
                            </span>
                            <span className="text-gray-300">/</span>
                            <span className="text-xl font-black text-green-500">
                                {picks.filter(p => p.status === 'CLOSED').reduce((min, p) => Math.min(min, p.realizedReturn || 0), 0).toFixed(0)}%
                            </span>
                        </div>
                        <div className="text-xs text-gray-400 font-mono mt-1">最大獲利 / 最大虧損</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">策略庫存 (Current Holdings)</div>
                        <div className={`text-2xl font-black text-gray-800 ${blurClass}`}>{picks.filter(p => p.status === 'ACTIVE').length} <span className="text-sm font-normal text-gray-400">檔</span></div>
                        <div className="text-xs text-gray-400 font-mono mt-1">目前持倉</div>
                    </div>
                </div>

                {/* 1.5. Strategy Performance Chart (Full Width) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" /> 策略整體績效
                    </h2>
                    <div className={blurClass}>
                        <StrategyPerformanceChart picks={picks} />
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col lg:flex-row gap-6">
                    {/* Admin Toggle (Only visible to Admin) */}
                    {userRole === 'admin' && (
                        <div className="fixed bottom-4 right-4 z-50">
                            <button
                                onClick={() => setIsDebugDemo(!isDebugDemo)}
                                className={`px-4 py-2 rounded-full shadow-lg text-sm font-bold transition-all ${isDebugDemo ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'}`}
                            >
                                {isDebugDemo ? '👁️ 預覽: 非會員' : '👁️ 預覽: 管理員'}
                            </button>
                        </div>
                    )}

                    {/* Left Signal List */}
                    <div className="lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[800px]">
                        <div className="p-2 border-b border-gray-100 bg-white grid grid-cols-3 gap-1">
                            <button
                                onClick={() => setActiveTab('NEW')}
                                className={`py-3 rounded-lg text-base font-bold transition flex flex-col items-center gap-1 ${activeTab === 'NEW' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                <span className="flex items-center gap-1">最新訊號 <span className={`w-1.5 h-1.5 rounded-full ${picks.some(p => p.date === today) ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></span></span>
                            </button>
                            <button
                                onClick={() => setActiveTab('ACTIVE')}
                                className={`py-3 rounded-lg text-base font-bold transition flex flex-col items-center gap-1 ${activeTab === 'ACTIVE' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                庫存 ({picks.filter(p => p.status === 'ACTIVE').length})
                            </button>
                            <button
                                onClick={() => setActiveTab('HISTORY')}
                                className={`py-3 rounded-lg text-base font-bold transition flex flex-col items-center gap-1 ${activeTab === 'HISTORY' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                歷史結算
                            </button>
                        </div>

                        <div className={`flex-1 overflow-y-auto ${blurClass}`}>
                            {activeTab === 'NEW' && (
                                <>
                                    <div className="bg-indigo-50/50 p-3 text-sm font-bold text-indigo-800 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 今日訊號 (Today)
                                    </div>
                                    {picks.filter(p => p.date === today).length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 text-xs italic">今日無新訊號</div>
                                    ) : (
                                        picks.filter(p => p.date === today).map(pick => (
                                            <PickItem
                                                key={pick.id}
                                                pick={pick}
                                                selectedPick={selectedPick}
                                                onSelect={setSelectedPick}
                                                onRepair={handleRepairPrice}
                                                userRole={userRole}
                                            />
                                        ))
                                    )}
                                </>
                            )}

                            {activeTab === 'ACTIVE' && (
                                <>
                                    <div className="bg-gray-50 p-3 text-sm font-bold text-gray-600 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                                        策略持倉 (Active Positions)
                                    </div>
                                    {picks.filter(p => p.status === 'ACTIVE').length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 text-xs italic">無持倉部位</div>
                                    ) : (
                                        picks.filter(p => p.status === 'ACTIVE').map(pick => (
                                            <PickItem
                                                key={pick.id}
                                                pick={pick}
                                                selectedPick={selectedPick}
                                                onSelect={setSelectedPick}
                                                onRepair={handleRepairPrice}
                                                userRole={userRole}
                                            />
                                        ))
                                    )}
                                </>
                            )}

                            {activeTab === 'HISTORY' && (
                                <>
                                    <div className="bg-gray-50 p-3 text-sm font-bold text-gray-600 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                                        歷史紀錄 (History)
                                    </div>
                                    {picks.filter(p => p.status === 'CLOSED').length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 text-xs italic">尚無結算紀錄</div>
                                    ) : (
                                        picks.filter(p => p.status === 'CLOSED').slice(0, 20).map(pick => (
                                            <PickItem key={pick.id} pick={pick} selectedPick={selectedPick} onSelect={setSelectedPick} />
                                        ))
                                    )}
                                </>
                            )}
                        </div>
                        {picks.length === 0 && (
                            <div className="p-8 text-center text-gray-400 text-sm">暫無訊號</div>
                        )}
                    </div>


                    {/* 3. Right Panel: Detail & Chart */}
                    {/* 3. Right Panel: Detail & Chart */}
                    <div className="lg:w-2/3 flex flex-col gap-6 h-[800px]">
                        <div className={`${blurClass} h-full flex flex-col gap-6`}>
                            {selectedPick ? (
                                <>
                                    {/* Strategy Card */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-2 space-y-3">
                                            <h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                                                {selectedPick.symbol.split(':').pop()}
                                                <span className="text-xl font-medium text-gray-500">{selectedPick.name}</span>
                                            </h2>
                                            <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-lg border border-gray-100">
                                                {selectedPick.analysis}
                                            </p>
                                        </div>
                                        <div className="space-y-4 border-l border-gray-100 pl-6">
                                            <div>
                                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">進場點位 (Entry)</div>
                                                <div
                                                    onClick={userRole === 'admin' ? handleEditEntryPrice : undefined}
                                                    className={`font-mono font-bold text-indigo-600 text-2xl flex items-center gap-2 ${userRole === 'admin' ? 'cursor-pointer hover:bg-gray-50 rounded px-1 -ml-1' : ''}`}
                                                    title={userRole === 'admin' ? "點擊修改進場價格" : ""}
                                                >
                                                    <Target className="w-5 h-5" /> {selectedPick.entryPrice ? selectedPick.entryPrice : '開盤價'}
                                                    {selectedPick.entryPrice === 0 && userRole === 'admin' && <Edit3 className="w-4 h-4 text-gray-400" />}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">出場條件 (Exit)</div>
                                                <div className="font-mono font-bold text-red-500 text-2xl flex items-center gap-2">
                                                    <ShieldCheck className="w-5 h-5" /> {selectedPick.exitCondition || 'N/A'}
                                                </div>
                                            </div>
                                            {userRole === 'admin' && (
                                                <div className="flex flex-col gap-2 mt-4">
                                                    {selectedPick.status === 'ACTIVE' && (
                                                        <button
                                                            onClick={handleClosePosition}
                                                            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition"
                                                        >
                                                            <Target className="w-4 h-4" /> 結算出場 (Close)
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(selectedPick.id)}
                                                        className="text-xs text-red-400 hover:text-red-600 flex items-center justify-center gap-1 mt-1"
                                                    >
                                                        <Trash2 className="w-3 h-3" /> 刪除此訊號
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Chart Panel */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden min-h-0">
                                        <StockChartPanel symbol={selectedPick.symbol} market={selectedPick.market} />
                                    </div>
                                </>
                            ) : (
                                <div className="h-full bg-white rounded-2xl border border-gray-100 border-dashed flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>請選擇左側訊號以查看個別分析</p>
                                    </div>
                                </div>
                            )
                            }
                        </div>
                    </div>
                </div> {/* Close Flex Row */}
                {/* Admin Quick Add - FOOTER SECTION */}
                {
                    userRole === 'admin' && (
                        <div className="mt-12 pt-8 border-t border-gray-200">
                            <div className="bg-gray-900 w-full p-6 rounded-2xl shadow-xl border border-gray-800">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-white text-lg font-bold flex items-center gap-2"><Plus className="w-5 h-5 text-green-400" /> 發布新策略訊號</h3>
                                    <button onClick={() => setIsAdding(!isAdding)} className="text-gray-400 hover:text-white text-sm hover:underline">
                                        {isAdding ? '收起表單' : '展開發布表單'}
                                    </button>
                                </div>

                                {isAdding && (
                                    <div className="space-y-6 animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <input type="date" value={newPick.date} onChange={e => setNewPick({ ...newPick, date: e.target.value })} className="bg-gray-800 border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                            <select value={newPick.market} onChange={e => setNewPick({ ...newPick, market: e.target.value as any })} className="bg-gray-800 border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                                                <option value="TW">TW (台股)</option><option value="US">US (美股)</option>
                                            </select>
                                            <div className="md:col-span-2 relative">
                                                <input
                                                    placeholder="Symbol (例如: 2330, AAPL)"
                                                    value={newPick.symbol}
                                                    onChange={e => handleSymbolChange(e.target.value)}
                                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg px-4 py-3 text-sm uppercase font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    autoComplete="off"
                                                />
                                                {showSuggestions && activeSearchField === 'symbol' && (
                                                    <div className="absolute bottom-full left-0 w-full z-[100] bg-gray-800 shadow-xl rounded-lg border border-gray-700 mb-1 max-h-56 overflow-y-auto">
                                                        <ul>
                                                            {suggestions.map((item, idx) => (
                                                                <li
                                                                    key={idx}
                                                                    onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(item); }}
                                                                    className="px-3 py-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700/50 last:border-0 flex items-center gap-2 group"
                                                                >
                                                                    <span className="font-mono font-bold text-indigo-400 bg-gray-900 px-2 py-0.5 rounded text-xs shrink-0 min-w-[50px] text-center">{item.symbol}</span>
                                                                    <span className="text-sm text-gray-300 group-hover:text-white">{item.name}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="relative md:col-span-1">
                                                <input
                                                    placeholder="Name (股票名稱)"
                                                    value={newPick.name}
                                                    onChange={e => handleNameChange(e.target.value)}
                                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    autoComplete="off"
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                placeholder="訊號價格 (Signal Price)"
                                                value={newPick.entryPrice}
                                                onChange={e => setNewPick({ ...newPick, entryPrice: Number(e.target.value) })}
                                                className="bg-gray-800 border-gray-700 text-white rounded-lg px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <select
                                                value={newPick.exitCondition}
                                                onChange={e => setNewPick({ ...newPick, exitCondition: e.target.value })}
                                                className="bg-gray-800 border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            >
                                                <option value="跌破 20MA">跌破 20MA (月線)</option>
                                                <option value="跌破 5MA">跌破 5MA (週線)</option>
                                                <option value="跌破 10MA">跌破 10MA (雙週線)</option>
                                                <option value="跌破 60MA">跌破 60MA (季線)</option>
                                            </select>
                                        </div>

                                        <textarea
                                            placeholder="AI 分析觀點 (Rationale)..."
                                            value={newPick.analysis}
                                            onChange={e => setNewPick({ ...newPick, analysis: e.target.value })}
                                            className="w-full bg-gray-800 border-gray-700 text-white rounded-lg px-4 py-3 text-sm min-h-[100px] focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />

                                        <button onClick={handleAddPick} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-indigo-900/50 text-lg">
                                            🚀 發布新策略訊號
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
                {/* End Admin Footer */}
            </div >
        </div>
    );
};

export default AIPicks;
