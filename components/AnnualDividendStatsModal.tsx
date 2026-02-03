
import React, { useMemo } from 'react';
import { TransactionRecord } from '../types';
import { X, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

interface AnnualDividendStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: TransactionRecord[]; // Already filtered by parent if needed, but we typically pass all DIVIDENDS for the active tab
    activeTab: 'my' | 'martingale';
    isPrivacyMode: boolean;
}

const AnnualDividendStatsModal: React.FC<AnnualDividendStatsModalProps> = ({
    isOpen,
    onClose,
    transactions,
    activeTab,
    isPrivacyMode
}) => {
    // 1. Calculate Annual Stats
    const stats = useMemo(() => {
        const map = new Map<number, { year: number, total: number, count: number }>();

        transactions.forEach(t => {
            const year = new Date(t.date).getFullYear();
            const amount = t.realizedPnL || 0;

            if (!map.has(year)) {
                map.set(year, { year, total: 0, count: 0 });
            }
            const entry = map.get(year)!;
            entry.total += amount;
            entry.count += 1;
        });

        // Fill in gaps if we want continuous years? Or just existing? 
        // Let's sort by year descending
        return Array.from(map.values()).sort((a, b) => b.year - a.year);
    }, [transactions]);

    const maxTotal = useMemo(() => Math.max(...stats.map(s => s.total), 1), [stats]);
    const maskValue = (val: string | number) => isPrivacyMode ? '*******' : val;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                            <TrendingUp className="w-6 h-6 text-yellow-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{activeTab === 'my' ? '個人' : '馬丁'}歷年領息統計</h2>
                            <p className="text-purple-200 text-xs mt-0.5">Annual Dividend History</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">

                    {stats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-4">
                            <Calendar className="w-16 h-16 opacity-20" />
                            <p>尚無任何年度領息紀錄</p>
                        </div>
                    ) : (
                        <div className="space-y-8">

                            {/* Chart Section */}
                            <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm">
                                <h3 className="text-gray-700 font-bold mb-6 flex items-center gap-2">
                                    <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
                                    年度趨勢圖
                                </h3>

                                {/* Bar Chart Container */}
                                <div className="flex items-end justify-center gap-2 sm:gap-4 h-64 w-full">
                                    {/* Reverse stats for chart to show Left->Right as Past->Future */}
                                    {[...stats].reverse().map(stat => {
                                        const heightPercent = Math.max((stat.total / maxTotal) * 100, 4); // Min 4% height
                                        const isMax = stat.total === maxTotal;

                                        return (
                                            <div key={stat.year} className="flex flex-col items-center gap-2 group flex-1">
                                                <div className="relative w-full flex justify-end flex-col items-center h-full">
                                                    {/* Tooltip / Value Label */}
                                                    <div className={`
                                mb-2 text-xs font-bold font-mono transition-all duration-300
                                ${isMax ? 'text-purple-600 scale-110' : 'text-gray-500 opacity-0 group-hover:opacity-100'}
                              `}>
                                                        ${maskValue((stat.total / 1000).toFixed(1))}k
                                                    </div>

                                                    {/* The Bar */}
                                                    <div
                                                        className={`
                                  w-full sm:w-12 rounded-t-lg transition-all duration-500 ease-out relative overflow-hidden
                                  ${isMax ? 'bg-gradient-to-t from-purple-600 to-indigo-500 shadow-lg shadow-purple-200' : 'bg-purple-200 group-hover:bg-purple-400'}
                                `}
                                                        style={{ height: `${heightPercent}%` }}
                                                    >
                                                        {/* Shine effect */}
                                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </div>
                                                <div className={`text-xs sm:text-sm font-bold ${isMax ? 'text-purple-700' : 'text-gray-400'}`}>
                                                    {stat.year}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Table Section */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-bold">
                                        <tr>
                                            <th className="p-4">年度</th>
                                            <th className="p-4 text-right">領息筆數</th>
                                            <th className="p-4 text-right">實領總額 (TWD)</th>
                                            <th className="p-4 text-right hidden sm:table-cell">佔比</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {stats.map(stat => (
                                            <tr key={stat.year} className="hover:bg-purple-50/10 transition-colors">
                                                <td className="p-4 font-bold text-gray-700">{stat.year}</td>
                                                <td className="p-4 text-right font-mono text-gray-600">{stat.count}</td>
                                                <td className="p-4 text-right font-bold text-purple-700 font-mono text-lg">
                                                    ${maskValue(stat.total.toLocaleString())}
                                                </td>
                                                <td className="p-4 text-right hidden sm:table-cell">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="text-xs text-gray-400 font-mono">
                                                            {Math.round((stat.total / (stats.reduce((a, b) => a + b.total, 0) || 1)) * 100)}%
                                                        </span>
                                                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                                            <div
                                                                className="bg-purple-200 h-1.5 rounded-full"
                                                                style={{ width: `${(stat.total / maxTotal) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                僅統計已入帳之「實領金額」，預估配息不包含在內。
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnnualDividendStatsModal;
