import React from 'react';
import { useUserRoles } from './useUserRoles';
import { Loader2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Assuming you might use react-router in future, but currently this is conditional render in App.tsx

interface RequireRoleProps {
    role: 'member' | 'first_class';
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ role, children, fallback }) => {
    const { loading, hasRole, isMember, isFirstClass, user } = useUserRoles();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-gray-500 text-sm">正在驗證會員權限...</p>
            </div>
        );
    }

    const hasPermission = role === 'first_class' ? isFirstClass : isMember;

    if (!hasPermission) {
        if (fallback) return <>{fallback}</>;

        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <Lock className="w-8 h-8 text-red-500" />
                </div>
                <div className="space-y-2 max-w-md">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {user ? "權限不足" : "請先登入"}
                    </h2>
                    <p className="text-gray-600">
                        {user
                            ? "抱歉，您的帳號尚未開通此區域的存取權限。如果您剛完成購買，請稍候片刻或重新整理。"
                            : "此為會員專屬內容，請先登入以繼續訪問。"}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
                    {!user ? (
                        // This usually triggers the login modal in App.tsx
                        // Since this component is inside App, we might need a way to open login.
                        // For now, simple text or redirect.
                        <button
                            onClick={() => window.location.href = '/login'} // Or trigger your modal context
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            前往登入
                        </button>
                    ) : (
                        <a
                            href="https://kajabi.com/your-sales-page" // TODO: REPLACE WITH REAL URL
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-medium transition-all shadow-lg shadow-orange-500/20 text-center"
                        >
                            前往課程購買
                        </a>
                    )}
                </div>
                {user && (
                    <p className="text-xs text-gray-400 mt-4">
                        目前帳號: {user.email} <br />
                        Kajabi 系統同步可能需要 1-3 分鐘
                    </p>
                )}
            </div>
        );
    }

    return <>{children}</>;
};
