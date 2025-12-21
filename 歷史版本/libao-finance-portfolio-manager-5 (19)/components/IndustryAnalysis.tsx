
import React, { useState } from 'react';
import { Layers, PieChart, Maximize2, X } from 'lucide-react';

interface IndustryData {
  name: string;
  value: number; // TWD
  percent: number;
}

interface IndustryAnalysisProps {
  data: IndustryData[];
  totalValue: number;
  isPrivacyMode: boolean;
}

// Standard Hex colors for charts (Tailwind 500/600 shades)
const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#d946ef', // fuchsia-500
  '#f43f5e', // rose-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#84cc16', // lime-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#6366f1', // indigo-500
];

const IndustryAnalysis: React.FC<IndustryAnalysisProps> = ({ data, totalValue, isPrivacyMode }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Take top 5 industries, group others for the Card View
  // For the Modal View, we might want more detail, but keeping consistency is good.
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
    
    // Store midpoint for modal labeling logic later
    const midAngle = cumulativePercent + (d.percent / 2);
    
    cumulativePercent += d.percent;
    
    return {
      ...d,
      offset,
      midAngle, // 0-100 scale
      color: CHART_COLORS[i % CHART_COLORS.length],
      strokeDasharray: `${value} ${circumference - value}`,
      strokeDashoffset: -offset, 
    };
  });

  const activeIndex = hoveredIndex !== null ? hoveredIndex : 0;
  const activeItem = displayData[activeIndex] || { name: '無', percent: 0, value: 0 };
  const isInteracting = hoveredIndex !== null;

  // --- Modal Chart Logic ---
  // ViewBox 100x100 for higher precision
  const modalCenter = 50;
  const modalRadius = 25; // Donut radius
  const labelRadius = 38; // Where text sits
  const modalCircumference = 2 * Math.PI * modalRadius;

  return (
    <>
      {/* Card View */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col relative group">
        <div className="flex items-center justify-between mb-4 text-gray-700 font-bold border-b pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            產業分佈
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-gray-400 hover:text-indigo-600 transition-colors p-1 rounded-full hover:bg-indigo-50"
            title="放大查看詳情"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {totalValue === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] text-gray-400 text-sm">
            <PieChart className="w-12 h-12 mb-3 opacity-20" />
            尚無持倉數據
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1 py-4">
            <div className="relative w-64 h-64 shrink-0 transition-all cursor-pointer" onClick={() => setIsModalOpen(true)}>
              <svg viewBox="0 0 40 40" className="w-full h-full transform -rotate-90">
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
                      style={{ transition: 'all 0.3s ease' }}
                      className="transition-all duration-300 hover:filter hover:drop-shadow-md"
                      opacity={opacity}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  );
                })}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                 <span className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">
                   {isInteracting ? 'Selected' : 'TOP 1'}
                 </span>
                 <div className="flex flex-col items-center justify-center h-10 w-full px-2">
                   <span className="text-lg font-bold text-gray-800 text-center leading-tight line-clamp-2">
                     {activeItem.name.split(' ')[0]}
                   </span>
                 </div>
                 <span className="text-2xl font-mono font-bold text-blue-600 mt-1">
                   {activeItem.percent.toFixed(1)}%
                 </span>
                 <span className="text-xs text-gray-400 font-mono mt-1 bg-gray-100 px-2 py-0.5 rounded-full">
                    {isPrivacyMode ? 'NT$ ****' : `NT$ ${(activeItem.value / 1000).toFixed(0)}k`}
                 </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full Screen Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Layers className="w-6 h-6 text-indigo-600" />
                產業資產分佈詳情 (Industry Breakdown)
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-white relative overflow-hidden">
               {/* Large Chart Container */}
               <div className="w-full h-full max-w-[800px] max-h-[800px] relative">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                     {/* 1. Draw Segments */}
                     <g transform="rotate(-90 50 50)">
                       {chartSegments.map((segment, i) => {
                          const val = (segment.percent / 100) * modalCircumference;
                          const gap = segment.percent >= 100 ? 0 : 0.5;
                          // Recalculate dash array for larger coord system
                          // Circumference is 2*PI*25 approx 157
                          // But we want to use 0-100 scale for simplicity if we set pathLength=100
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
                        // Only label significant segments
                        if (segment.percent < 3) return null;

                        // Calculate Angle in Radians
                        // midAngle is 0-100 starting from 12 o'clock clockwise
                        // Math cos/sin starts from 3 o'clock (0 rad) counter-clockwise
                        // We need to convert 0-100 (12oclock) to radians
                        
                        // 0% -> -90 deg (12 oclock)
                        // 25% -> 0 deg (3 oclock)
                        // 50% -> 90 deg (6 oclock)
                        const angleDeg = (segment.midAngle / 100) * 360 - 90;
                        const angleRad = angleDeg * (Math.PI / 180);

                        // Points
                        const x1 = modalCenter + (modalRadius) * Math.cos(angleRad);
                        const y1 = modalCenter + (modalRadius) * Math.sin(angleRad);
                        
                        const x2 = modalCenter + (labelRadius) * Math.cos(angleRad);
                        const y2 = modalCenter + (labelRadius) * Math.sin(angleRad);
                        
                        const isRightSide = x2 > modalCenter;
                        const textAnchor = isRightSide ? 'start' : 'end';
                        
                        // Add a small horizontal line for cleaner look
                        const x3 = isRightSide ? x2 + 5 : x2 - 5; 
                        const y3 = y2;

                        return (
                           <g key={i} className="pointer-events-none">
                              {/* Connector Line */}
                              <polyline 
                                points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
                                fill="none"
                                stroke={segment.color}
                                strokeWidth="0.5"
                                opacity="0.6"
                              />
                              {/* Dot at start */}
                              <circle cx={x1} cy={y1} r="0.8" fill={segment.color} />
                              
                              {/* Industry Name */}
                              <text
                                x={isRightSide ? x3 + 2 : x3 - 2}
                                y={y3 - 1}
                                textAnchor={textAnchor}
                                className="text-[3px] font-bold fill-gray-800"
                                dominantBaseline="middle"
                              >
                                {segment.name.split(' ')[0]}
                              </text>
                              
                              {/* Percentage & Value */}
                              <text
                                x={isRightSide ? x3 + 2 : x3 - 2}
                                y={y3 + 3}
                                textAnchor={textAnchor}
                                className="text-[2.5px] fill-gray-500 font-mono"
                                dominantBaseline="middle"
                              >
                                {segment.percent.toFixed(1)}% {isPrivacyMode ? '(NT$ ****)' : `(NT$${(segment.value/1000).toFixed(0)}k)`}
                              </text>
                           </g>
                        );
                     })}

                     {/* Center Summary in Modal */}
                     <text x="50" y="48" textAnchor="middle" className="text-[4px] fill-gray-400 font-bold uppercase">TOTAL ASSETS</text>
                     <text x="50" y="55" textAnchor="middle" className="text-[6px] fill-gray-800 font-bold font-mono">
                        NT$ {isPrivacyMode ? '*******' : (totalValue / 10000).toFixed(1) + '萬'}
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

export default IndustryAnalysis;
