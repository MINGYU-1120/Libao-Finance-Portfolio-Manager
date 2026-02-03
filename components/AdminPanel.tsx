import React, { useState, useEffect } from 'react';
import { db, updateUserRole, getAllUsers, getAllSectionMinTiers, updateSectionMinTier, logAdminAction, getAuditLogs } from '../services/firebase';
import { UserProfile, UserRole, AccessTier, AuditLog } from '../types';
import { Shield, User, Clock, Search, Filter, AlertTriangle, CheckCircle, X, FileText, Activity } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface AdminPanelProps {
    isOpen: boolean;
    currentUser: UserProfile | any; // Allow lax typing to support Firebase User object
    onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, currentUser, onClose }) => {
    const { showToast } = useToast();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);

    // Permission State
    const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'logs'>('users');
    const [permissionMatrix, setPermissionMatrix] = useState<Record<string, AccessTier>>({});
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load Users
            const userList = await getAllUsers();
            setUsers(userList.sort((a, b) => b.lastActive - a.lastActive));

            // Load Permissions
            const perms = await getAllSectionMinTiers();
            // Ensure defaults exist for known sections if missing
            const defaults: Record<string, AccessTier> = {
                'market_insider': AccessTier.ADMIN,
                'ai_picks': AccessTier.STANDARD,
                'martingale': AccessTier.STANDARD,
            };
            setPermissionMatrix({ ...defaults, ...perms });

            // Load Logs
            const logs = await getAuditLogs(50);
            setAuditLogs(logs);
        } catch (e) {
            console.error("Failed to load admin data", e);
            showToast("無法載入管理員資料", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = async (targetUid: string, newRole: UserRole) => {
        if (!currentUser || targetUid === currentUser.uid) {
            showToast("為了安全起見，您不能更改自己的管理員權限", "error");
            return;
        }

        try {
            setEditingUserId(targetUid);
            await updateUserRole(targetUid, newRole);

            // Update local state
            setUsers(prev => prev.map(u =>
                u.uid === targetUid ? { ...u, role: newRole } : u
            ));

            await logAdminAction(
                "UPDATE_USER_ROLE",
                targetUid,
                `Updated role to ${newRole}`,
                currentUser.email
            );

            // Reload logs to show new action
            getAuditLogs().then(setAuditLogs);

            showToast("權限已更新", "success");
        } catch (error) {
            showToast("更新失敗，請檢查網路或是權限", "error");
            console.error(error);
        } finally {
            setEditingUserId(null);
        }
    };

    const handleChangeMinTier = async (sectionKey: string, tier: AccessTier) => {
        // Optimistic update
        const originalTier = permissionMatrix[sectionKey];
        setPermissionMatrix(prev => ({
            ...prev,
            [sectionKey]: tier
        }));

        try {
            await updateSectionMinTier(sectionKey, tier);

            await logAdminAction(
                "UPDATE_SECTION_TIER",
                sectionKey,
                `Updated ${sectionKey} tier requirement to ${tier}`,
                currentUser.email
            );

            // Reload logs
            getAuditLogs().then(setAuditLogs);

            showToast(`已更新板塊權限等級`, "success");
        } catch (error) {
            showToast("更新板塊權限失敗", "error");
            console.error("Failed to update section min tier", error);
            // Revert optimistic update
            setPermissionMatrix(prev => ({
                ...prev,
                [sectionKey]: originalTier
            }));
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('zh-TW', { hour12: false });
    };

    if (!isOpen) return null;
    if (!currentUser) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 z-50 overflow-y-auto animate-in fade-in duration-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-xl md:text-3xl font-black text-white flex items-center gap-3">
                            <Shield className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
                            管理員控制台 <span className="hidden sm:inline">(Admin Dashboard)</span>
                        </h1>
                        <p className="text-gray-400 mt-2">管理系統使用者與權限分配</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-8 h-8" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex space-x-4 mb-6 border-b border-gray-700">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`pb-3 px-4 font-bold transition-all ${activeTab === 'users' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white'}`}
                    >
                        使用者管理
                    </button>
                    <button
                        onClick={() => setActiveTab('permissions')}
                        className={`pb-3 px-4 font-bold transition-all ${activeTab === 'permissions' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white'}`}
                    >
                        板塊權限設定
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`pb-3 px-4 font-bold transition-all ${activeTab === 'logs' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white'}`}
                    >
                        操作紀錄 <span className="bg-gray-800 text-xs px-2 py-0.5 rounded-full ml-1 border border-gray-600">NEW</span>
                    </button>
                </div>

                {activeTab === 'users' && (
                    // Users List Tab
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        {/* Filters */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="搜尋使用者 Email 或名稱..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="text-gray-400 w-5 h-5" />
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                                    className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="all">全部角色</option>
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                    <option value="vip">VIP</option>
                                    <option value="member">Member</option>
                                    <option value="viewer">Viewer</option>
                                </select>
                            </div>
                        </div>

                        {/* List */}
                        {isLoading ? (
                            <div className="p-12 flex justify-center">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase bg-gray-900/50">
                                            <th className="py-3 px-4 rounded-tl-lg">使用者</th>
                                            <th className="py-3 px-4">角色權限</th>
                                            <th className="py-3 px-4">最後上線</th>
                                            <th className="py-3 px-4 rounded-tr-lg">狀態</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-gray-500">
                                                    沒有找到符合條件的使用者
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map(user => (
                                                <tr key={user.uid} className="hover:bg-gray-750 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg uppercase">
                                                                {(user.email?.[0] || 'U').toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-white">{user.displayName || '未命名使用者'}</div>
                                                                <div className="text-sm text-gray-400">{user.email}</div>
                                                                <div className="text-xs text-gray-600 font-mono mt-0.5">{user.uid.slice(0, 8)}...</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <select
                                                            value={user.role}
                                                            onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                                                            disabled={editingUserId === user.uid}
                                                            className={`bg-gray-900 border border-gray-600 rounded px-3 py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${user.role === 'admin' ? 'text-red-400 border-red-900' :
                                                                user.role === 'vip' ? 'text-yellow-400 border-yellow-900' :
                                                                    user.role === 'member' ? 'text-blue-400 border-blue-900' :
                                                                        'text-gray-400'
                                                                }`}
                                                        >
                                                            <option value="viewer">Viewer (訪客)</option>
                                                            <option value="member">Member (會員)</option>
                                                            <option value="vip">VIP (頭等艙)</option>
                                                            <option value="admin">Admin (管理員)</option>
                                                        </select>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                                                            <Clock className="w-4 h-4" />
                                                            {formatDate(user.lastActive)}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${(Date.now() - user.lastActive) < 1000 * 60 * 5 // 5 mins
                                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                            : 'bg-gray-700 text-gray-500'
                                                            }`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${(Date.now() - user.lastActive) < 1000 * 60 * 5 ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                                                                }`} />
                                                            {(Date.now() - user.lastActive) < 1000 * 60 * 5 ? '在線上' : '離線'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'permissions' && (
                    // Permission Matrix Tab
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        {isLoading ? (
                            <div className="p-12 flex justify-center text-gray-500">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                                    載入權限設定中...
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-indigo-400" /> 板塊存取門檻 (Minimum Access Tier)
                                </h3>
                                <p className="text-gray-400 text-sm mb-6">設定各個功能板塊所需的最低會員等級。等級越高，限制越嚴格。</p>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-700">
                                                <th className="py-3 px-4 text-gray-400 font-bold uppercase text-xs w-1/3">功能板塊 (Section)</th>
                                                <th className="py-3 px-4 text-gray-400 font-bold uppercase text-xs">最低需求等級 (Min Tier)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.keys(permissionMatrix).length === 0 && (
                                                <tr><td colSpan={2} className="p-4 text-center text-gray-500">尚無權限設定</td></tr>
                                            )}
                                            {Object.entries(permissionMatrix).map(([key, tier]) => (
                                                <tr key={key} className="border-b border-gray-700/50 hover:bg-gray-750">
                                                    <td className="py-4 px-4">
                                                        <div className="font-mono text-white font-bold text-lg">{key}</div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {key === 'market_insider' ? '市場內線/大盤分析' :
                                                                key === 'ai_picks' ? 'AI 量化選股' :
                                                                    key === 'martingale' ? '馬丁策略持倉' : '其他功能'}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="relative">
                                                            <select
                                                                value={tier as number}
                                                                onChange={(e) => handleChangeMinTier(key, Number(e.target.value))}
                                                                className={`w-full md:w-64 appearance-none rounded-lg px-4 py-3 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all border ${(tier as number) === AccessTier.ADMIN ? 'bg-red-900/20 text-red-400 border-red-900/50 hover:border-red-500' :
                                                                    (tier as number) === AccessTier.FIRST_CLASS ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50 hover:border-yellow-500' :
                                                                        (tier as number) === AccessTier.STANDARD ? 'bg-blue-900/20 text-blue-400 border-blue-900/50 hover:border-blue-500' :
                                                                            'bg-gray-700 text-gray-300 border-gray-600 hover:border-gray-500'
                                                                    }`}
                                                            >
                                                                <option value={AccessTier.GUEST}>🔓 訪客 (Guest) - 公開</option>
                                                                <option value={AccessTier.STANDARD}>👤 會員 (Standard) - 基本訂閱</option>
                                                                <option value={AccessTier.FIRST_CLASS}>👑 頭等艙 (VIP) - 高級訂閱</option>
                                                                <option value={AccessTier.ADMIN}>🛡️ 管理員 (Admin Only) - 內部測試</option>
                                                            </select>
                                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                                                                <Filter className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-400" /> 管理員操作日誌 (Audit Logs)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase bg-gray-900/50">
                                        <th className="py-3 px-4 w-40">時間</th>
                                        <th className="py-3 px-4 w-40">操作者 (Admin)</th>
                                        <th className="py-3 px-4 w-32">對象 (Target)</th>
                                        <th className="py-3 px-4 w-40">動作 (Action)</th>
                                        <th className="py-3 px-4">詳細內容</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {auditLogs.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-500">尚無操作紀錄</td></tr>
                                    ) : (
                                        auditLogs.map(log => {
                                            // Try to resolve targetId to a user email if possible
                                            const targetUser = users.find(u => u.uid === log.targetId);

                                            // Map known section keys to friendly names
                                            const sectionNames: Record<string, string> = {
                                                'market_insider': '市場內線/大盤',
                                                'ai_picks': 'AI 量化選股',
                                                'martingale': '馬丁策略',
                                                'users': '使用者管理'
                                            };

                                            const displayTarget = targetUser ? targetUser.email : (sectionNames[log.targetId] || log.targetId);

                                            return (
                                                <tr key={log.id} className="hover:bg-gray-750">
                                                    <td className="py-3 px-4 text-gray-400 font-mono text-xs">
                                                        {formatDate(log.timestamp)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="text-white font-bold text-sm block">{log.actorEmail}</span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-1.5">
                                                            {targetUser ? <User className="w-3 h-3 text-indigo-400" /> : <Shield className="w-3 h-3 text-gray-500" />}
                                                            <span className="text-gray-300 font-mono text-xs truncate max-w-[120px]" title={String(displayTarget)}>
                                                                {displayTarget}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${log.action.includes('ROLE') ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30' :
                                                            log.action.includes('TIER') ? 'bg-orange-900/30 text-orange-400 border border-orange-500/30' :
                                                                'bg-gray-700 text-gray-300'
                                                            }`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-300 text-sm">
                                                        {log.details}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default AdminPanel;
