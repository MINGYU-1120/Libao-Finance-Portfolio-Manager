
import React, { useState } from 'react';
import { X, Mail, Check, AlertCircle, Loader2, Lock, ArrowRight, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react';
import { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, handleAccountConflict, syncUserProfile } from '../services/firebase';

interface LoginModalProps {
    onClose: () => void;
    isOpen: boolean;
    initialMode?: 'default' | 'confirm-email';
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, isOpen }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMSG, setErrorMSG] = useState('');
    const [successMSG, setSuccessMSG] = useState('');
    const [isForgotPassword, setIsForgotPassword] = useState(false);

    // Reset state when isOpen changes
    React.useEffect(() => {
        if (isOpen) {
            setErrorMSG('');
            setSuccessMSG('');
            setPassword('');
            setConfirmPassword('');
            setShowPassword(false);
            setLoading(false);
        }
    }, [isOpen]);

    const handleGoogle = async () => {
        setLoading(true);
        setErrorMSG('');
        try {
            const user = await loginWithGoogle();
            if (user) {
                await syncUserProfile(user);
                onClose();
            }
        } catch (e: any) {
            console.error("Login Error:", e);
            const conflict = await handleAccountConflict(e);
            if (conflict && conflict.isConflict) {
                setErrorMSG(`您之前使用 ${conflict.existingMethods.join(', ')} 登入過此 Email。請使用該方式登入以連結帳號。`);
            } else {
                setErrorMSG(e.message || "登入失敗");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setErrorMSG('');
        setSuccessMSG('');

        try {
            if (isForgotPassword) {
                await resetPassword(email);
                setSuccessMSG(`重設密碼信件已發送至 ${email}，請檢查信箱。`);
                setIsForgotPassword(false);
            } else if (isRegister) {
                if (password.length < 6) {
                    throw new Error("密碼長度至少需 6 個字元");
                }
                if (password !== confirmPassword) {
                    throw new Error("兩次輸入的密碼不一致");
                }
                const user = await registerWithEmail(email, password);
                if (user) {
                    await syncUserProfile(user);
                    onClose();
                }
            } else {
                const user = await loginWithEmail(email, password);
                if (user) {
                    // Sync profile (updates last active)
                    await syncUserProfile(user);
                    onClose();
                }
            }
        } catch (e: any) {
            console.error("Auth Error:", e);
            let msg = e.message;
            if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
                msg = "帳號或密碼錯誤";
            } else if (e.code === 'auth/email-already-in-use') {
                msg = "此 Email 已被註冊，請直接登入";
            } else if (e.code === 'auth/weak-password') {
                msg = "密碼強度不足 (至少 6 碼)";
            } else if (e.code === 'auth/too-many-requests') {
                msg = "登入嘗試次數過多，請稍後再試";
            }
            setErrorMSG(msg || "驗證失敗，請稍後再試");
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
                <div className="p-8 pt-10 space-y-6">

                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                            {isForgotPassword ? '重設密碼' : isRegister ? '註冊帳號' : '歡迎回來'}
                        </h2>
                        <p className="text-slate-500 text-sm">
                            {isForgotPassword ? '輸入您的 Email 以接收重設連結' :
                                isRegister ? '建立您的專屬投資組合' :
                                    '登入以繼續您的投資旅程'}
                        </p>
                    </div>

                    {/* Google Login (Only in Login/Register mode) */}
                    {!isForgotPassword && (
                        <>
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
                                <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 z-10 font-medium">或使用 Email 登入</span>
                                <div className="absolute inset-0 flex items-center -z-0">
                                    <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Email/Password Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        disabled={loading}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            {!isForgotPassword && (
                                <>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Password</label>
                                            {!isRegister && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsForgotPassword(true)}
                                                    className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                                                >
                                                    忘記密碼?
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                disabled={loading}
                                                minLength={6}
                                                className="w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {isRegister && (
                                        <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Confirm Password</label>
                                            <div className="relative">
                                                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    required
                                                    placeholder="Confirm password"
                                                    value={confirmPassword}
                                                    onChange={e => setConfirmPassword(e.target.value)}
                                                    disabled={loading}
                                                    minLength={6}
                                                    className="w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Reminder Text */}
                        <div className={`p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/30 flex gap-2 items-start ${isForgotPassword ? 'hidden' : ''}`}>
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                請使用與 <strong>Libao 財經學院</strong> 一致的 Email，以便後台審核您的權限。
                            </p>
                        </div>

                        {errorMSG && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2 border border-red-100 dark:border-red-900/30 animate-in slide-in-from-top-1">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="leading-snug">{errorMSG}</span>
                            </div>
                        )}

                        {successMSG && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg flex items-start gap-2 border border-green-100 dark:border-green-900/30 animate-in slide-in-from-top-1">
                                <Check className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="leading-snug">{successMSG}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 mt-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isForgotPassword ? (
                                <>
                                    <Mail className="w-5 h-5" />
                                    <span>發送重設連結</span>
                                </>
                            ) : isRegister ? (
                                <>
                                    <UserPlus className="w-5 h-5" />
                                    <span>建立新帳號</span>
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    <span>登入帳號</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Toggle */}
                    <div className="text-center">
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => {
                                if (isForgotPassword) {
                                    setIsForgotPassword(false);
                                } else {
                                    setIsRegister(!isRegister);
                                }
                                setErrorMSG('');
                                setSuccessMSG('');
                            }}
                            className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-medium inline-flex items-center gap-1 group"
                        >
                            {isForgotPassword ? (
                                <>返回登入畫面</>
                            ) : isRegister ? (
                                <>已有帳號？ <span className="text-blue-500 group-hover:underline">立即登入</span></>
                            ) : (
                                <>還沒有帳號？ <span className="text-blue-500 group-hover:underline">免費註冊</span></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
