
import React, { useState } from 'react';
import { CalculatedCategory } from '../types';
import { Edit2, PieChart, RefreshCw, ChevronRight, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { formatTWD } from '../utils/formatting';

interface SummaryTableProps {
  categories: CalculatedCategory[];
  totalCapital: number;
  onUpdateAllocation: (id: string, percent: number) => void;
  onSelectCategory: (id: string) => void;
  onRefreshCategory?: (id: string) => Promise<void>;
  onDeleteCategory?: (id: string) => void;
  onMoveCategory?: (id: string, direction: 'up' | 'down') => void;
  isPrivacyMode: boolean;
  isMasked?: boolean;
}

const SummaryTable: React.FC<SummaryTableProps> = ({
  categories,
  totalCapital,
  onUpdateAllocation,
  onSelectCategory,
  onRefreshCategory,
  onDeleteCategory,
  onMoveCategory,
  isPrivacyMode,
  isMasked = false
}) => {
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const handleRefresh = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onRefreshCategory) {
      setRefreshingIds(prev => new Set(prev).add(id));
      await onRefreshCategory(id);
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const totalPercent = categories.reduce((sum, c) => sum + c.allocationPercent, 0);

  // Strict masking helper: If masked, show stars. If privacy mode, show stars.
  // Strict masking helper: If masked, show stars. If privacy mode, show stars.
  const maskValue = (val: string | number) => (isMasked || isPrivacyMode) ? '****' : val;
  const strictMask = (val: string | number) => (isMasked || isPrivacyMode) ? '****' : val;

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PieChart className="w-5 h-5 text-yellow-400" />
          持倉總覽 (Overview)
        </h2>
        <div className="text-lg">
          總配置: <span className={`${totalPercent > 100 ? 'text-red-400' : 'text-green-400'}`}>{isMasked ? '****' : totalPercent}%</span>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-100">
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            id={idx === 0 ? "tour-summary-mobile-first" : undefined} // Add ID for tour step 2 on mobile
            className="p-4 bg-white hover:bg-gray-50 transition-colors"
            onClick={() => onSelectCategory(cat.id)}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold px-2 py-1 rounded text-white ${cat.market === 'TW' ? 'bg-red-600' : 'bg-blue-600'}`}>
                  {cat.market === 'TW' ? '台股' : '美股'}
                </span>
                <h3 className="font-bold text-xl text-gray-800">{cat.name}</h3>
                {onMoveCategory && (
                  <div className="flex flex-col ml-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'up'); }}
                      className="text-gray-300 hover:text-gray-500 active:scale-95"
                      title="上移"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'down'); }}
                      className="text-gray-300 hover:text-gray-500 active:scale-95"
                      title="下移"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {onDeleteCategory && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                    className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-500 mr-1"
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => handleRefresh(e, cat.id)}
                  disabled={refreshingIds.has(cat.id)}
                  className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 ${refreshingIds.has(cat.id) ? 'text-blue-600 animate-spin' : 'text-gray-500'}`}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>資金占比</span>
                  <span>{strictMask(cat.investmentRatio.toFixed(1))}% 已投入</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`absolute top-0 left-0 h-full ${cat.investmentRatio > 100 ? 'bg-red-500' : 'bg-blue-600'}`}
                      style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                    />
                  </div>
                  <div className="relative w-16" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={strictMask(cat.allocationPercent)}
                      onChange={(e) => onUpdateAllocation(cat.id, Number(e.target.value))}
                      disabled={isMasked}
                      className="w-full text-center bg-white border border-yellow-300 rounded px-1 py-0.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-base bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">
              <div>
                <div className="text-sm text-gray-400">已投入</div>
                <div className="font-mono font-bold text-gray-700">{maskValue((cat.investedAmount / 10000).toFixed(1))}萬</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">剩餘現金</div>
                <div className="font-mono font-bold text-gray-700">{maskValue((cat.remainingCash / 10000).toFixed(1))}萬</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">預計總投入</div>
                <div className="font-mono font-bold text-blue-600">{maskValue((cat.projectedInvestment / 10000).toFixed(1))}萬</div>
              </div>
            </div>

            <button className="w-full py-2 bg-gray-800 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 active:bg-gray-900">
              查看明細 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">
              <th className="p-4 w-12 text-center">#</th>
              <th className="p-4 w-12 text-center">市場</th>
              <th className="p-4 min-w-[120px]">倉位名稱 (Category)</th>
              <th className="p-4 w-28 text-center">資金配置 (%)</th>
              <th className="p-4 text-right">預計總投入</th>
              <th className="p-4 text-right">已投入金額</th>
              <th className="p-4 text-right">剩餘現金</th>
              <th className="p-4 text-right">已實現損益</th>
              <th className="p-4 text-center w-40">資金使用率</th>
              <th className="p-4 text-center w-24">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-lg">
            {categories.map((cat, idx) => (
              <tr
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
              >
                <td className="p-4 text-center font-mono text-gray-400 text-sm">{idx + 1}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${cat.market === 'TW' ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-blue-100 text-blue-600 border border-blue-200'}`}>
                    {cat.market}
                  </span>
                </td>
                <td className="p-4">
                  <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                    {cat.name}
                    {onMoveCategory && (
                      <div className="flex flex-col ml-1 opacity-10 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'up'); }}
                          className="text-gray-300 hover:text-gray-500 active:scale-95 p-0.5 hover:bg-gray-100 rounded"
                          title="上移"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'down'); }}
                          className="text-gray-300 hover:text-gray-500 active:scale-95 p-0.5 hover:bg-gray-100 rounded"
                          title="下移"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-0.5">
                    <input
                      type="text"
                      value={isMasked ? '****' : cat.allocationPercent}
                      onChange={(e) => onUpdateAllocation(cat.id, Number(e.target.value))}
                      disabled={isMasked}
                      className="w-12 text-center border-b-2 border-yellow-400 bg-transparent font-mono font-black text-gray-900 focus:outline-none focus:border-indigo-500 disabled:text-gray-400 text-lg"
                    />
                    <span className="text-gray-400 text-xs font-bold">%</span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="font-mono text-gray-500 font-medium">{maskValue(formatTWD(cat.projectedInvestment, isPrivacyMode))}</div>
                </td>
                <td className="p-4 text-right">
                  <div className="font-mono font-black text-gray-900">{maskValue(formatTWD(cat.investedAmount, isPrivacyMode))}</div>
                </td>
                <td className="p-4 text-right">
                  <div className={`font-mono font-black ${cat.remainingCash < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {maskValue(formatTWD(cat.remainingCash, isPrivacyMode))}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className={`font-mono font-black ${cat.realizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {maskValue(formatTWD(cat.realizedPnL, isPrivacyMode))}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full ${cat.investmentRatio > 100 ? 'bg-red-500' : 'bg-indigo-600'}`}
                        style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-black min-w-[35px] text-right">{isMasked ? '****' : cat.investmentRatio.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={(e) => handleRefresh(e, cat.id)}
                      disabled={refreshingIds.has(cat.id)}
                      className={`p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all active:scale-95 ${refreshingIds.has(cat.id) ? 'text-blue-600' : 'text-gray-500'}`}
                      title="更新此分類股價"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingIds.has(cat.id) ? 'animate-spin' : ''}`} />
                    </button>
                    {onDeleteCategory && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                        className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-all active:scale-95"
                        title="刪除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-black text-gray-900 text-lg border-t-2 border-gray-200">
            <tr>
              <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500 uppercase tracking-widest">Grand Total</td>
              <td className="px-4 py-4 text-center">{totalPercent.toFixed(0)}%</td>
              <td className="px-4 py-4 text-right font-mono">
                {formatTWD((totalCapital * (totalPercent / 100)), isPrivacyMode)}
              </td>
              <td className="px-4 py-4 text-right font-mono text-xl">
                {formatTWD(categories.reduce((acc, c) => acc + c.investedAmount, 0), isPrivacyMode)}
              </td>
              <td className="px-4 py-4 text-right font-mono">
                {formatTWD(categories.reduce((acc, c) => acc + c.remainingCash, 0), isPrivacyMode)}
              </td>
              <td className="px-4 py-4 text-right font-mono">
                {formatTWD(categories.reduce((acc, c) => acc + c.realizedPnL, 0), isPrivacyMode)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div >
  );
};

export default SummaryTable;
