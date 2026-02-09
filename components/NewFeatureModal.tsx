import React from 'react';
import { X, Bitcoin, Zap, Shield, ArrowRight } from 'lucide-react';

interface NewFeatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDismiss: () => void;
}

const NewFeatureModal: React.FC<NewFeatureModalProps> = ({ isOpen, onClose, onDismiss }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative animate-in zoom-in-95 duration-300 border border-gray-100">

                {/* Background Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-yellow-500/10 to-orange-500/10 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8">
                    <div className="flex flex-col items-center text-center space-y-4">

                        {/* Icon */}
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 transform rotate-3">
                            <Bitcoin className="w-8 h-8 text-white" />
                        </div>

                        {/* Title */}
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                全新功能：虛擬貨幣支援
                            </h2>
                            <p className="text-sm text-indigo-600 font-bold mt-1">
                                Cryptocurrency Support Now Live!
                            </p>
                        </div>

                        {/* Content List */}
                        <div className="text-left bg-gray-50 rounded-xl p-5 w-full space-y-4 border border-gray-100">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 min-w-[20px]">
                                    <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
                                        <Bitcoin className="w-3 h-3 text-orange-600" />
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">支援美股倉位 (D/E倉)</h4>
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                        現在您可以在 D倉 或 E倉 直接搜尋並加入 <span className="font-mono font-bold text-gray-700">BTC-USD</span>, <span className="font-mono font-bold text-gray-700">ETH-USD</span> 等加密貨幣資產。
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 min-w-[20px]">
                                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Zap className="w-3 h-3 text-blue-600" />
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">高精度小數點計算</h4>
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                        針對單價較低的幣種 (如 DOGE)，系統已支援至小數點後 <span className="font-bold text-gray-800">6 位數</span> 的精確顯示與計算。
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="w-full flex flex-col gap-2">
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-bold shadow-lg shadow-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                            >
                                <span>開始體驗</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={onDismiss}
                                className="w-full py-2.5 bg-white hover:bg-gray-50 text-gray-500 rounded-xl font-bold text-sm transition-all border border-gray-200"
                            >
                                不再顯示
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewFeatureModal;
