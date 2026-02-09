
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface AddCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (name: string, market: 'TW' | 'US', allocation: number) => void;
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [name, setName] = useState('');
    const [market, setMarket] = useState<'TW' | 'US'>('TW');
    const [allocation, setAllocation] = useState<string>('0');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('請輸入策略名稱');
            return;
        }
        const allocVal = parseFloat(allocation);
        if (isNaN(allocVal) || allocVal < 0) {
            alert('請輸入有效的資金佔比');
            return;
        }
        if (allocVal > 100) {
            alert('資金佔比不能超過 100%');
            return;
        }
        onConfirm(name.trim(), market, allocVal);
        // Reset form
        setName('');
        setMarket('TW');
        setAllocation('0');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">新增策略倉位</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">策略名稱 (Strategy Name)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例如：紅標策略 F 倉"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">市場 (Market)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setMarket('TW')}
                                className={`py-3 rounded-xl border-2 font-bold transition-all ${market === 'TW' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 hover:border-gray-300 text-gray-400'}`}
                            >
                                TW 台股
                            </button>
                            <button
                                type="button"
                                onClick={() => setMarket('US')}
                                className={`py-3 rounded-xl border-2 font-bold transition-all ${market === 'US' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 hover:border-gray-300 text-gray-400'}`}
                            >
                                US 美股
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">預設資金佔比 (Allocation %)</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={allocation}
                                onChange={(e) => setAllocation(e.target.value)}
                                min="0"
                                max="100"
                                step="0.1"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono font-bold text-lg"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                        </div>
                        <p className="text-xs text-gray-400">設定此策略佔「學院總資金」的百分比。</p>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 px-4 bg-libao-gold text-white rounded-xl font-bold hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-200 flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            確認新增
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddCategoryModal;
