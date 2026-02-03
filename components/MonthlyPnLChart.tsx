
import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';

interface MonthlyPnLChartProps {
  data: { month: string; value: number }[];
  isPrivacyMode: boolean;
}

const MonthlyPnLChart: React.FC<MonthlyPnLChartProps> = ({ data, isPrivacyMode }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Determine scale
  const maxValue = Math.max(...data.map(d => Math.abs(d.value || 0)), 1000); // Min scale to avoid flat line
  const chartHeight = 160;
  const barWidth = 30;
  const gap = 20;
  const totalWidth = data.length * (barWidth + gap);

  const maskValue = (val: number) => isPrivacyMode ? '****' : val.toLocaleString();

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 border-b pb-3">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          近半年已實現損益 (Monthly P&L)
        </h3>
      </div>

      <div className="flex-1 flex items-end justify-center w-full overflow-x-auto overflow-y-hidden pb-2">
        <div className="flex items-end space-x-3 sm:space-x-6 h-[200px] pt-8">
          {data.map((item, index) => {
            const value = item.value || 0;
            const isPositive = value >= 0;
            const height = (Math.abs(value) / maxValue) * (chartHeight - 40); // Leave space for labels
            const barHeight = Math.max(height, 2); // Min height 2px visibility
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={item.month}
                className="flex flex-col items-center group relative cursor-default"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Value Label (Always visible or on hover) */}
                <div
                  className={`absolute -top-8 text-xs font-bold font-mono transition-all duration-300 ${isPositive ? 'text-red-600' : 'text-green-600'
                    } ${isHovered || !isPrivacyMode ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'}`}
                >
                  {value > 0 ? '+' : ''}{maskValue(value)}
                </div>

                {/* Bar */}
                <div
                  className={`w-8 sm:w-10 rounded-t-md transition-all duration-300 relative ${isPositive ? 'bg-red-500' : 'bg-green-500'
                    } ${isHovered ? 'opacity-100 scale-110 shadow-md' : 'opacity-80'}`}
                  style={{ height: `${barHeight}px` }}
                >
                  {/* Zero Line Indicator */}
                  <div className="absolute bottom-0 w-full h-[1px] bg-white/50"></div>
                </div>

                {/* Month Label */}
                <div className="mt-3 text-xs text-gray-500 font-bold bg-gray-100 px-2 py-1 rounded">
                  {item.month.split('-')[1]}月
                </div>

                {/* Tooltip for Privacy Mode */}
                {isPrivacyMode && isHovered && (
                  <div className="absolute bottom-16 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                    {value > 0 ? '+' : ''}{value.toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> 獲利 (Profit)</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"></div> 虧損 (Loss)</div>
      </div>
    </div>
  );
};

export default MonthlyPnLChart;
