
import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, DollarSign, Info } from 'lucide-react';
import { CalculatedCategory } from '../types';
import { formatTWD } from '../utils/formatting';

interface CashTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: CalculatedCategory[];
    sourceCategory: CalculatedCategory | null;
    onTransfer: (fromId: string, toId: string, amount: number, mode: 'budget' | 'profit') => void;
    isPrivacyMode: boolean;
}

const CashTransferModal: React.FC<CashTransferModalProps> = ({
    isOpen,
    onClose,
    categories,
    sourceCategory,
    onTransfer,
    isPrivacyMode
}) => {
    const [amount, setAmount] = useState('');
    const [targetCategoryId, setTargetCategoryId] = useState('');
    const [mode, setMode] = useState<'budget' | 'profit'>('budget');

    // Reset when modal opens or source changes
    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setTargetCategoryId('');
            setMode('budget');
        }
    }, [isOpen]);

    if (!isOpen || !sourceCategory) return null;

    const availableTargets = categories.filter(c => c.id !== sourceCategory.id);

    // Safety check: if no target selected, set the first one as default
    if (availableTargets.length > 0 && !targetCategoryId) {
        setTargetCategoryId(availableTargets[0].id);
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) return;
        if (!targetCategoryId) return;

        onTransfer(sourceCategory.id, targetCategoryId, val, mode);
        onClose();
    };

    const maskValue = (val: string | number) => isPrivacyMode ? '*******' : val;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="font-bold text-slate-100">資金轉移</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Source Info */}
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">轉出倉位</div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-200">{sourceCategory.name}</span>
                            <span className="text-xs font-mono text-slate-400">
                                現金: NT$ {maskValue(formatTWD(sourceCategory.remainingCash))}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center -my-2 opacity-30">
                        <ArrowRightLeft className="w-6 h-6 text-slate-500 rotate-90" />
                    </div>

                    {/* Target Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">轉入目標倉位</label>
                        <select
                            value={targetCategoryId}
                            onChange={(e) => setTargetCategoryId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            required
                        >
                            {availableTargets.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Amount Input */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">轉移金額 (TWD)</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">NT$</div>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-xl font-mono font-bold text-slate-100 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                required
                                min="1"
                                max={sourceCategory.remainingCash}
                            />
                        </div>
                    </div>

                    {/* Transfer Mode */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setMode('budget')}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${mode === 'budget' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            預算轉移 (調整%)
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('profit')}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${mode === 'profit' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            獲利提取
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={!amount || !targetCategoryId}
                            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                        >
                            確認轉移
                        </button>
                    </div>

                    {/* Helper Info */}
                    {mode === 'budget' && (
                        <div className="flex gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-slate-400 leading-normal">
                                <b>預算轉移</b> 會連同策略的「配置百分比 %」一併調整，適合用於倉位間的資源重新分配。
                            </p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default CashTransferModal;
