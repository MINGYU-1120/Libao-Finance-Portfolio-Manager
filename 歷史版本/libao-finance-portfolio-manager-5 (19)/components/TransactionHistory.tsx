
import React, { useState } from 'react';
import { TransactionRecord, PortfolioState, Asset } from '../types';
import { ArrowDownLeft, ArrowUpRight, History, Trash2, AlertCircle, X, CheckCircle, Coins } from 'lucide-react';

interface TransactionHistoryProps {
  transactions: TransactionRecord[];
  portfolio: PortfolioState;
  onRevoke: (txId: string) => void;
  isPrivacyMode: boolean;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions, portfolio, onRevoke, isPrivacyMode }) => {
  // State for the confirmation modal
  const [revokingTx, setRevokingTx] = useState<TransactionRecord | null>(null);

  // Sort transactions by date descending
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const maskValue = (val: string | number) => isPrivacyMode ? '*******' : val;

  // Helper to check if a transaction can be revoked based on FIFO rules
  const canRevoke = (tx: TransactionRecord): { allowed: boolean; reason?: string } => {
    // 1. Get all transactions for this specific asset (symbol + category)
    const assetTxList = transactions
      .filter(t => t.symbol === tx.symbol && t.categoryName === tx.categoryName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 2. Check strict chronological order
    if (assetTxList.length === 0 || assetTxList[0].id !== tx.id) {
      return { allowed: false, reason: "需先撤銷較新的交易" };
    }

    // 3. Find current asset status in portfolio
    let asset: Asset | undefined;
    for (const cat of portfolio.categories) {
      if (cat.name === tx.categoryName) {
        const found = cat.assets.find(a => a.id === tx.assetId || a.symbol === tx.symbol);
        if (found) {
          asset = found;
          break;
        }
      }
    }

    if (tx.type === 'BUY') {
      // For BUY: The asset MUST exist to be revoked
      if (!asset) return { allowed: false, reason: "資產已賣出，無法撤銷買入" };
      
      // The specific Lot created by this BUY must exist and have original shares
      if (!tx.lotId) return { allowed: false, reason: "舊資料無法撤銷" };
      
      const lot = asset.lots.find(l => l.id === tx.lotId);
      if (!lot) return { allowed: false, reason: "批次已完全賣出" };
      if (lot.shares !== tx.shares) return { allowed: false, reason: "批次已部分賣出" };
      
      return { allowed: true };
    } 
    else if (tx.type === 'SELL') {
      // For SELL: It IS allowed even if asset is undefined (fully sold).
      // We already checked it's the latest transaction above.
      return { allowed: true };
    }
    else if (tx.type === 'DIVIDEND') {
       // Dividend can always be revoked as long as it's the latest (enforced above)
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

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200 relative">
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <History className="w-5 h-5 text-yellow-400" />
          交易紀錄 (Transaction History)
        </h2>
        <div className="text-sm opacity-80">
          共 {transactions.length} 筆
        </div>
      </div>
      
      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b-2 border-gray-300">
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
                <td colSpan={10} className="text-center py-12 text-gray-500 flex flex-col items-center justify-center w-full">
                  <History className="w-12 h-12 mb-2 opacity-20" />
                  尚無交易紀錄
                </td>
              </tr>
            ) : (
              sortedTransactions.map((tx) => {
                const check = canRevoke(tx);
                const isDiv = tx.type === 'DIVIDEND';
                return (
                  <tr key={tx.id} className="border-b hover:bg-gray-50 group">
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                      {new Date(tx.date).toLocaleString('zh-TW', { hour12: false })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                        tx.type === 'BUY' ? 'bg-red-100 text-red-700' : 
                        tx.type === 'SELL' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {tx.type === 'BUY' ? <ArrowDownLeft className="w-3 h-3"/> : 
                         tx.type === 'SELL' ? <ArrowUpRight className="w-3 h-3"/> : <Coins className="w-3 h-3"/>}
                        {tx.type === 'BUY' ? '買入' : tx.type === 'SELL' ? '賣出' : '領息'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {tx.categoryName}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{tx.symbol}</span>
                        <span className="text-xs text-gray-500">{tx.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {isDiv ? '-' : maskValue(tx.price.toLocaleString())}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {isDiv ? '-' : tx.shares.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-700">
                      {isDiv 
                        ? maskValue(tx.amount.toLocaleString()) // Gross Dividend
                        : maskValue(tx.amount.toLocaleString())}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {tx.portfolioRatio ? (
                        <span className={tx.type === 'BUY' ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                          {tx.type === 'BUY' ? '+' : '-'}{tx.portfolioRatio.toFixed(2)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {tx.type === 'SELL' || tx.type === 'DIVIDEND' ? (
                         <span className={tx.realizedPnL! >= 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                           {isPrivacyMode ? '*******' : (tx.realizedPnL! > 0 ? '+' : '') + tx.realizedPnL?.toLocaleString()}
                           {isDiv && <span className="text-[10px] text-gray-400 block">淨入帳</span>}
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

      {/* Revoke Confirmation Modal */}
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
                <X className="w-6 h-6"/>
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 mb-4 font-medium">
                您確定要撤銷這筆交易嗎？
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6 text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">動作</span>
                  <span className={`font-bold ${
                    revokingTx.type === 'BUY' ? 'text-red-600' : 
                    revokingTx.type === 'SELL' ? 'text-green-600' : 'text-purple-600'
                  }`}>
                    {revokingTx.type === 'BUY' ? '買入 (BUY)' : 
                     revokingTx.type === 'SELL' ? '賣出 (SELL)' : '領息 (DIV)'}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">標的</span>
                  <span className="font-bold text-gray-800">{revokingTx.symbol} {revokingTx.name}</span>
                </div>
                {revokingTx.type !== 'DIVIDEND' && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-500">股數</span>
                    <span className="font-mono">{revokingTx.shares.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">{revokingTx.type === 'DIVIDEND' ? '配息總額' : '總金額'}</span>
                  <span className="font-mono font-bold">NT$ {maskValue(revokingTx.amount.toLocaleString())}</span>
                </div>
                {revokingTx.type !== 'DIVIDEND' && (
                  <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                    <span className="text-gray-500">加/減碼比例</span>
                    <span className={`font-mono font-bold ${revokingTx.type === 'BUY' ? 'text-red-600' : 'text-green-600'}`}>
                      {revokingTx.type === 'BUY' ? '+' : '-'}{revokingTx.portfolioRatio ? revokingTx.portfolioRatio.toFixed(2) : '0.00'}%
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-red-500 mb-6 bg-red-50 p-2 rounded border border-red-100 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>此動作將還原資金與庫存，請確認交易順序無誤。</span>
              </p>

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
