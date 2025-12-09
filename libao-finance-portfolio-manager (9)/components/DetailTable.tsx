
import React, { useState } from 'react';
import { Asset, CalculatedCategory, CalculatedAsset } from '../types';
import { ArrowLeft, Plus, TrendingUp, RefreshCw, DollarSign, NotebookPen } from 'lucide-react';
import OrderModal, { OrderData } from './OrderModal';
import StockChartModal from './StockChartModal';
import NoteModal from './NoteModal';

interface DetailTableProps {
  category: CalculatedCategory;
  assets: CalculatedAsset[];
  totalCapital: number;
  defaultExchangeRate: number;
  onBack: () => void;
  onExecuteOrder: (order: OrderData) => void;
  onDeleteAsset: (assetId: string) => void;
  onUpdateAssetPrice: (assetId: string, symbol: string, market: string) => Promise<void>;
  onUpdateCategoryPrices: (categoryId: string) => Promise<void>;
  onUpdateAssetNote: (assetId: string, note: string) => void;
  isPrivacyMode: boolean;
}

const DetailTable: React.FC<DetailTableProps> = ({
  category,
  assets,
  totalCapital,
  defaultExchangeRate,
  onBack,
  onExecuteOrder,
  onDeleteAsset,
  onUpdateAssetPrice,
  onUpdateCategoryPrices,
  onUpdateAssetNote,
  isPrivacyMode
}) => {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CalculatedAsset | null>(null);
  
  const [refreshingAssetId, setRefreshingAssetId] = useState<string | null>(null);
  const [isRefreshingCategory, setIsRefreshingCategory] = useState(false);

  // Chart State
  const [chartAsset, setChartAsset] = useState<CalculatedAsset | null>(null);
  
  // Note State
  const [noteAsset, setNoteAsset] = useState<CalculatedAsset | null>(null);

  const handleOpenOrder = (asset?: CalculatedAsset) => {
    setSelectedAsset(asset || null);
    setIsOrderModalOpen(true);
  };

  const handleOrderSubmit = (order: OrderData) => {
    onExecuteOrder(order);
  };

  const handleRefreshSingle = async (e: React.MouseEvent, asset: Asset) => {
    e.stopPropagation();
    setRefreshingAssetId(asset.id);
    await onUpdateAssetPrice(asset.id, asset.symbol, category.market);
    setRefreshingAssetId(null);
  };

  const handleRefreshCategory = async () => {
    setIsRefreshingCategory(true);
    await onUpdateCategoryPrices(category.id);
    setIsRefreshingCategory(false);
  };

  const totalUnrealized = assets.reduce((sum, a) => sum + a.unrealizedPnL, 0);

  const maskValue = (val: string | number) => isPrivacyMode ? '*******' : val;

  // Helper to format values based on market
  const isUS = category.market === 'US';
  const currencyPrefix = isUS ? '$' : 'NT$';
  const displayRate = isUS ? defaultExchangeRate : 1;

  // For header summary, we usually keep TWD as it aggregates to Total Capital (which is TWD)
  // But strictly for the table/cards, users want USD.

  return (
    <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-300">
      
      <OrderModal 
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        market={category.market}
        totalCapital={totalCapital}
        categoryRemainingCash={category.remainingCash}
        categoryProjectedInvestment={category.projectedInvestment}
        initialAsset={selectedAsset}
        currentAssetAllocation={selectedAsset?.portfolioRatio || 0}
        onExecuteOrder={handleOrderSubmit}
        defaultExchangeRate={defaultExchangeRate}
      />

      <StockChartModal 
        isOpen={!!chartAsset}
        onClose={() => setChartAsset(null)}
        symbol={chartAsset?.symbol || ''}
        name={chartAsset?.name || ''}
        market={category.market}
      />

      <NoteModal 
        isOpen={!!noteAsset}
        onClose={() => setNoteAsset(null)}
        symbol={noteAsset?.symbol || ''}
        name={noteAsset?.name || ''}
        initialNote={noteAsset?.note || ''}
        onSave={(note) => {
           if (noteAsset) onUpdateAssetNote(noteAsset.id, note);
        }}
      />

      {/* Header (Keeps TWD for overall portfolio consistency, or shows both if space allows) */}
      <div className={`p-4 text-white flex flex-wrap justify-between items-center gap-4 ${category.market === 'TW' ? 'bg-red-700' : 'bg-blue-800'}`}>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={onBack} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
               {category.name} 
               <span className="text-xs bg-black/20 px-2 py-0.5 rounded">{category.market === 'TW' ? '台股' : '美股'}</span>
            </h2>
            <p className="text-xs opacity-80 mt-0.5">預計投入: NT${maskValue(category.projectedInvestment.toLocaleString())}</p>
          </div>
        </div>

        <div className="flex gap-4 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-none border-white/20 pt-3 sm:pt-0">
          <div>
            <div className="text-xs opacity-80">已投入</div>
            <div className="text-lg font-mono font-bold">{maskValue((category.investedAmount/10000).toFixed(1))}萬</div>
          </div>
          <div>
            <div className="text-xs opacity-80">未實現</div>
            <div className={`text-lg font-mono font-bold ${totalUnrealized >= 0 ? 'text-white' : 'text-green-300'}`}>
              {isPrivacyMode ? '****' : (totalUnrealized > 0 ? '+' : '') + (totalUnrealized/10000).toFixed(1) + '萬'}
            </div>
          </div>
          <div className="pl-4 border-l border-white/20">
            <div className="text-xs opacity-80">已實現</div>
            <div className={`text-lg font-mono font-bold ${category.realizedPnL >= 0 ? 'text-yellow-300' : 'text-green-300'}`}>
              {isPrivacyMode ? '****' : (category.realizedPnL > 0 ? '+' : '') + (category.realizedPnL/10000).toFixed(1) + '萬'}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
        <span className="text-sm text-gray-500">
            {assets.length === 0 ? '請開始下單' : `共 ${assets.length} 檔 (顯示幣別: ${isUS ? 'USD' : 'TWD'})`}
        </span>
        <button
          onClick={() => handleOpenOrder()}
          className="bg-libao-gold hover:bg-yellow-400 text-gray-900 font-bold py-2 px-4 rounded text-sm flex items-center gap-2 shadow-sm transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" /> 下單
        </button>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden bg-gray-100 p-3 space-y-3 min-h-[300px]">
         {assets.length === 0 && (
            <div className="text-center py-10 text-gray-400">
               <TrendingUp className="w-10 h-10 opacity-20 mx-auto mb-2" />
               <p>尚無持倉，請點擊上方按鈕下單。</p>
            </div>
         )}
         {assets.map(asset => {
            const displayCostBasis = asset.costBasis / displayRate;
            const displayMarketValue = asset.marketValue / displayRate;
            const displayUnrealized = asset.unrealizedPnL / displayRate;

            return (
            <div key={asset.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200" onClick={() => handleOpenOrder(asset)}>
               {/* Card Header */}
               <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                     <span className="bg-gray-100 text-gray-800 font-bold font-mono px-2 py-1 rounded text-sm">
                        {asset.symbol}
                     </span>
                     <span className="font-bold text-gray-700">{asset.name}</span>
                  </div>
                  <div className="text-right flex items-center gap-2">
                     <span className="font-mono font-bold text-gray-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100">
                        {currencyPrefix} {maskValue(asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }))}
                     </span>
                     <button 
                        onClick={(e) => handleRefreshSingle(e, asset)}
                        disabled={refreshingAssetId === asset.id}
                        className={`p-1.5 rounded-full bg-gray-50 border border-gray-200 ${refreshingAssetId === asset.id ? 'animate-spin text-blue-600' : 'text-gray-400'}`}
                     >
                        <RefreshCw className="w-3 h-3" />
                     </button>
                  </div>
               </div>

               {/* Card Body Grid */}
               <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                     <div className="text-xs text-gray-400">持有股數</div>
                     <div className="font-mono font-medium">{maskValue(asset.shares.toLocaleString())}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded text-right">
                     <div className="text-xs text-gray-400">持有成本 ({isUS ? 'USD' : 'TWD'})</div>
                     <div className="font-mono font-medium">{currencyPrefix} {maskValue(displayCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 }))}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                     <div className="text-xs text-gray-400">市值 ({isUS ? 'USD' : 'TWD'})</div>
                     <div className="font-mono font-bold text-gray-800">{currencyPrefix} {maskValue(displayMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 }))}</div>
                  </div>
                  <div className={`p-2 rounded text-right ${asset.unrealizedPnL >= 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                     <div className="text-xs opacity-70">損益 (ROI)</div>
                     <div className="font-mono font-bold flex flex-col">
                        <span>{isPrivacyMode ? '****' : (displayUnrealized > 0 ? '+' : '') + displayUnrealized.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span className="text-xs">{asset.returnRate.toFixed(2)}%</span>
                     </div>
                  </div>
               </div>

               {/* Card Footer Actions */}
               <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button 
                     onClick={(e) => { e.stopPropagation(); handleOpenOrder(asset); }}
                     className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-bold"
                  >
                     交易
                  </button>
                  <button 
                     onClick={(e) => { e.stopPropagation(); setChartAsset(asset); }}
                     className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-sm font-bold font-mono"
                  >
                     K線
                  </button>
                  <button 
                     onClick={(e) => { e.stopPropagation(); setNoteAsset(asset); }}
                     className={`flex-1 py-2 rounded text-sm flex justify-center items-center ${asset.note ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-50 text-gray-400'}`}
                  >
                     <NotebookPen className="w-4 h-4" />
                  </button>
               </div>
            </div>
            );
         })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto min-h-[300px]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b">
            <tr>
              <th className="px-3 py-3 w-16">代號</th>
              <th className="px-3 py-3">公司名稱</th>
              <th className="px-3 py-3 text-center w-24">資金占比</th>
              <th className="px-3 py-3 text-right bg-yellow-50">現有股數</th>
              <th className="px-3 py-3 text-right bg-yellow-50">成本均價</th>
              <th className="px-3 py-3 text-right">投資成本 ({isUS ? 'USD' : 'TWD'})</th>
              <th className="px-3 py-3 text-right bg-yellow-50 group cursor-pointer hover:bg-yellow-100 transition-colors">
                <div className="flex items-center justify-end gap-1">
                  當前股價
                  <button onClick={handleRefreshCategory} disabled={isRefreshingCategory || assets.length === 0} className={`p-1 rounded-full hover:bg-gray-200 ${isRefreshingCategory ? 'animate-spin text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}>
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </th>
              <th className="px-3 py-3 text-right">持倉價值 ({isUS ? 'USD' : 'TWD'})</th>
              <th className="px-3 py-3 text-right">未實現損益</th>
              <th className="px-3 py-3 text-center">損益率</th>
              <th className="px-3 py-3 text-right text-gray-500">已實現 (TWD)</th>
              <th className="px-3 py-3 text-center w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center py-10 text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <TrendingUp className="w-10 h-10 opacity-20" />
                    <p>尚無持倉資料</p>
                  </div>
                </td>
              </tr>
            )}
            {assets.map((asset) => {
              const displayCostBasis = asset.costBasis / displayRate;
              const displayMarketValue = asset.marketValue / displayRate;
              const displayUnrealized = asset.unrealizedPnL / displayRate;

              return (
              <tr key={asset.id} className="border-b hover:bg-gray-50 group">
                <td className="px-3 py-3 font-bold text-gray-800">{asset.symbol}</td>
                <td className="px-3 py-3 text-gray-600 truncate max-w-[120px]">{asset.name}</td>
                <td className="px-3 py-3 text-center align-middle">
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                     <div 
                       className="bg-blue-600 h-1.5 rounded-full" 
                       style={{ width: `${Math.min(asset.portfolioRatio, 100)}%` }}
                     ></div>
                  </div>
                  <span className="text-[10px] text-gray-500">{asset.portfolioRatio.toFixed(2)}%</span>
                </td>
                <td className="px-3 py-3 text-right font-mono">{maskValue(asset.shares.toLocaleString())}</td>
                <td className="px-3 py-3 text-right text-gray-600 font-mono">
                  {currencyPrefix} {maskValue(asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                </td>
                <td className="px-3 py-3 text-right font-mono text-gray-400">
                   {maskValue(displayCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 }))}
                </td>
                <td className="px-3 py-3 text-right bg-yellow-50/30 font-medium font-mono relative">
                   <div className="flex items-center justify-end gap-2">
                      {currencyPrefix} {maskValue(asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }))}
                      <button 
                        onClick={(e) => handleRefreshSingle(e, asset)}
                        disabled={refreshingAssetId === asset.id}
                        className={`p-1.5 rounded-full hover:bg-gray-200 ${refreshingAssetId === asset.id ? 'animate-spin text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                      >
                         <RefreshCw className="w-3 h-3" />
                      </button>
                   </div>
                </td>
                <td className="px-3 py-3 text-right font-mono font-medium">
                   {maskValue(displayMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 }))}
                </td>
                <td className={`px-3 py-3 text-right font-mono ${asset.unrealizedPnL >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {maskValue(displayUnrealized.toLocaleString(undefined, { maximumFractionDigits: 0 }))}
                </td>
                <td className={`px-3 py-3 text-center font-bold ${asset.returnRate >= 0 ? 'text-white bg-red-500 rounded-sm' : 'text-white bg-green-600 rounded-sm'}`}>
                  {asset.returnRate.toFixed(2)}%
                </td>
                <td className={`px-3 py-3 text-right font-mono text-xs ${asset.realizedPnL >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                   {/* Realized PnL kept in TWD for consistency with ledger */}
                   {asset.realizedPnL !== 0 ? 'NT$' + maskValue(asset.realizedPnL.toLocaleString()) : '-'}
                </td>
                <td className="px-3 py-3 text-center">
                   <div className="flex gap-1 justify-center">
                     <button 
                      onClick={() => handleOpenOrder(asset)} 
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs border border-gray-300 flex items-center"
                      title="下單/交易"
                     >
                       交易
                     </button>
                     <button 
                      onClick={() => setChartAsset(asset)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs border border-blue-200 flex items-center justify-center min-w-[28px]"
                      title="查看K線圖"
                     >
                       <span className="font-bold font-mono text-sm leading-none">K</span>
                     </button>
                     <button 
                      onClick={() => setNoteAsset(asset)}
                      className={`px-2 py-1 rounded text-xs border flex items-center transition-colors ${asset.note ? 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                      title={asset.note ? "編輯筆記" : "新增筆記"}
                     >
                       <NotebookPen className="w-3 h-3" />
                     </button>
                   </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DetailTable;
