
import React, { useState } from 'react';
import { TransactionRecord, UserRole, PositionCategory } from '../types';
import { Coins, TrendingUp, Calendar, Trash2, Plus, RefreshCw, DollarSign } from 'lucide-react';

import AnnualDividendStatsModal from './AnnualDividendStatsModal';

interface DividendLedgerProps {
  transactions: TransactionRecord[];
  onScan: (target: 'my' | 'martingale') => void;
  onManualAdd: (target: 'my' | 'martingale') => void;
  onRevoke: (txId: string) => void;
  onReset: (target: 'my' | 'martingale') => void;
  isPrivacyMode: boolean;
  userRole: UserRole;
  martingaleCategories: string[];
  personalCategories: PositionCategory[];
}

const DividendLedger: React.FC<DividendLedgerProps> = ({
  transactions,
  onScan,
  onManualAdd,
  onRevoke,
  onReset,
  isPrivacyMode,
  userRole,
  martingaleCategories,
  personalCategories
}) => {
  const [activeTab, setActiveTab] = useState<'my' | 'martingale'>('my');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Filter and sort DIVIDEND transactions based on active tab
  const dividends = transactions
    .filter(t => t.type === 'DIVIDEND')
    .filter(t => {
      // Determine if a transaction is "Martingale"

      // 1. If explicit tag exists (Future proof), use it.
      if (t.isMartingale !== undefined) {
        return activeTab === 'my' ? !t.isMartingale : t.isMartingale;
      }

      // 2. Legacy Logic
      if (userRole === 'admin') {
        const isMartingaleName = martingaleCategories.includes(t.categoryName);

        // Smart Check: If name implies Martingale, verify if it's actually a Personal asset.
        // If the Asset ID exists in Personal Categories, treat as Personal regardless of name.
        const isPersonalAsset = personalCategories.some(c => c.assets.some(a => a.id === t.assetId));

        if (isPersonalAsset) {
          // It's definitely Personal
          return activeTab === 'my';
        }

        // Otherwise fallback to name match
        return activeTab === 'my' ? !isMartingaleName : isMartingaleName;
      } else {
        // For Members, ALL existing transactions are Personal.
        return activeTab === 'my';
      }

      // return activeTab === 'my' ? !isMartingaleTx : isMartingaleTx; // Old return removed
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const maskValue = (val: string | number) => isPrivacyMode ? '*******' : val;
  const isReadOnly = activeTab === 'martingale' && userRole !== 'admin';

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

      <AnnualDividendStatsModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        transactions={dividends}
        activeTab={activeTab}
        isPrivacyMode={isPrivacyMode}
      />

      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Card */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-purple-200 font-medium text-lg flex items-center gap-2 mb-1">
              <Coins className="w-5 h-5" /> {activeTab === 'my' ? '個人' : '馬丁'}累計實領股息
            </h3>
            <div className="text-4xl font-bold font-mono my-2">
              NT$ {maskValue(totalDividendsTWD.toLocaleString())}
            </div>
            <p className="text-sm text-purple-300 mt-2 opacity-80">
              * 已扣除預扣稅額之淨現金流
            </p>
          </div>
          <Coins className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-white opacity-10 rotate-12" />
        </div>

        {/* Year Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100 flex flex-col justify-center relative group">
          <h3 className="text-gray-500 font-medium text-lg flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-purple-500" /> {currentYear} 年度領息
          </h3>
          <div className="text-3xl font-bold font-mono text-gray-800">
            NT$ {maskValue(thisYearDividends.toLocaleString())}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
          </div>

          {/* History Button Overlay */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="absolute top-4 right-4 p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-full transition-all opacity-0 group-hover:opacity-100 active:opacity-100 focus:opacity-100"
            title="查看歷年統計"
          >
            <TrendingUp className="w-5 h-5" />
          </button>
        </div>

        {/* Action Card */}
        <div className={`bg-purple-50 rounded-2xl p-6 border border-purple-100 flex flex-col justify-center items-start gap-3 ${isReadOnly ? 'opacity-60 grayscale' : ''}`}>
          <h3 className="text-purple-800 font-bold text-lg flex items-center justify-between w-full">
            <span>股息管理</span>
            {!isReadOnly && dividends.length > 0 && (
              <button
                onClick={() => onReset(activeTab)}
                className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                title="清空目前分頁的所有股息紀錄"
              >
                清空紀錄
              </button>
            )}
          </h3>
          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              onClick={() => onScan(activeTab)}
              disabled={isReadOnly}
              className="py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 text-base"
            >
              <RefreshCw className="w-5 h-5" /> 自動掃描
            </button>
            <button
              onClick={() => onManualAdd(activeTab)}
              disabled={isReadOnly}
              className="py-3 bg-white border border-purple-200 hover:bg-purple-50 disabled:bg-gray-100 disabled:text-gray-400 text-purple-700 rounded-lg font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 text-base"
            >
              <Plus className="w-5 h-5" /> 手動新增
            </button>
          </div>
          <p className="text-sm text-purple-600 opacity-80">
            {isReadOnly ? '僅管理員可管理馬丁股息' : '建議先「自動掃描」，如無紀錄再「手動新增」'}
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-gray-700 flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              股息入帳明細
            </h2>
            <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
              <button
                onClick={() => setActiveTab('my')}
                className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${activeTab === 'my'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                我的帳本
              </button>
              <div className="w-[1px] bg-gray-200 mx-1"></div>
              <button
                onClick={() => setActiveTab('martingale')}
                className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${activeTab === 'martingale'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                馬丁帳本
              </button>
            </div>
          </div>

          <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded border">
            共 {dividends.length} 筆
          </span>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-base text-left">
            <thead className="text-sm text-gray-500 uppercase bg-gray-50 border-b">
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
                      <p>尚無{activeTab === 'my' ? '個人' : '馬丁'}股息紀錄{activeTab === 'my' && '，試試看「掃描」功能吧！'}</p>
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
                        <span className="text-sm text-gray-500">{tx.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-gray-100 text-gray-800">
                        {tx.categoryName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-500">
                      {maskValue(tx.amount.toLocaleString())}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-red-400 text-sm">
                      -{maskValue((tx.tax || 0).toLocaleString())}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-purple-700 font-bold font-mono text-lg">
                        +{maskValue(tx.realizedPnL!.toLocaleString())}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {!isReadOnly ? (
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
                      ) : (
                        <span className="text-gray-200 cursor-not-allowed" title="僅管理員可操作">
                          <Trash2 className="w-4 h-4" />
                        </span>
                      )}
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
