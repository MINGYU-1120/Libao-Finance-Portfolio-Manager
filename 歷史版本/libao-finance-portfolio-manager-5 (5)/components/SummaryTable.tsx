
import React, { useState } from 'react';
import { CalculatedCategory } from '../types';
import { Edit2, PieChart, RefreshCw, ChevronRight } from 'lucide-react';

interface SummaryTableProps {
  categories: CalculatedCategory[];
  totalCapital: number;
  onUpdateAllocation: (id: string, percent: number) => void;
  onSelectCategory: (id: string) => void;
  onRefreshCategory: (id: string) => Promise<void>;
  isPrivacyMode: boolean;
}

const SummaryTable: React.FC<SummaryTableProps> = ({ 
  categories, 
  totalCapital,
  onUpdateAllocation,
  onSelectCategory,
  onRefreshCategory,
  isPrivacyMode
}) => {
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const handleRefresh = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (refreshingIds.has(id)) return;
    
    setRefreshingIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      await onRefreshCategory(id);
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  
  const totalPercent = categories.reduce((sum, c) => sum + c.allocationPercent, 0);

  const maskValue = (val: string | number) => isPrivacyMode ? '*******' : val;

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PieChart className="w-5 h-5 text-yellow-400" />
          持倉總覽 (Overview)
        </h2>
        <div className="text-sm">
          總配置: <span className={`${totalPercent > 100 ? 'text-red-400' : 'text-green-400'}`}>{totalPercent}%</span>
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
                <span className={`text-xs font-bold px-2 py-1 rounded text-white ${cat.market === 'TW' ? 'bg-red-600' : 'bg-blue-600'}`}>
                  {cat.market === 'TW' ? '台股' : '美股'}
                </span>
                <h3 className="font-bold text-lg text-gray-800">{cat.name}</h3>
              </div>
              <button 
                onClick={(e) => handleRefresh(e, cat.id)}
                disabled={refreshingIds.has(cat.id)}
                className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 ${refreshingIds.has(cat.id) ? 'text-blue-600 animate-spin' : 'text-gray-500'}`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
               <div className="flex-1">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>資金占比</span>
                    <span>{cat.investmentRatio.toFixed(1)}% 已投入</span>
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
                          type="number"
                          value={cat.allocationPercent}
                          onChange={(e) => onUpdateAllocation(cat.id, Number(e.target.value))}
                          className="w-full text-center bg-white border border-yellow-300 rounded px-1 py-0.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                       <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                    </div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">
               <div>
                 <div className="text-xs text-gray-400">已投入</div>
                 <div className="font-mono font-bold text-gray-700">{maskValue((cat.investedAmount/10000).toFixed(1))}萬</div>
               </div>
               <div className="text-center border-l border-r border-gray-200">
                 <div className="text-xs text-gray-400">剩餘現金</div>
                 <div className={`font-mono font-bold ${cat.remainingCash < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {maskValue((cat.remainingCash/10000).toFixed(1))}萬
                 </div>
               </div>
               <div className="text-right">
                 <div className="text-xs text-gray-400">已實現</div>
                 <div className={`font-mono font-bold ${cat.realizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {cat.realizedPnL !== 0 ? (cat.realizedPnL > 0 ? '+' : '') + maskValue((cat.realizedPnL/10000).toFixed(1)) + '萬' : '-'}
                 </div>
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
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-4 py-3 text-center w-24">市場</th>
              <th className="px-4 py-3">倉位名稱</th>
              <th className="px-4 py-3 text-center bg-yellow-100/50 border-x border-yellow-200">資金占比</th>
              <th className="px-4 py-3 text-right">預計投入</th>
              <th className="px-4 py-3 text-right">已投入 (TWD)</th>
              <th className="px-4 py-3 text-center">比例</th>
              <th className="px-4 py-3 text-right">剩餘現金</th>
              <th className="px-4 py-3 text-right text-gray-600">已實現損益</th>
              <th className="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, idx) => {
               const isFirstOfMarket = idx === 0 || categories[idx-1].market !== cat.market;
               const rowSpan = categories.filter(c => c.market === cat.market).length;

               return (
                <tr key={cat.id} className="border-b hover:bg-gray-50 transition-colors">
                  {isFirstOfMarket && (
                    <td rowSpan={rowSpan} className="px-4 py-3 font-bold text-center border-r bg-gray-50 align-middle">
                      {cat.market === 'TW' ? '台股' : '美股'}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <button 
                      onClick={() => onSelectCategory(cat.id)}
                      className="hover:text-blue-600 underline decoration-dotted underline-offset-4"
                    >
                      {cat.name}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center bg-yellow-50 border-x border-yellow-100">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={cat.allocationPercent}
                      onChange={(e) => onUpdateAllocation(cat.id, Number(e.target.value))}
                      className="w-16 text-center bg-white border border-yellow-300 rounded px-1 py-1 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-gray-800"
                    />
                    <span className="ml-1 text-gray-500">%</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">
                    {maskValue(cat.projectedInvestment.toLocaleString())}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {maskValue(cat.investedAmount.toLocaleString())}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                      <div 
                        className={`h-2.5 rounded-full ${cat.investmentRatio > 100 ? 'bg-red-500' : 'bg-blue-600'}`} 
                        style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 mt-1 block">{cat.investmentRatio.toFixed(1)}%</span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${cat.remainingCash < 0 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                    {maskValue(cat.remainingCash.toLocaleString())}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${cat.realizedPnL > 0 ? 'text-red-600' : cat.realizedPnL < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                     {cat.realizedPnL !== 0 ? maskValue(cat.realizedPnL.toLocaleString()) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                     <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => onSelectCategory(cat.id)}
                          className="text-white bg-gray-700 hover:bg-gray-800 px-3 py-1 rounded text-xs flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> 明細
                        </button>
                        <button 
                          onClick={(e) => handleRefresh(e, cat.id)}
                          disabled={refreshingIds.has(cat.id)}
                          className={`p-1.5 rounded-full border border-gray-300 hover:bg-gray-200 transition-colors ${refreshingIds.has(cat.id) ? 'text-blue-600' : 'text-gray-500'}`}
                          title="更新此分類股價"
                        >
                          <RefreshCw className={`w-3 h-3 ${refreshingIds.has(cat.id) ? 'animate-spin' : ''}`} />
                        </button>
                     </div>
                  </td>
                </tr>
               );
            })}
          </tbody>
          <tfoot className="bg-gray-100 font-bold text-gray-900">
             <tr>
               <td colSpan={2} className="px-4 py-3 text-center">Total</td>
               <td className="px-4 py-3 text-center">{totalPercent.toFixed(0)}%</td>
               <td className="px-4 py-3 text-right">
                 {maskValue((totalCapital * (totalPercent / 100)).toLocaleString())}
               </td>
               <td className="px-4 py-3 text-right">
                  {maskValue(categories.reduce((acc, c) => acc + c.investedAmount, 0).toLocaleString())}
               </td>
               <td className="px-4 py-3"></td>
               <td className="px-4 py-3 text-right">
                  {maskValue(categories.reduce((acc, c) => acc + c.remainingCash, 0).toLocaleString())}
               </td>
               <td className="px-4 py-3 text-right">
                  {maskValue(categories.reduce((acc, c) => acc + c.realizedPnL, 0).toLocaleString())}
               </td>
               <td></td>
             </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default SummaryTable;
