import React, { useState, useMemo } from 'react';
import { LineChart, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { TransactionRecord } from '../../types';


interface MartingalePerformanceChartProps {
    transactions: TransactionRecord[];
    isPrivacyMode: boolean;
}

type Timeframe = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

// Helper to calculate "nice" ticks
const calculateNiceTicks = (min: number, max: number, maxTicks: number = 5) => {
    if (min === max) return [min];
    const range = max - min;
    const roughStep = range / (maxTicks - 1);
    const exponent = Math.floor(Math.log10(Math.abs(roughStep)));
    const magnitude = Math.pow(10, exponent);
    const normalizedStep = roughStep / magnitude;
    let niceStep;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;
    const step = niceStep * magnitude;
    const startTick = Math.floor(min / step) * step;
    const endTick = Math.ceil(max / step) * step;
    const ticks = [];
    for (let t = startTick; t <= endTick + (step / 1000); t += step) {
        ticks.push(parseFloat(t.toPrecision(12)));
    }
    if (ticks.length === 0) return [min, max];
    return ticks;
};

const MartingalePerformanceChart: React.FC<MartingalePerformanceChartProps> = ({ transactions, isPrivacyMode }) => {
    // 0. Market Filter State
    const [marketFilter, setMarketFilter] = useState<'ALL' | 'TW' | 'US'>('ALL');
    const [timeframe, setTimeframe] = useState<Timeframe>('YTD');
    const [showPercent, setShowPercent] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState<{ date: string; value: number; x: number; y: number } | null>(null);

    // 1. Calculate Daily Cumulative Realized P&L
    const chartData = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (sortedTxs.length === 0) return [];

        const startDate = new Date(sortedTxs[0].date);
        startDate.setDate(startDate.getDate() - 2);
        const endDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const days: { date: Date; value: number; invested: number; percentage: number }[] = [];
        let currentRealizedPnL = 0;
        let currentInvested = 0;
        let txIndex = 0;

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);

            while (txIndex < sortedTxs.length) {
                const tx = sortedTxs[txIndex];
                const txDate = new Date(tx.date);
                txDate.setHours(0, 0, 0, 0);

                if (txDate.getTime() > currentDate.getTime()) break;

                // Market Filter Check
                const isUS = (tx.exchangeRate || 1) > 5;
                const txMarket = isUS ? 'US' : 'TW';

                // Skip if not matching filter (unless ALL)
                if (marketFilter !== 'ALL' && txMarket !== marketFilter) {
                    txIndex++;
                    continue;
                }

                // Value Calculation based on Filter
                // If US Filter -> Use USD PnL. If TW/ALL -> Use TWD PnL.
                // Note: For ALL, we use TWD as base.
                const useUSD = marketFilter === 'US';
                const rate = useUSD ? (tx.exchangeRate || 1) : 1;

                // Original amount in TWD
                const amountTWD = (tx.price * tx.shares * (tx.exchangeRate || 1));
                const amount = useUSD ? amountTWD / (tx.exchangeRate || 1) : amountTWD;

                if (tx.type === 'BUY') {
                    currentInvested += amount;
                } else if (tx.type === 'SELL') {
                    const realizedTWD = (tx.realizedPnL || 0);
                    const realized = useUSD ? realizedTWD / (tx.exchangeRate || 1) : realizedTWD;

                    // Cost Basis = Proceeds - PnL? 
                    // proceeds = amount
                    const costBasisReleased = amount - realized;
                    currentInvested -= costBasisReleased;
                    currentRealizedPnL += realized;
                } else if (tx.type === 'DIVIDEND') {
                    const realizedTWD = (tx.realizedPnL || 0);
                    const realized = useUSD ? realizedTWD / (tx.exchangeRate || 1) : realizedTWD;
                    currentRealizedPnL += realized;
                }
                txIndex++;
            }

            let pct = 0;
            if (currentInvested > 1) { // 1 is just a tiny float buffer
                pct = (currentRealizedPnL / currentInvested) * 100;
            } else if (currentInvested === 0 && currentRealizedPnL !== 0) {
                // If all sold, return is infinite? Or just keep last %?
                // Let's keep 0 or handle essentially infinite return cleanly
                // Usually means we closed out positions. 
                // Simple approach: 0 or last known could be misleading.
                // Let's use 0 to reset ratio if no investment active.
                pct = 0;
            }

            days.push({
                date: new Date(currentDate),
                value: currentRealizedPnL,
                invested: currentInvested,
                percentage: pct
            });
        }
        return days;
    }, [transactions, marketFilter]);

    // 2. Filter by Timeframe
    const filteredData = useMemo(() => {
        if (chartData.length === 0) return [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let cutoff = new Date(now);
        switch (timeframe) {
            case '1W': cutoff.setDate(now.getDate() - 7); break;
            case '1M': cutoff.setMonth(now.getMonth() - 1); break;
            case '3M': cutoff.setMonth(now.getMonth() - 3); break;
            case '6M': cutoff.setMonth(now.getMonth() - 6); break;
            case 'YTD': cutoff = new Date(now.getFullYear(), 0, 1); break;
            case '1Y': cutoff.setFullYear(now.getFullYear() - 1); break;
            case 'ALL': cutoff = new Date(0); break;
        }
        const firstIdx = chartData.findIndex(d => d.date >= cutoff);
        let data = firstIdx === -1 ? [] : chartData.slice(firstIdx === 0 ? 0 : firstIdx - 1);
        return data;
    }, [chartData, timeframe]);

    const displayData = useMemo(() => {
        return filteredData.map(d => ({
            ...d,
            displayValue: showPercent ? d.percentage : d.value
        }));
    }, [filteredData, showPercent]);

    // 3. Render Logic
    const width = 800;
    const height = 300;
    const padding = { top: 40, bottom: 40, left: 0, right: 60 };

    // Helper for Currency Label
    const getCurrencyLabel = () => {
        if (marketFilter === 'US') return 'USD';
        return 'NT$';
    };

    if (displayData.length < 2) {
        return (
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 h-[350px] flex flex-col items-center justify-center text-gray-500 gap-4">
                <LineChart className="w-16 h-16 opacity-20" />
                <span className="font-medium text-sm">尚無足夠的交易歷史可供顯示</span>
            </div>
        );
    }

    const minValue = Math.min(...displayData.map(d => d.displayValue));
    const maxValue = Math.max(...displayData.map(d => d.displayValue));
    let yTicks = calculateNiceTicks(minValue === maxValue ? minValue - 100 : minValue, maxValue === minValue ? maxValue + 100 : maxValue, 4);

    if (yTicks.length < 2) {
        yTicks = [minValue - (minValue ? Math.abs(minValue) * 0.1 : 10), maxValue + (maxValue ? Math.abs(maxValue) * 0.1 : 10)];
    }

    const minY = yTicks[0] - (yTicks[1] - yTicks[0]) * 0.2;
    const maxY = yTicks[yTicks.length - 1] + (yTicks[1] - yTicks[0]) * 0.2;

    const getX = (index: number) => padding.left + (index / (displayData.length - 1)) * (width - padding.left - padding.right);
    const getY = (value: number) => {
        if (maxY === minY) return height / 2;
        return height - padding.bottom - ((value - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);
    };

    const points = displayData.map((d, i) => `${getX(i)},${getY(d.displayValue)}`).join(' ');
    const areaPoints = `${getX(0)},${height} ${points} ${getX(displayData.length - 1)},${height}`;

    const latestPoint = displayData[displayData.length - 1];
    const currentValue = latestPoint.displayValue;
    const isPositive = currentValue >= 0;

    // Dark Mode Colors
    const displayColor = isPositive ? 'text-red-400' : 'text-green-400';
    const mainColor = isPositive ? '#f87171' : '#4ade80'; // red-400 : green-400
    const gradientId = `martingale-perf-${isPositive ? 'up' : 'down'}`;

    const currentDisplayValue = hoveredPoint ? hoveredPoint.value : currentValue;
    const dateDisplay = hoveredPoint ? hoveredPoint.date : (timeframe === 'ALL' ? '自始以來' : '此期間');

    const formatAxisValue = (val: number) => {
        if (showPercent) return `${Math.round(val)}%`;
        if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
        return Math.round(val).toLocaleString();
    };

    const formatHeaderValue = (val: number) => {
        if (isPrivacyMode) return '****';
        if (showPercent) return `${val.toFixed(2)}%`;
        return Math.round(val).toLocaleString();
    };

    return (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 text-white">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                    <div className="flex items-center gap-2 text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">
                        <LineChart className="w-4 h-4 text-libao-gold" />
                        已實現損益績效 (Realized P&L {showPercent ? '%' : '$'})
                    </div>
                    <div className="flex items-baseline gap-3">
                        <div className={`text-4xl font-black font-mono tracking-tighter ${displayColor}`}>
                            {currentDisplayValue > 0 ? '+' : ''}
                            {!showPercent && (marketFilter === 'US' ? 'USD ' : 'NT$ ')}
                            {formatHeaderValue(currentDisplayValue)}
                        </div>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-bold mt-1 ${isPositive ? 'text-red-400' : 'text-green-400'}`}>
                        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        <span className="text-gray-500 font-medium ml-1 text-xs">{dateDisplay}</span>
                    </div>
                </div>

                {/* Controls Group */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Market Toggles */}
                    <div className="bg-gray-800 p-1 rounded-lg flex text-[10px] font-bold border border-gray-700">
                        {(['TW', 'US', 'ALL'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setMarketFilter(m)}
                                className={`px-2 py-1 rounded transition-colors ${marketFilter === m ? 'bg-libao-gold text-gray-900' : 'text-gray-400 hover:text-white'}`}
                            >
                                {m === 'TW' ? '台股' : m === 'US' ? '美股' : '全市場'}
                            </button>
                        ))}
                    </div>

                    {/* Show % Toggle */}
                    <div className="bg-gray-800 p-1 rounded-lg flex text-[10px] font-bold font-mono border border-gray-700">
                        <button onClick={() => setShowPercent(false)} className={`px-2 py-1 rounded transition-colors ${!showPercent ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>$</button>
                        <button onClick={() => setShowPercent(true)} className={`px-2 py-1 rounded transition-colors ${showPercent ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>%</button>
                    </div>
                </div>
            </div>
            {/* ... rest of header (Value Display) needs update ... */}

            {/* Chart Area */}
            <div className="relative w-full aspect-[2/1] sm:aspect-[3/1] max-h-[300px]" onMouseLeave={() => setHoveredPoint(null)}>
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={mainColor} stopOpacity="0.2" />
                            <stop offset="100%" stopColor={mainColor} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {yTicks.map((tickVal) => {
                        const y = getY(tickVal);
                        return (
                            <g key={tickVal}>
                                <line x1="0" y1={y} x2={width - padding.right} y2={y} stroke="#374151" strokeWidth="1" strokeOpacity="0.5" />
                                <text x={width} y={y} textAnchor="end" fill="#6b7280" fontSize="10" fontFamily="monospace" dy="4">{formatAxisValue(tickVal)}</text>
                            </g>
                        );
                    })}

                    {/* Zero Line */}
                    {minY < 0 && maxY > 0 && !yTicks.includes(0) && (
                        <line x1="0" y1={getY(0)} x2={width - padding.right} y2={getY(0)} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
                    )}

                    {/* Paths */}
                    <path d={areaPoints} fill={`url(#${gradientId})`} stroke="none" />
                    <path d={`M ${points}`} fill="none" stroke={mainColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Interactive Overlay */}
                    {displayData.map((d, i) => (
                        <rect
                            key={i}
                            x={getX(i) - (width / displayData.length / 2)}
                            y={0}
                            width={width / displayData.length}
                            height={height}
                            fill="transparent"
                            onMouseEnter={() => setHoveredPoint({ date: d.date.toLocaleDateString(), value: d.displayValue, x: getX(i), y: getY(d.displayValue) })}
                        />
                    ))}

                    {/* Hover Indicator */}
                    {hoveredPoint && (
                        <>
                            <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={height - padding.bottom} stroke="#4b5563" strokeWidth="1" strokeDasharray="4 4" />
                            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="#1f2937" stroke={mainColor} strokeWidth="3" />
                        </>
                    )}
                </svg>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 px-1 font-mono pr-[60px]">
                <span>{displayData[0].date.toLocaleDateString()}</span>
                <span>{displayData[Math.floor(displayData.length / 2)].date.toLocaleDateString()}</span>
                <span>{displayData[displayData.length - 1].date.toLocaleDateString()}</span>
            </div>
        </div>
    );
};

export default MartingalePerformanceChart;
