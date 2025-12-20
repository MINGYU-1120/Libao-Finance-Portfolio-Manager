
import React, { useState, useEffect } from 'react';
import { Asset, CalculatedCategory, CalculatedAsset, AppSettings } from '../types';
import { ArrowLeft, Plus, TrendingUp, RefreshCw, DollarSign, NotebookPen, LayoutDashboard, Target, LayoutList, Grid2X2, Wallet } from 'lucide-react';
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
  forceShowOrderModal?: boolean; 
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
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('detailed');
  
  const [refreshingAssetId, setRefreshingAssetId] = useState<string | null>(null);
  const [isRefreshingCategory, setIsRefreshingCategory] = useState(false);

  // Chart State
  const [chartAsset, setChartAsset] = useState<CalculatedAsset | null>(null);
  
  // Note State
  const [noteAsset, setNoteAsset] = useState<CalculatedAsset | null>(null);

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

  const isUS = category.market === 'US';
  const currencyPrefix = isUS ? '$' : 'NT$';
  const displayRate = isUS ? defaultExchangeRate : 1;

  return (
    <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-300 w-full max-w-full relative">
      
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

      {/* --- 1. Dashboard Banner (跟隨捲動，不置頂) --- */}
      <div id="detail-header" className={`px-4 py-6 text-white flex flex-wrap justify-between items-center gap-4 ${category.market === 'TW' ? 'bg-red-700' : 'bg-blue-800'}`}>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={onBack} 
            className="flex items-center gap-1.5 px-3 py-2 -ml-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all group shrink-0"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-bold">返回</span>
          </button>

          <div className="flex-1 overflow-hidden">
            <h2 className="text-2xl font-black flex items-center gap-2 truncate">
                {category.name} 
                <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded tracking-widest uppercase font-mono shrink-0">{category.market === 'TW' ? '台股' : '美股'}</span>
            </h2>
            <div className="flex items-center gap-3 text-xs opacity-90 mt-1 font-bold">
                <span className="uppercase tracking-wide opacity-70">上限: {maskValue(category.projectedInvestment.toLocaleString())}</span>
                <span className="flex items-center gap-1 text-yellow-300"><Wallet className="w-3.5 h-3.5"/> 現金: {maskValue(category.remainingCash.toLocaleString())}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-8 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-none border-white/10 pt-4 sm:pt-0">
          <div>
            <div className="text-xs opacity-70 uppercase font-bold tracking-widest">已投入</div>
            <div className="text-xl font-mono font-bold leading-none mt-1">{maskValue((category.investedAmount/10000).toFixed(1))}萬 <span className="text-xs opacity-60 ml-1">({category.investmentRatio.toFixed(1)}%)</span></div>
          </div>
          <div>
            <div className="text-xs opacity-70 uppercase font-bold tracking-widest">未實現</div>
            <div className={`text-xl font-mono font-bold leading-none mt-1 ${totalUnrealized >= 0 ? 'text-white' : 'text-green-300'}`}>
              {isPrivacyMode ? '****' : (totalUnrealized > 0 ? '+' : '') + (totalUnrealized/10000).toFixed(1) + '萬'}
            </div>
          </div>
        </div>
      </div>

      {/* --- 2. Sticky Action Bar (捲動到頂部時置頂在導航欄下方) --- */}
      <div className="sticky top-[64px] z-30 bg-white border-b-2 border-gray-100 p-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden sm:inline mr-2">
                ASSET HOLDINGS
            </span>
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
              <button 
                onClick={() => setViewMode('simple')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${viewMode === 'simple' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
              >
                <LayoutList className="w-3.5 h-3.5" /> 簡易
              </button>
              <button 
                onClick={() => setViewMode('detailed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${viewMode === 'detailed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
              >
                <Grid2X2 className="w-3.5 h-3.5" /> 詳細
              </button>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          {assets.length > 0 && (
            <button onClick={handleRefreshCategory} className={`p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors ${isRefreshingCategory ? 'animate-spin text-blue-600' : ''}`} title="更新此分類股價">
               <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            id="detail-add-btn"
            onClick={() => handleOpenOrder()}
            className="bg-libao-gold hover:bg-yellow-400 text-gray-900 font-black py-2 px-8 rounded-xl text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 border-b-4 border-yellow-600"
          >
            <Plus className="w-5 h-5" /> 下單 (Order)
          </button>
        </div>
      </div>

      {/* --- 3. Content Area (增加頂部間距確保內容不被裁切) --- */}
      <div className="bg-gray-50 min-h-[500px]">
        {/* Mobile View */}
        <div className="md:hidden p-3 space-y-4 pb-24 pt-4">
          {assets.length === 0 && (
              <div className="text-center py-24 text-gray-400">
                <TrendingUp className="w-16 h-16 opacity-10 mx-auto mb-4" />
                <p className="font-bold">尚無持股紀錄</p>
              </div>
          )}
          {assets.map(asset => {
              const displayCostBasis = asset.costBasis / displayRate;
              const displayMarketValue = asset.marketValue / displayRate;
              const displayUnrealized = asset.unrealizedPnL / displayRate;

              return (
              <div key={asset.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-200 overflow-hidden active:bg-gray-50 transition-colors" onClick={() => handleOpenOrder(asset)}>
                {/* 標題與價格 */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-2 overflow-hidden flex-1">
                      <span className={`font-mono font-black px-3 py-1 rounded-lg text-xs w-fit shadow-sm ${isUS ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                          {asset.symbol}
                      </span>
                      <span className="font-black text-gray-900 text-xl leading-tight truncate pr-4">{asset.name}</span>
                    </div>
                    <div className="text-right bg-gray-50 p-2.5 rounded-2xl border border-gray-100 shrink-0">
                        <div className="text-[10px] text-gray-400 font-black uppercase mb-1">即時報價</div>
                        <div className="font-mono font-black text-gray-800 text-lg leading-none">
                          {maskValue(asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: isUS ? 2 : 1 }))}
                        </div>
                    </div>
                </div>

                {/* 數據內容 */}
                {viewMode === 'simple' ? (
                    <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl mb-4 border border-blue-100">
                      <div className="flex-1">
                          <div className="text-[10px] text-blue-400 font-black uppercase mb-1">持有 / 占比</div>
                          <div className="font-mono font-black text-blue-900 text-base">
                            {maskValue(asset.shares.toLocaleString())} <span className="text-xs font-normal">股</span> <span className="mx-1 opacity-20">|</span> {asset.portfolioRatio.toFixed(1)}%
                          </div>
                      </div>
                      <div className="text-right flex-1">
                          <div className={`text-[10px] font-black uppercase mb-1 ${asset.unrealizedPnL >= 0 ? 'text-red-500' : 'text-green-600'}`}>預估損益 (ROI)</div>
                          <div className={`font-mono font-black text-xl leading-none ${asset.unrealizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {isPrivacyMode ? '****' : (displayUnrealized > 0 ? '+' : '') + displayUnrealized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            <span className="text-xs ml-1.5 font-black opacity-90">({asset.returnRate.toFixed(1)}%)</span>
                          </div>
                      </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-inner">
                        <div className="text-[10px] text-gray-400 font-black mb-1">現有股數</div>
                        <div className="font-mono font-black text-gray-700 text-sm">{maskValue(asset.shares.toLocaleString())}</div>
                      </div>
                      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-inner">
                        <div className="text-[10px] text-gray-400 font-black mb-1">成本均價</div>
                        <div className="font-mono font-black text-gray-700 text-sm">
                            {currencyPrefix}{maskValue(asset.avgCost.toLocaleString(undefined, { maximumFractionDigits: 2 }))}
                        </div>
                      </div>
                      <div className="bg-blue-50/30 p-3 rounded-2xl border border-blue-100/50 col-span-2 flex justify-between items-center">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-[10px] text-blue-400 font-black uppercase flex items-center gap-1 shrink-0"><Target className="w-3.5 h-3.5"/> 資金占比</span>
                            <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                                <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${Math.min(asset.portfolioRatio, 100)}%` }}></div>
                            </div>
                          </div>
                          <div className="font-mono font-black text-blue-700 text-sm ml-4">{asset.portfolioRatio.toFixed(2)}%</div>
                      </div>
                      <div className={`p-4 rounded-2xl border col-span-2 flex justify-between items-center ${asset.unrealizedPnL >= 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-100 text-green-600'}`}>
                        <div className="text-xs font-black uppercase">預估損益 (ROI%)</div>
                        <div className="font-mono font-black flex items-center gap-2">
                            <span className="text-lg">{isPrivacyMode ? '****' : (displayUnrealized > 0 ? '+' : '') + displayUnrealized.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            <span className="text-[11px] bg-white/60 px-2 py-1 rounded-lg shadow-sm">({asset.returnRate.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>
                )}

                {/* 卡片按鈕 */}
                <div className="flex gap-3 mt-2">
                    <button onClick={(e) => { e.stopPropagation(); handleOpenOrder(asset); }} className="flex-1 py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-black active:scale-95 transition-all shadow-lg">交易</button>
                    <button onClick={(e) => { e.stopPropagation(); setChartAsset(asset); }} className="flex-1 py-3.5 bg-blue-50 text-blue-600 rounded-2xl text-sm font-black border border-blue-100 active:scale-95 transition-all">K線</button>
                    <button onClick={(e) => { e.stopPropagation(); setNoteAsset(asset); }} className={`w-14 py-3.5 rounded-2xl flex justify-center items-center active:scale-95 transition-all shadow-sm ${asset.note ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                      <NotebookPen className="w-5 h-5" />
                    </button>
                </div>
              </div>
              );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block w-full overflow-x-auto pt-6">
          <table className="w-full min-w-max text-sm text-left table-fixed bg-white">
            <thead className="text-[11px] text-gray-500 uppercase bg-gray-100 border-b-2 border-gray-200 font-black">
              <tr>
                <th className="px-6 py-4 w-32">代號 (Symbol)</th>
                <th className="px-6 py-4 w-48">公司名稱</th>
                <th className="px-6 py-4 text-center w-36">資金占比</th>
                <th className="px-6 py-4 text-right bg-yellow-50/50 w-32">現有股數</th>
                <th className="px-6 py-4 text-right bg-yellow-50/50 w-36">成本均價</th>
                <th className="px-6 py-4 text-right w-36">持倉市值</th>
                <th className="px-6 py-4 text-right bg-yellow-100/20 w-40">預估損益</th>
                <th className="px-6 py-4 text-center w-32">損益率</th>
                <th className="px-6 py-4 text-center w-48">操作工具</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assets.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-40 text-gray-400">
                    <TrendingUp className="w-20 h-20 opacity-5 mx-auto mb-4" />
                    <p className="text-xl font-black">目前此倉位尚無任何持股資料</p>
                  </td>
                </tr>
              )}
              {assets.map((asset) => {
                const displayUnrealized = asset.unrealizedPnL / displayRate;
                const displayMarketValue = asset.marketValue / displayRate;

                return (
                <tr key={asset.id} className="hover:bg-blue-50/20 group transition-all">
                  <td className="px-6 py-6 align-middle">
                    <span className={`font-mono font-black px-3 py-1.5 rounded-lg text-sm shadow-sm ${isUS ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                        {asset.symbol}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-gray-800 font-black text-base truncate align-middle">{asset.name}</td>
                  <td className="px-6 py-6 text-center align-middle">
                    <div className="w-28 mx-auto">
                      <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner border border-gray-200">
                        <div className="bg-blue-600 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(asset.portfolioRatio, 100)}%` }}></div>
                      </div>
                      <span className="text-[11px] text-gray-500 font-mono font-black">{asset.portfolioRatio.toFixed(2)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-right font-mono font-black text-gray-700 align-middle">{maskValue(asset.shares.toLocaleString())}</td>
                  <td className="px-6 py-6 text-right text-gray-600 font-mono font-bold align-middle">
                    {currencyPrefix}{maskValue(asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2 }))}
                  </td>
                  <td className="px-6 py-6 text-right font-mono font-black text-gray-900 align-middle">
                    {maskValue(displayMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 }))}
                  </td>
                  <td className={`px-6 py-6 text-right font-mono font-black align-middle ${asset.unrealizedPnL >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {maskValue(displayUnrealized.toLocaleString(undefined, { maximumFractionDigits: 0 }))}
                  </td>
                  <td className={`px-6 py-6 text-center align-middle`}>
                    <span className={`inline-block px-3 py-1.5 rounded-lg font-black text-xs font-mono min-w-[65px] shadow-sm ${asset.returnRate >= 0 ? 'text-red-600 bg-red-50 border border-red-100' : 'text-green-600 bg-green-50 border border-green-100'}`}>
                      {asset.returnRate > 0 ? '+' : ''}{asset.returnRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-6 text-center align-middle">
                    <div className="flex gap-2.5 justify-center">
                      <button onClick={() => handleOpenOrder(asset)} className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95">交易</button>
                      <button onClick={() => setChartAsset(asset)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-xs font-black border border-blue-100 transition-all active:scale-95">K線</button>
                      <button onClick={() => setNoteAsset(asset)} className={`px-3 py-2 rounded-xl text-xs border flex items-center transition-all active:scale-95 shadow-sm ${asset.note ? 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}><NotebookPen className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Footer Button */}
      <div className="p-16 border-t bg-white flex justify-center">
        <button 
          onClick={onBack}
          className="group flex items-center gap-3 px-20 py-5 bg-gray-900 hover:bg-black rounded-2xl text-white font-black transition-all shadow-xl hover:shadow-2xl active:scale-95"
        >
            <ArrowLeft className="w-6 h-6 transition-transform group-hover:-translate-x-2" />
            返回持倉總覽戰情室
        </button>
      </div>
    </div>
  );
};

export default DetailTable;
