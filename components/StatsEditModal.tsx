import React, { useState, useEffect } from 'react';
import { StrategyStats } from '../types';
import { X, Save } from 'lucide-react';

interface StatsEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStats: StrategyStats | null;
    onSave: (stats: StrategyStats) => void;
}

const StatsEditModal: React.FC<StatsEditModalProps> = ({ isOpen, onClose, currentStats, onSave }) => {
    const [stats, setStats] = useState<StrategyStats>({
        totalReturn: 0,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        tradesCount: 0,
        winRateChange: 0,
        lastUpdated: Date.now(),
        // Override with props if available
        ...(currentStats || {}) as StrategyStats // This line ensures currentStats is merged if available, otherwise an empty object
    });

    useEffect(() => {
        if (currentStats) {
            setStats(currentStats);
        }
    }, [currentStats, isOpen]);

    const handleSave = () => {
        onSave({
            ...stats,
            lastUpdated: Date.now()
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">設定策略歷史績效 (Track Record)</h3>
                    <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded-full"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        在此輸入您的量化策略回測數據或歷史實盤績效。這些數據將顯示在儀表板頂部，建立使用者信心。
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">今年度勝率 (%)</label>
                            <input
                                type="number"
                                value={stats.winRate}
                                onChange={e => setStats({ ...stats, winRate: parseFloat(e.target.value) })}
                                max="100"
                                className="w-full p-2 border rounded font-mono font-bold text-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">勝率變動 (%)</label>
                            <input
                                type="number"
                                value={stats.winRateChange || 0}
                                onChange={e => setStats({ ...stats, winRateChange: parseFloat(e.target.value) })}
                                className="w-full p-2 border rounded font-mono text-sm"
                                placeholder="+2.1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">平均報酬 (%)</label>
                            <input
                                type="number"
                                value={stats.avgReturn}
                                onChange={e => setStats({ ...stats, avgReturn: parseFloat(e.target.value) })}
                                max="1000"
                                className="w-full p-2 border rounded font-mono font-bold text-lg text-indigo-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">標籤 (Label)</label>
                            <input
                                type="text"
                                value={stats.avgReturnLabel || ''}
                                onChange={e => setStats({ ...stats, avgReturnLabel: e.target.value })}
                                className="w-full p-2 border rounded text-sm"
                                placeholder="每筆交易"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">最大回撤 (%)</label>
                            <input
                                type="number"
                                value={stats.maxDrawdown}
                                onChange={e => setStats({ ...stats, maxDrawdown: parseFloat(e.target.value) })}
                                max="100"
                                className="w-full p-2 border rounded font-mono font-bold text-lg text-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">備註 (Note)</label>
                            <input
                                type="text"
                                value={stats.drawdownLabel || ''}
                                onChange={e => setStats({ ...stats, drawdownLabel: e.target.value })}
                                className="w-full p-2 border rounded text-sm"
                                placeholder="低風險策略"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button onClick={handleSave} className="bg-gray-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-black transition-all flex items-center gap-2 shadow-lg active:scale-95">
                        <Save className="w-4 h-4" /> 儲存設定
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StatsEditModal;
