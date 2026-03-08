import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowRightLeft, ArrowRightLeft as TransferIcon, Coins, AlertCircle, Info } from 'lucide-react';
import { CalculatedCategory } from '../types';
import { formatTWD } from '../utils/formatting';

interface CashTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceCategory: CalculatedCategory;
    allCategories: CalculatedCategory[];
    totalCapital: number;
    onTransfer: (fromId: string, toId: string, amount: number, mode: 'budget' | 'profit') => void;
    isPrivacyMode: boolean;
}

const CashTransferModal: React.FC<CashTransferModalProps> = ({
    isOpen,
    onClose,
    sourceCategory,
    allCategories,
    totalCapital,
    onTransfer,
    isPrivacyMode
}) => {
    const [targetId, setTargetId] = useState<string>('');
    const [amountStr, setAmountStr] = useState<string>('');
    const [transferMode, setTransferMode] = useState<'budget' | 'profit'>('budget');
    const [error, setError] = useState<string | null>(null);

    // Filter out source category only for budget mode
    const targetOptions = transferMode === 'budget'
        ? allCategories.filter(c => c.id !== sourceCategory.id)
        : allCategories;

    // Initialize amount to full remaining cash or profit
    useEffect(() => {
        if (isOpen) {
            const initialAmount = transferMode === 'budget'
                ? Math.max(0, sourceCategory.remainingCash)
                : Math.max(0, sourceCategory.availableProfit || 0);
            setAmountStr(initialAmount.toString());
            // Important: we depend on targetOptions which depends on transferMode
            if (!targetOptions.some(opt => opt.id === targetId)) {
                setTargetId(targetOptions.length > 0 ? targetOptions[0].id : '');
            }
            setError(null);
        }
    }, [isOpen, sourceCategory, transferMode, targetOptions, targetId]);

    const amount = parseFloat(amountStr) || 0;
    const currentMax = transferMode === 'budget'
        ? sourceCategory.remainingCash
        : (sourceCategory.availableProfit || 0);
    const amountPercentOfTotal = totalCapital > 0 ? (amount / totalCapital) * 100 : 0;

    const handleTransfer = () => {
        if (!targetId) {
            setError('請選擇目標倉位');
            return;
        }
        if (amount <= 0) {
            setError('請輸入有效的轉移金額');
            return;
        }
        if (amount > currentMax + 1) { // Add small buffer for rounding
            const label = transferMode === 'budget' ? '剩餘現金' : '已實現損益';
            setError(`轉移金額不能超過${label} (${formatTWD(currentMax, isPrivacyMode)})`);
            return;
        }

        onTransfer(sourceCategory.id, targetId, amount, transferMode);
        onClose();
    };

    if (!isOpen) return null;

    const targetCategory = targetOptions.find(c => c.id === targetId);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[210] p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden shadow-libao-gold/10">
                {/* Header */}
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-libao-gold/10 text-libao-gold">
                            <ArrowRightLeft className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">資金餘額轉移</h3>
                            <p className="text-xs text-slate-500 mt-0.5">將此倉位多餘的現金分配給其他倉位</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Transfer Mode Toggle */}
                    <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-xl">
                        <button
                            onClick={() => setTransferMode('budget')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${transferMode === 'budget' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Coins className="w-3.5 h-3.5" />
                            轉移剩餘預算
                        </button>
                        <button
                            onClick={() => setTransferMode('profit')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${transferMode === 'profit' ? 'bg-emerald-500/20 text-emerald-400 shadow-lg border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <TransferIcon className="w-3.5 h-3.5" />
                            再投入已實現損益
                        </button>
                    </div>

                    {/* Source Status */}
                    <div className={`rounded-xl p-4 border ${transferMode === 'budget' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">來源：{sourceCategory.name}</div>
                        <div className="flex justify-between items-center mb-1">
                            <div className="font-bold text-white text-lg">
                                {transferMode === 'budget' ? '預算餘額' : '可動用利潤餘額'}
                            </div>
                            <div className="text-right">
                                <div className={`font-mono font-bold text-lg ${transferMode === 'budget' ? 'text-emerald-400' : 'text-emerald-500'}`}>
                                    {formatTWD(currentMax, isPrivacyMode)}
                                </div>
                            </div>
                        </div>
                        {transferMode === 'profit' && (
                            <div className="text-[10px] text-emerald-500/80 font-mono tracking-widest text-right">
                                總已實現 {formatTWD(sourceCategory.realizedPnL || 0, isPrivacyMode)} - 已再投入 {formatTWD(sourceCategory.withdrawnProfit || 0, isPrivacyMode)}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center text-slate-600">
                        <ArrowRight className="w-6 h-6 rotate-90 sm:rotate-0" />
                    </div>

                    {/* Target Selection */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">轉移至目標倉位</label>
                            <select
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-libao-gold transition-colors appearance-none"
                            >
                                {targetOptions.map(c => (
                                    <option key={c.id} value={c.id} className={c.id === sourceCategory.id ? "text-emerald-400" : ""}>
                                        {c.name} {c.id === sourceCategory.id ? '(本倉位加碼)' : `(剩餘 ${formatTWD(c.remainingCash, isPrivacyMode)})`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">轉移金額 (TWD)</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Coins className="w-5 h-5 text-slate-600 group-focus-within:text-libao-gold transition-colors" />
                                </div>
                                <input
                                    type="number"
                                    value={amountStr}
                                    onChange={(e) => setAmountStr(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white font-mono font-bold text-lg focus:outline-none focus:border-libao-gold transition-colors"
                                    placeholder="0"
                                />
                            </div>
                            <div className="flex justify-between items-center px-1">
                                <div className="text-[10px] text-slate-500 italic">
                                    將轉移約 {amountPercentOfTotal.toFixed(3)}% 資金權重
                                </div>
                                <button
                                    onClick={() => setAmountStr(currentMax.toString())}
                                    className="text-[10px] font-bold text-libao-gold hover:text-yellow-300 transition-colors uppercase tracking-widest"
                                >
                                    全部轉移
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Simulation Info */}
                    {targetCategory && amount > 0 && !error && (
                        <div className={`border rounded-xl p-4 flex gap-3 ${transferMode === 'budget' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                            <Info className={`w-5 h-5 shrink-0 mt-0.5 ${transferMode === 'budget' ? 'text-blue-400' : 'text-emerald-400'}`} />
                            <div className={`text-xs leading-relaxed ${transferMode === 'budget' ? 'text-blue-200' : 'text-emerald-100'}`}>
                                {transferMode === 'budget' ? (
                                    <>執行後，<span className="text-white font-bold">{sourceCategory.name}</span> 的預計投入將下調，而 <span className="text-white font-bold">{targetCategory.name}</span> 將吸收這部分預算。</>
                                ) : (
                                    <>將複利投入：馬丁總資本將增加 <span className="font-bold">{formatTWD(amount, false)}</span>，所有倉位的百分比會重新計算以維持 <span className="text-white font-bold">{targetCategory.name}</span> 的新預算。</>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 text-red-400">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span className="text-xs font-bold">{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-800 bg-slate-900/50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 transition-colors"
                    >取消</button>
                    <button
                        onClick={handleTransfer}
                        className="flex-1 py-3 rounded-xl font-bold bg-libao-gold hover:bg-yellow-500 text-slate-900 shadow-lg shadow-libao-gold/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        確認轉移
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CashTransferModal;
