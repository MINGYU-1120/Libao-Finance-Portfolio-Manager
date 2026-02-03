import React, { useState, useMemo } from 'react';
import { LineChart, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { TransactionRecord } from '../types';

interface PerformanceChartProps {
    transactions: TransactionRecord[];
    isPrivacyMode: boolean;
}

type Timeframe = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

// Helper to calculate "nice" ticks for graph axes
const calculateNiceTicks = (min: number, max: number, maxTicks: number = 5) => {
    if (min === max) return [min];

    const range = max - min;
    const roughStep = range / (maxTicks - 1);

    // Calculate magnitude of the step
    const exponent = Math.floor(Math.log10(Math.abs(roughStep)));
    const magnitude = Math.pow(10, exponent);
    const normalizedStep = roughStep / magnitude;

    // Pick a standard step size
    let niceStep;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;

    const step = niceStep * magnitude;

    // Calculate start and end tick
    const startTick = Math.floor(min / step) * step;
    const endTick = Math.ceil(max / step) * step;

    const ticks = [];
    // Floating point arithmetic protection
    for (let t = startTick; t <= endTick + (step / 1000); t += step) {
        // Fix float precision issues (e.g. 0.300000004)
        const val = parseFloat(t.toPrecision(12));
        ticks.push(val);
    }

    // Ensure we have at least 2 ticks if possible, or expand range?
    // For now, if ticks is empty (range too small), just return min/max
    if (ticks.length === 0) return [min, max];
    return ticks;
};

const PerformanceChart: React.FC<PerformanceChartProps> = ({ transactions, isPrivacyMode }) => {
    const [timeframe, setTimeframe] = useState<Timeframe>('YTD');
    const [showPercent, setShowPercent] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState<{ date: string; value: number; x: number; y: number } | null>(null);

    // 1. Calculate Daily Cumulative Realized P&L
    const chartData = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (sortedTxs.length === 0) return [];

        const startDate = new Date(sortedTxs[0].date);
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

                const amount = (tx.price * tx.shares * tx.exchangeRate);

                if (tx.type === 'BUY') {
                    currentInvested += amount;
                } else if (tx.type === 'SELL') {
                    const realized = (tx.realizedPnL || 0);
                    const costBasisReleased = amount - realized;
                    currentInvested -= costBasisReleased;
                    currentRealizedPnL += realized;
                }
                txIndex++;
            }

            let pct = 0;
            if (currentInvested > 1) {
                pct = (currentRealizedPnL / currentInvested) * 100;
            }

            days.push({
                date: new Date(currentDate),
                value: currentRealizedPnL,
                invested: currentInvested,
                percentage: pct
            });
        }
        return days;
    }, [transactions]);

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
    const width = 800; // Internal SVG coord
    const height = 300;
    const padding = { top: 40, bottom: 40, left: 0, right: 60 };

    if (displayData.length < 2) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[400px] flex items-center justify-center text-gray-400">
                暫無足夠數據繪製圖表
            </div>
        );
    }

    // Determine Axis Range and Ticks
    const minValue = Math.min(...displayData.map(d => d.displayValue));
    const maxValue = Math.max(...displayData.map(d => d.displayValue));

    // Add nice padding range using tick logic
    // We want about 3-5 ticks
    let yTicks = calculateNiceTicks(minValue, maxValue, 4);

    // If ticks range is too small, force some expansion?
    if (yTicks.length < 2) {
        yTicks = [minValue - (minValue ? Math.abs(minValue) * 0.1 : 10), maxValue + (maxValue ? Math.abs(maxValue) * 0.1 : 10)];
    }

    // Expand min/max Y to fit the ticks comfortably
    const minY = yTicks[0] - (yTicks[1] - yTicks[0]) * 0.2; // Extra bottom padding
    const maxY = yTicks[yTicks.length - 1] + (yTicks[1] - yTicks[0]) * 0.2; // Extra top padding

    const getX = (index: number) => {
        return padding.left + (index / (displayData.length - 1)) * (width - padding.left - padding.right);
    };

    const getY = (value: number) => {
        // Prevent division by zero if flat line
        if (maxY === minY) return height / 2;
        return height - padding.bottom - ((value - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);
    };

    const points = displayData.map((d, i) => `${getX(i)},${getY(d.displayValue)}`).join(' ');
    // Ensure the area closes properly at the bottom (minY)
    const areaPoints = `${getX(0)},${height} ${points} ${getX(displayData.length - 1)},${height}`;

    const latestPoint = displayData[displayData.length - 1];
    const currentValue = latestPoint.displayValue;
    const isPositive = currentValue >= 0;

    // Color Logic: Red for gain (Positive), Green for loss (Negative)
    const displayColor = isPositive ? 'text-red-500' : 'text-green-500';
    const mainColor = isPositive ? '#ef4444' : '#22c55e';
    const gradientId = `perf-gradient-${isPositive ? 'up' : 'down'}`;

    const currentDisplayValue = hoveredPoint ? hoveredPoint.value : currentValue;
    const dateDisplay = hoveredPoint ? hoveredPoint.date : (timeframe === 'ALL' ? '自始以來' : '此期間');

    // Integer formatting for Y-axis (no decimals for $, ints for %)
    const formatAxisValue = (val: number) => {
        if (showPercent) return `${Math.round(val)}%`;
        // Compact notation if very large? Or just locale int. 
        // User asked for "integers".
        if (val >= 10000) return `${(val / 1000).toFixed(0)}k`; // Optional compact? Or just full int. User wants "integers".
        return Math.round(val).toLocaleString();
    };

    const formatHeaderValue = (val: number) => {
        if (isPrivacyMode) return '****';
        if (showPercent) return `${val.toFixed(2)}%`; // Keep precision for header
        return Math.round(val).toLocaleString();
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">
                        <LineChart className="w-4 h-4" />
                        已實現損益績效 (Realized P&L {showPercent ? '%' : '$'})
                    </div>
                    <div className="flex items-baseline gap-3">
                        <div className={`text-4xl font-black font-mono tracking-tighter ${displayColor}`}>
                            {currentDisplayValue > 0 ? '+' : ''}{formatHeaderValue(currentDisplayValue)}
                        </div>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-bold mt-1 ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
                        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        <span className="text-gray-400 font-medium ml-1 text-xs">{dateDisplay}</span>
                    </div>
                </div>

                {/* Toggle & Info */}
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-bold font-mono">
                        <button
                            onClick={() => setShowPercent(false)}
                            className={`px-3 py-1 rounded-md transition-all ${!showPercent ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            $
                        </button>
                        <button
                            onClick={() => setShowPercent(true)}
                            className={`px-3 py-1 rounded-md transition-all ${showPercent ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            %
                        </button>
                    </div>
                    <Info className="w-5 h-5 text-gray-300" />
                </div>
            </div>

            {/* Timeframe Tabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2 no-scrollbar">
                {(['1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const).map(tf => (
                    <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${timeframe === tf
                            ? 'bg-gray-800 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                    >
                        {tf === '1W' ? '1周' : tf === '1M' ? '1個月' : tf === '3M' ? '3個月' : tf === 'YTD' ? '本年迄今' : tf === '1Y' ? '1年' : '全部'}
                    </button>
                ))}
            </div>

            {/* Chart Area */}
            <div className="relative w-full aspect-[2/1] sm:aspect-[3/1] max-h-[300px]"
                onMouseLeave={() => setHoveredPoint(null)}
            >
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={mainColor} stopOpacity="0.2" />
                            <stop offset="100%" stopColor={mainColor} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Grid Lines & Ticks tied to calculated "Nice Ticks" */}
                    {yTicks.map((tickVal, idx) => {
                        const y = getY(tickVal);
                        return (
                            <g key={tickVal}>
                                <line
                                    x1="0" y1={y} x2={width - padding.right} y2={y}
                                    stroke="#f3f4f6" strokeWidth="1"
                                />
                                <text
                                    x={width}
                                    y={y}
                                    textAnchor="end"
                                    fill="#9ca3af"
                                    fontSize="10"
                                    fontFamily="monospace"
                                    dy="4"
                                >
                                    {formatAxisValue(tickVal)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Zero Line if visible and not already covered by a tick */}
                    {minY < 0 && maxY > 0 && !yTicks.includes(0) && (
                        <line
                            x1="0" y1={getY(0)} x2={width - padding.right} y2={getY(0)}
                            stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"
                        />
                    )}

                    {/* Area fill */}
                    <path d={areaPoints} fill={`url(#${gradientId})`} stroke="none" />

                    {/* Line path */}
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
                            onMouseEnter={() => setHoveredPoint({
                                date: d.date.toLocaleDateString(),
                                value: d.displayValue,
                                x: getX(i),
                                y: getY(d.displayValue)
                            })}
                        />
                    ))}

                    {/* Hover Indicator */}
                    {hoveredPoint && (
                        <>
                            <line
                                x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={height - padding.bottom}
                                stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4"
                            />
                            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="white" stroke={mainColor} strokeWidth="3" />
                        </>
                    )}
                </svg>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2 px-1 font-mono pr-[60px]">
                <span>{displayData[0].date.toLocaleDateString()}</span>
                <span>{displayData[Math.floor(displayData.length / 2)].date.toLocaleDateString()}</span>
                <span>{displayData[displayData.length - 1].date.toLocaleDateString()}</span>
            </div>
        </div>
    );
};

export default PerformanceChart;
