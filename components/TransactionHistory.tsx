import React, { useState } from 'react';
import { TransactionRecord, PortfolioState, Asset, UserRole, AccessTier, getTier } from '../types';
import { History, ArrowUpRight, ArrowDownLeft, Coins, Filter, Search, Calendar, ChevronDown, Trash2, AlertCircle, X, CheckCircle, Lock, RefreshCw } from 'lucide-react';
import { formatCurrency, formatTWD, formatShares } from '../utils/formatting';

interface TransactionHistoryProps {
  transactions: TransactionRecord[];
  portfolio: PortfolioState;
  onRevoke: (txId: string) => void;
  isPrivacyMode: boolean;
  userRole: UserRole;
  martingaleCategories: string[];
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  portfolio,
  onRevoke,
  isPrivacyMode,
  userRole,
  martingaleCategories
}) => {
  // State for the confirmation modal
  const [revokingTx, setRevokingTx] = useState<TransactionRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'martingale'>('my');

  const maskValue = (val: string | number) => isPrivacyMode ? '*******' : val;
  const userTier = getTier(userRole);
  const isReadOnly = activeTab === 'martingale' && userRole !== 'admin';
  const hasMartingaleAccess = userTier >= AccessTier.STANDARD;

  // Helper: Safe date parsing
  const getTxTimestamp = (dateStr: string | Date | number) => {
    if (typeof dateStr === 'number') return dateStr;
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? 0 : t;
  };

  /**
   * 核心邏輯修正：只要是該個股在該類別中的「最新」交易，就應該可以撤銷。
   */
  const canRevoke = (tx: TransactionRecord): { allowed: boolean; reason?: string } => {
    if (isReadOnly) return { allowed: false, reason: "僅管理員可撤銷馬丁交易" };

    // 1. 找出該個股在該倉位中的所有交易，並按時間排序
    const assetTxList = transactions
      .filter(t => t.symbol === tx.symbol && t.categoryName === tx.categoryName)
      .sort((a, b) => {
        const timeA = getTxTimestamp(a.date);
        const timeB = getTxTimestamp(b.date);
        return timeB - timeA;
      });

    if (assetTxList.length === 0) return { allowed: false, reason: "無交易紀錄" };

    const latestTx = assetTxList[0];
    const latestTime = getTxTimestamp(latestTx.date);
    const thisTime = getTxTimestamp(tx.date);

    // 只有最上面（最新）的那一筆可以被撤銷，否則會破壞 FIFO 邏輯
    if (tx.id !== latestTx.id && thisTime < latestTime) {
      return { allowed: false, reason: "需先撤銷較新的交易" };
    }

    // 獲取當前資產狀態
    const allCategories = [...portfolio.categories, ...(Array.isArray(portfolio.martingale) ? portfolio.martingale : [])];
    let asset: Asset | undefined;
    for (const cat of allCategories) {
      if (cat.name === tx.categoryName) {
        asset = cat.assets.find(a => a.symbol === tx.symbol);
        break;
      }
    }

    if (tx.type === 'BUY') {
      if (!asset) return { allowed: true };
      if (asset.shares < (tx.shares || 0)) return { allowed: false, reason: "持股數小於買入量，可能已涉及後續交易" };
      return { allowed: true };
    }

    if (tx.type === 'SELL' || tx.type === 'DIVIDEND' || tx.type === 'SPLIT') {
      return { allowed: true };
    }

    return { allowed: false };
  };

  const handleRevokeClick = (e: React.MouseEvent, tx: TransactionRecord) => {
    e.stopPropagation();
    e.preventDefault();
    setRevokingTx(tx);
  };

  const confirmRevoke = () => {
    if (revokingTx) {
      onRevoke(revokingTx.id);
      setRevokingTx(null);
    }
  };

  // --- Search & Filter Logic ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('all');

  const tabTransactions = transactions.filter(tx => {
    // 1. 判定是否為馬丁交易 (優先使用 isMartingale 標記，次之使用 Legacy Fallback)
    let isMart = false;
    if (tx.isMartingale !== undefined) {
      isMart = tx.isMartingale;
    } else {
      isMart = (martingaleCategories || []).includes(tx.categoryName || '') && (tx.portfolioRatio === 0 || !tx.portfolioRatio);
    }

    // 2. 依照當前分頁 (個人/馬丁) 進行初步過濾
    if (activeTab === 'my' && isMart) return false;
    if (activeTab === 'martingale' && !isMart) return false;

    // 3. 針對「官方馬丁交易」進行「紅標 (頭等艙)」權限限制
    // 如果是用戶自己建立的個人倉位 (isMart: false)，即便名稱相同也應允許顯示，因為那是用戶自己的數據
    if (isMart) {
      const isRedLabel = tx.categoryName === '紅標 (頭等艙)' || (tx.categoryName || '').includes('紅標');
      const userTier = getTier(userRole);
      if (isRedLabel && userTier < AccessTier.FIRST_CLASS) return false;
    }

    return true;
  });

  const uniqueCategories = Array.from(new Set(tabTransactions.map(tx => tx.categoryName || ''))).sort();

  const finalFilteredTransactions = tabTransactions.filter(tx => {
    const matchesCategory = selectedCategory === 'all' || tx.categoryName === selectedCategory;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = tx.symbol.toLowerCase().includes(searchLower) || (tx.name || '').toLowerCase().includes(searchLower);
    let matchesTime = true;
    if (selectedTimeRange !== 'all') {
      const txDateObj = new Date(tx.date);
      const txDate = txDateObj.getTime();
      const now = Date.now();

      // Handle discrete years
      if (/^\d{4}$/.test(selectedTimeRange)) {
        matchesTime = txDateObj.getFullYear() === parseInt(selectedTimeRange);
      } else {
        let cutoff = 0;
        switch (selectedTimeRange) {
          case '1w': cutoff = now - (7 * 24 * 60 * 60 * 1000); break;
          case '1m': cutoff = now - (30 * 24 * 60 * 60 * 1000); break;
          case '3m': cutoff = now - (90 * 24 * 60 * 60 * 1000); break;
          case '6m': cutoff = now - (180 * 24 * 60 * 60 * 1000); break;
          case '1y': cutoff = now - (365 * 24 * 60 * 60 * 1000); break;
          default: cutoff = 0;
        }
        matchesTime = txDate >= cutoff;
      }
    }
    return matchesCategory && matchesSearch && matchesTime;
  });

  const sortedTransactions = [...finalFilteredTransactions].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200 relative">
      <div className="bg-gray-800 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <History className="w-5 h-5 text-yellow-400" />
          交易紀錄 (Transaction History)
        </h2>
        <div className="flex bg-gray-700/50 p-1 rounded-lg backdrop-blur-sm border border-gray-600/50">
          <button
            onClick={() => { setActiveTab('my'); setSelectedCategory('all'); setSearchTerm(''); setSelectedTimeRange('all'); }}
            className={`relative px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === 'my'
              ? 'bg-blue-400 text-gray-900 shadow-md transform scale-[1.02]'
              : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
              }`}
          >
            <Coins className="w-4 h-4" />
            個人交易紀錄
          </button>
          {hasMartingaleAccess ? (
            <button
              onClick={() => { setActiveTab('martingale'); setSelectedCategory('all'); setSearchTerm(''); setSelectedTimeRange('all'); }}
              className={`relative px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === 'martingale'
                ? 'bg-yellow-400 text-gray-900 shadow-md transform scale-[1.02]'
                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              馬丁交易紀錄
            </button>
          ) : (
            <div className="px-4 py-1.5 text-sm font-bold text-gray-400 flex items-center gap-2 cursor-not-allowed opacity-50 select-none" title="升級至 Pro 會員以解鎖馬丁數據">
              <Lock className="w-4 h-4" />
              馬丁交易紀錄
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 text-sm text-gray-500 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 whitespace-nowrap"
          >
            <option value="all">所有時間</option>
            <option value="1w">一週內</option>
            <option value="1m">一個月內</option>
            <option value="3m">三個月內</option>
            <option value="6m">半年內</option>
            <option value="1y">一年內</option>
            <option disabled className="text-gray-400">── 年份篩選 ──</option>
            <option value="2026">2026年</option>
            <option value="2025">2025年</option>
            <option value="2024">2024年</option>
            <option value="2023">2023年</option>
            <option value="2022">2022年</option>
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 whitespace-nowrap"
          >
            <option value="all">所有倉位</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="relative w-full md:w-64 min-w-[150px]">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500"
              placeholder="搜尋標的..."
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Total Realized PnL Display (Restored) */}
          {(() => {
            const { totalTWD, totalUSD } = finalFilteredTransactions.reduce((acc, tx) => {
              const pnl = tx.realizedPnL || 0;
              if (pnl === 0) return acc;
              const isUS = (tx.exchangeRate || 1) > 5;
              if (isUS) {
                acc.totalUSD += pnl / (tx.exchangeRate || 1);
              } else {
                acc.totalTWD += pnl;
              }
              return acc;
            }, { totalTWD: 0, totalUSD: 0 });

            if (totalTWD === 0 && totalUSD === 0) return null;

            return (
              <div className="text-sm font-bold flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-gray-600">已實現損益:</span>
                {totalTWD !== 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-medium">TWD</span>
                    <span className={`${totalTWD > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {totalTWD > 0 ? '+' : ''}{formatCurrency(totalTWD, 'TWD')}
                    </span>
                  </div>
                )}
                {totalTWD !== 0 && totalUSD !== 0 && <span className="text-gray-300">|</span>}
                {totalUSD !== 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-medium">USD</span>
                    <span className={`${totalUSD > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {totalUSD > 0 ? '+' : ''}{formatCurrency(totalUSD, 'USD')}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
          <span className="whitespace-nowrap hidden md:inline font-medium text-gray-500">
            共 {finalFilteredTransactions.length} 筆
          </span>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-base text-left">
          <thead className="text-sm text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-300">
            <tr>
              <th className="px-4 py-3">時間</th>
              <th className="px-4 py-3 text-center">動作</th>
              <th className="px-4 py-3">倉位</th>
              <th className="px-4 py-3">標的</th>
              <th className="px-4 py-3 text-right">成交價格</th>
              <th className="px-4 py-3 text-right">股數</th>
              <th className="px-4 py-3 text-right">總金額</th>
              <th className="px-4 py-3 text-center">加/減碼比例</th>
              <th className="px-4 py-3 text-right">已實現損益</th>
              <th className="px-4 py-3 text-center">撤銷</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <History className="w-12 h-12 mb-2 opacity-20" />
                    尚無符合條件的{activeTab === 'my' ? '個人' : '馬丁'}交易紀錄
                  </div>
                </td>
              </tr>
            ) : (
              sortedTransactions.map((tx) => {
                const check = canRevoke(tx);
                const isDiv = tx.type === 'DIVIDEND';
                const isSell = tx.type === 'SELL';
                const allCats = [...portfolio.categories, ...(Array.isArray(portfolio.martingale) ? portfolio.martingale : [])];
                const cat = allCats.find(c => c.name === tx.categoryName);
                const isUS = cat?.market === 'US';
                return (
                  <tr key={tx.id} className="border-b hover:bg-gray-50 group">
                    <td className="px-4 py-3 text-gray-600 font-mono text-sm whitespace-nowrap">
                      {typeof tx.date === 'string' ? tx.date.split('T')[0] : new Date(tx.date).toISOString().split('T')[0]}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${tx.type === 'BUY' ? 'bg-red-50 text-red-600 border border-red-200' :
                        tx.type === 'SELL' ? 'bg-green-50 text-green-600 border border-green-200' :
                          tx.type === 'SPLIT' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                            'bg-purple-50 text-purple-600 border border-purple-200'
                        }`}>
                        {tx.type === 'BUY' ? <ArrowDownLeft className="w-3 h-3" /> :
                          tx.type === 'SELL' ? <ArrowUpRight className="w-3 h-3" /> :
                            tx.type === 'SPLIT' ? <RefreshCw className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                        {tx.type === 'BUY' ? '買入' : tx.type === 'SELL' ? '賣出' : tx.type === 'SPLIT' ? '拆合股' : '領息'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                      {tx.categoryName}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{tx.symbol}</span>
                        <span className="text-sm text-gray-500">{tx.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {isDiv ? '-' : (tx.type === 'SPLIT' ? '-' : maskValue(tx.price.toLocaleString()))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {isDiv ? '-' : (tx.type === 'SPLIT' ? `x${tx.quantity}` : formatShares(tx.shares || 0, isPrivacyMode))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-700">
                      {formatCurrency(tx.amount || 0, isUS ? 'USD' : 'TWD', isPrivacyMode)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm">
                      {tx.portfolioRatio ? (
                        <span className={tx.type === 'BUY' ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                          {tx.type === 'BUY' ? '+' : '-'}{tx.portfolioRatio.toFixed(2)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {(isSell || isDiv) ? (
                        <span className={tx.realizedPnL! >= 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                          {(() => {
                            const isUS_PnL = (tx.exchangeRate || 1) > 5;
                            const pnlVal = isUS_PnL ? (tx.realizedPnL || 0) / (tx.exchangeRate || 1) : (tx.realizedPnL || 0);
                            if (isPrivacyMode) return '*******';
                            const valStr = pnlVal.toLocaleString('en-US', { minimumFractionDigits: isUS_PnL ? 2 : 0, maximumFractionDigits: isUS_PnL ? 2 : 0 });
                            const sign = pnlVal > 0 ? '+' : '';
                            const prefix = isUS_PnL ? 'USD' : 'NT$';
                            return `${sign}${prefix} ${valStr}`;
                          })()}
                          {isDiv && <span className="text-[10px] text-gray-400 block">淨入帳</span>}
                          {isSell && (tx.originalCostTWD || (tx.amount - (tx.realizedPnL || 0) - (tx.fee || 0) - (tx.tax || 0))) > 0 && (
                            <span className="text-[11px] font-bold block opacity-80">
                              {(() => {
                                const cost = tx.originalCostTWD || (tx.amount - (tx.realizedPnL || 0) - (tx.fee || 0) - (tx.tax || 0));
                                return `${tx.realizedPnL! > 0 ? '+' : ''}${((tx.realizedPnL! / cost) * 100).toFixed(2)}%`;
                              })()}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {check.allowed ? (
                        <button
                          type="button"
                          onClick={(e) => handleRevokeClick(e, tx)}
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all p-2 rounded-full shadow-sm border border-transparent hover:border-red-200"
                          title="撤銷此交易"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex justify-center cursor-not-allowed opacity-30" title={check.reason}>
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {revokingTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> 撤銷交易確認
              </h3>
              <button
                onClick={() => setRevokingTx(null)}
                className="hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4 font-medium">您確定要撤銷這筆交易嗎？</p>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6 text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">動作</span>
                  <span className={`font-bold ${revokingTx.type === 'BUY' ? 'text-red-600' :
                    revokingTx.type === 'SELL' ? 'text-green-600' :
                      revokingTx.type === 'SPLIT' ? 'text-blue-600' : 'text-purple-600'
                    }`}>
                    {revokingTx.type === 'BUY' ? '買入 (BUY)' :
                      revokingTx.type === 'SELL' ? '賣出 (SELL)' :
                        revokingTx.type === 'SPLIT' ? '拆合股 (SPLIT)' : '領息 (DIV)'}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">標的</span>
                  <span className="font-bold text-gray-800">{revokingTx.symbol} {revokingTx.name}</span>
                </div>
                {revokingTx.type !== 'DIVIDEND' && revokingTx.type !== 'SPLIT' && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-500">股數</span>
                    <span className="font-mono">{formatShares(revokingTx.shares || 0, isPrivacyMode)}</span>
                  </div>
                )}
                {revokingTx.type === 'SPLIT' && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-500">拆合倍率</span>
                    <span className="font-mono font-bold">x{revokingTx.quantity}</span>
                  </div>
                )}
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">{revokingTx.type === 'DIVIDEND' ? '配息總額' : '總金額'}</span>
                  <span className="font-mono font-bold">NT$ {formatTWD(revokingTx.amount || 0, isPrivacyMode)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setRevokingTx(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmRevoke}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> 確認撤銷
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
