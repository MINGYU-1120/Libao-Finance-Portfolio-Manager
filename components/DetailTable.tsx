
import React, { useState, useEffect } from 'react';
import { Asset, CalculatedCategory, CalculatedAsset, AppSettings } from '../types';
import { ArrowLeft, Plus, RefreshCw, NotebookPen, Wallet, Search } from 'lucide-react';
import { formatCurrency } from '../utils/formatting';
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
  // onDeleteAsset prop removed as per user request to prevent manual deletion
  onUpdateAssetPrice: (assetId: string, symbol: string, market: string) => Promise<void>;
  onUpdateCategoryPrices: (categoryId: string) => Promise<void>;
  onUpdateAssetNote: (assetId: string, note: string) => void;
  isPrivacyMode: boolean;
  isMasked?: boolean;
  settings?: AppSettings;
  forceShowOrderModal?: boolean;
  readOnly?: boolean;
}

const DetailTable: React.FC<DetailTableProps> = ({
  category,
  assets,
  totalCapital,
  defaultExchangeRate,
  onBack,
  onExecuteOrder,
  // onDeleteAsset,
  onUpdateAssetPrice,
  onUpdateCategoryPrices,
  onUpdateAssetNote,
  isPrivacyMode,
  isMasked = false,
  settings,
  forceShowOrderModal,
  readOnly = false
}) => {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CalculatedAsset | null>(null);
  // const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('detailed'); // Removed

  const [isRefreshingCategory, setIsRefreshingCategory] = useState(false);
  const [chartAsset, setChartAsset] = useState<CalculatedAsset | null>(null);
  const [searchTerm, setSearchTerm] = useState('');


  const filteredAssets = assets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const [noteAsset, setNoteAsset] = useState<CalculatedAsset | null>(null);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  const toggleAssetExpansion = (id: string) => {
    setExpandedAssetId(prev => prev === id ? null : id);
  };

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
  const maskValue = (val: string | number) => (isMasked || isPrivacyMode) ? '*******' : val;
  const strictMask = (val: string | number) => (isMasked || isPrivacyMode) ? '****' : val;

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
      <div id="detail-header" className={`px-4 py-6 text-white flex flex-wrap justify-between items-center gap-4 ${category.market === 'TW' ? 'bg-gradient-to-r from-red-700 to-red-600' : 'bg-gradient-to-r from-blue-800 to-indigo-700'} shadow-inner`}>
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
            <div className="flex items-center gap-4 text-xs opacity-90 mt-1 font-bold">
              <span className="bg-white/10 px-2 py-0.5 rounded">上限: {formatCurrency(category.projectedInvestment, isUS ? 'USD' : 'TWD', isPrivacyMode)}</span>
              <span className="flex items-center gap-1 text-yellow-300 bg-black/10 px-2 py-0.5 rounded"><Wallet className="w-3.5 h-3.5" /> 現金: {formatCurrency(category.remainingCash, isUS ? 'USD' : 'TWD', isPrivacyMode)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-8 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-none border-white/10 pt-4 sm:pt-0">
          <div>
            <div className="text-[10px] opacity-70 uppercase font-black tracking-widest mb-1">已投入資金</div>
            <div className="text-3xl font-mono font-black leading-none">{formatCurrency(category.investedAmount, isUS ? 'USD' : 'TWD', isPrivacyMode)} <span className="text-[10px] opacity-60">({category.investmentRatio.toFixed(1)}%)</span></div>
          </div>
          <div>
            <div className="text-[10px] opacity-70 uppercase font-black tracking-widest mb-1">未實現損益</div>
            <div className={`text-3xl font-mono font-black leading-none ${totalUnrealized >= 0 ? 'text-white' : 'text-green-300'}`}>
              {totalUnrealized > 0 ? '+' : ''}{maskValue(formatCurrency(totalUnrealized, isUS ? 'USD' : 'TWD', isPrivacyMode))}
            </div>
          </div>
        </div>
      </div>

      {/* 操作列 */}
      <div className="sticky top-[64px] z-40 bg-white border-b border-gray-200 px-3 py-2 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden sm:inline mr-1">持倉項目 (Details)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* 搜尋框 */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="搜尋代碼/名稱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-32 sm:w-48 transition-all"
            />
          </div>

          {!readOnly && (
            <button
              onClick={handleRefreshCategory}
              disabled={isRefreshingCategory}
              className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded text-sm text-gray-600 hover:text-indigo-600 shadow-sm transition ${isRefreshingCategory ? 'opacity-50' : ''}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCategory ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshingCategory ? '更新中...' : '同步價格'}</span>
            </button>
          )}
          {!readOnly && (
            <button id="detail-add-btn" onClick={() => handleOpenOrder()} className="bg-libao-gold hover:bg-yellow-400 text-gray-900 font-black py-1.5 px-6 rounded-lg text-xs flex items-center gap-1.5 shadow transition-all active:scale-95 border-b-2 border-yellow-600">
              <Plus className="w-4 h-4" /> 下單交易 (Order)
            </button>
          )}
        </div>
      </div>

      <div className="md:hidden divide-y divide-gray-100 min-h-[400px]">
        {/* Mobile Header Row */}
        <div className="grid grid-cols-[1.3fr_1fr_1fr_1.1fr] gap-1 px-4 py-2 bg-gray-100 text-[11px] font-black text-gray-500 text-right sticky top-0 z-10 border-b border-gray-200 shadow-sm">
          <div className="text-left pl-1">名稱</div>
          <div>
            <div>現價</div>
            <div className="text-[9px] font-normal opacity-80">均價</div>
          </div>
          <div>
            <div>股數</div>
            <div className="text-[9px] font-normal opacity-80">佔比</div>
          </div>
          <div className="pr-1">損益</div>
        </div>

        {filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-gray-400 bg-white">
            <div className="mb-2 font-bold">{searchTerm ? '找不到符合的資產' : '尚無持倉'}</div>
            {!readOnly && !searchTerm && (
              <button onClick={() => handleOpenOrder()} className="text-indigo-600 font-bold hover:underline">立即新增</button>
            )}
          </div>
        ) : (
          filteredAssets.map(asset => (
            <div key={asset.id} className="bg-white transition-colors">
              <div
                className={`grid grid-cols-[1.3fr_1fr_1fr_1.1fr] gap-1 px-4 py-3 items-center min-h-[64px] active:bg-gray-50 cursor-pointer ${expandedAssetId === asset.id ? 'bg-indigo-50/30' : ''}`}
                onClick={() => toggleAssetExpansion(asset.id)}
              >
                {/* Col 1: Name */}
                <div className="text-left overflow-hidden">
                  <div className="font-black text-gray-900 truncate text-[15px]">{asset.name}</div>
                  <div className="text-[11px] font-bold text-gray-400 font-mono truncate">{asset.symbol}</div>
                </div>

                {/* Col 2: Price / Avg */}
                <div className="text-right">
                  <div className={`font-mono font-black text-[13px] ${asset.currentPrice > asset.avgCost ? 'text-red-600' : (asset.currentPrice < asset.avgCost ? 'text-green-600' : 'text-gray-900')}`}>
                    {strictMask(category.market === 'US' ? formatCurrency(asset.currentPrice, 'USD', isPrivacyMode) : asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }))}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                    {strictMask(category.market === 'US' ? formatCurrency(asset.avgCost, 'USD', isPrivacyMode) : asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }))}
                  </div>
                </div>

                {/* Col 3: Shares / Ratio */}
                <div className="text-right">
                  <div className="font-mono font-black text-gray-800 text-[13px]">{strictMask(asset.shares)}</div>
                  <div className="text-[11px] font-bold text-indigo-500 font-mono mt-0.5">{isMasked ? '****' : asset.portfolioRatio.toFixed(1)}%</div>
                </div>

                {/* Col 4: P&L */}
                <div className="text-right">
                  <div className={`font-mono font-black text-[13px] ${asset.unrealizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {maskValue(Math.round(asset.unrealizedPnL).toLocaleString())}
                  </div>
                  <div className={`text-[11px] font-bold mt-0.5 ${asset.currentPrice > asset.avgCost ? 'text-red-500' : 'text-green-600'}`}>
                    {asset.avgCost > 0 ? (asset.currentPrice > asset.avgCost ? '+' : '') + (isMasked ? '****' : ((asset.currentPrice - asset.avgCost) / asset.avgCost * 100).toFixed(2)) + '%' : '0.00%'}
                  </div>
                </div>
              </div>

              {/* Collapsible Action Row */}
              {expandedAssetId === asset.id && !readOnly && (
                <div className="px-4 py-2 bg-gray-50 border-t border-b border-gray-100 flex justify-end items-center gap-2 animate-in slide-in-from-top-2 duration-200">
                  <button onClick={(e) => { e.stopPropagation(); setNoteAsset(asset); }} className="px-3 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-500 flex items-center gap-1 shadow-sm">
                    <NotebookPen className="w-3.5 h-3.5" /> 筆記
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onUpdateAssetPrice(asset.id, asset.symbol, category.market); }} className="px-3 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-blue-600 flex items-center gap-1 shadow-sm">
                    <RefreshCw className="w-3.5 h-3.5" /> 更新
                  </button>

                  {/* Delete button removed */}
                  <button onClick={(e) => { e.stopPropagation(); handleOpenOrder(asset); }} className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white rounded text-xs font-black flex items-center gap-1 shadow-md ml-2">
                    <Plus className="w-3.5 h-3.5" /> 交易
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block overflow-x-auto min-h-[400px]">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left text-sm font-black text-gray-500 uppercase tracking-widest">
              <th className="p-4 w-40">標的</th>

              <th className="p-4 text-right">成本均價</th>
              <th className="p-4 text-right">當前股價</th>
              <th className="p-4 text-right">持倉股數</th>
              <th className="p-4 text-right">持倉價值</th>
              <th className="p-4 text-right">未實現損益</th>
              <th className="p-4 text-center">資金佔比</th>
              {!readOnly && <th className="p-4 text-center w-48">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-lg font-medium">
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-12 text-center text-gray-400">
                  <div className="mb-2 font-bold">{searchTerm ? `找不到與 "${searchTerm}" 相關的資產` : '尚無持倉'}</div>
                  {!readOnly && !searchTerm && (
                    <button onClick={() => handleOpenOrder()} className="text-indigo-600 font-bold hover:underline">立即新增</button>
                  )}
                </td>
              </tr>
            ) : (
              filteredAssets.map(asset => (
                <tr key={asset.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-10 rounded-full ${asset.unrealizedPnL >= 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
                      <div>
                        <div className="font-black text-gray-900 flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => setChartAsset(asset)}>
                          {asset.symbol}
                          {(asset.currentPrice > asset.avgCost) ? <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> : <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[150px] font-bold">{asset.name}</div>
                        {asset.note && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1 bg-gray-100 px-1.5 py-0.5 rounded-md w-fit font-bold">
                            <NotebookPen className="w-3 h-3" />
                            {asset.note.substring(0, 10)}{asset.note.length > 10 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="p-4 text-right font-mono text-gray-500 font-medium text-sm">
                    {strictMask(category.market === 'US' ? formatCurrency(asset.avgCost, 'USD', isPrivacyMode) : asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }))}
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-mono font-black text-gray-900">
                      {strictMask(category.market === 'US' ? formatCurrency(asset.currentPrice, 'USD', isPrivacyMode) : asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }))}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-mono font-black text-gray-800">{strictMask(asset.shares)} <span className="text-gray-400 text-xs font-bold">股</span></div>
                  </td>
                  <td className="p-4 text-right font-mono text-indigo-900 font-black">
                    {maskValue(formatCurrency(asset.marketValue, isUS ? 'USD' : 'TWD', isPrivacyMode))}
                  </td>
                  <td className="p-4 text-right">
                    <div className={`font-mono font-black ${asset.unrealizedPnL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {asset.unrealizedPnL >= 0 ? '+' : ''}{maskValue(formatCurrency(asset.unrealizedPnL, isUS ? 'USD' : 'TWD', isPrivacyMode))}
                    </div>
                    <div className={`text-xs font-black ${asset.currentPrice > asset.avgCost ? 'text-red-500' : 'text-green-600'}`}>
                      {asset.avgCost > 0 ? (
                        <>
                          {(asset.currentPrice > asset.avgCost ? '+' : '')}{isMasked ? '****' : ((asset.currentPrice - asset.avgCost) / asset.avgCost * 100).toFixed(2)}%
                        </>
                      ) : '0.00%'}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="text-sm font-black text-gray-700 font-mono">{isMasked ? '****' : asset.portfolioRatio.toFixed(1)}%</div>
                  </td>
                  {!readOnly && (
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenOrder(asset)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg transition-all font-black text-xs shadow-md active:scale-95"
                          title="資產交易 (Trade)"
                        >
                          <Plus className="w-4 h-4" /> 交易
                        </button>
                        <div className="flex gap-1 border-l border-gray-100 pl-2">
                          <button
                            onClick={() => setNoteAsset(asset)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="筆記"
                          >
                            <NotebookPen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onUpdateAssetPrice(asset.id, asset.symbol, category.market)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="更新"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          {/* Delete button removed */}
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>



      {/* 底部返回按鈕 */}
      <div className="p-6 border-t bg-gray-50 flex justify-center">
        <button onClick={onBack} className="group flex items-center gap-2 px-10 py-2.5 bg-gray-900 hover:bg-black rounded-xl text-white font-bold transition-all shadow-lg active:scale-95 text-sm">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>返回持倉總覽 (Back)</span>
        </button>
      </div>
    </div >
  );
};

export default DetailTable;
