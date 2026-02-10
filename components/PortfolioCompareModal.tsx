
import React, { useState, useMemo } from 'react';
import { X, ArrowRightLeft, AlertCircle, CheckCircle2, MinusCircle, Info, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { CalculatedCategory, CalculatedAsset, AppSettings } from '../types';
import { formatCurrency, formatShares } from '../utils/formatting';
import { RequireRole } from './auth/RequireRole';

interface PortfolioCompareModalProps {
    isOpen: boolean;
    onClose: () => void;
    userCategories: CalculatedCategory[];
    martinCategories: CalculatedCategory[];
    totalCapital: number;
    settings: AppSettings;
    isPrivacyMode: boolean;
}

const PortfolioCompareModal: React.FC<PortfolioCompareModalProps> = ({
    isOpen,
    onClose,
    userCategories,
    martinCategories,
    totalCapital,
    settings,
    isPrivacyMode
}) => {
    const [selectedUserCatId, setSelectedUserCatId] = useState<string>('all');
    const [selectedMartinCatId, setSelectedMartinCatId] = useState<string>('all');

    // Comparison Logic
    const comparisonData = useMemo(() => {
        if (!isOpen) return []; // Don't run logic if not open

        const userAssets: Record<string, { asset: CalculatedAsset, catNames: string[], market: string }> = {};
        const martinAssets: Record<string, { asset: CalculatedAsset, catNames: string[], market: string }> = {};

        // 1. Gather User Assets
        const filteredUserCats = selectedUserCatId === 'all' ? userCategories : userCategories.filter(c => c.id === selectedUserCatId);
        filteredUserCats.forEach(cat => {
            cat.assets.forEach(asset => {
                const key = `${asset.symbol}`;
                if (userAssets[key]) {
                    // Aggregate if multiple categories selected
                    const existing = userAssets[key].asset;
                    userAssets[key].asset = {
                        ...existing,
                        shares: existing.shares + asset.shares,
                        costBasis: existing.costBasis + asset.costBasis,
                        portfolioRatio: existing.portfolioRatio + asset.portfolioRatio
                    };
                    if (!userAssets[key].catNames.includes(cat.name)) {
                        userAssets[key].catNames.push(cat.name);
                    }
                } else {
                    userAssets[key] = { asset: { ...asset }, catNames: [cat.name], market: cat.market };
                }
            });
        });

        // 2. Gather Martin Assets
        const filteredMartinCats = selectedMartinCatId === 'all' ? martinCategories : martinCategories.filter(c => c.id === selectedMartinCatId);
        filteredMartinCats.forEach(cat => {
            cat.assets.forEach(asset => {
                const key = `${asset.symbol}`;
                if (martinAssets[key]) {
                    const existing = martinAssets[key].asset;
                    martinAssets[key].asset = {
                        ...existing,
                        shares: existing.shares + asset.shares,
                        costBasis: existing.costBasis + asset.costBasis,
                        portfolioRatio: existing.portfolioRatio + asset.portfolioRatio
                    };
                    if (!martinAssets[key].catNames.includes(cat.name)) {
                        martinAssets[key].catNames.push(cat.name);
                    }
                } else {
                    martinAssets[key] = { asset: { ...asset }, catNames: [cat.name], market: cat.market };
                }
            });
        });

        // 3. Merge and Compare
        const allSymbols = Array.from(new Set([...Object.keys(userAssets), ...Object.keys(martinAssets)]));

        return allSymbols.map(symbol => {
            const u = userAssets[symbol];
            const m = martinAssets[symbol];

            const userRatio = u ? u.asset.portfolioRatio : 0;
            const martinRatio = m ? m.asset.portfolioRatio : 0;
            const deltaRatio = userRatio - martinRatio;

            const market = u?.market || m?.market || 'TW';

            return {
                symbol,
                name: u?.asset.name || m?.asset.name || 'Unknown',
                userRatio,
                martinRatio,
                deltaRatio,
                userCost: u?.asset.avgCost || 0,
                martinCost: m?.asset.avgCost || 0,
                status: !u ? 'MISSING' : (!m ? 'EXTRA' : 'MATCH'),
                market,
                userCatNames: u?.catNames || [],
                martinCatNames: m?.catNames || []
            };
        }).sort((a, b) => b.martinRatio - a.martinRatio);
    }, [isOpen, selectedUserCatId, selectedMartinCatId, userCategories, martinCategories, totalCapital, settings]);

    const stats = useMemo(() => {
        return {
            missing: comparisonData.filter(d => d.status === 'MISSING').length,
            extra: comparisonData.filter(d => d.status === 'EXTRA').length,
            mismatch: comparisonData.filter(d => d.status === 'MATCH' && Math.abs(d.deltaRatio) > 0.5).length
        };
    }, [comparisonData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-2 sm:p-4 lg:p-8 animate-in fade-in duration-200">
            <div className="bg-gray-50 w-full max-w-3xl h-full max-h-[90vh] sm:rounded-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/20">

                {/* Header */}
                <div className="bg-white p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="bg-libao-gold/10 p-1.5 sm:p-2 rounded-xl text-libao-gold">
                            <ArrowRightLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black text-gray-800 leading-tight">倉位落差比對</h2>
                            <p className="text-[10px] sm:text-xs text-gray-400 font-medium">比對持倉與馬丁倉位的差異</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <RequireRole role="member">
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

                            {/* Filters & Summary */}
                            <div className="p-4 sm:p-6 bg-white space-y-3 sm:space-y-4 shrink-0 shadow-sm z-10">
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">我的持倉</label>
                                        <select
                                            value={selectedUserCatId}
                                            onChange={(e) => setSelectedUserCatId(e.target.value)}
                                            className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-libao-gold outline-none text-sm"
                                        >
                                            <option value="all">所有持倉</option>
                                            {userCategories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.market})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">馬丁持倉</label>
                                        <select
                                            value={selectedMartinCatId}
                                            onChange={(e) => setSelectedMartinCatId(e.target.value)}
                                            className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-libao-gold outline-none text-sm"
                                        >
                                            <option value="all">馬丁所有持倉</option>
                                            {martinCategories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.market})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                    <div className="bg-amber-50 rounded-xl sm:rounded-2xl p-2 sm:p-4 border border-amber-100 flex flex-col sm:flex-row items-center gap-1 sm:gap-4 text-center sm:text-left">
                                        <div className="bg-amber-100 p-1.5 sm:p-2 rounded-lg text-amber-600 hidden sm:block">
                                            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>
                                        <div>
                                            <div className="text-[12px] sm:text-[12px] font-bold text-amber-500 uppercase leading-none mb-1">未跟進</div>
                                            <div className="text-base sm:text-xl font-black text-amber-700">{stats.missing}<span className="text-[10px] sm:text-sm ml-0.5">檔</span></div>
                                        </div>
                                    </div>
                                    <div className="bg-indigo-50 rounded-xl sm:rounded-2xl p-2 sm:p-4 border border-indigo-100 flex flex-col sm:flex-row items-center gap-1 sm:gap-4 text-center sm:text-left">
                                        <div className="bg-indigo-100 p-1.5 sm:p-2 rounded-lg text-indigo-600 hidden sm:block">
                                            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>
                                        <div>
                                            <div className="text-[12px] sm:text-[12px] font-bold text-indigo-500 uppercase leading-none mb-1">比例不符</div>
                                            <div className="text-base sm:text-xl font-black text-indigo-700">{stats.mismatch}<span className="text-[10px] sm:text-sm ml-0.5">檔</span></div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-2 sm:p-4 border border-gray-200 flex flex-col sm:flex-row items-center gap-1 sm:gap-4 text-center sm:text-left">
                                        <div className="bg-gray-200 p-1.5 sm:p-2 rounded-lg text-gray-500 hidden sm:block">
                                            <MinusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>
                                        <div>
                                            <div className="text-[12px] sm:text-[12px] font-bold text-gray-400 uppercase leading-none mb-1">非馬丁</div>
                                            <div className="text-base sm:text-xl font-black text-gray-600">{stats.extra}<span className="text-[10px] sm:text-sm ml-0.5">檔</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Result Table */}
                            <div className="flex-1 p-3 sm:p-6 bg-gray-50 min-h-0 flex flex-col">
                                <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-y-auto overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-gray-200">
                                    <table className="w-full text-left border-collapse table-fixed min-w-[600px] sm:min-w-0">
                                        <thead className="sticky top-0 z-30 shadow-sm">
                                            <tr className="border-b border-gray-100">
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white w-[180px]">標的</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center bg-white w-[80px]">馬丁 %</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center bg-white w-[80px]">我的 %</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center bg-white w-[100px]">落差</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white">馬丁平均成本 / 比對</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {comparisonData.map((row) => (
                                                <tr key={row.symbol} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-1 h-8 rounded-full ${row.status === 'MISSING' ? 'bg-amber-400' : (row.status === 'EXTRA' ? 'bg-gray-300' : 'bg-green-400')}`} />
                                                            <div className="flex flex-col">
                                                                <div className="font-mono font-black text-gray-800 text-base leading-tight">{row.symbol}</div>
                                                                <div className="text-[10px] text-gray-400 font-medium truncate max-w-[120px] mb-1">{row.name}</div>

                                                                {/* Category Sources */}
                                                                <div className="flex flex-wrap gap-1">
                                                                    {selectedMartinCatId === 'all' && row.martinCatNames.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 items-center">
                                                                            <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1 rounded font-bold border border-indigo-100/50">馬丁: {row.martinCatNames.join(', ')}</span>
                                                                        </div>
                                                                    )}
                                                                    {selectedUserCatId === 'all' && row.userCatNames.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 items-center">
                                                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded font-bold border border-gray-200/50">我: {row.userCatNames.join(', ')}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="font-mono font-bold text-gray-600">{row.martinRatio.toFixed(1)}%</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="font-mono font-bold text-gray-800">{isPrivacyMode ? '***' : row.userRatio.toFixed(1)}%</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`font-mono font-black ${row.deltaRatio < -0.5 ? 'text-amber-500' : (row.deltaRatio > 0.5 ? 'text-indigo-500' : 'text-green-500')}`}>
                                                            {row.deltaRatio > 0 ? '+' : ''}{row.deltaRatio.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {row.status === 'MISSING' ? (
                                                            <div className="bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <Target className="w-4 h-4 text-amber-600" />
                                                                    <div className="text-xs font-bold text-amber-700">馬丁有此標的，您尚未配置</div>
                                                                </div>
                                                                {row.martinCost > 0 && (
                                                                    <div className="text-[11px] font-mono font-bold text-amber-600">
                                                                        馬丁平均成本: {formatCurrency(row.martinCost, row.market === 'US' ? 'USD' : 'TWD', isPrivacyMode)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : row.status === 'EXTRA' ? (
                                                            <div className="bg-gray-50 text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-2">
                                                                <Info className="w-4 h-4" />
                                                                <div className="text-xs font-bold">非馬丁標的</div>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-100 flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    {row.deltaRatio < -0.5 ? (
                                                                        <AlertCircle className="w-4 h-4 text-amber-500" />
                                                                    ) : row.deltaRatio > 0.5 ? (
                                                                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                                                                    ) : (
                                                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                                    )}
                                                                    <div className={`text-xs font-bold ${row.deltaRatio < -0.5 ? 'text-amber-600' : row.deltaRatio > 0.5 ? 'text-indigo-600' : 'text-gray-600'}`}>
                                                                        {row.deltaRatio < -0.5 ? '配置比例不足' : row.deltaRatio > 0.5 ? '配置比例過高' : '配置比例理想'}
                                                                    </div>
                                                                </div>
                                                                {row.martinCost > 0 && (
                                                                    <div className="text-[11px] font-mono font-bold text-indigo-600">
                                                                        馬丁平均成本: {formatCurrency(row.martinCost, row.market === 'US' ? 'USD' : 'TWD', isPrivacyMode)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Cost Basis Comparison Badge */}
                                                        {row.status !== 'EXTRA' && row.userCost > 0 && row.martinCost > 0 && (
                                                            <div className="mt-1 flex items-center gap-2 px-1">
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase">成本落差:</span>
                                                                <span className={`text-[10px] font-bold ${row.userCost <= row.martinCost ? 'text-green-500' : 'text-red-500'}`}>
                                                                    {row.userCost <= row.martinCost ? '低於馬丁' : '高於馬丁'} ({Math.abs(((row.userCost - row.martinCost) / row.martinCost) * 100).toFixed(1)}%)
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </RequireRole>
                </div>

                {/* Footer */}
                <div className="bg-white p-4 sm:p-6 border-t border-gray-200 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50">
                    <div className="hidden sm:flex items-center gap-2 text-gray-500">
                        <Info className="w-4 h-4" />
                        <p className="text-xs font-medium">比對結果僅供參考，成本落差計算與馬丁平均成本係基於歷史紀錄估算。</p>
                    </div>
                    <button onClick={onClose} className="w-full sm:w-auto px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg shadow-gray-200 active:scale-95">
                        關閉比對視窗
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PortfolioCompareModal;
