import React, { useState } from 'react';
import { CalculatedCategory, UserRole, AccessTier, getTier } from '../types';
import { PieChart, RefreshCw, ChevronRight, GraduationCap, ArrowRight, Quote, ArrowUp, ArrowDown, Trash2, Check, Lock, Shield, Edit3 } from 'lucide-react';
import { formatTWD } from '../utils/formatting';
import EditCategoryModal from './EditCategoryModal';

interface MartingaleSummaryProps {
    categories: CalculatedCategory[];
    totalCapital: number;
    onEditCategory?: (id: string, name: string, allocation: number) => void;
    onSelectCategory: (id: string) => void;
    onRefreshCategory?: (id: string) => Promise<void>;
    onDeleteCategory?: (id: string) => void;
    onMoveCategory?: (id: string, direction: 'up' | 'down') => void;
    onAddCategory?: () => void; // New prop
    isPrivacyMode: boolean;
    isMasked?: boolean;
    readOnly?: boolean;
    userRole?: UserRole; // Added for permission checks
}

const MartingaleSummary: React.FC<MartingaleSummaryProps> = ({
    categories,
    totalCapital,
    onEditCategory,
    onSelectCategory,
    onRefreshCategory,
    onDeleteCategory,
    onMoveCategory,
    onAddCategory, // destructure
    isPrivacyMode,
    isMasked = false,
    readOnly = true,
    userRole = 'viewer'
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
        // ... existing handleRefresh ...
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

    // Strict masking helper: If masked, show stars. If privacy mode, show stars.
    const maskValue = (val: string | number) => (isMasked || isPrivacyMode) ? '****' : val;
    const strictMask = (val: string | number) => (isMasked || isPrivacyMode) ? '****' : val;

    return (
        <div className="bg-slate-900 shadow-2xl rounded-2xl overflow-hidden border border-slate-700 ring-1 ring-white/10 animate-in fade-in zoom-in duration-300">
            {/* Premium Header - Unchanged */}
            <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 border-b border-libao-gold/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-libao-gold/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-libao-gold via-yellow-200 to-libao-gold tracking-wide">
                            <GraduationCap className="w-8 h-8 text-libao-gold drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                            馬丁個人持倉 (Model Portfolio)
                        </h2>
                        <div className="flex items-center gap-2 mt-2 text-slate-400 text-sm font-medium italic">
                            <Quote className="w-3 h-3 text-libao-gold/50" />
                            <span>播種跟收穫不在同一個季節。</span>
                        </div>
                    </div>
                    <div className="text-right hidden md:flex flex-col items-end gap-2">
                        <div>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">總資產配置 (Total Allocation)</div>
                            <div className="text-2xl font-black text-libao-gold font-mono">{maskValue(totalPercent)}%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile CEO Dashboard View */}
            <div className="md:hidden p-4 space-y-4 bg-slate-900">
                {categories.map((cat, idx) => {
                    const isRedLabel = cat.id === 'tw-red' || cat.name.includes('紅標');
                    const userTier = getTier(userRole || 'viewer');
                    const isLocked = isRedLabel && userTier < AccessTier.FIRST_CLASS;

                    return (
                        <div
                            key={cat.id}
                            className={`group relative overflow-hidden p-5 rounded-xl border transition-all duration-200 
                                ${isLocked
                                    ? 'bg-slate-900/40 border-slate-800 cursor-not-allowed grayscale-[0.5]'
                                    : 'bg-slate-800/50 border-slate-700/50 active:scale-[0.98] hover:border-libao-gold/30 hover:bg-slate-800 cursor-pointer'
                                }`}
                            onClick={() => !isLocked && onSelectCategory(cat.id)}
                        >
                            {!isLocked && <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-libao-gold/0 via-libao-gold/50 to-libao-gold/0 opacity-50 group-hover:opacity-100 transition-opacity"></div>}

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${cat.market === 'TW' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                            {cat.market}
                                        </span>
                                        {!readOnly && onEditCategory && !isLocked ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(cat, 'allocation');
                                                }}
                                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-libao-gold/50 transition-all group/btn"
                                            >
                                                <span className="text-xs font-bold text-libao-gold group-hover/btn:text-yellow-300">{cat.allocationPercent}% 配置</span>
                                                <Edit3 className="w-3 h-3 text-slate-500 group-hover/btn:text-libao-gold" />
                                            </button>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat.allocationPercent}% 配置</span>
                                        )}
                                    </div>
                                    <h3 className={`text-xl font-bold tracking-tight flex items-center gap-2 ${isLocked ? 'text-slate-500' : 'text-slate-100'}`}>
                                        {cat.name}
                                        {/* Name Edit Button for Mobile */}
                                        {!readOnly && onEditCategory && !isLocked && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(cat, 'name');
                                                }}
                                                className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-libao-gold transition-colors"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {isLocked && <Shield className="w-4 h-4 text-slate-600" />}
                                    </h3>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">已實現</div>
                                    <div className={`font-mono font-bold text-base ${isLocked ? 'text-slate-600' : (cat.realizedPnL >= 0 ? 'text-red-400' : 'text-green-400')
                                        }`}>
                                        {cat.realizedPnL > 0 ? '+' : ''}{maskValue(formatTWD(cat.realizedPnL, isPrivacyMode))}
                                    </div>
                                </div>
                            </div>

                            {/* ... Progress Bar ... */}
                            <div className="mb-4">
                                <div className="flex justify-between text-xs font-medium text-slate-400 mb-1.5">
                                    <span>資金使用率</span>
                                    <span className={isLocked ? 'text-slate-500' : 'text-libao-gold'}>{cat.investmentRatio.toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${isLocked ? 'bg-slate-600' : (cat.investmentRatio > 80 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-libao-gold to-yellow-500')}`}
                                        style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className={`flex items-center justify-between pt-3 border-t ${isLocked ? 'border-slate-800' : 'border-slate-700/50'}`}>
                                <div className="flex items-center gap-4">
                                    <div>
                                        <div className="text-[10px] text-slate-500">已投入</div>
                                        <div className={`text-sm font-mono font-bold ${isLocked ? 'text-slate-500' : 'text-slate-300'}`}>{maskValue(formatTWD(cat.investedAmount, isPrivacyMode))}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500">剩餘現金</div>
                                        <div className={`text-sm font-mono font-bold ${isLocked ? 'text-slate-500' : 'text-slate-300'}`}>{maskValue(formatTWD(cat.remainingCash, isPrivacyMode))}</div>
                                    </div>
                                </div>
                                <div className={`flex items-center text-xs font-bold gap-1 ${isLocked ? 'text-slate-600' : 'text-libao-gold'}`}>
                                    {isLocked ? (
                                        <>
                                            <Lock className="w-3.5 h-3.5" /> 限 VIP 權限
                                        </>
                                    ) : (
                                        <>
                                            查看明細 <ArrowRight className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {!readOnly && onAddCategory && (
                    <button
                        onClick={onAddCategory}
                        className="w-full p-5 rounded-xl border border-dashed border-slate-700 hover:border-libao-gold/50 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 text-slate-500 hover:text-libao-gold group"
                    >
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center group-hover:border-libao-gold transition-colors">
                            <span className="text-xl leading-none mb-0.5">+</span>
                        </div>
                        <span className="font-bold text-sm tracking-widest uppercase">新增策略 (Add Strategy)</span>
                    </button>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto bg-slate-900">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/50 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <th className="p-5 w-8 text-center">#</th>
                            <th className="p-5 w-8 text-center">市場</th>
                            <th className="p-5 min-w-[180px] text-center">倉位名稱</th>
                            <th className="p-5 text-center min-w-[40px]">資金配置 (%)</th>
                            <th className="p-5 text-right w-32">預計總投入</th>
                            <th className="p-5 text-right min-w-[120px]">已投入金額</th>
                            <th className="p-5 text-right w-32">剩餘現金</th>
                            <th className="p-5 text-right min-w-[120px]">已實現損益</th>
                            <th className="p-5 text-center w-32">資金使用率</th>
                            <th className="p-5 text-center w-16">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-lg">
                        {categories.map((cat, idx) => {
                            const isRedLabel = cat.id === 'tw-red' || cat.name.includes('紅標');
                            const userTier = getTier(userRole || 'viewer');
                            const isLocked = isRedLabel && userTier < AccessTier.FIRST_CLASS;

                            return (
                                <tr
                                    key={cat.id}
                                    onClick={() => !isLocked && onSelectCategory(cat.id)}
                                    className={`transition-all border-l-4 
                                    ${isLocked
                                            ? 'bg-slate-900/40 opacity-70 cursor-not-allowed border-transparent'
                                            : 'hover:bg-slate-800/80 cursor-pointer group hover:shadow-[0_0_15px_rgba(234,179,8,0.1)] border-transparent hover:border-libao-gold'
                                        }`}
                                >
                                    {/* Index Column */}
                                    <td className="p-5 text-center font-mono text-slate-600 text-sm group-hover:text-libao-gold/50">
                                        {idx + 1}
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${cat.market === 'TW' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                            {cat.market}
                                        </span>
                                    </td>
                                    <td className="p-5 text-center">
                                        <div className={`font-bold transition-colors text-base flex items-center justify-center gap-2 ${isLocked ? 'text-slate-500' : 'text-slate-200 group-hover:text-libao-gold'}`}>
                                            {/* Sort Controls - Vertical Handle Style */}
                                            {!readOnly && onMoveCategory && !isLocked && (
                                                <div className="flex flex-col bg-slate-800/50 rounded-md p-0.5 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'up'); }}
                                                        className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-libao-gold transition-all active:scale-90"
                                                        title="上移"
                                                    >
                                                        <ArrowUp className="w-2.5 h-2.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'down'); }}
                                                        className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-libao-gold transition-all active:scale-90"
                                                        title="下移"
                                                    >
                                                        <ArrowDown className="w-2.5 h-2.5" />
                                                    </button>
                                                </div>
                                            )}
                                            {cat.name}
                                            {isLocked && <Shield className="w-4 h-4 text-slate-600" />}
                                            {/* Name Edit Button */}
                                            {!readOnly && onEditCategory && !isLocked && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEdit(cat, 'name');
                                                    }}
                                                    className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-libao-gold transition-colors opacity-0 group-hover:opacity-100"
                                                    title="編輯名稱"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-5 text-center" onClick={(e) => e.stopPropagation()}>
                                        {!readOnly && onEditCategory && !isLocked ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(cat, 'allocation');
                                                }}
                                                className="flex items-center justify-center gap-1.5 group/btn hover:bg-slate-800 px-2 py-1 rounded transition-colors"
                                            >
                                                <span className="font-mono font-bold text-libao-gold text-lg group-hover/btn:text-yellow-300">{cat.allocationPercent}%</span>
                                                <Edit3 className="w-3 h-3 text-slate-600 group-hover/btn:text-libao-gold opacity-0 group-hover/btn:opacity-100 transition-all" />
                                            </button>
                                        ) : (
                                            <span className="font-mono font-bold text-slate-400 text-lg">{cat.allocationPercent}%</span>
                                        )}
                                    </td>
                                    <td className="p-5 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="font-mono text-slate-500 font-medium">{maskValue(formatTWD(cat.projectedInvestment, isPrivacyMode))}</div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className={`font-mono font-black ${isLocked ? 'text-slate-600' : 'text-slate-200 group-hover:text-white'}`}>{maskValue(formatTWD(cat.investedAmount, isPrivacyMode))}</div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className={`font-mono font-black ${isLocked ? 'text-slate-600' : (cat.remainingCash < 0 ? 'text-red-400' : 'text-green-400')}`}>
                                            {maskValue(formatTWD(cat.remainingCash, isPrivacyMode))}
                                        </div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className={`font-mono font-black ${isLocked ? 'text-slate-600' : (cat.realizedPnL >= 0 ? 'text-red-400' : 'text-green-400')}`}>
                                            {maskValue(formatTWD(cat.realizedPnL, isPrivacyMode))}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${isLocked ? 'bg-slate-600' : (cat.investmentRatio > 100 ? 'bg-red-500' : 'bg-libao-gold')}`}
                                                    style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs font-black min-w-[35px] text-right text-slate-400 font-mono">{strictMask(cat.investmentRatio.toFixed(0))}%</span>
                                        </div>
                                    </td>
                                    <td className="p-5 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button
                                                onClick={(e) => handleRefresh(e, cat.id)}
                                                disabled={refreshingIds.has(cat.id) || isLocked}
                                                className={`p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-all active:scale-95 ${refreshingIds.has(cat.id) ? 'text-blue-400' : 'text-slate-400'}`}
                                                title="更新價格"
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${refreshingIds.has(cat.id) ? 'animate-spin' : ''}`} />
                                            </button>
                                            {!readOnly && onDeleteCategory && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                                                    disabled={isLocked}
                                                    className={`p-1.5 rounded-lg border border-red-900/30 hover:bg-red-900/20 text-red-400 hover:text-red-300 transition-all active:scale-95 ${isLocked ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                    title="刪除"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Add Strategy Row */}
                        {!readOnly && onAddCategory && (
                            <tr
                                onClick={onAddCategory}
                                className="border-t border-slate-700/50 hover:bg-slate-800/80 transition-all cursor-pointer group border-l-4 border-transparent hover:border-libao-gold border-dashed"
                            >
                                <td className="p-5 text-center text-slate-600">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center mx-auto group-hover:border-libao-gold group-hover:text-libao-gold transition-colors">
                                        <span className="text-lg leading-none mb-0.5">+</span>
                                    </div>
                                </td>
                                <td colSpan={10} className="p-5">
                                    <div className="flex items-center text-slate-400 font-bold font-mono group-hover:text-libao-gold transition-colors gap-2">
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
                    isMartingale={true}
                    initialMode={editMode}
                />
            )}
        </div>
    );
};

export default MartingaleSummary;
