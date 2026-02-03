import React, { useState } from 'react';
import { Layers, PieChart, Maximize2, X, Briefcase } from 'lucide-react';
import { formatTWD } from '../../utils/formatting';

export interface IndustryData {
    name: string;
    value: number; // TWD
    percent: number;
}

interface MartingaleIndustryChartProps {
    data: IndustryData[];
    totalValue: number;
    isPrivacyMode: boolean;
}

// Dark/Gold Theme Colors
const CHART_COLORS = [
    '#EAB308', // yellow-500 (Primary Gold)
    '#A16207', // yellow-700
    '#CA8A04', // yellow-600
    '#FACC15', // yellow-400
    '#713F12', // yellow-900
    '#FEF08A', // yellow-200
    '#854D0E', // yellow-800
    '#FDE047', // yellow-300
];

const MartingaleIndustryChart: React.FC<MartingaleIndustryChartProps> = ({ data, totalValue, isPrivacyMode }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Grouping Logic if too many (Top 5 + Others)
    let displayData = [...data];
    if (data.length > 5) {
        const top5 = data.slice(0, 5);
        const others = data.slice(5);
        const othersValue = others.reduce((sum, d) => sum + d.value, 0);
        const othersPercent = others.reduce((sum, d) => sum + d.percent, 0);

        displayData = [
            ...top5,
            { name: '其他 (Others)', value: othersValue, percent: othersPercent }
        ];
    }

    // --- SVG Chart Calculations (Card View) ---
    const radius = 15.9155;
    const center = 20; // ViewBox 40x40
    const circumference = 100;

    let cumulativePercent = 0;
    const chartSegments = displayData.map((d, i) => {
        const gap = d.percent >= 100 ? 0 : 0.5;
        const value = Math.max(d.percent - gap, 0);
        const offset = cumulativePercent;

        const midAngle = cumulativePercent + (d.percent / 2);
        cumulativePercent += d.percent;

        return {
            ...d,
            offset,
            midAngle,
            color: CHART_COLORS[i % CHART_COLORS.length],
            strokeDasharray: `${value} ${circumference - value}`,
            strokeDashoffset: -offset,
        };
    });

    const activeIndex = hoveredIndex !== null ? hoveredIndex : 0;
    const activeItem = displayData[activeIndex] || { name: '無', percent: 0, value: 0 };
    const isInteracting = hoveredIndex !== null;

    // --- Modal Chart Logic (Higher Precision) ---
    const modalCenter = 50;
    const modalRadius = 25;
    const labelRadius = 38;
    const modalCircumference = 2 * Math.PI * modalRadius;

    // Helper for Modal Summary
    const summaryValue = isPrivacyMode ? '*******' : formatTWD(totalValue, false);

    return (
        <>
            {/* Card View - Dark Theme */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-5 rounded-xl shadow-xl border border-gray-700 h-full flex flex-col relative group">
                <div className="flex items-center justify-between mb-4 border-b border-gray-700/50 pb-3">
                    <div className="flex items-center gap-2 text-libao-gold font-bold">
                        <Layers className="w-5 h-5" />
                        產業分佈 (Industry)
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                        title="放大查看詳情"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>

                {totalValue === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] text-gray-600 text-sm">
                        <PieChart className="w-12 h-12 mb-3 opacity-20" />
                        尚無持倉數據
                    </div>
                ) : (
                    <div className="flex items-center justify-center flex-1 py-4">
                        <div className="relative w-64 h-64 shrink-0 transition-all cursor-pointer hover:scale-105 duration-500" onClick={() => setIsModalOpen(true)}>
                            {/* Inner Glow Helper */}
                            <div className="absolute inset-0 bg-yellow-400/5 rounded-full blur-3xl transform scale-75 pointer-events-none"></div>

                            <svg viewBox="0 0 40 40" className="w-full h-full transform -rotate-90 relative z-10">
                                {chartSegments.map((segment, i) => {
                                    const isHovered = hoveredIndex === i;
                                    const opacity = isInteracting && !isHovered ? 0.3 : 1;
                                    const strokeWidth = isHovered ? 5 : 3.5;

                                    return (
                                        <circle
                                            key={i}
                                            cx={center}
                                            cy={center}
                                            r={radius}
                                            fill="transparent"
                                            stroke={segment.color}
                                            strokeWidth={strokeWidth}
                                            strokeDasharray={segment.strokeDasharray}
                                            strokeDashoffset={segment.strokeDashoffset}
                                            style={{ transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
                                            className="hover:filter hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] cursor-pointer"
                                            opacity={opacity}
                                            onMouseEnter={() => setHoveredIndex(i)}
                                            onMouseLeave={() => setHoveredIndex(null)}
                                        />
                                    );
                                })}
                            </svg>

                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-20">
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">
                                    {isInteracting ? 'SELECTED' : 'TOP 1'}
                                </span>
                                <div className="flex flex-col items-center justify-center h-10 w-full px-4">
                                    <span className={`text-lg font-bold text-white text-center leading-tight line-clamp-2 transition-all duration-300 ${isInteracting ? 'scale-110 text-yellow-300' : ''}`}>
                                        {activeItem.name.split(' ')[0]}
                                    </span>
                                </div>
                                <span className="text-2xl font-mono font-bold text-libao-gold mt-1 drop-shadow-md">
                                    {activeItem.percent.toFixed(1)}%
                                </span>
                                <span className="text-[10px] text-gray-500 font-mono mt-1 bg-gray-900/50 px-2 py-0.5 rounded-full border border-gray-700/50">
                                    {isPrivacyMode ? 'NT$ ****' : `NT$ ${(activeItem.value / 1000).toFixed(0)}k`}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Full Screen Modal - Dark Theme */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-gray-900 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-700">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Layers className="w-6 h-6 text-libao-gold" />
                                產業分佈詳細分析 (Industry Breakdown)
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-800 rounded-full transition-colors group">
                                <X className="w-6 h-6 text-gray-500 group-hover:text-white" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 p-8 flex flex-col items-center justify-center bg-[#0d121e] relative overflow-hidden">
                            {/* Background decoration */}<div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-gray-900/0 to-gray-900/0 pointer-events-none"></div>

                            <div className="w-full h-full max-w-[800px] max-h-[800px] relative z-10">
                                <svg viewBox="0 0 100 100" className="w-full h-full">
                                    {/* 1. Draw Segments */}
                                    <g transform="rotate(-90 50 50)">
                                        {chartSegments.map((segment, i) => {
                                            const gap = segment.percent >= 100 ? 0 : 0.5;
                                            return (
                                                <circle
                                                    key={i}
                                                    cx={modalCenter}
                                                    cy={modalCenter}
                                                    r={modalRadius}
                                                    fill="transparent"
                                                    stroke={segment.color}
                                                    strokeWidth="12"
                                                    strokeDasharray={`${Math.max(segment.percent - gap, 0)} ${100 - Math.max(segment.percent - gap, 0)}`}
                                                    strokeDashoffset={-segment.offset}
                                                    pathLength="100"
                                                    className="transition-all duration-500 hover:opacity-80"
                                                />
                                            );
                                        })}
                                    </g>

                                    {/* 2. Draw Labels & Lines */}
                                    {chartSegments.map((segment, i) => {
                                        if (segment.percent < 2) return null; // Increased threshold for cleaner look

                                        const angleDeg = (segment.midAngle / 100) * 360 - 90;
                                        const angleRad = angleDeg * (Math.PI / 180);

                                        const x1 = modalCenter + (modalRadius) * Math.cos(angleRad);
                                        const y1 = modalCenter + (modalRadius) * Math.sin(angleRad);

                                        const x2 = modalCenter + (labelRadius) * Math.cos(angleRad);
                                        const y2 = modalCenter + (labelRadius) * Math.sin(angleRad);

                                        const isRightSide = x2 > modalCenter;
                                        const textAnchor = isRightSide ? 'start' : 'end';
                                        const x3 = isRightSide ? x2 + 5 : x2 - 5;
                                        const y3 = y2;

                                        return (
                                            <g key={i} className="pointer-events-none">
                                                <polyline
                                                    points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
                                                    fill="none"
                                                    stroke={segment.color}
                                                    strokeWidth="0.3" // Thinner lines
                                                    opacity="0.5"
                                                />
                                                <circle cx={x1} cy={y1} r="0.6" fill={segment.color} />

                                                <text
                                                    x={isRightSide ? x3 + 2 : x3 - 2}
                                                    y={y3 - 1.5}
                                                    textAnchor={textAnchor}
                                                    className="text-[2.8px] font-bold fill-gray-200 tracking-wide"
                                                    dominantBaseline="middle"
                                                >
                                                    {segment.name.split(' ')[0]} {/* Simplified name */}
                                                </text>

                                                <text
                                                    x={isRightSide ? x3 + 2 : x3 - 2}
                                                    y={y3 + 2}
                                                    textAnchor={textAnchor}
                                                    className="text-[2.2px] fill-gray-400 font-mono"
                                                    dominantBaseline="middle"
                                                >
                                                    {segment.percent.toFixed(1)}% {isPrivacyMode ? '(NT$ ****)' : `(NT$${(segment.value / 1000).toFixed(0)}k)`}
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* Center Summary */}
                                    <text x="50" y="47" textAnchor="middle" className="text-[3px] fill-gray-500 font-bold uppercase tracking-[0.2em]">TOTAL ASSETS</text>
                                    <text x="50" y="54" textAnchor="middle" className="text-[5px] fill-white font-bold font-mono tracking-tight drop-shadow-lg">
                                        NT$ {summaryValue}
                                    </text>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MartingaleIndustryChart;
