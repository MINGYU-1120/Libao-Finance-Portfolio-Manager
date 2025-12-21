
import React, { useState, useEffect } from 'react';
import { Asset, CalculatedCategory, CalculatedAsset, AppSettings } from '../types';
import { ArrowLeft, Plus, RefreshCw, NotebookPen, LayoutList, Grid2X2, Wallet } from 'lucide-react';
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
  
  const [isRefreshingCategory, setIsRefreshingCategory] = useState(false);
  const [chartAsset, setChartAsset] = useState<CalculatedAsset | null>(null);
  const [noteAsset, setNoteAsset] = useState<CalculatedAsset | null>(null);

  useEffect(() => {
    if (forceShowOrderModal) setIsOrderModalOpen(true);
  }, [forceShowOrderModal]);

  const handleOpenOrder = (asset?: CalculatedAsset) => {
    setSelectedAsset(asset || null);
    setIsOrderModalOpen(true);
  };

  const handleOrderSubmit = (order: OrderData) => {
    onExecuteOrder(order);
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
    <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-300 w-full relative">
      
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

      {/* 頂部紅標 Banner */}
      <div id="detail-header" className={`px-4 py-5 text-white flex flex-wrap justify-between items-center gap-4 ${category.market === 'TW' ? 'bg-red-700' : 'bg-blue-800'}`}>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold shrink-0">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black flex items-center gap-2 truncate">
              {category.name} 
              <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded tracking-widest uppercase font-mono">{category.market === 'TW' ? '台股' : '美股'}</span>
            </h2>
            <div className="flex items-center gap-3 text-xs opacity-90 mt-0.5 font-bold">
              <span>上限: {maskValue(category.projectedInvestment.toLocaleString())}</span>
              <span className="flex items-center gap-1 text-yellow-300"><Wallet className="w-3.5 h-3.5"/> 現金: {maskValue(category.remainingCash.toLocaleString())}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-6 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-none border-white/10 pt-3 sm:pt-0">
          <div>
            <div className="text-[10px] opacity-70 uppercase font-bold tracking-widest">已投入</div>
            <div className="text-xl font-mono font-bold leading-none mt-1">{maskValue(category.investedAmount.toLocaleString())} <span className="text-xs opacity-60">({category.investmentRatio.toFixed(1)}%)</span></div>
          </div>
          <div>
            <div className="text-[10px] opacity-70 uppercase font-bold tracking-widest">未實現</div>
            <div className={`text-xl font-mono font-bold leading-none mt-1 ${totalUnrealized >= 0 ? 'text-white' : 'text-green-300'}`}>
              {isPrivacyMode ? '****' : (totalUnrealized > 0 ? '+' : '') + totalUnrealized.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 操作列 */}
      <div className="sticky top-[64px] z-40 bg-white border-b border-gray-200 px-3 py-2 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden sm:inline mr-1">HOLDINGS</span>
            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button onClick={() => setViewMode('simple')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'simple' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                <LayoutList className="w-3 h-3" /> 簡易
              </button>
              <button onClick={() => setViewMode('detailed')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'detailed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                <Grid2X2 className="w-3 h-3" /> 詳細
              </button>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          {assets.length > 0 && (
            <button onClick={handleRefreshCategory} className={`p-1.5 rounded-full hover:bg-gray-100 text-gray-400 ${isRefreshingCategory ? 'animate-spin text-blue-600' : ''}`}>
               <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button id="detail-add-btn" onClick={() => handleOpenOrder()} className="bg-libao-gold hover:bg-yellow-400 text-gray-900 font-black py-1.5 px-6 rounded-lg text-xs flex items-center gap-1.5 shadow transition-all active:scale-95 border-b-2 border-yellow-600">
            <Plus className="w-4 h-4" /> 下單 (Order)
          </button>
        </div>
      </div>

      {/* 表格內容區 */}
      <div className="bg-white">
        {viewMode === 'simple' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-12">
            {assets.length === 0 && <div className="col-span-full text-center py-20 text-gray-400 font-bold">目前無持股資料</div>}
            {assets.map(asset => {
                const displayUnrealized = asset.unrealizedPnL / displayRate;
                const displayCost = asset.costBasis / displayRate;
                return (
                  <div key={asset.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-pointer" onClick={() => handleOpenOrder(asset)}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className={`font-mono font-black px-1.5 py-0.5 rounded text-[9px] w-fit text-white ${isUS ? 'bg-blue-600' : 'bg-red-600'}`}>{asset.symbol}</span>
                        <span className="font-bold text-gray-900 truncate text-sm">{asset.name}</span>
                      </div>
                      <div className="text-right">
                          <div className="text-[8px] text-gray-400 font-bold uppercase">現價</div>
                          <div className="font-mono font-bold text-xs text-gray-800">{maskValue(asset.currentPrice.toLocaleString())}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                      <div>
                          <div className="text-[8px] text-gray-400 uppercase">成本 / 占比</div>
                          <div className="font-mono font-bold text-[10px]">{currencyPrefix}{maskValue(Math.round(displayCost).toLocaleString())} | {asset.portfolioRatio.toFixed(1)}%</div>
                      </div>
                      <div className="text-right">
                          <div className={`text-[8px] font-bold ${asset.unrealizedPnL >= 0 ? 'text-red-500' : 'text-green-600'}`}>ROI</div>
                          <div className={`font-mono font-bold text-[10px] ${asset.unrealizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {isPrivacyMode ? '****' : (displayUnrealized > 0 ? '+' : '') + Math.round(displayUnrealized).toLocaleString()}
                            <span className="text-[9px] ml-1">({asset.returnRate.toFixed(1)}%)</span>
                          </div>
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>
        ) : (
          <div className="w-full overflow-x-auto bg-white border-t border-gray-100">
            <table className="w-full min-w-[900px] text-[12px] text-left border-collapse table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200 font-black text-gray-500 uppercase">
                <tr>
                  <th className="px-1.5 py-2.5 text-center w-[8%]">代號</th>
                  <th className="px-1.5 py-2.5 w-[18%]">公司名稱</th>
                  <th className="px-1.5 py-2.5 text-center w-[10%]">資金占比</th>
                  <th className="px-1.5 py-2.5 text-right bg-yellow-50/40 w-[12%]">現有股數</th>
                  <th className="px-1.5 py-2.5 text-right bg-yellow-50/40 w-[12%]">成本均價</th>
                  <th className="px-1.5 py-2.5 text-right w-[12%]">持倉市值 ({isUS ? 'USD' : 'TWD'})</th>
                  <th className="px-1.5 py-2.5 text-right bg-red-50/20 w-[12%]">預估損益 ({isUS ? 'USD' : 'TWD'})</th>
                  <th className="px-1.5 py-2.5 text-center w-[8%]">損益率</th>
                  <th className="px-1.5 py-2.5 text-center w-[8%]">工具</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assets.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-24 text-gray-400 font-bold bg-white text-sm">目前尚無任何持股資料</td>
                  </tr>
                )}
                {assets.map((asset) => {
                  const displayUnrealized = asset.unrealizedPnL / displayRate;
                  const displayMarketValue = asset.marketValue / displayRate;
                  return (
                    <tr key={asset.id} className="hover:bg-blue-50/20 transition-colors bg-white">
                      <td className="px-1.5 py-2 text-center">
                        <span className={`inline-block font-mono font-bold px-1.5 py-0.5 rounded text-[10px] text-white ${isUS ? 'bg-blue-600' : 'bg-red-600'}`}>{asset.symbol}</span>
                      </td>
                      <td className="px-1.5 py-2 font-bold text-gray-800 truncate">{asset.name}</td>
                      <td className="px-1.5 py-2 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-full max-w-[40px] bg-gray-100 rounded-full h-1 mb-0.5 overflow-hidden">
                            <div className="bg-blue-500 h-full" style={{ width: `${Math.min(asset.portfolioRatio, 100)}%` }}></div>
                          </div>
                          <span className="text-[9px] text-gray-500 font-mono">{asset.portfolioRatio.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-1.5 py-2 text-right font-mono font-bold text-gray-700">{maskValue(asset.shares.toLocaleString())}</td>
                      <td className="px-1.5 py-2 text-right font-mono text-gray-400">
                        {currencyPrefix}{maskValue(asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                      </td>
                      <td className="px-1.5 py-2 text-right font-mono font-bold text-gray-800">
                        {maskValue(Math.round(displayMarketValue).toLocaleString())}
                      </td>
                      <td className={`px-1.5 py-2 text-right font-mono font-bold ${asset.unrealizedPnL >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {maskValue(Math.round(displayUnrealized).toLocaleString())}
                      </td>
                      <td className="px-1.5 py-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded font-black text-[10px] font-mono ${asset.returnRate >= 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                          {asset.returnRate > 0 ? '+' : ''}{asset.returnRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-1.5 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => handleOpenOrder(asset)} className="bg-gray-900 text-white px-2 py-0.5 rounded text-[10px] font-bold active:scale-95 transition-all">交易</button>
                          <button onClick={() => setNoteAsset(asset)} className={`p-0.5 rounded border active:scale-95 transition-all ${asset.note ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-gray-50 text-gray-400'}`}><NotebookPen className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 底部返回按鈕 */}
      <div className="p-6 border-t bg-gray-50 flex justify-center">
        <button onClick={onBack} className="group flex items-center gap-2 px-10 py-2.5 bg-gray-900 hover:bg-black rounded-xl text-white font-bold transition-all shadow-lg active:scale-95 text-sm">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>返回持倉總覽</span>
        </button>
      </div>
    </div>
  );
};

export default DetailTable;
