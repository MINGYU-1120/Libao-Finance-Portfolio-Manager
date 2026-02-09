
import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Coins, Plus, Trash2, Calculator, Calendar } from 'lucide-react';

export interface ScannedDividend {
  id: string; // Internal ID for key
  assetId: string;
  symbol: string;
  name: string;
  exDate: string;
  rate: number; // Dividend per share
  shares: number; // Held shares on ex-date
  taxRate: number; // 0.3 for US, 0 for TW usually
  categoryName: string;
  market: 'TW' | 'US';
  isManual?: boolean;
  isMartingale?: boolean;
}

interface DividendModalProps {
  isOpen: boolean;
  onClose: () => void;
  scannedDividends: ScannedDividend[]; // Initial suggestions
  availableAssets: { id: string; symbol: string; name: string; categoryName: string; market: 'TW' | 'US' }[];
  usExchangeRate: number;
  onCheckShares: (assetId: string, date: string) => number; // Callback to calc shares
  onConfirm: (dividends: ScannedDividend[]) => void;
  isLoading: boolean;
}

const DividendModal: React.FC<DividendModalProps> = ({
  isOpen,
  onClose,
  scannedDividends,
  availableAssets,
  usExchangeRate,
  onCheckShares,
  onConfirm,
  isLoading
}) => {
  const [items, setItems] = useState<ScannedDividend[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Ref arrays to control date inputs directly (Separate for Mobile/Desktop to avoid conflicts)
  const dateInputRefsDesktop = useRef<(HTMLInputElement | null)[]>([]);
  const dateInputRefsMobile = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize items when props change
  useEffect(() => {
    if (isOpen) {
      setItems(scannedDividends);
      // Default select all scanned items
      setSelectedIndices(new Set(scannedDividends.map((_, i) => i)));
    }
  }, [isOpen, scannedDividends]);

  // Reset refs when items change to avoid stale references
  useEffect(() => {
    dateInputRefsDesktop.current = dateInputRefsDesktop.current.slice(0, items.length);
    dateInputRefsMobile.current = dateInputRefsMobile.current.slice(0, items.length);
  }, [items]);

  const toggleSelect = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const handleUpdateItem = (index: number, field: keyof ScannedDividend, value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const handleManualAdd = () => {
    if (availableAssets.length === 0) return;
    const defaultAsset = availableAssets[0];
    const today = new Date().toISOString().split('T')[0];

    // Initial shares check for today
    const shares = onCheckShares(defaultAsset.id, today);

    const newItem: ScannedDividend = {
      id: Math.random().toString(36).substr(2, 9),
      assetId: defaultAsset.id,
      symbol: defaultAsset.symbol,
      name: defaultAsset.name,
      exDate: today,
      rate: 0,
      shares: shares,
      taxRate: defaultAsset.market === 'US' ? 0.3 : 0,
      categoryName: defaultAsset.categoryName,
      market: defaultAsset.market,
      isManual: true
    };

    setItems(prev => [...prev, newItem]);
    setSelectedIndices(prev => new Set(prev).add(items.length));
  };

  const handleManualAssetChange = (index: number, assetId: string) => {
    const asset = availableAssets.find(a => a.id === assetId);
    if (!asset) return;

    setItems(prev => {
      const newItems = [...prev];
      const currentItem = newItems[index];
      // Recalculate shares for new asset at current date
      const shares = onCheckShares(asset.id, currentItem.exDate);

      newItems[index] = {
        ...currentItem,
        assetId: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        categoryName: asset.categoryName,
        market: asset.market,
        shares: shares,
        taxRate: asset.market === 'US' ? 0.3 : 0
      };
      return newItems;
    });
  };

  const handleDateChange = (index: number, date: string) => {
    handleUpdateItem(index, 'exDate', date);
    // Recalculate shares for this date immediately
    if (date) {
      const item = items[index];
      const shares = onCheckShares(item.assetId, date);
      handleUpdateItem(index, 'shares', shares);
    }
  };

  const handleDelete = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    setSelectedIndices(prev => {
      const newSet = new Set<number>();
      prev.forEach(i => {
        if (i < index) newSet.add(i);
        if (i > index) newSet.add(i - 1);
      });
      return newSet;
    });
  };

  const handleConfirm = () => {
    const selected = items.filter((_, i) => selectedIndices.has(i));
    // Final check to ensure rates are valid
    if (selected.some(i => i.rate <= 0)) {
      if (!window.confirm("部分選取項目的配息金額為 0，確定要入帳嗎？")) return;
    }
    if (selected.some(i => i.rate > 1000000 || i.shares > 10000000000)) {
      alert("部分項目的數值過大，請檢查配息金額或股數。");
      return;
    }
    onConfirm(selected);
    onClose();
  };

  const openDatePicker = (idx: number, view: 'mobile' | 'desktop') => {
    const el = view === 'mobile' ? dateInputRefsMobile.current[idx] : dateInputRefsDesktop.current[idx];
    if (el) {
      try {
        el.showPicker();
      } catch (e) {
        el.focus();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-purple-600 p-4 text-white flex justify-between items-center rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Coins className="w-6 h-6 text-yellow-300" />
            <span className="hidden sm:inline">配息確認工作表 (Dividend Worksheet)</span>
            <span className="sm:hidden">配息確認</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-4 md:p-6 flex-1 overflow-y-auto bg-gray-50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <p className="text-gray-500 font-medium">正在掃描歷史配息與回溯持倉...</p>
            </div>
          ) : (
            <>
              <div className="mb-4 bg-white p-4 rounded-lg border border-purple-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="hidden md:block bg-purple-100 p-2 rounded-full text-purple-600">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm md:text-base">請確認或手動輸入配息資訊</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      可修改 <span className="font-bold text-purple-600">「配息/股」</span> 與 <span className="font-bold text-purple-600">「日期」</span>，系統自動計算總額。
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleManualAdd}
                  className="bg-white border border-purple-200 hover:bg-purple-50 text-purple-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap w-full md:w-auto"
                >
                  <Plus className="w-4 h-4" /> 手動新增
                </button>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {items.length === 0 && (
                  <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-200">
                    尚無配息資料，請點擊「手動新增」。
                  </div>
                )}
                {items.map((item, idx) => {
                  const isSelected = selectedIndices.has(idx);
                  const exRate = item.market === 'US' ? usExchangeRate : 1;
                  const grossOriginal = item.shares * item.rate;
                  const taxAmount = grossOriginal * item.taxRate;
                  const netOriginal = grossOriginal - taxAmount;
                  const netTWD = Math.round(netOriginal * exRate);

                  return (
                    <div key={item.id} className={`bg-white p-4 rounded-xl border shadow-sm transition-all ${isSelected ? 'border-purple-300 ring-1 ring-purple-100' : 'border-gray-200'}`}>
                      {/* Header */}
                      <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(idx)}
                            className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            {item.isManual ? (
                              <select
                                value={item.assetId}
                                onChange={(e) => handleManualAssetChange(idx, e.target.value)}
                                className="w-full p-1 border rounded bg-yellow-50 text-xs font-bold"
                              >
                                {availableAssets.map(a => (
                                  <option key={a.id} value={a.id}>{a.symbol} {a.name}</option>
                                ))}
                              </select>
                            ) : (
                              <>
                                <div className="font-bold text-gray-800">{item.symbol}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[150px]">{item.name}</div>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(idx)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Date Input */}
                      <div className="mb-3">
                        <label className="text-xs text-gray-400 block mb-1">入帳/除息日</label>
                        <div className="relative">
                          <input
                            ref={(el) => { dateInputRefsMobile.current[idx] = el; }}
                            type="date"
                            value={item.exDate.split('T')[0]}
                            onChange={(e) => handleDateChange(idx, e.target.value)}
                            className="w-full p-2 pr-10 border border-gray-300 rounded-lg bg-yellow-50 text-sm font-mono focus:ring-2 focus:ring-purple-500 outline-none text-gray-800"
                          />
                          <Calendar
                            onClick={() => openDatePicker(idx, 'mobile')}
                            className="w-5 h-5 text-purple-600 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Rate & Tax Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">配息/股 ({item.market === 'US' ? 'USD' : 'TWD'})</label>
                          <input
                            type="number"
                            min="0"
                            max="1000000"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => handleUpdateItem(idx, 'rate', parseFloat(e.target.value))}
                            className="w-full p-2 border border-blue-200 bg-yellow-50 rounded-lg text-right font-bold font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">稅率 (%)</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={Math.round(item.taxRate * 100 * 10) / 10}
                              onChange={(e) => handleUpdateItem(idx, 'taxRate', parseFloat(e.target.value) / 100)}
                              className="w-full p-2 pr-8 border border-gray-300 bg-yellow-50 rounded-lg text-right font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary Footer */}
                      <div className="flex justify-between items-end pt-2 border-t border-gray-100 bg-gray-50 -mx-4 -mb-4 p-4 rounded-b-xl">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">持有股數</label>
                          <input
                            type="number"
                            min="0"
                            max="10000000000"
                            step="1"
                            value={item.shares}
                            onChange={(e) => handleUpdateItem(idx, 'shares', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 border border-purple-200 bg-yellow-50 rounded-lg text-right font-bold font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-400">預估實領 (TWD)</div>
                          <div className="text-xl font-bold font-mono text-purple-700">
                            ${netTWD.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-white border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && selectedIndices.size === items.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIndices(new Set(items.map((_, i) => i)));
                            else setSelectedIndices(new Set());
                          }}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3 min-w-[140px]">標的 (Symbol)</th>
                      <th className="p-3 w-40">除息/基準日</th>
                      <th className="p-3 text-right w-24">持有股數</th>
                      <th className="p-3 text-right w-32">配息/股 (Rate)</th>
                      <th className="p-3 text-right w-24">稅率 (%)</th>
                      <th className="p-3 text-right min-w-[120px]">預估實領 (Net)</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-gray-400">
                          尚無配息資料，請點擊「手動新增」或等待掃描結果。
                        </td>
                      </tr>
                    )}
                    {items.map((item, idx) => {
                      const isSelected = selectedIndices.has(idx);
                      const exRate = item.market === 'US' ? usExchangeRate : 1;
                      const grossOriginal = item.shares * item.rate;
                      const taxAmount = grossOriginal * item.taxRate;
                      const netOriginal = grossOriginal - taxAmount;
                      const netTWD = Math.round(netOriginal * exRate);

                      return (
                        <tr key={item.id} className={`group hover:bg-gray-50 transition-colors ${isSelected ? 'bg-purple-50/20' : ''}`}>
                          <td className="p-3 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(idx)}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 align-middle">
                            {item.isManual ? (
                              <select
                                value={item.assetId}
                                onChange={(e) => handleManualAssetChange(idx, e.target.value)}
                                className="w-full p-1.5 border rounded bg-yellow-50 text-xs font-medium"
                              >
                                {availableAssets.map(a => (
                                  <option key={a.id} value={a.id}>{a.symbol} {a.name}</option>
                                ))}
                              </select>
                            ) : (
                              <div>
                                <div className="font-bold text-gray-800">{item.symbol}</div>
                                <div className="text-xs text-gray-500">{item.name}</div>
                              </div>
                            )}
                          </td>
                          <td className="p-3 align-middle">
                            <div className="relative">
                              <input
                                ref={(el) => { dateInputRefsDesktop.current[idx] = el; }}
                                type="date"
                                value={item.exDate.split('T')[0]} // Handle ISO string
                                onChange={(e) => handleDateChange(idx, e.target.value)}
                                className="w-full p-1.5 pr-8 border rounded bg-yellow-50 text-xs font-mono focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer text-gray-700"
                              />
                              <Calendar
                                onClick={() => openDatePicker(idx, 'desktop')}
                                className="w-3.5 h-3.5 text-purple-600 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer hover:text-purple-800 hover:scale-110 transition-all"
                              />
                            </div>
                          </td>
                          <td className="p-3 text-right align-middle">
                            <input
                              type="number"
                              min="0"
                              max="10000000000"
                              step="1"
                              value={item.shares}
                              onChange={(e) => handleUpdateItem(idx, 'shares', parseFloat(e.target.value) || 0)}
                              className="w-full p-1.5 border border-purple-200 bg-yellow-50 rounded text-right font-bold font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                            {item.shares <= 0 && (
                              <div className="text-[10px] text-red-400 mt-1">無歷史持倉</div>
                            )}
                          </td>
                          <td className="p-3 text-right align-middle">
                            <div className="flex items-center">
                              <span className="text-xs text-gray-400 mr-1">$</span>
                              <input
                                type="number"
                                min="0"
                                max="1000000"
                                step="0.01"
                                value={item.rate}
                                onChange={(e) => handleUpdateItem(idx, 'rate', parseFloat(e.target.value))}
                                className="w-full p-1.5 border border-blue-200 bg-yellow-50 rounded text-right font-bold font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div className="text-[10px] text-gray-400 text-right mt-1">
                              {item.market === 'US' ? 'USD' : 'TWD'}
                            </div>
                          </td>
                          <td className="p-3 text-right align-middle">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={Math.round(item.taxRate * 100 * 10) / 10}
                                onChange={(e) => handleUpdateItem(idx, 'taxRate', parseFloat(e.target.value) / 100)}
                                className="w-16 p-1.5 pr-6 border rounded text-right text-xs bg-yellow-50 outline-none focus:ring-2 focus:ring-purple-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                            </div>
                          </td>
                          <td className="p-3 text-right align-middle">
                            <div className="font-bold text-purple-700 font-mono text-lg">
                              ${netTWD.toLocaleString()}
                            </div>
                            {item.market === 'US' && (
                              <div className="text-[10px] text-gray-400">
                                (USD ${netOriginal.toFixed(2)})
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center align-middle">
                            <button
                              onClick={() => handleDelete(idx)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors text-sm md:text-base"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || selectedIndices.size === 0}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm md:text-base"
          >
            <CheckCircle className="w-4 h-4" />
            <span className="hidden sm:inline">確認入帳 ({selectedIndices.size})</span>
            <span className="sm:hidden">入帳 ({selectedIndices.size})</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default DividendModal;
