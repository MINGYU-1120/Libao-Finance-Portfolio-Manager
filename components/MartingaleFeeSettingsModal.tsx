import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, Info } from 'lucide-react';
import { MartingaleFeeSettings } from '../types';
import { useToast } from '../contexts/ToastContext';

interface MartingaleFeeSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: MartingaleFeeSettings;
    onUpdateSettings: (newSettings: MartingaleFeeSettings) => void;
}

const MartingaleFeeSettingsModal: React.FC<MartingaleFeeSettingsModalProps> = ({
    isOpen,
    onClose,
    settings,
    onUpdateSettings
}) => {
    const { showToast } = useToast();
    const [enableFees, setEnableFees] = useState(settings.enableFees ?? true);
    const [usBroker, setUsBroker] = useState(settings.usBroker || 'Firstrade');
    const [twDiscount, setTwDiscount] = useState(settings.twFeeDiscount?.toString() || '6');

    useEffect(() => {
        if (isOpen) {
            setEnableFees(settings.enableFees ?? true);
            setUsBroker(settings.usBroker || 'Firstrade');
            setTwDiscount(settings.twFeeDiscount?.toString() || '6');
        }
    }, [isOpen, settings]);

    if (!isOpen) return null;

    const handleSave = () => {
        const numTwDiscount = parseFloat(twDiscount);
        onUpdateSettings({
            enableFees,
            usBroker,
            twFeeDiscount: isNaN(numTwDiscount) ? 6 : numTwDiscount
        });
        showToast("馬丁策略手續費設定已儲存", "success");
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header - 使用深藍金色主題以區別於全域設定的紫色 */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <Calculator className="w-5 h-5 text-yellow-400" /> 馬丁策略手續費設定
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X className="w-6 h-6" /></button>
                </div>

                <div className="p-6 space-y-6">
                    {/* 提示訊息 */}
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                        <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                        <span>此處設定僅影響<strong>馬丁策略</strong>的下單手續費計算，不影響個人組合。</span>
                    </div>

                    {/* 啟用開關 */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <label className="text-sm font-bold text-slate-800">啟用手續費自動計算</label>
                            <p className="text-[10px] text-slate-500">馬丁下單時自動帶入預設費率</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={enableFees}
                            onChange={(e) => setEnableFees(e.target.checked)}
                            className="w-6 h-6 rounded border-gray-300 text-slate-700 focus:ring-slate-500 cursor-pointer"
                        />
                    </div>

                    {enableFees && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                            {/* 台股設定 */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">台股 (TW Stock)</h3>
                                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                                    <label className="text-sm font-medium text-gray-700">電子下單手續費折扣</label>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={twDiscount}
                                            onChange={(e) => setTwDiscount(e.target.value)}
                                            max="10"
                                            className="w-16 text-center text-sm font-bold p-2 border border-gray-200 bg-gray-50/50 rounded focus:bg-white focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                                        />
                                        <span className="text-sm font-bold text-gray-500">折</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-1.5 px-1">
                                    <Info className="w-3 h-3 text-gray-400 mt-0.5" />
                                    <p className="text-[10px] text-gray-400">系統將以 0.1425% 為基準計算折扣後的費用。</p>
                                </div>
                            </div>

                            {/* 美股設定 */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">美股 (US Stock)</h3>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
                                    <span className="text-sm font-medium text-gray-700 block">預設美股券商</span>
                                    <div className="grid grid-cols-1 gap-2">
                                        {['Firstrade', 'IBKR', 'Sub-brokerage'].map((broker) => (
                                            <label key={broker} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${usBroker === broker ? 'border-slate-600 bg-slate-50 ring-1 ring-slate-600' : 'border-gray-100 hover:bg-gray-50'}`}>
                                                <input
                                                    type="radio"
                                                    name="martingale-usBroker"
                                                    value={broker}
                                                    checked={usBroker === broker}
                                                    onChange={() => setUsBroker(broker as any)}
                                                    className="text-slate-600 focus:ring-slate-500"
                                                />
                                                <span className={`text-sm font-bold ${usBroker === broker ? 'text-slate-700' : 'text-gray-600'}`}>
                                                    {broker === 'Firstrade' ? 'Firstrade (免佣金)' :
                                                        broker === 'IBKR' ? 'IBKR (階梯式)' : '複委託 (TW Sub-brokerage)'}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 shadow-lg shadow-slate-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <Save className="w-4 h-4" /> 儲存馬丁策略費率設定
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MartingaleFeeSettingsModal;
