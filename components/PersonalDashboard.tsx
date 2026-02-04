import React from 'react';
import { CalculatedCategory, TransactionRecord } from '../types';
import { formatTWD } from '../utils/formatting';
import { Briefcase, Wallet, TrendingUp, History, Coins } from 'lucide-react';
import MartingaleIndustryChart, { IndustryData } from './charts/MartingaleIndustryChart';
import MartingalePerformanceChart from './charts/MartingalePerformanceChart';

interface PersonalDashboardProps {
    categories: CalculatedCategory[];
    totalCapital: number;
    transactions: TransactionRecord[];
    industryData?: IndustryData[];
    onDeposit?: () => void;
    onReset?: () => void;
    isPrivacyMode: boolean;
}

const PersonalDashboard: React.FC<PersonalDashboardProps> = ({
    categories,
    totalCapital,
    transactions = [],
    industryData = [],
    onDeposit,
    onReset,
    isPrivacyMode
}) => {
    // 1. Aggregate Data
    const totalMarketValue = categories.reduce((sum, c) => sum + c.assets.reduce((aSum, asset) => aSum + (asset.marketValue || 0), 0), 0);
    const totalInvested = categories.reduce((sum, c) => sum + c.investedAmount, 0);
    const totalRealizedPnL = categories.reduce((sum, c) => sum + c.realizedPnL, 0);

    const totalUnrealizedPnL = categories.reduce((sum, cat) => {
        return sum + cat.assets.reduce((aSum, asset) => aSum + (asset.unrealizedPnL || 0), 0);
    }, 0);
    // Net Worth = Capital + Unrealized + Realized
    const totalNetWorth = totalCapital + totalUnrealizedPnL + totalRealizedPnL;

    // Ratios
    const unrealizedRatio = totalInvested > 0 ? (totalUnrealizedPnL / totalInvested) * 100 : 0;
    const investedRatio = totalNetWorth > 0 ? (totalInvested / totalNetWorth) * 100 : 0;

    const mask = (val: string | number) => isPrivacyMode ? '****' : val;

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 mb-8">
            {/* Left Area: Stats & Trend (8 cols) */}
            <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-6 order-1 md:order-2">
                <div className="flex flex-col gap-4">
                    {/* Hero Card: Net Worth - Private Vault Theme (Carbon/Cyan) */}
                    <div className="bg-gray-950 p-6 rounded-2xl shadow-xl border border-gray-800 relative overflow-hidden group">
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <div className="text-emerald-500/80 text-[10px] sm:text-xs font-bold mb-1 tracking-wider uppercase flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" />
                                    總資產淨值 (Net Worth)
                                </div>
                                <div className="text-3xl sm:text-4xl font-mono font-black text-white tracking-tight drop-shadow-lg">
                                    NT$ {mask(formatTWD(totalNetWorth, false))}
                                </div>
                            </div>
                            <Briefcase className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-500 opacity-10 group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        {/* Aurora Effect */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full -ml-16 -mb-16 blur-3xl"></div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {/* Capital */}
                        <div className="bg-gray-900 p-4 sm:p-5 rounded-xl shadow-lg border border-gray-800 hover:border-gray-700 transition-colors">
                            <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1">
                                <Wallet className="w-3 h-3 text-gray-500" /> 投入本金
                            </div>
                            <div className="text-base sm:text-xl font-mono font-bold text-gray-200">
                                <div className="truncate mb-1">NT$ {mask(formatTWD(totalCapital, false))}</div>
                                {onDeposit && (
                                    <div className="flex gap-2">
                                        <button onClick={onDeposit} className="text-[10px] bg-emerald-500/10 px-2 py-1 rounded text-emerald-400 font-bold hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors w-fit">
                                            出/入金
                                        </button>
                                        {onReset && (
                                            <button onClick={onReset} className="text-[10px] bg-red-500/10 px-2 py-1 rounded text-red-400 font-bold hover:bg-red-500/20 border border-red-500/20 transition-colors w-fit">
                                                重置
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Unrealized P&L */}
                        <div className="bg-gray-900 p-4 sm:p-5 rounded-xl shadow-lg border border-gray-800 hover:border-gray-700 transition-colors">
                            <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-red-400" /> 未實現損益
                            </div>
                            <div className={`text-base sm:text-xl font-mono font-bold ${totalUnrealizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {totalUnrealizedPnL > 0 ? '+' : ''}{mask(formatTWD(totalUnrealizedPnL, false))}
                                <span className="text-xs block font-bold opacity-60 mt-1">{unrealizedRatio > 0 ? '+' : ''}{unrealizedRatio.toFixed(2)}%</span>
                            </div>
                        </div>

                        {/* Realized P&L */}
                        <div className="bg-gray-900 p-4 sm:p-5 rounded-xl shadow-lg border border-gray-800 hover:border-gray-700 transition-colors">
                            <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1">
                                <History className="w-3 h-3 text-cyan-400" /> 已實現損益
                            </div>
                            <div className={`text-base sm:text-xl font-mono font-bold ${totalRealizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {totalRealizedPnL > 0 ? '+' : ''}{mask(formatTWD(totalRealizedPnL, false))}
                            </div>
                        </div>

                        {/* Invested Ratio */}
                        <div className="bg-gray-900 p-4 sm:p-5 rounded-xl shadow-lg border border-gray-800 hover:border-cyan-500/30 transition-colors ring-1 ring-transparent hover:ring-cyan-500/20">
                            <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1">
                                <Coins className="w-3 h-3 text-cyan-400" /> 已投入資金
                            </div>
                            <div className="text-base sm:text-xl font-mono font-bold text-cyan-400">
                                NT$ {mask(formatTWD(totalInvested, false))}
                                <span className="text-xs block font-bold text-cyan-600 mt-1">佔比 {investedRatio.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Chart - Reused Martingale Chart Component but passed Personal Data */}
                <MartingalePerformanceChart transactions={transactions.filter(t => t.isMartingale !== true)} isPrivacyMode={isPrivacyMode} />
            </div>

            {/* Right Area: Industry Chart (4 cols) */}
            <div className="md:col-span-4 lg:col-span-3 order-2 md:order-1 h-full">
                <MartingaleIndustryChart
                    data={industryData}
                    totalValue={totalMarketValue}
                    isPrivacyMode={isPrivacyMode}
                />
            </div>
        </div>
    );
};

export default PersonalDashboard;
