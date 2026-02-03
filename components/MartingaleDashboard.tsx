import React from 'react';
import { CalculatedCategory, TransactionRecord } from '../types';
import { formatTWD } from '../utils/formatting';
import { Briefcase, Wallet, TrendingUp, History, Coins } from 'lucide-react';
import MartingaleIndustryChart, { IndustryData } from './charts/MartingaleIndustryChart';
import MartingalePerformanceChart from './charts/MartingalePerformanceChart';

interface MartingaleDashboardProps {
    categories: CalculatedCategory[];
    totalCapital: number;
    transactions: TransactionRecord[];
    industryData?: IndustryData[]; // New Prop
    onDeposit?: () => void; // New Prop
    onReset?: () => void; // New Prop, for resetting the portfolio
    isPrivacyMode: boolean;
}

const MartingaleDashboard: React.FC<MartingaleDashboardProps> = ({
    categories,
    totalCapital,
    transactions = [],
    industryData = [], // Default empty
    onDeposit,
    onReset,
    isPrivacyMode
}) => {
    // 1. Aggregate Data
    const totalMarketValue = categories.reduce((sum, c) => sum + c.assets.reduce((aSum, asset) => aSum + (asset.marketValue || 0), 0), 0);
    const totalInvested = categories.reduce((sum, c) => sum + c.investedAmount, 0);
    const totalRealizedPnL = categories.reduce((sum, c) => sum + c.realizedPnL, 0);

    // Correct Net Worth Calculation: Total Capital + Total Unr PnL + Total Realized PnL
    const totalUnrealizedPnL = categories.reduce((sum, cat) => {
        return sum + cat.assets.reduce((aSum, asset) => aSum + (asset.unrealizedPnL || 0), 0);
    }, 0);
    const totalNetWorth = totalCapital + totalUnrealizedPnL + totalRealizedPnL;

    // Ratios
    const unrealizedRatio = totalInvested > 0 ? (totalUnrealizedPnL / totalInvested) * 100 : 0;
    // Invested Ratio: Invested / NetWorth (or Capital?) 
    const investedRatio = totalNetWorth > 0 ? (totalInvested / totalNetWorth) * 100 : 0;

    // Mask Helper
    const mask = (val: string | number) => isPrivacyMode ? '****' : val;

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 mb-8">
            {/* Left Area: Stats & Trend (8 cols) */}
            <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-6 order-1 md:order-2">
                <div className="flex flex-col gap-4">
                    {/* Hero Card: Net Worth */}
                    <div className="bg-gradient-to-r from-gray-900 to-slate-900 p-6 rounded-2xl shadow-xl border border-gray-700 relative overflow-hidden group">
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <div className="text-libao-gold/80 text-[10px] sm:text-xs font-bold mb-1 tracking-wider uppercase flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" />
                                    總資產淨值 (Net Worth)
                                </div>
                                <div className="text-3xl sm:text-4xl font-mono font-black text-white tracking-tight drop-shadow-lg">
                                    NT$ {mask(formatTWD(totalNetWorth, false))}
                                </div>
                            </div>
                            <Briefcase className="w-12 h-12 sm:w-16 sm:h-16 text-libao-gold opacity-20 group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="absolute top-0 right-0 w-40 h-40 bg-libao-gold/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {/* Capital */}
                        <div className="bg-gray-800 p-4 sm:p-5 rounded-xl shadow-lg border border-gray-700/50 flex flex-col justify-between group hover:border-gray-600 transition-colors">
                            <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1">
                                <Wallet className="w-3 h-3 text-gray-500" /> 投入本金
                            </div>
                            <div className="text-base sm:text-xl font-mono font-bold text-gray-200">
                                <div className="truncate mb-1">NT$ {mask(formatTWD(totalCapital, false))}</div>
                                {onDeposit && (
                                    <div className="flex gap-2">
                                        <button onClick={onDeposit} className="text-[10px] bg-libao-gold/10 px-2 py-1 rounded text-libao-gold font-bold hover:bg-libao-gold/20 border border-libao-gold/20 transition-colors w-fit">
                                            出/入金
                                        </button>
                                        {onReset && (
                                            <button onClick={onReset} className="text-[10px] bg-red-500/10 px-2 py-1 rounded text-red-500 font-bold hover:bg-red-500/20 border border-red-500/20 transition-colors w-fit">
                                                重置倉位
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Unrealized P&L */}
                        <div className="bg-gray-800 p-4 sm:p-5 rounded-xl shadow-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
                            <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-red-400" /> 未實現損益
                            </div>
                            <div className={`text-base sm:text-xl font-mono font-bold ${totalUnrealizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {totalUnrealizedPnL > 0 ? '+' : ''}{mask(formatTWD(totalUnrealizedPnL, false))}
                                <span className="text-xs block font-bold opacity-60 mt-1">{unrealizedRatio > 0 ? '+' : ''}{unrealizedRatio.toFixed(2)}%</span>
                            </div>
                        </div>

                        {/* Realized P&L */}
                        <div className="bg-gray-800 p-4 sm:p-5 rounded-xl shadow-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
                            <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1">
                                <History className="w-3 h-3 text-blue-400" /> 已實現損益
                            </div>
                            <div className={`text-base sm:text-xl font-mono font-bold ${totalRealizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {totalRealizedPnL > 0 ? '+' : ''}{mask(formatTWD(totalRealizedPnL, false))}
                            </div>
                        </div>

                        {/* Invested Ratio */}
                        <div className="bg-gray-800 p-4 sm:p-5 rounded-xl shadow-lg border border-gray-700/50 hover:border-libao-gold/30 transition-colors ring-1 ring-transparent hover:ring-libao-gold/20">
                            <div className="text-gray-400 text-[10px] font-bold mb-2 uppercase flex items-center gap-1">
                                <Coins className="w-3 h-3 text-libao-gold" /> 已投入資金
                            </div>
                            <div className="text-base sm:text-xl font-mono font-bold text-libao-gold">
                                NT$ {mask(formatTWD(totalInvested, false))}
                                <span className="text-xs block font-bold text-yellow-600 mt-1">佔比 {investedRatio.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Chart */}
                <MartingalePerformanceChart transactions={transactions} isPrivacyMode={isPrivacyMode} />
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

export default MartingaleDashboard;
