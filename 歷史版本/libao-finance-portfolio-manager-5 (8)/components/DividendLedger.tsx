
import React from 'react';
import { TransactionRecord } from '../types';
import { Coins, TrendingUp, Calendar, Trash2, Plus, RefreshCw, DollarSign } from 'lucide-react';

interface DividendLedgerProps {
  transactions: TransactionRecord[];
  onScan: () => void;
  onRevoke: (txId: string) => void;
  isPrivacyMode: boolean;
}

const DividendLedger: React.FC<DividendLedgerProps> = ({ transactions, onScan, onRevoke, isPrivacyMode }) => {
  // Filter only DIVIDEND transactions
  const dividends = transactions.filter(t => t.type === 'DIVIDEND').sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const maskValue = (val: string | number) => isPrivacyMode ? '*******' : val;

  // Calculate Stats
  const totalDividendsTWD = dividends.reduce((sum, t) => sum + t.realizedPnL!, 0);
  
  // Calculate Market breakdown (Approximate based on fee/tax logic or symbol inference if market not stored directly in tx)
  // Since we don't store 'market' in TransactionRecord explicitly, we can infer or just sum total.
  // Ideally TransactionRecord should have 'market', but for now we aggregate Total.

  const currentYear = new Date().getFullYear();
  const thisYearDividends = dividends
    .filter(t => new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + t.realizedPnL!, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Card */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-purple-200 font-medium text-sm flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4" /> 歷史累計實領股息
            </h3>
            <div className="text-3xl font-bold font-mono">
              NT$ {maskValue(totalDividendsTWD.toLocaleString())}
            </div>
            <p className="text-xs text-purple-300 mt-2 opacity-80">
              * 已扣除預扣稅額之淨現金流
            </p>
          </div>
          <Coins className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-white opacity-10 rotate-12" />
        </div>

        {/* Year Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100 flex flex-col justify-center">
          <h3 className="text-gray-500 font-medium text-sm flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-purple-500" /> {currentYear} 年度領息
          </h3>
          <div className="text-2xl font-bold font-mono text-gray-800">
             NT$ {maskValue(thisYearDividends.toLocaleString())}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
             <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        {/* Action Card */}
        <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100 flex flex-col justify-center items-start gap-3">
           <h3 className="text-purple-800 font-bold text-sm">股息管理</h3>
           <button 
             onClick={onScan}
             className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
           >
             <RefreshCw className="w-4 h-4" /> 掃描 / 新增配息
           </button>
           <p className="text-xs text-purple-600 opacity-80">
             系統將自動掃描歷史持倉與配息紀錄
           </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
           <h2 className="font-bold text-gray-700 flex items-center gap-2">
             <TrendingUp className="w-5 h-5 text-purple-600" />
             股息入帳明細
           </h2>
           <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
             共 {dividends.length} 筆
           </span>
        </div>
        
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3">入帳日期</th>
                <th className="px-6 py-3">標的</th>
                <th className="px-6 py-3">倉位</th>
                <th className="px-6 py-3 text-right">配息總額 (Gross)</th>
                <th className="px-6 py-3 text-right">稅金 (Tax)</th>
                <th className="px-6 py-3 text-right">實領金額 (Net)</th>
                <th className="px-6 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dividends.length === 0 ? (
                <tr>
                   <td colSpan={7} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-3">
                         <Coins className="w-12 h-12 opacity-20" />
                         <p>尚無股息紀錄，試試看「掃描」功能吧！</p>
                      </div>
                   </td>
                </tr>
              ) : (
                dividends.map(tx => (
                  <tr key={tx.id} className="hover:bg-purple-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-600">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{tx.symbol}</span>
                        <span className="text-xs text-gray-500">{tx.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {tx.categoryName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-500">
                      {maskValue(tx.amount.toLocaleString())}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-red-400 text-xs">
                      -{maskValue((tx.tax || 0).toLocaleString())}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className="text-purple-700 font-bold font-mono text-lg">
                         +{maskValue(tx.realizedPnL!.toLocaleString())}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => {
                          if (window.confirm('確定要刪除此筆股息紀錄嗎？資金將會被扣回。')) {
                             onRevoke(tx.id);
                          }
                        }}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                        title="刪除紀錄"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DividendLedger;
