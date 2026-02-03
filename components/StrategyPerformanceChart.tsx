import React, { useState, useMemo } from 'react';
import { LineChart, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { AIPick } from '../types';

interface StrategyPerformanceChartProps {
    picks: AIPick[];
}

type Timeframe = '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';

// --- Logic from PerformanceChart.tsx (Simplified) ---
const calculateNiceTicks = (min: number, max: number, maxTicks: number = 5) => {
    if (min === max) {
        // If flat, give some room
        return [min - 5, min + 5];
    }

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

const StrategyPerformanceChart: React.FC<StrategyPerformanceChartProps> = ({ picks }) => {
    const [timeframe, setTimeframe] = useState<Timeframe>('YTD');
    const [hoveredPoint, setHoveredPoint] = useState<{ date: string; value: number; x: number; y: number } | null>(null);

    // 1. Calculate Daily Cumulative Realized %
    const chartData = useMemo(() => {
        const closedPicks = picks
            .filter(p => p.status === 'CLOSED' && p.exitDate && p.realizedReturn !== undefined)
            .sort((a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime());

        if (closedPicks.length === 0) return [];

        const startDate = new Date(closedPicks[0].exitDate!);
        const endDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const days: { date: Date; value: number }[] = [];
        let cumulativeReturn = 0;
        let pickIndex = 0;

        // Iterate day by day from first exit to today
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            const dateStr = currentDate.toISOString().split('T')[0];

            // Add returns from picks closed on this day
            while (pickIndex < closedPicks.length) {
                const pick = closedPicks[pickIndex];
                if (pick.exitDate! > dateStr) break; // Future pick

                if (pick.exitDate === dateStr) {
                    cumulativeReturn += (pick.realizedReturn || 0);
                }
                pickIndex++;
            }

            days.push({
                date: new Date(currentDate),
                value: cumulativeReturn
            });
        }
        return days;
    }, [picks]);

    // 2. Filter Timeframe
    const filteredData = useMemo(() => {
        if (chartData.length === 0) return [];

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let cutoff = new Date(now);

        switch (timeframe) {
            case '1W': cutoff.setDate(now.getDate() - 7); break;
            case '1M': cutoff.setMonth(now.getMonth() - 1); break;
            case '3M': cutoff.setMonth(now.getMonth() - 3); break;
            case 'YTD': cutoff = new Date(now.getFullYear(), 0, 1); break;
            case '1Y': cutoff.setFullYear(now.getFullYear() - 1); break;
            case 'ALL': cutoff = new Date(0); break;
        }

        const firstIdx = chartData.findIndex(d => d.date >= cutoff);
        // Ensure continuous line from left edge if exists
        let data = firstIdx === -1 ? [] : chartData.slice(firstIdx === 0 ? 0 : firstIdx - 1);
        return data;
    }, [chartData, timeframe]);

    // 3. Render
    const width = 800;
    const height = 300;
    const padding = { top: 40, bottom: 40, left: 0, right: 60 };

    if (picks.filter(p => p.status === 'CLOSED').length === 0) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[400px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <LineChart className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>尚無已結算訊號，無法繪製績效圖表</p>
                </div>
            </div>
        );
    }

    if (filteredData.length < 2) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[400px] flex items-center justify-center text-gray-400">
                此區間無數據 (Accumulating Data...)
            </div>
        );
    }

    const minValue = Math.min(...filteredData.map(d => d.value));
    const maxValue = Math.max(...filteredData.map(d => d.value));

    // Axis Ticks
    let yTicks = calculateNiceTicks(minValue, maxValue, 4);
    if (yTicks.length < 2) {
        yTicks = [minValue - 5, maxValue + 5];
    }

    const minY = yTicks[0] - (yTicks[1] - yTicks[0]) * 0.2;
    const maxY = yTicks[yTicks.length - 1] + (yTicks[1] - yTicks[0]) * 0.2;

    const getX = (index: number) => padding.left + (index / (filteredData.length - 1)) * (width - padding.left - padding.right);
    const getY = (value: number) => {
        if (maxY === minY) return height / 2;
        return height - padding.bottom - ((value - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);
    };

    const points = filteredData.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
    // Baseline for "Fill" should be 0 or bottom? Usually area charts fill from 0 if relevant, or bottom.
    // Let's fill from 'minY' (bottom) for generic area look, or 0 line if we want to emphasize polarity.
    // Portfolio chart fills from bottom. Let's stick to that.
    const areaPoints = `${getX(0)},${height} ${points} ${getX(filteredData.length - 1)},${height}`;

    const latestPoint = filteredData[filteredData.length - 1];
    const currentValue = latestPoint.value;
    const isPositive = currentValue >= 0;
    const displayColor = isPositive ? 'text-red-500' : 'text-green-500'; // TW Style: Red = Up
    const mainColor = isPositive ? '#ef4444' : '#22c55e'; // tw-red-500 / tw-green-500
    const gradientId = `strat-gradient-${isPositive ? 'up' : 'down'}`;

    const currentDisplayValue = hoveredPoint ? hoveredPoint.value : currentValue;
    const dateDisplay = hoveredPoint ? hoveredPoint.date : (timeframe === 'ALL' ? '自始以來' : '此期間');

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">
                        <LineChart className="w-4 h-4" />
                        已實現損益績效 (REALIZED P&L %)
                    </div>
                    <div className="flex items-baseline gap-3">
                        <div className={`text-4xl font-black font-mono tracking-tighter ${displayColor}`}>
                            {currentDisplayValue > 0 ? '+' : ''}{currentDisplayValue.toFixed(2)}%
                        </div>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-bold mt-1 ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
                        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        <span className="text-gray-400 font-medium ml-1 text-xs">{dateDisplay}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span title="僅計算已平倉交易的百分比累計總和" className="cursor-help">
                        <Info className="w-5 h-5 text-gray-300" />
                    </span>
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

            {/* Chart */}
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

                    {/* Grid & Ticks */}
                    {yTicks.map((tickVal) => {
                        const y = getY(tickVal);
                        return (
                            <g key={tickVal}>
                                <line
                                    x1="0" y1={y} x2={width - padding.right} y2={y}
                                    stroke="#f3f4f6" strokeWidth="1"
                                />
                                <text
                                    x={width} y={y} textAnchor="end" fill="#9ca3af" fontSize="10" fontFamily="monospace" dy="4"
                                >
                                    {tickVal.toFixed(0)}%
                                </text>
                            </g>
                        );
                    })}

                    {/* Zero Line */}
                    {minY < 0 && maxY > 0 && !yTicks.includes(0) && (
                        <line
                            x1="0" y1={getY(0)} x2={width - padding.right} y2={getY(0)}
                            stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"
                        />
                    )}

                    {/* Area & Line */}
                    <path d={areaPoints} fill={`url(#${gradientId})`} stroke="none" />
                    <path d={`M ${points}`} fill="none" stroke={mainColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Interaction */}
                    {filteredData.map((d, i) => (
                        <rect
                            key={i}
                            x={getX(i) - (width / filteredData.length / 2)}
                            y={0}
                            width={width / filteredData.length}
                            height={height}
                            fill="transparent"
                            onMouseEnter={() => setHoveredPoint({
                                date: d.date.toLocaleDateString(),
                                value: d.value,
                                x: getX(i),
                                y: getY(d.value)
                            })}
                        />
                    ))}

                    {/* Hover Point */}
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
        </div>
    );
};

export default StrategyPerformanceChart;
