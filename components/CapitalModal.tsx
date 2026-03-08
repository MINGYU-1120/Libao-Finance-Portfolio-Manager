
import React, { useState, useRef } from 'react';
import { X, DollarSign, Trash2, Calendar, FileText } from 'lucide-react';
import { CapitalLogEntry, CapitalType } from '../types';
import { useToast } from '../contexts/ToastContext';

interface CapitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  capitalLogs: CapitalLogEntry[];
  onAddLog: (entry: Omit<CapitalLogEntry, 'id'>) => void;
  onDeleteLog: (id: string) => void;
  isPrivacyMode: boolean;
  categories: { id: string, name: string }[];
  isMartingale?: boolean;
}

const CapitalModal: React.FC<CapitalModalProps> = ({
  isOpen,
  onClose,
  capitalLogs,
  onAddLog,
  onDeleteLog,
  isPrivacyMode,
  categories,
  isMartingale
}) => {
  const { showToast } = useToast();
  const [type, setType] = useState<CapitalType>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');

  const dateInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      showToast("請輸入有效的金額", 'error');
      return;
    }
    if (val > 100000000000000) {
      showToast("金額過大，請檢查是否輸入錯誤", 'error');
      return;
    }
    onAddLog({
      date: new Date(date).toISOString(),
      type,
      amount: val,
      note,
      targetCategoryId: targetCategoryId || undefined
    });
    setAmount('');
    setNote('');
    setTargetCategoryId('');
  };

  const handleDateIconClick = () => {
    try {
      if (dateInputRef.current) {
        if (typeof dateInputRef.current.showPicker === 'function') {
          dateInputRef.current.showPicker();
        } else {
          dateInputRef.current.focus();
        }
      }
    } catch (e) {
      console.warn('DatePicker open failed', e);
      dateInputRef.current?.focus();
    }
  };

  const sortedLogs = [...capitalLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const maskValue = (val: string | number) => isPrivacyMode ? '*******' : val;

  const totalCapital = capitalLogs.reduce((sum, log) => {
    if (log.type === 'DEPOSIT') return sum + log.amount;
    if (log.type === 'WITHDRAW') return sum - log.amount;
    return sum; // Ignore TRANSFER/ADJUST in external capital sum
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-gray-800 p-4 text-white flex justify-between items-center rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            資金管理 (Capital Management)
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
          {/* Left: Action Panel */}
          <div className="p-6 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-1/2 flex flex-col gap-4 overflow-y-auto">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-2">
              <div className="text-gray-500 text-xs font-medium mb-1">當前總投入本金</div>
              <div className="text-2xl font-mono font-bold text-gray-800">
                NT$ {maskValue(totalCapital.toLocaleString())}
              </div>
            </div>

            <div className="flex bg-gray-200 p-1 rounded-lg">
              <button
                onClick={() => setType('DEPOSIT')}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${type === 'DEPOSIT' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500'}`}
              >
                入金 (Deposit)
              </button>
              <button
                onClick={() => setType('WITHDRAW')}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${type === 'WITHDRAW' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
              >
                出金 (Withdraw)
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">日期</label>
                <div className="relative">
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2 pl-3 pr-10 border border-gray-300 rounded-lg bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm cursor-pointer text-gray-700"
                  />
                  <Calendar
                    onClick={handleDateIconClick}
                    className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer hover:text-blue-600 transition-colors z-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">金額 (TWD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max="100000000000000"
                  placeholder="請輸入金額"
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold font-mono"
                />
              </div>

              {type === 'DEPOSIT' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">資金分配至</label>
                  <select
                    value={targetCategoryId}
                    onChange={(e) => setTargetCategoryId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
                  >
                    <option value="">(不指定) 均分至所有倉位</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">備註 (選填)</label>
                <div className="relative">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="例如：年終獎金投入、急用提領"
                    className="w-full p-2 pl-9 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                className={`w-full py-3 mt-2 rounded-lg text-white font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${type === 'DEPOSIT' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                確認{type === 'DEPOSIT' ? '入金' : '出金'}
              </button>
            </div>
          </div>

          {/* Right: Log List */}
          <div className="w-full md:w-1/2 bg-white flex flex-col">
            <div className="p-3 border-b bg-gray-50 font-bold text-gray-700 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" /> 資金變動紀錄
            </div>
            <div className="flex-1 overflow-y-auto">
              {sortedLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm p-6">
                  <DollarSign className="w-12 h-12 opacity-20 mb-2" />
                  尚無資金紀錄
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <tbody className="divide-y divide-gray-100">
                    {sortedLogs.map(log => {
                      const targetCat = log.targetCategoryId ? categories.find(c => c.id === log.targetCategoryId) : null;
                      const sourceCat = log.sourceCategoryId ? categories.find(c => c.id === log.sourceCategoryId) : null;
                      return (
                        <tr key={log.id} className="hover:bg-gray-50 group border-b border-gray-50 last:border-0">
                          <td className="p-3 align-top">
                            <div className="flex items-start gap-2">
                              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs ${log.type === 'DEPOSIT' ? 'bg-red-100 text-red-700' :
                                log.type === 'WITHDRAW' ? 'bg-green-100 text-green-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                {log.type === 'DEPOSIT' ? '入' : log.type === 'WITHDRAW' ? '出' : '轉'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-gray-800 text-xs">
                                  {log.type === 'DEPOSIT' ? '入金' : log.type === 'WITHDRAW' ? '出金' : '預算轉移'}
                                  {(targetCat || sourceCat) && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {sourceCat && (
                                        <span className="text-gray-500 bg-gray-100 px-1 rounded-[4px] text-[10px] font-normal">
                                          從 {sourceCat.name}
                                        </span>
                                      )}
                                      {targetCat && (
                                        <span className="text-libao-gold bg-gray-800 px-1 rounded-[4px] text-[10px] font-normal">
                                          {log.type === 'TRANSFER' ? '至 ' : '→ '}{targetCat.name}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(log.date).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 align-top min-w-[120px]">
                            <div className="text-gray-600 text-[11px] leading-relaxed break-words whitespace-normal">
                              {log.note || <span className="text-gray-300">-</span>}
                            </div>
                          </td>
                          <td className="p-3 align-top text-right">
                            <div className={`font-mono font-bold text-sm ${log.type === 'DEPOSIT' ? 'text-red-600' :
                              log.type === 'WITHDRAW' ? 'text-green-600' :
                                'text-blue-600'
                              }`}>
                              {log.type === 'DEPOSIT' ? '+' : log.type === 'WITHDRAW' ? '-' : '⇄'}{maskValue(log.amount.toLocaleString())}
                            </div>
                            <button
                              onClick={() => onDeleteLog(log.id)}
                              className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all ml-auto block mt-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CapitalModal;
