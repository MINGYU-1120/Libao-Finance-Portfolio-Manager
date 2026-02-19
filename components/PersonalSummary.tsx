import React, { useState } from 'react';
import { CalculatedCategory } from '../types';
import { PieChart, RefreshCw, ChevronRight, ArrowRight, Quote, ArrowUp, ArrowDown, Trash2, Edit3, ArrowRightLeft, Shield, Check } from 'lucide-react';
import { formatTWD } from '../utils/formatting';
import { UserRole, AccessTier, getTier } from '../types';
import EditCategoryModal from './EditCategoryModal';

interface PersonalSummaryProps {
    categories: CalculatedCategory[];
    totalCapital: number;
    onEditCategory?: (id: string, name: string, allocation: number) => void;
    onSelectCategory: (id: string) => void;
    onRefreshCategory?: (id: string) => Promise<void>;
    onDeleteCategory?: (id: string) => void;
    onMoveCategory?: (id: string, direction: 'up' | 'down') => void;
    onAddCategory?: () => void;
    onCompare?: () => void;
    userRole: UserRole;
    isPrivacyMode: boolean;
    isMasked?: boolean;
    readOnly?: boolean;
}

const PersonalSummary: React.FC<PersonalSummaryProps> = ({
    categories,
    totalCapital,
    onEditCategory,
    onSelectCategory,
    onRefreshCategory,
    onDeleteCategory,
    onMoveCategory,
    onAddCategory,
    onCompare,
    userRole,
    isPrivacyMode,
    isMasked = false,
    readOnly = false
}) => {
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
    // Modal State
    const [editingCategory, setEditingCategory] = useState<CalculatedCategory | null>(null);
    const [editMode, setEditMode] = useState<'name' | 'allocation'>('allocation');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const handleEdit = (cat: CalculatedCategory, mode: 'name' | 'allocation') => {
        setEditingCategory(cat);
        setEditMode(mode);
        setIsEditModalOpen(true);
    };

    const handleRefresh = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (onRefreshCategory) {
            setRefreshingIds(prev => new Set(prev).add(id));
            await onRefreshCategory(id);
            setRefreshingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const totalPercent = categories.reduce((sum, c) => sum + c.allocationPercent, 0);
    const maskValue = (val: string | number) => (isMasked || isPrivacyMode) ? '****' : val;
    const strictMask = (val: string | number) => (isMasked || isPrivacyMode) ? '****' : val;

    return (
        <div className="bg-gray-950 shadow-2xl rounded-2xl overflow-hidden border border-gray-800 ring-1 ring-white/5 animate-in fade-in zoom-in duration-300">
            {/* Header - Private Vault Theme */}
            <div className="relative bg-gray-900 p-6 border-b border-gray-800">
                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-3 text-white tracking-wide">
                            <PieChart className="w-8 h-8 text-emerald-500" />
                            持倉總覽 (Overview)
                            {onCompare && (
                                <button
                                    onClick={onCompare}
                                    className={`ml-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 border ${getTier(userRole) >= AccessTier.STANDARD
                                        ? "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400"
                                        : "bg-gray-800 border-gray-700 text-gray-500"
                                        }`}
                                >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    倉位比對
                                    {getTier(userRole) < AccessTier.STANDARD && <Shield className="w-3 h-3 ml-0.5" />}
                                </button>
                            )}
                        </h2>
                        {/* Quote could be restored if desired, or kept simple as per original */}
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <div>
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">總配置 (Total)</div>
                            <div className={`text-2xl font-black font-mono ${totalPercent > 100 ? 'text-red-400' : 'text-cyan-400'}`}>
                                {maskValue(totalPercent)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden p-4 space-y-4 bg-gray-950">
                {categories.map((cat, idx) => (
                    <div
                        key={cat.id}
                        className="group relative overflow-hidden p-5 rounded-xl bg-gray-900 border border-gray-800 active:scale-[0.98] transition-all duration-200 hover:border-cyan-500/30"
                        onClick={() => onSelectCategory(cat.id)}
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500/0 via-cyan-500/50 to-cyan-500/0 opacity-50 group-hover:opacity-100 transition-opacity"></div>

                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${cat.market === 'TW' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                        {cat.market === 'TW' ? '台股' : '美股'}
                                    </span>
                                    {!readOnly && onEditCategory ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(cat, 'allocation');
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-500/50 transition-all group/btn"
                                        >
                                            <span className="text-xs font-bold text-cyan-400 group-hover/btn:text-cyan-300">{cat.allocationPercent}% 配置</span>
                                            <Edit3 className="w-3 h-3 text-gray-500 group-hover/btn:text-cyan-400" />
                                        </button>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{cat.allocationPercent}% 配置</span>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                    {cat.name}
                                    {!readOnly && onEditCategory && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(cat, 'name');
                                            }}
                                            className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-cyan-400 transition-colors"
                                            title="編輯名稱"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </h3>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">已實現</div>
                                <div className={`font-mono font-bold text-base ${cat.realizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {cat.realizedPnL > 0 ? '+' : ''}{maskValue(formatTWD(cat.realizedPnL, isPrivacyMode))}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar Visual */}
                        <div className="mb-4">
                            <div className="flex justify-between text-xs font-medium text-gray-400 mb-1.5">
                                <span>資金使用率</span>
                                <span className="text-cyan-400">{cat.investmentRatio.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${cat.investmentRatio > 80 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-cyan-600 to-cyan-400'}`}
                                    style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                            <div className="flex items-center gap-4">
                                <div>
                                    <div className="text-[10px] text-gray-500">已投入</div>
                                    <div className="text-sm font-mono font-bold text-gray-300">{maskValue(formatTWD(cat.investedAmount, isPrivacyMode))}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-gray-500">剩餘現金</div>
                                    <div className="text-sm font-mono font-bold text-gray-300">{maskValue(formatTWD(cat.remainingCash, isPrivacyMode))}</div>
                                </div>
                            </div>
                            <div className="flex items-center text-xs font-bold text-cyan-400 gap-1">
                                查看明細 <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                        </div>
                    </div>
                ))}
                {!readOnly && onAddCategory && (
                    <button
                        onClick={onAddCategory}
                        className="w-full p-5 rounded-xl border border-dashed border-gray-700 hover:border-cyan-500/50 hover:bg-gray-900 transition-all flex items-center justify-center gap-3 text-gray-500 hover:text-cyan-400 group"
                    >
                        <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center group-hover:border-cyan-500 transition-colors">
                            <span className="text-xl leading-none mb-0.5">+</span>
                        </div>
                        <span className="font-bold text-sm tracking-widest uppercase">新增策略 (Add Strategy)</span>
                    </button>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto bg-gray-950">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                            <th className="p-5 w-8 text-center">#</th>
                            <th className="p-5 w-8 text-center">市場</th>
                            <th className="p-5 min-w-[180px] text-center">倉位名稱</th>
                            <th className="p-5 text-center min-w-[40px]">資金配置 (%)</th>
                            <th className="p-5 text-right w-32">預計總投入</th>
                            <th className="p-5 text-right min-w-[120px]">已投入金額</th>
                            <th className="p-5 text-right w-32">剩餘現金</th>
                            <th className="p-5 text-right min-w-[120px]">已實現損益</th>
                            <th className="p-5 text-center w-32">資金使用率</th>
                            <th className="p-5 text-center w-20">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-lg">
                        {categories.map((cat, idx) => (
                            <tr
                                key={cat.id}
                                onClick={() => onSelectCategory(cat.id)}
                                className="hover:bg-gray-900 transition-all cursor-pointer group border-l-4 border-transparent hover:border-cyan-500"
                            >
                                {/* Index Column */}
                                <td className="p-5 text-center font-mono text-gray-600 text-sm group-hover:text-cyan-500/50">
                                    {idx + 1}
                                </td>
                                <td className="p-5 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${cat.market === 'TW' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                        {cat.market}
                                    </span>
                                </td>
                                <td className="p-5 text-center">
                                    <div className="font-bold text-gray-200 group-hover:text-cyan-400 transition-colors text-base flex items-center justify-center gap-2">
                                        {/* Sort Controls - Vertical Handle Style */}
                                        {!readOnly && onMoveCategory && (
                                            <div className="flex flex-col bg-gray-800/50 rounded-md p-0.5 border border-gray-800 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'up'); }}
                                                    className="p-0.5 hover:bg-gray-700 rounded text-gray-500 hover:text-cyan-400 transition-all active:scale-90"
                                                    title="上移"
                                                >
                                                    <ArrowUp className="w-2.5 h-2.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'down'); }}
                                                    className="p-0.5 hover:bg-gray-700 rounded text-gray-500 hover:text-cyan-400 transition-all active:scale-90"
                                                    title="下移"
                                                >
                                                    <ArrowDown className="w-2.5 h-2.5" />
                                                </button>
                                            </div>
                                        )}
                                        {cat.name}
                                        {!readOnly && onEditCategory && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(cat, 'name');
                                                }}
                                                className="p-1 rounded hover:bg-gray-800 text-gray-600 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100"
                                                title="編輯名稱"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="p-5 text-center" onClick={(e) => e.stopPropagation()}>
                                    {!readOnly && onEditCategory ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(cat, 'allocation');
                                            }}
                                            className="flex items-center justify-center gap-1.5 group/btn hover:bg-gray-800 px-2 py-1 rounded transition-colors"
                                        >
                                            <span className="font-mono font-bold text-cyan-400 text-lg group-hover/btn:text-cyan-300">{cat.allocationPercent}%</span>
                                            <Edit3 className="w-3 h-3 text-gray-600 group-hover/btn:text-cyan-400 opacity-0 group-hover/btn:opacity-100 transition-all" />
                                        </button>
                                    ) : (
                                        <span className="font-mono font-bold text-gray-400 text-lg">{cat.allocationPercent}%</span>
                                    )}
                                </td>
                                <td className="p-5 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="font-mono text-gray-500 font-medium">{maskValue(formatTWD(cat.projectedInvestment, isPrivacyMode))}</div>
                                </td>
                                <td className="p-5 text-right">
                                    <div className="font-mono font-black text-gray-200 group-hover:text-white">{maskValue(formatTWD(cat.investedAmount, isPrivacyMode))}</div>
                                </td>
                                <td className="p-5 text-right">
                                    <div className={`font-mono font-black ${cat.remainingCash < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {maskValue(formatTWD(cat.remainingCash, isPrivacyMode))}
                                    </div>
                                </td>
                                <td className="p-5 text-right">
                                    <div className={`font-mono font-black ${cat.realizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {maskValue(formatTWD(cat.realizedPnL, isPrivacyMode))}
                                    </div>
                                </td>
                                <td className="p-5">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${cat.investmentRatio > 100 ? 'bg-red-500' : 'bg-cyan-500'}`}
                                                style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs font-black min-w-[35px] text-right text-gray-400 font-mono">{strictMask(cat.investmentRatio.toFixed(0))}%</span>
                                    </div>
                                </td>
                                <td className="p-5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <button
                                            onClick={(e) => handleRefresh(e, cat.id)}
                                            disabled={refreshingIds.has(cat.id)}
                                            className={`p-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 transition-all active:scale-95 ${refreshingIds.has(cat.id) ? 'text-cyan-400' : 'text-gray-400'}`}
                                            title="更新價格"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingIds.has(cat.id) ? 'animate-spin' : ''}`} />
                                        </button>
                                        {!readOnly && onDeleteCategory && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                                                className="p-1.5 rounded-lg border border-red-900/30 hover:bg-red-900/20 text-red-400 hover:text-red-300 transition-all active:scale-95"
                                                title="刪除"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-cyan-500 ml-1 transition-colors" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {/* Add Strategy Row */}
                        {!readOnly && onAddCategory && (
                            <tr
                                onClick={onAddCategory}
                                className="border-t border-gray-800/50 hover:bg-gray-900 transition-all cursor-pointer group border-l-4 border-transparent hover:border-emerald-500 border-dashed"
                            >
                                <td className="p-5 text-center text-gray-600">
                                    <div className="w-6 h-6 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center mx-auto group-hover:border-emerald-500 group-hover:text-emerald-500 transition-colors">
                                        <span className="text-lg leading-none mb-0.5">+</span>
                                    </div>
                                </td>
                                <td colSpan={10} className="p-5">
                                    <div className="flex items-center text-gray-400 font-bold font-mono group-hover:text-emerald-500 transition-colors gap-2">
                                        新增策略 (Add Strategy)
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* Edit Modal */}
            {editingCategory && (
                <EditCategoryModal
                    isOpen={isEditModalOpen}
                    onClose={() => { setIsEditModalOpen(false); setEditingCategory(null); }}
                    category={editingCategory}
                    totalCapital={totalCapital}
                    onSave={(id, name, alloc) => {
                        if (onEditCategory) onEditCategory(id, name, alloc);
                    }}
                    isPrivacyMode={isPrivacyMode}
                    initialMode={editMode}
                />
            )}
        </div>
    );
};

export default PersonalSummary;
