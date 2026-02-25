import React, { useState, useEffect } from 'react';
import { Bell, X, ShieldCheck } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { subscribeToPushNotifications } from '../services/firebase';
import { useUserRoles } from './auth/useUserRoles';

interface PushPromptModalProps {
    onClose: () => void;
}

const PushPromptModal: React.FC<PushPromptModalProps> = ({ onClose }) => {
    const { showToast } = useToast();
    const { user } = useUserRoles();
    const [isRequesting, setIsRequesting] = useState(false);

    // Check if we should even show this
    useEffect(() => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            onClose(); // Browser doesn't support push
            return;
        }

        if (Notification.permission === 'granted' || Notification.permission === 'denied') {
            onClose(); // Already asked
            return;
        }
    }, [onClose]);

    const handleEnable = async () => {
        setIsRequesting(true);
        try {
            const success = await subscribeToPushNotifications(user?.uid || null);
            if (success) {
                showToast('已成功開啟推播通知！', 'success');
                localStorage.setItem('libao_push_prompt_dismissed', 'true');
                onClose();
            } else {
                showToast('您取消了授權或瀏覽器不支援', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('設定推播失敗，請稍後再試', 'error');
        } finally {
            setIsRequesting(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem('libao_push_prompt_dismissed', 'true');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-[#121212] rounded-2xl border border-gray-800 p-6 max-w-sm w-full mx-auto relative shadow-2xl overflow-hidden">
                {/* 動態背景光暈 */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center pt-1 ring-1 ring-blue-500/30">
                        <Bell className="w-8 h-8 text-blue-400" />
                    </div>
                </div>

                <h2 className="text-xl font-bold text-white text-center mb-2 tracking-wide font-['Outfit']">
                    開啟即時交易通知
                </h2>

                <p className="text-gray-400 text-center text-sm mb-6 leading-relaxed">
                    零延遲掌握策略調倉與市場訊號。我們承諾絕不發送廣告，只傳遞最重要的資金動態。
                </p>

                <div className="bg-gray-800/50 rounded-lg p-3 mb-8 flex items-center gap-3 border border-gray-700/50">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-gray-300">系統將常駐加密連線，確保通知安全送達您的裝置</span>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleEnable}
                        disabled={isRequesting}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50"
                    >
                        {isRequesting ? '設定中...' : '立即開啟推播'}
                    </button>

                    <button
                        onClick={handleDismiss}
                        disabled={isRequesting}
                        className="w-full bg-transparent text-gray-500 hover:text-gray-300 font-medium py-2 px-4 rounded-xl transition-all text-sm"
                    >
                        稍後再說
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PushPromptModal;
