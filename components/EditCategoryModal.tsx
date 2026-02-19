import React, { useState, useEffect } from 'react';
import { X, Check, Calculator, DollarSign, PieChart } from 'lucide-react';
import { CalculatedCategory } from '../types';
import { formatTWD } from '../utils/formatting';

interface EditCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    category: CalculatedCategory;
    totalCapital: number;
    onSave: (id: string, newName: string, newAllocation: number) => void;
    isPrivacyMode: boolean;
    isMartingale?: boolean;
    initialMode?: 'name' | 'allocation';
}

const EditCategoryModal: React.FC<EditCategoryModalProps> = ({
    isOpen,
    onClose,
    category,
    totalCapital,
    onSave,
    isPrivacyMode,
    isMartingale = false,
    initialMode = 'allocation'
}) => {
    const [name, setName] = useState(category.name);
    const [allocation, setAllocation] = useState(category.allocationPercent.toString());
    const [amount, setAmount] = useState(category.projectedInvestment.toString());
    const [mode, setMode] = useState<'percent' | 'amount'>('percent');

    // Reset state when category changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setName(category.name);
            setAllocation(category.allocationPercent.toString());
            setAmount(category.projectedInvestment.toString());
        }
    }, [isOpen, category]);

    // Handle Amount/Percent Sync
    const handleAllocationChange = (val: string) => {
        setAllocation(val);
        const num = parseFloat(val);
        if (!isNaN(num) && totalCapital > 0) {
            setAmount(Math.floor(totalCapital * (num / 100)).toString());
        } else {
            setAmount('');
        }
    };

    const handleAmountChange = (val: string) => {
        setAmount(val);
        const num = parseFloat(val);
        if (!isNaN(num) && totalCapital > 0) {
            const pct = (num / totalCapital) * 100;
            setAllocation(pct.toFixed(1)); // More precision for amount-based input
        } else {
            setAllocation('');
        }
    };

    const handleSave = () => {
        const numAlloc = parseFloat(allocation);
        if (name.trim() === '') {
            alert('請輸入倉位名稱');
            return;
        }
        if (isNaN(numAlloc) || numAlloc < 0) {
            alert('請輸入有效的配置比例');
            return;
        }
        onSave(category.id, name.trim(), numAlloc);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
                {/* Header - Unchanged */}
                <div className="p-4 sm:p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isMartingale ? 'bg-libao-gold/10 text-libao-gold' : 'bg-cyan-500/10 text-cyan-500'}`}>
                            <PieChart className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-tight">
                                {initialMode === 'name' ? '編輯倉位名稱' : '編輯資金配置'}
                            </h3>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                                {initialMode === 'name' ? '修改此倉位的顯示名稱' : '調整此倉位的資金分配比例或金額'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content - Made Scrollable */}
                <div className="p-5 space-y-5 overflow-y-auto max-h-[60vh] sm:max-h-none">
                    {/* Name Input */}
                    {initialMode === 'name' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">倉位名稱</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-cyan-500 transition-colors"
                                placeholder="例如：G倉、F倉..."
                            />
                            <div className="flex gap-2 mt-2">
                                <span className={`text-[10px] px-2 py-1 rounded border ${category.market === 'TW' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                    目前的市場: {category.market}
                                </span>
                            </div>
                            <p className="text-[10px] text-gray-600 px-1">
                                注意：修改名稱將會同步更新所有相關的歷史交易紀錄。
                            </p>
                        </div>
                    )}

                    {/* Allocation Input */}
                    {initialMode === 'allocation' && (
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">資金配置 ({totalCapital > 0 ? formatTWD(totalCapital, isPrivacyMode) : '-'})</label>

                                <div className="flex bg-gray-800 rounded-lg p-0.5">
                                    <button
                                        onClick={() => setMode('percent')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${mode === 'percent' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                                    >比例 %</button>
                                    <button
                                        onClick={() => setMode('amount')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${mode === 'amount' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                                    >金額 $</button>
                                </div>
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    {mode === 'percent' ? (
                                        <PieChart className="w-5 h-5 text-gray-600 group-focus-within:text-cyan-500 transition-colors" />
                                    ) : (
                                        <DollarSign className="w-5 h-5 text-gray-600 group-focus-within:text-cyan-500 transition-colors" />
                                    )}
                                </div>
                                <input
                                    type="number"
                                    inputMode={mode === 'percent' ? 'decimal' : 'numeric'}
                                    value={mode === 'percent' ? allocation : amount}
                                    onChange={(e) => mode === 'percent' ? handleAllocationChange(e.target.value) : handleAmountChange(e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-white font-mono font-bold text-lg focus:outline-none focus:border-cyan-500 transition-colors"
                                    placeholder="0"
                                />
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-500 font-bold text-sm">
                                    {mode === 'percent' ? '%' : 'TWD'}
                                </div>
                            </div>

                            <div className="flex justify-end px-1">
                                <div className="text-xs font-mono text-gray-500">
                                    {mode === 'percent'
                                        ? `約 ${totalCapital > 0 ? formatTWD(Math.floor(totalCapital * (parseFloat(allocation || '0') / 100)), isPrivacyMode) : '-'}`
                                        : `約 ${parseFloat(allocation || '0').toFixed(2)}%`
                                    }
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-gray-800 bg-gray-900/50 flex gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-800 transition-colors"
                    >取消</button>
                    <button
                        onClick={handleSave}
                        className={`flex-1 py-3 rounded-xl font-bold text-gray-900 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2
                            ${isMartingale ? 'bg-libao-gold hover:bg-yellow-500 shadow-libao-gold/20' : 'bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/20'}`}
                    >
                        <Check className="w-4 h-4" />
                        儲存變更
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditCategoryModal;
