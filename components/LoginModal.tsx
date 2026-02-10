
import React, { useState } from 'react';
import { X, Mail, Check, AlertCircle, Loader2 } from 'lucide-react';
import { loginWithGoogle, sendMagicLink, handleAccountConflict } from '../services/firebase';

interface LoginModalProps {
    onClose: () => void;
    isOpen: boolean;
    initialMode?: 'default' | 'confirm-email';
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, isOpen, initialMode = 'default' }) => {
    const [mode, setMode] = useState<'default' | 'confirm-email'>(initialMode);

    // Reset mode when isOpen changes
    React.useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
        }
    }, [isOpen, initialMode]);
    const [email, setEmail] = useState('');
    const [isSent, setIsSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMSG, setErrorMSG] = useState('');
    const [linkInfo, setLinkInfo] = useState<{ email: string } | null>(null);
    const [countdown, setCountdown] = useState(0);

    // Moved early return to JSX render to prevent hook mismatch
    // if (!isOpen) return null;

    const handleGoogle = async () => {
        setLoading(true);
        setErrorMSG('');
        setLinkInfo(null);
        try {
            await loginWithGoogle();
            // Redirect handling is in App.tsx
            onClose();
        } catch (e: any) {
            console.error("Login Error:", e);
            // Check for account linking requirement
            const conflict = await handleAccountConflict(e);
            if (conflict && conflict.isConflict) {
                setErrorMSG(`您之前使用 ${conflict.existingMethods.join(', ')} 登入過此 Email。請使用該方式登入以連結帳號。`);
                // Here we could auto-trigger email link flow if existing method is emailLink
                if (conflict.existingMethods.includes('emailLink')) {
                    setLinkInfo({ email: conflict.email });
                    setErrorMSG(`檢測到您之前使用 Email Link 登入過 (${conflict.email})。請點擊下方按鈕發送連結以合併帳號。`);
                    setEmail(conflict.email);
                }
            } else {
                setErrorMSG(e.message || "登入失敗");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEmailLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setErrorMSG('');
        try {
            await sendMagicLink(email);
            setIsSent(true);
        } catch (e: any) {
            console.error("Send Link Error:", e);
            setErrorMSG(e.message || "發送失敗，請稍後再試");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setErrorMSG('');
        try {
            // Validate email again or just pass to finish
            const { checkAndFinishEmailLogin } = await import('../services/firebase');
            await checkAndFinishEmailLogin(email);
            // checkAndFinishEmailLogin handles the sign in. If successful, auth state changes and App handles it.
            // If it throws, we catch it here.
            onClose();
        } catch (e: any) {
            console.error("Confirm Email Error:", e);
            setErrorMSG(e.message || "驗證失敗，請確認 Email 是否正確");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleResend = async () => {
        if (countdown > 0 || !email) return;
        setLoading(true);
        try {
            await sendMagicLink(email);
            setCountdown(60); // 60s cool down
            setErrorMSG('');
        } catch (e: any) {
            setErrorMSG("發送失敗，請稍後再試");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 relative scale-100 transition-all">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10"
                >
                    <X className="w-5 h-5 text-slate-500" />
                </button>

                {/* Content */}
                <div className="p-8 pt-10 space-y-8">

                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">歡迎回來</h2>
                        <p className="text-slate-500 text-sm">請選擇您習慣的登入方式</p>
                    </div>

                    {!isSent ? (
                        <div className="space-y-6">
                            {/* Google Login */}
                            <button
                                onClick={handleGoogle}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-300 dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] shadow-sm"
                            >
                                {loading && !email ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        <span>使用 Google 繼續</span>
                                    </>
                                )}
                            </button>

                            <div className="relative flex justify-center text-xs">
                                <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 z-10 font-medium">學員登入 (Email)</span>
                                <div className="absolute inset-0 flex items-center -z-0">
                                    <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                                </div>
                            </div>

                            {/* Email Link Form */}
                            <form onSubmit={handleEmailLink} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">電子信箱</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        disabled={loading}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
                                >
                                    {loading && email ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                    <span>發送登入連結</span>
                                </button>
                            </form>
                        </div>
                    ) : mode === 'default' && isSent ? (
                        <div className="text-center py-6 animate-in fade-in zoom-in duration-300">
                            <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-3">請檢查您的信箱</h4>
                            <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed text-sm">
                                我們已發送登入連結至<br />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{email}</span>
                            </p>

                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-left text-sm text-amber-800 dark:text-amber-200 mb-6 border border-amber-100 dark:border-amber-900/30">
                                <p className="font-bold mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> 沒收到信件？
                                </p>
                                <ul className="list-disc pl-5 space-y-1 opacity-90">
                                    <li>請檢查 <strong>垃圾郵件</strong> 或 <strong>促銷內容</strong> 資料夾</li>
                                    <li>若被歸類為垃圾郵件，請務必先點選 <strong>「回報為非垃圾郵件」</strong>，連結才會生效</li>
                                    <li>搜尋關鍵字：<strong>Libao</strong> 或 <strong>noreply</strong></li>
                                </ul>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={onClose}
                                    className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white font-medium py-3.5 rounded-xl transition-colors shadow-lg shadow-slate-200/50 dark:shadow-none"
                                >
                                    完成，我已點擊連結
                                </button>
                                <button
                                    onClick={handleResend}
                                    disabled={countdown > 0 || loading}
                                    className="w-full text-slate-500 hover:text-slate-700 dark:text-slate-400 text-sm py-2 disabled:opacity-50"
                                >
                                    {countdown > 0 ? `重新發送 (${countdown}s)` : "沒收到？重新發送"}
                                </button>
                                <button
                                    onClick={() => { setIsSent(false); setCountdown(0); }}
                                    className="w-full text-slate-400 hover:text-slate-600 dark:text-slate-500 text-xs py-1"
                                >
                                    更換 Email
                                </button>
                            </div>
                        </div>
                    ) : mode === 'confirm-email' ? (
                        /* Manual Email Confirmation Mode */
                        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                                    <span className="font-bold block mb-1">為了確保帳號安全</span>
                                    請再次確認您剛剛點擊連結的 Email 信箱。
                                </p>
                            </div>

                            <form onSubmit={handleConfirmEmail} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">確認 Email</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        disabled={loading}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    <span>驗證並登入</span>
                                </button>
                            </form>
                        </div>
                    ) : null /* Fallback for unexpected mode/state */}

                    {errorMSG && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-start gap-3 border border-red-100 dark:border-red-900/30">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span className="leading-snug">{errorMSG}</span>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default LoginModal;
