import React, { useState, useEffect } from 'react';
import { db, functions, updateUserRole, getAllUsers, getAllSectionMinTiers, updateSectionMinTier, logAdminAction, getAuditLogs } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { UserProfile, UserRole, AccessTier, AuditLog } from '../types';
import { Shield, User, Clock, Search, Filter, AlertTriangle, CheckCircle, X, FileText, Activity, Download, Bell, Send, Upload } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface AdminPanelProps {
    currentUser: UserProfile | any;
    onImportTrades?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, onImportTrades }) => {
    // ... (state vars same)
    const { showToast } = useToast();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);

    // Permission State
    const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'batch' | 'push' | 'logs'>('users');
    const [permissionMatrix, setPermissionMatrix] = useState<Record<string, AccessTier>>({
        'market_insider': AccessTier.ADMIN,
        'ai_picks': AccessTier.STANDARD,
        'martingale': AccessTier.STANDARD,
    });
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

    // Batch Update State
    const [batchEmails, setBatchEmails] = useState('');
    const [batchRole, setBatchRole] = useState<UserRole>('vip');
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchResult, setBatchResult] = useState<{
        success: number;
        failed: number;
        logs: Array<{ email: string; status: 'success' | 'error'; message: string }>;
    } | null>(null);

    // Push Notification State
    const [pushTitle, setPushTitle] = useState('');
    const [pushBody, setPushBody] = useState('');
    const [pushTopics, setPushTopics] = useState<string[]>(['all']);
    const [pushUrl, setPushUrl] = useState('/');
    const [isPushing, setIsPushing] = useState(false);
    const [pushMode, setPushMode] = useState<'broadcast' | 'direct'>('broadcast');
    const [directTargetUid, setDirectTargetUid] = useState('');

    useEffect(() => {
        // Load on mount since it is now a page
        loadData();
    }, []);

    const loadData = async () => {
        // ... same logic
        setIsLoading(true);
        try {
            const userList = await getAllUsers();
            setUsers(userList.sort((a, b) => b.lastActive - a.lastActive));
            const perms = await getAllSectionMinTiers();
            const defaults: Record<string, AccessTier> = {
                'market_insider': AccessTier.ADMIN,
                'ai_picks': AccessTier.STANDARD,
                'martingale': AccessTier.STANDARD,
            };
            setPermissionMatrix({ ...defaults, ...perms });
            const logs = await getAuditLogs(50);
            setAuditLogs(logs);
        } catch (e) {
            console.error("Failed to load admin data", e);
            showToast("無法載入管理員資料", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // ... (rest of helper functions omitted, they don't use overlay) ...
    // BUT we need to replace the RETURN statement which has the modal structure.

    // I need to be careful with replace_file_content limit. 
    // The previous view_file showed lines 1-100 and 200-250 and 400-445.
    // I will replace 1-32 first to strip props.
    // Then replace the render block.




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

    const handleBatchUpdate = async () => {
        if (!currentUser) return;
        setIsBatchProcessing(true);
        setBatchResult(null);

        const lines = batchEmails.split(/[\n,]+/).map(e => e.trim()).filter(e => e);
        const results: Array<{ email: string; status: 'success' | 'error'; message: string }> = [];
        let successCount = 0;
        let failCount = 0;

        try {
            // Need to fetch all users to find by email since we don't have an email-to-uid index easily accessible without a query
            // Optimization: If list is small, this is fine. If large, might need better approach.
            // For now, client-side filtering from the 'users' state is fastest since we already loaded them.
            // If 'users' state is not complete (e.g. pagination), we might miss people. 
            // BUT getAllUsers() fetches ALL users currently.

            for (const email of lines) {
                // Basic format check
                if (!email.includes('@')) {
                    results.push({ email, status: 'error', message: 'Invalid format' });
                    failCount++;
                    continue;
                }

                // Find user
                const targetUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

                if (!targetUser) {
                    results.push({ email, status: 'error', message: 'User not found in database' });
                    failCount++;
                    continue;
                }

                if (targetUser.role === batchRole) {
                    results.push({ email, status: 'error', message: `Already has role ${batchRole}` });
                    failCount++; // Or consider this a skip? Counting as fail for now to draw attention.
                    continue;
                }

                try {
                    await updateUserRole(targetUser.uid, batchRole);
                    // Update local state for consistency
                    setUsers(prev => prev.map(u =>
                        u.uid === targetUser.uid ? { ...u, role: batchRole } : u
                    ));
                    results.push({ email, status: 'success', message: `Updated to ${batchRole}` });
                    successCount++;

                    // Log each success? Or maybe one big log at end? 
                    // Let's log individual for granularity if list is small, but to avoid spamming audit logs, maybe just one summary log?
                    // Actually, individual logs are safer for auditing "Who changed X".
                    await logAdminAction(
                        "BATCH_UPDATE_ROLE",
                        targetUser.uid,
                        `Batch updated role to ${batchRole}`,
                        currentUser.email
                    );

                } catch (err) {
                    console.error(err);
                    results.push({ email, status: 'error', message: 'Update failed (Network/Permission)' });
                    failCount++;
                }
            }

            setBatchResult({
                success: successCount,
                failed: failCount,
                logs: results
            });

            showToast(`批次更新完成: ${successCount} 成功, ${failCount} 失敗`, "success");

            // Refresh logs
            getAuditLogs().then(setAuditLogs);

        } catch (error) {
            console.error(error);
            showToast("批次處理發生未預期的錯誤", "error");
        } finally {
            setIsBatchProcessing(false);
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

    const handleSendPush = async () => {
        if (!pushTitle || !pushBody) {
            showToast("請填寫標題與內容", "error");
            return;
        }

        if (pushMode === 'broadcast' && !window.confirm(`確定要對主題 [${pushTopics.join(',')}] 發送廣播推播嗎？`)) {
            return;
        }

        setIsPushing(true);
        try {
            if (pushMode === 'broadcast') {
                const sendBroadcastFn = httpsCallable(functions, 'sendBroadcast');
                await sendBroadcastFn({
                    title: pushTitle,
                    body: pushBody,
                    topics: pushTopics,
                    url: pushUrl
                });
            } else {
                if (!directTargetUid) throw new Error("缺少目標用戶 UID");
                const sendDirectFn = httpsCallable(functions, 'sendDirectMessage');
                const result: any = await sendDirectFn({
                    targetUid: directTargetUid,
                    title: pushTitle,
                    body: pushBody,
                    url: pushUrl
                });

                if (result.data && !result.data.success) {
                    showToast(`發送失敗: ${result.data.reason}`, "error");
                    setIsPushing(false);
                    return;
                }
            }

            await logAdminAction(
                pushMode === 'broadcast' ? "SEND_PUSH_BROADCAST" : "SEND_PUSH_DIRECT",
                pushMode === 'broadcast' ? pushTopics.join(',') : directTargetUid,
                `Sent ${pushMode}: ${pushTitle}`,
                currentUser.email
            );

            showToast("推播已成功發送！", "success");
            setPushTitle('');
            setPushBody('');

            // Refresh logs
            getAuditLogs().then(setAuditLogs);
        } catch (error: any) {
            console.error(error);
            showToast(`發送失敗: ${error.message}`, "error");
        } finally {
            setIsPushing(false);
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

    const handleExportUsers = () => {
        // Helper to get friendly name
        const getRoleDisplay = (r: string) => {
            switch (r) {
                case 'admin': return '管理員 (Admin)';
                case 'vip': return 'VIP頭等艙 (VIP)';
                case 'member': return 'Pro會員 (Pro)';
                case 'viewer': return '訪客 (Viewer)';
                default: return r;
            }
        };

        // Headers
        const headers = ['UID', 'Email', 'Name', 'Role (Key)', 'Role (Display)', 'Last Active', 'Join Date'];

        // Rows
        const rows = users.map(user => [
            user.uid,
            user.email || '',
            user.displayName || '',
            user.role,
            getRoleDisplay(user.role),
            formatDate(user.lastActive),
            user.createdAt ? formatDate(user.createdAt) : ''
        ]);

        // Combine
        const csvContent = [
            // Add BOM for Excel to read UTF-8 correctly
            '\uFEFF' + headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `user_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!currentUser) return null;

    return (
        <div className="w-full animate-in fade-in duration-500">
            {/* Tech Background Effect */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-gray-950">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-4 tracking-tight">
                            <div className="p-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                                <Shield className="w-8 h-8 md:w-10 md:h-10 text-white" />
                            </div>
                            <span className="bg-gradient-to-r from-white via-indigo-100 to-gray-400 bg-clip-text text-transparent">
                                管理員控制台
                            </span>
                        </h1>
                        <p className="text-indigo-300/80 mt-2 font-mono text-sm tracking-wider pl-1">SYSTEM_ADMIN_DASHBOARD // V5.0</p>
                    </div>
                    {onImportTrades && (
                        <button
                            id="btn-import-trades"
                            onClick={onImportTrades}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg transition-all active:scale-95"
                        >
                            <Upload className="w-4 h-4" />
                            匯入歷史交易
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex space-x-2 mb-8 p-1 bg-gray-900/60 backdrop-blur-md rounded-xl border border-gray-700/50 w-fit">
                    {[
                        { id: 'users', label: '使用者管理', icon: User },
                        { id: 'permissions', label: '板塊權限', icon: Shield },
                        { id: 'batch', label: '批次權限', icon: Activity },
                        { id: 'push', label: '推播廣播', icon: Bell },
                        { id: 'logs', label: '操作日誌', icon: FileText }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                                relative px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 flex items-center gap-2
                                ${activeTab === tab.id
                                    ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] ring-1 ring-indigo-400'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }
                            `}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'users' && (
                    // Users List Tab
                    <div className="bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-800 shadow-2xl overflow-hidden relative group">
                        {/* Tech Border Glow */}
                        <div className="absolute inset-0 border border-indigo-500/20 rounded-2xl pointer-events-none group-hover:border-indigo-500/40 transition-colors duration-500"></div>

                        <div className="p-6 md:p-8">
                            {/* Filters */}
                            <div className="flex flex-col md:flex-row gap-4 mb-8">
                                <div className="relative flex-1 group/search">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Search className="h-5 w-5 text-indigo-400 group-focus-within/search:text-indigo-300 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="搜尋使用者 UID / Email / 名稱..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3 bg-gray-950/50 border border-gray-700 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-mono text-sm hover:bg-gray-950/80"
                                    />
                                </div>
                                <div className="relative w-full md:w-64">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Filter className="h-4 w-4 text-indigo-400" />
                                    </div>
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                                        className="block w-full pl-11 pr-10 py-3 bg-gray-950/50 border border-gray-700 rounded-xl text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 appearance-none font-bold text-sm cursor-pointer hover:bg-gray-950/80 transition-colors"
                                    >
                                        <option value="all">⚡ 全部角色 (All Roles)</option>
                                        <option value="user">👤 User</option>
                                        <option value="admin">🛡️ Admin</option>
                                        <option value="vip">👑 VIP頭等艙</option>
                                        <option value="member">💠 Pro會員 (Pro)</option>
                                        <option value="viewer">👀 Viewer</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                                <button
                                    onClick={handleExportUsers}
                                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-2 font-bold text-sm transition-all shadow-md active:scale-95"
                                    title="匯出 CSV"
                                >
                                    <Download className="w-5 h-5" />
                                    <span className="hidden md:inline">匯出 CSV</span>
                                </button>
                            </div>

                            {/* List */}
                            {isLoading ? (
                                <div className="p-20 flex flex-col items-center justify-center gap-4">
                                    <div className="relative w-16 h-16">
                                        <div className="absolute inset-0 border-4 border-indigo-900 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        <Activity className="absolute inset-0 m-auto text-indigo-400 w-6 h-6 animate-pulse" />
                                    </div>
                                    <span className="text-indigo-400 font-mono text-sm tracking-widest animate-pulse">LOADING DATA_STREAM...</span>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-gray-800">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-950/80 text-gray-400 text-xs uppercase tracking-wider font-mono border-b border-gray-800">
                                                <th className="py-4 px-6 font-semibold">USER_ID</th>
                                                <th className="py-4 px-6 font-semibold">ACCESS_LEVEL</th>
                                                <th className="py-4 px-6 font-semibold">LAST_LOGIN</th>
                                                <th className="py-4 px-6 font-semibold text-right">STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800 bg-gray-900/20">
                                            {filteredUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3 opacity-50">
                                                            <Search className="w-12 h-12 text-gray-600" />
                                                            <span className="text-gray-400 font-mono">NO_MATCHES_FOUND</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredUsers.map(user => (
                                                    <tr key={user.uid} className="group/row hover:bg-indigo-900/10 transition-all duration-200">
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="relative">
                                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg ${user.role === 'admin' ? 'bg-gradient-to-br from-red-500 to-orange-600 text-white' :
                                                                        user.role === 'vip' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                                                                            'bg-gray-800 text-gray-400 group-hover/row:bg-indigo-600 group-hover/row:text-white transition-colors'
                                                                        }`}>
                                                                        {(user.email?.[0] || 'U').toUpperCase()}
                                                                    </div>
                                                                    {user.role === 'admin' && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-gray-100 group-hover/row:text-white transition-colors">{user.displayName || 'Unknown Agent'}</div>
                                                                    <div className="text-xs text-gray-500 font-mono">{user.email}</div>
                                                                    <div className="text-[10px] text-gray-600 font-mono mt-1 opacity-0 group-hover/row:opacity-100 transition-opacity uppercase tracking-wider">ID: {user.uid.slice(0, 8)}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6 md:px-6">
                                                            <select
                                                                value={user.role}
                                                                onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                                                                disabled={editingUserId === user.uid}
                                                                className={`bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer ${user.role === 'admin' ? 'text-red-400 border-red-900/50 hover:border-red-500' :
                                                                    user.role === 'vip' ? 'text-yellow-400 border-yellow-900/50 hover:border-yellow-500' :
                                                                        user.role === 'member' ? 'text-blue-400 border-blue-900/50 hover:border-blue-500' :
                                                                            'text-gray-400 hover:border-gray-500'
                                                                    }`}
                                                            >
                                                                <option value="viewer">Viewer</option>
                                                                <option value="member">Pro會員</option>
                                                                <option value="vip">VIP</option>
                                                                <option value="admin">Admin</option>
                                                            </select>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center gap-2 text-gray-400 text-sm font-mono">
                                                                <Clock className="w-4 h-4 text-gray-600" />
                                                                {formatDate(user.lastActive)}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6 text-right">
                                                            <div className="flex justify-end gap-2 text-right">
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveTab('push');
                                                                        setPushMode('direct');
                                                                        setDirectTargetUid(user.uid);
                                                                    }}
                                                                    className="p-2 hover:bg-indigo-500/20 rounded-lg text-indigo-400 transition-colors"
                                                                    title="對該用戶發送私訊"
                                                                >
                                                                    <Send className="w-4 h-4" />
                                                                </button>
                                                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-mono border ${(Date.now() - user.lastActive) < 1000 * 60 * 5
                                                                    ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                                                                    : 'bg-gray-800 text-gray-500 border-gray-700'
                                                                    }`}>
                                                                    <div className={`w-2 h-2 rounded-full ${(Date.now() - user.lastActive) < 1000 * 60 * 5 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                                                                    {(Date.now() - user.lastActive) < 1000 * 60 * 5 ? 'ONLINE' : 'OFFLINE'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {
                    activeTab === 'permissions' && (
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
                                                                    <option value={AccessTier.FIRST_CLASS}>👑 VIP頭等艙 - 高級訂閱</option>
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
                    )
                }

                {
                    activeTab === 'batch' && (
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 animate-in fade-in duration-300">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-indigo-400" /> 批次權限管理 (Batch Permission Manager)
                            </h3>
                            <p className="text-gray-400 text-sm mb-6">請輸入 Email 清單（每行一個），系統將自動為這些使用者開通指定權限。</p>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Input Area */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-300">1. 選擇要賦予的角色 (Target Role)</label>
                                        <select
                                            value={batchRole}
                                            onChange={(e) => setBatchRole(e.target.value as UserRole)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="member">💠 Member (一般成員)</option>
                                            <option value="vip">👑 VIP頭等艙 (高級訂閱)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-300 flex justify-between">
                                            <span>2. 貼上 Email 清單 (Paste Emails)</span>
                                            <span className="text-xs text-gray-500 font-normal">支援格式：換行分隔、逗號分隔</span>
                                        </label>
                                        <textarea
                                            value={batchEmails}
                                            onChange={(e) => setBatchEmails(e.target.value)}
                                            placeholder={`user1@example.com\nuser2@example.com\nuser3@example.com`}
                                            className="w-full h-64 bg-gray-950/50 border border-gray-700 rounded-xl p-4 text-sm font-mono text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-gray-600 resize-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handleBatchUpdate}
                                        disabled={isBatchProcessing || !batchEmails.trim()}
                                        className={`
                                            w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all
                                            ${isBatchProcessing || !batchEmails.trim()
                                                ? 'bg-gray-700 cursor-not-allowed text-gray-500'
                                                : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-[0.98]'
                                            }
                                        `}
                                    >
                                        {isBatchProcessing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                處理中 (Processing)...
                                            </>
                                        ) : (
                                            <>
                                                <Activity className="w-5 h-5" />
                                                開始批次更新 (Execute Batch Update)
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Results Area */}
                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-gray-300">執行結果 (Results)</label>
                                    <div className="h-[calc(100%-2rem)] bg-gray-900 rounded-xl border border-gray-700 overflow-hidden flex flex-col">

                                        {!batchResult ? (
                                            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-center">
                                                <FileText className="w-12 h-12 mb-3 opacity-20" />
                                                <p className="text-sm">執行結果將顯示於此</p>
                                            </div>
                                        ) : (
                                            <div className="flex-1 flex flex-col min-h-0">
                                                {/* Summary Header */}
                                                <div className="p-4 bg-gray-950/50 border-b border-gray-800 flex gap-4">
                                                    <div className="flex-1 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                                                        <div className="text-xs text-green-500 font-bold uppercase mb-1">Success</div>
                                                        <div className="text-2xl font-black text-green-400">{batchResult.success}</div>
                                                    </div>
                                                    <div className="flex-1 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                                                        <div className="text-xs text-red-500 font-bold uppercase mb-1">Failed/Skipped</div>
                                                        <div className="text-2xl font-black text-red-400">{batchResult.failed}</div>
                                                    </div>
                                                </div>

                                                {/* Log List */}
                                                <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
                                                    {batchResult.logs.length === 0 && (
                                                        <div className="text-gray-500 text-center py-4">無詳細紀錄</div>
                                                    )}
                                                    {batchResult.logs.map((log, i) => (
                                                        <div key={i} className={`flex items-start gap-2 p-2 rounded border ${log.status === 'success'
                                                            ? 'bg-green-900/10 border-green-900/20 text-green-300'
                                                            : 'bg-red-900/10 border-red-900/20 text-red-300'
                                                            }`}>
                                                            {log.status === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <X className="w-4 h-4 mt-0.5 shrink-0" />}
                                                            <div className="break-all">
                                                                <span className="font-bold">{log.email}</span>
                                                                <span className="opacity-70 ml-2">- {log.message}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'push' && (
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 animate-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Bell className="w-5 h-5 text-indigo-400" /> 推播廣播系統 (Global Push Notification)
                            </h3>
                            <p className="text-gray-400 text-sm mb-8">透過此功能，您可以對全體或特定權限等級的用戶發送即時推播通知。系統將透過 Google 雲端訊息 (FCM) 傳送至已授權的 PWA 設備。</p>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                {/* Form */}
                                <div className="space-y-5">
                                    <div className="flex bg-gray-900/50 p-1 rounded-xl border border-gray-700 mb-2">
                                        <button
                                            onClick={() => setPushMode('broadcast')}
                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${pushMode === 'broadcast' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            全體廣播
                                        </button>
                                        <button
                                            onClick={() => setPushMode('direct')}
                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${pushMode === 'direct' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            個人私訊推播
                                        </button>
                                    </div>

                                    {pushMode === 'broadcast' ? (
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">傳送目標多選 (Target Topics)</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { id: 'all', label: '📢 全體用戶', color: 'indigo' },
                                                    { id: 'tier_admin', label: '🛡️ 管理員', color: 'red' },
                                                    { id: 'tier_vip', label: '👑 VIP頭等艙', color: 'yellow' },
                                                    { id: 'tier_member', label: '💠 Pro會員', color: 'blue' },
                                                    { id: 'tier_viewer', label: '👀 訪客', color: 'gray' },
                                                ].map(topic => (
                                                    <button
                                                        key={topic.id}
                                                        onClick={() => {
                                                            if (topic.id === 'all') {
                                                                setPushTopics(['all']);
                                                            } else {
                                                                setPushTopics(prev => {
                                                                    const filtered = prev.filter(t => t !== 'all');
                                                                    if (filtered.includes(topic.id)) {
                                                                        const next = filtered.filter(t => t !== topic.id);
                                                                        return next.length === 0 ? ['all'] : next;
                                                                    } else {
                                                                        return [...filtered, topic.id];
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                        className={`
                                                            px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2
                                                            ${pushTopics.includes(topic.id)
                                                                ? `bg-${topic.color}-600/20 border-${topic.color}-500 text-${topic.color}-400 shadow-[0_0_10px_rgba(var(--${topic.color}-rgb),0.2)]`
                                                                : 'bg-gray-900/50 border-gray-700 text-gray-500 hover:border-gray-500'
                                                            }
                                                        `}
                                                    >
                                                        <div className={`w-2 h-2 rounded-full ${pushTopics.includes(topic.id) ? `bg-${topic.color}-400 animate-pulse` : 'bg-gray-700'}`} />
                                                        {topic.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-gray-500 italic">* 若勾選全體，則會覆蓋其他選項。支援多選後將使用 FCM 條件邏輯發送。</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">目標用戶 UID (Target User UID)</label>
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    value={directTargetUid}
                                                    onChange={(e) => setDirectTargetUid(e.target.value)}
                                                    placeholder="請輸入目標用戶的 UID..."
                                                    className="w-full bg-gray-950 border border-pink-900/50 rounded-xl px-4 py-3 text-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all font-mono text-sm placeholder:text-gray-800"
                                                />
                                                {directTargetUid && (
                                                    <div className="absolute right-3 top-3 text-[10px] text-pink-500/50 font-mono">
                                                        {users.find(u => u.uid === directTargetUid)?.email || 'User found'}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500">提示：您可以從「使用者管理」分頁點擊 <Send className="w-3 h-3 inline" /> 圖示來自動填入 UID。</p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">通知標題 (Notification Title)</label>
                                        <input
                                            type="text"
                                            value={pushTitle}
                                            onChange={(e) => setPushTitle(e.target.value)}
                                            placeholder="例如：大盤關鍵變動警告！"
                                            className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-gray-700"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">通知內容 (Notification Body)</label>
                                        <textarea
                                            value={pushBody}
                                            onChange={(e) => setPushBody(e.target.value)}
                                            placeholder="請輸入推播的詳細內容..."
                                            className="w-full h-32 bg-gray-950 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-gray-700 resize-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">導航連結 (Target URL / Deep Link)</label>
                                        <div className="flex bg-gray-950 border border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                                            <span className="px-4 py-3 bg-gray-900 text-gray-500 font-mono text-sm border-r border-gray-800 flex items-center">/</span>
                                            <input
                                                type="text"
                                                value={pushUrl}
                                                onChange={(e) => setPushUrl(e.target.value)}
                                                className="w-full bg-transparent px-3 py-3 text-gray-300 focus:outline-none font-mono text-sm"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSendPush}
                                        disabled={isPushing || !pushTitle || !pushBody}
                                        className={`
                                            w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all mt-4
                                            ${isPushing || !pushTitle || !pushBody
                                                ? 'bg-gray-700 cursor-not-allowed text-gray-500 opacity-50'
                                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-[0.98]'
                                            }
                                        `}
                                    >
                                        {isPushing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                發送中 (Pushing)...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-5 h-5" />
                                                立即發送推播通知
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Preview */}
                                <div className="space-y-5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">手機鎖定畫面預覽 (Mock Preview)</label>
                                    <div className="relative w-full aspect-[9/16] max-w-[280px] mx-auto bg-black rounded-[3rem] border-[8px] border-gray-800 shadow-2xl p-4 pt-12 overflow-hidden">
                                        {/* Notch */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-gray-800 rounded-b-2xl"></div>

                                        {/* Wallpaper Like Grad */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-gray-900 to-black z-0"></div>

                                        <div className="relative z-10">
                                            {/* Clock */}
                                            <div className="text-center mt-4">
                                                <div className="text-4xl font-light text-white/90 font-mono">22:50</div>
                                                <div className="text-xs text-white/60 font-medium">Thursday, Feb 26</div>
                                            </div>

                                            {/* Push Banner */}
                                            {(pushTitle || pushBody) && (
                                                <div className="mt-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
                                                                <Bell className="w-3 h-3 text-white" />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-white/80 uppercase">Libao Finance</span>
                                                        </div>
                                                        <span className="text-[10px] text-white/50">現在</span>
                                                    </div>
                                                    <div className="text-xs font-bold text-white mb-0.5 truncate">{pushTitle || '通知標題'}</div>
                                                    <div className="text-[11px] text-white/70 line-clamp-2 leading-relaxed">{pushBody || '這是一則推播通知的內容預覽。您可以自定義發送的主題與導航位置。'}</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Swipe Bar */}
                                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-1 bg-white/20 rounded-full z-10"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
                {
                    activeTab === 'logs' && (
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
                    )
                }

            </div>
        </div>
    );
};

export default AdminPanel;
