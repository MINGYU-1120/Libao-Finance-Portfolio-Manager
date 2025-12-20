
import React, { useState, useEffect } from 'react';
import { Asset, CalculatedCategory, CalculatedAsset, AppSettings } from '../types';
import { ArrowLeft, Plus, TrendingUp, RefreshCw, DollarSign, NotebookPen, LayoutDashboard } from 'lucide-react';
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
  settings?: AppSettings;
  forceShowOrderModal?: boolean; // New prop
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
  isPrivacyMode,
  settings,
  forceShowOrderModal
}) => {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CalculatedAsset | null>(null);
  
  const [refreshingAssetId, setRefreshingAssetId] = useState<string | null>(null);
  const [isRefreshingCategory, setIsRefreshingCategory] = useState(false);

  // Chart State
  const [chartAsset, setChartAsset] = useState<CalculatedAsset | null>(null);
  
  // Note State
  const [noteAsset, setNoteAsset] = useState<CalculatedAsset | null>(null);

  // Effect to handle forced modal opening from tour
  useEffect(() => {
    if (forceShowOrderModal) {
      setIsOrderModalOpen(true);
    } else {
      setIsOrderModalOpen(false);
    }
  }, [forceShowOrderModal]);

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
        settings={settings}
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

      {/* Sticky Header Group: 將標題與按鈕工具列卡在最上方 */}
      <div className="sticky top-[64px] z-30 shadow-md">
        {/* Header */}
        <div id="detail-header" className={`p-4 text-white flex flex-wrap justify-between items-center gap-4 ${category.market === 'TW' ? 'bg-red-700' : 'bg-blue-800'}`}>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* 返回按鈕 */}
            <button 
              onClick={onBack} 
              className="flex items-center gap-1.5 px-3 py-1.5 -ml-2 hover:bg-white/20 rounded-lg transition-all group shrink-0"
            >
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-bold">返回總覽</span>
            </button>

            <div className="h-8 w-[1px] bg-white/20 mx-1 hidden sm:block"></div>

            <div className="flex-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                 {category.name} 
                 <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded tracking-wider uppercase">{category.market === 'TW' ? '台股' : '美股'}</span>
              </h2>
              <p className="text-[10px] opacity-70 mt-0.5 uppercase tracking-wide">預計上限: NT${maskValue(category.projectedInvestment.toLocaleString())}</p>
            </div>
          </div>

          <div className="flex gap-4 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-none border-white/10 pt-3 sm:pt-0">
            <div>
              <div className="text-[10px] opacity-70 uppercase">已投入</div>
              <div className="text-lg font-mono font-bold">{maskValue((category.investedAmount/10000).toFixed(1))}萬</div>
            </div>
            <div>
              <div className="text-[10px] opacity-70 uppercase">未實現</div>
              <div className={`text-lg font-mono font-bold ${totalUnrealized >= 0 ? 'text-white' : 'text-green-300'}`}>
                {isPrivacyMode ? '****' : (totalUnrealized > 0 ? '+' : '') + (totalUnrealized/10000).toFixed(1) + '萬'}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar (Now inside sticky container) */}
        <div className="p-3 bg-gray-50 border-b flex justify-between items-center bg-white/95 backdrop-blur-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              {assets.length === 0 ? 'NO ASSETS' : `HOLDINGS (${assets.length}) / ${isUS ? 'USD' : 'TWD'}`}
          </span>
          <button
            id="detail-add-btn"
            onClick={() => handleOpenOrder()}
            className="bg-libao-gold hover:bg-yellow-400 text-gray-900 font-bold py-2 px-8 rounded-lg text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 border-b-2 border-yellow-600"
          >
            <Plus className="w-4 h-4" /> 下單 (Order)
          </button>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden bg-gray-100 p-3 space-y-3 min-h-[400px]">
         {assets.length === 0 && (
            <div className="text-center py-12 text-gray-400">
               <TrendingUp className="w-12 h-12 opacity-20 mx-auto mb-3" />
               <p className="text-sm font-medium">此倉位尚無持股紀錄</p>
               <p className="text-xs mt-1">點擊上方「下單」按鈕開始建立部位</p>
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

         {/* 手機版底部返回按鈕 */}
         {assets.length > 0 && (
            <div className="pt-4 pb-8 px-4">
               <button 
                  onClick={onBack}
                  className="w-full py-4 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold flex items-center justify-center gap-3 active:bg-gray-50 transition-colors shadow-sm"
               >
                  <LayoutDashboard className="w-5 h-5 text-indigo-500" />
                  返回持倉總覽
               </button>
            </div>
         )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto min-h-[400px]">
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
                <td colSpan={12} className="text-center py-16 text-gray-400">
                  <div className="flex flex-col items-center gap-3">
                    <TrendingUp className="w-12 h-12 opacity-20" />
                    <p className="text-base font-medium">尚無持倉資料</p>
                    <button onClick={() => handleOpenOrder()} className="text-blue-600 hover:underline font-bold mt-2">立即新增第一筆交易</button>
                  </div>
                </td>
              </tr>
            )}
            {assets.map((asset) => {
              const displayCostBasis = asset.costBasis / displayRate;
              const displayMarketValue = asset.marketValue / displayRate;
              const displayUnrealized = asset.unrealizedPnL / displayRate;

              return (
              <tr key={asset.id} className="border-b hover:bg-gray-50 group transition-colors">
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

        {/* 桌機版底部返回引導 */}
        {assets.length > 0 && (
           <div className="p-8 border-t bg-gray-50 flex justify-center">
              <button 
                onClick={onBack}
                className="group flex items-center gap-3 px-10 py-3 bg-white hover:bg-gray-100 border-2 border-gray-200 rounded-2xl text-gray-500 font-bold transition-all shadow-sm hover:shadow-md"
              >
                 <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                 返回持倉總覽戰情室
              </button>
           </div>
        )}
      </div>
    </div>
  );
};

export default DetailTable;
