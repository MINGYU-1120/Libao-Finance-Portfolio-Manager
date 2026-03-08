
import React, { useState } from 'react';
import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    Wallet,
    PieChart,
    ArrowRight,
    ChevronRight,
    RefreshCw,
    Trash2,
    Edit3,
    ArrowUp,
    ArrowDown,
    Quote,
    Briefcase,
    ArrowRightLeft as TransferIcon
} from 'lucide-react';
import { CalculatedCategory, CalculatedAsset, AccessTier, getTier, UserRole } from '../types';
import { formatTWD } from '../utils/formatting';
import EditCategoryModal from './EditCategoryModal';
import CashTransferModal from './CashTransferModal';

interface PersonalSummaryProps {
    categories: CalculatedCategory[];
    totalCapital: number;
    onSelectCategory: (id: string) => void;
    onRefreshCategory: (id: string) => Promise<void>;
    onEditCategory?: (id: string, name: string, allocation: number, note?: string) => void;
    onDeleteCategory?: (id: string) => void;
    onMoveCategory?: (id: string, direction: 'up' | 'down') => void;
    onAddCategory?: () => void;
    onTransferCash?: (fromId: string, toId: string, amount: number, mode: 'budget' | 'profit') => void;
    onCompare?: () => void;
    userRole?: UserRole;
    isPrivacyMode: boolean;
    readOnly?: boolean;
}

const PersonalSummary: React.FC<PersonalSummaryProps> = ({
    categories,
    totalCapital,
    onSelectCategory,
    onRefreshCategory,
    onEditCategory,
    onDeleteCategory,
    onMoveCategory,
    onAddCategory,
    onTransferCash,
    isPrivacyMode,
    readOnly = false
}) => {
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<CalculatedCategory | null>(null);
    const [editMode, setEditMode] = useState<'name' | 'allocation'>('name');

    // Transfer states
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferSource, setTransferSource] = useState<CalculatedCategory | null>(null);

    // Privacy masking helpers
    const maskValue = (val: string | number) => isPrivacyMode ? '****' : val;
    const strictMask = (val: string | number) => isPrivacyMode ? '****' : val;

    const handleRefresh = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (refreshingIds.has(id)) return;
        setRefreshingIds(prev => new Set(prev).add(id));
        try {
            await onRefreshCategory(id);
        } finally {
            setRefreshingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleEdit = (cat: CalculatedCategory, mode: 'name' | 'allocation') => {
        setEditingCategory(cat);
        setEditMode(mode);
        setIsEditModalOpen(true);
    };

    const totalAllocation = categories.reduce((sum, cat) => sum + cat.allocationPercent, 0);

    return (
        <div className="bg-slate-900 shadow-2xl rounded-2xl overflow-hidden border border-slate-700 ring-1 ring-white/10 animate-in fade-in zoom-in duration-300">
            {/* Premium Header */}
            <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 border-b border-libao-gold/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-libao-gold/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-libao-gold via-yellow-200 to-libao-gold tracking-wide">
                            <Briefcase className="w-8 h-8 text-libao-gold drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                            個人持倉總覽 (Personal Portfolio)
                        </h2>
                        <div className="flex items-center gap-2 mt-2 text-slate-400 text-sm font-medium italic">
                            <Quote className="w-3 h-3 text-libao-gold/50" />
                            <span>掌握資產動態，成就卓越投資。</span>
                        </div>
                    </div>
                    <div className="text-right hidden md:flex flex-col items-end gap-2">
                        <div>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">當前總配置 (Total Allocation)</div>
                            <div className="text-2xl font-black text-libao-gold font-mono">{totalAllocation.toFixed(2)}%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile View - Unified with Martingale Style but Cyan Themed */}
            <div className="md:hidden p-4 space-y-4 bg-slate-900 font-sans">
                {categories.map((cat, idx) => (
                    <div
                        key={cat.id}
                        className="group relative overflow-hidden p-5 rounded-xl border bg-slate-800/50 border-slate-700/50 active:scale-[0.98] hover:border-cyan-500/30 hover:bg-slate-800 cursor-pointer transition-all duration-200"
                        onClick={() => onSelectCategory(cat.id)}
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500/0 via-cyan-500/50 to-cyan-500/0 opacity-50 group-hover:opacity-100 transition-opacity"></div>

                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${cat.market === 'TW' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                        {cat.market}
                                    </span>
                                    {!readOnly && onEditCategory ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(cat, 'allocation');
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 transition-all group/btn"
                                        >
                                            <span className="text-xs font-bold text-cyan-400 group-hover/btn:text-cyan-300">{cat.allocationPercent.toFixed(2)}% 配置</span>
                                            <Edit3 className="w-3 h-3 text-slate-500 group-hover/btn:text-cyan-400" />
                                        </button>
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{cat.allocationPercent.toFixed(2)}% 配置</span>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                                    {cat.name}
                                    {!readOnly && onEditCategory && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(cat, 'name');
                                            }}
                                            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-cyan-400 transition-colors"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </h3>
                                {cat.note && (
                                    <p className="text-xs text-slate-500 italic mt-0.5 ml-0.5">{cat.note}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">已實現</div>
                                <div className={`font-mono font-bold text-base ${cat.realizedPnL >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {cat.realizedPnL > 0 ? '+' : ''}{maskValue(formatTWD(cat.realizedPnL || 0, isPrivacyMode))}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                            <div className="flex justify-between text-xs font-medium text-slate-400 mb-1.5">
                                <span>資金使用率</span>
                                <span className="text-cyan-400">{cat.investmentRatio.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${cat.investmentRatio > 80 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}
                                    style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                            <div className="flex items-center gap-4">
                                <div>
                                    <div className="text-[10px] text-slate-500">已投入</div>
                                    <div className="text-sm font-mono font-bold text-slate-300">{maskValue(formatTWD(cat.investedAmount, isPrivacyMode))}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500">剩餘現金</div>
                                    <div className="text-sm font-mono font-bold text-slate-300">{maskValue(formatTWD(cat.remainingCash, isPrivacyMode))}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => handleRefresh(e, cat.id)}
                                    className="p-2 rounded-lg bg-slate-800 text-slate-400 active:bg-slate-700 border border-slate-700"
                                >
                                    <RefreshCw className={`w-4 h-4 ${refreshingIds.has(cat.id) ? 'animate-spin' : ''}`} />
                                </button>
                                {!readOnly && onTransferCash && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTransferSource(cat);
                                            setIsTransferModalOpen(true);
                                        }}
                                        disabled={cat.remainingCash <= 0 && (cat.availableProfit || 0) <= 0}
                                        className={`p-2 rounded-lg bg-slate-800 text-cyan-400 active:bg-slate-700 border border-slate-700 ${cat.remainingCash <= 0 && (cat.availableProfit || 0) <= 0 ? 'opacity-30' : ''}`}
                                    >
                                        <TransferIcon className="w-4 h-4" />
                                    </button>
                                )}
                                <div className="ml-2 flex items-center text-cyan-400 text-xs font-bold gap-1">
                                    查看明細 <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {onAddCategory && (
                    <button
                        onClick={onAddCategory}
                        className="w-full p-5 rounded-xl border border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 text-slate-500 hover:text-cyan-400 group"
                    >
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center group-hover:border-cyan-500 transition-colors">
                            <span className="text-xl leading-none mb-0.5">+</span>
                        </div>
                        <span className="font-bold text-sm tracking-widest uppercase">新增個人策略 (Add Strategy)</span>
                    </button>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto bg-slate-900">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/50 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <th className="p-5 w-8 text-center">#</th>
                            <th className="p-5 w-12 text-center text-[10px]">市場</th>
                            <th className="p-5 min-w-[180px] text-center">倉位名稱</th>
                            <th className="p-5 text-center min-w-[40px] text-[10px]">資金配置 (%)</th>
                            <th className="p-5 text-right w-32 font-mono text-[10px]">預計總投入</th>
                            <th className="p-5 text-right min-w-[120px] font-mono text-[10px]">已投入金額</th>
                            <th className="p-5 text-right w-32 font-mono text-[10px]">剩餘現金</th>
                            <th className="p-5 text-right min-w-[120px] font-mono text-[10px]">已實現損益</th>
                            <th className="p-5 text-center w-32 text-[10px]">資金使用率</th>
                            <th className="p-5 text-center w-24 text-[10px]">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-lg">
                        {categories.map((cat, idx) => (
                            <tr
                                key={cat.id}
                                onClick={() => onSelectCategory(cat.id)}
                                className="group hover:bg-slate-800/50 transition-all cursor-pointer border-l-4 border-transparent hover:border-libao-gold"
                            >
                                <td className="p-5 text-center text-slate-600 font-mono text-sm">{idx + 1}</td>
                                <td className="p-5 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase border ${cat.market === 'TW' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-cyan-500 border-cyan-500/20'}`}>
                                        {cat.market}
                                    </span>
                                </td>
                                <td className="p-5 text-center">
                                    <div className="font-black text-slate-200 group-hover:text-libao-gold transition-colors text-base flex items-center justify-center gap-3">
                                        <div className="flex flex-col bg-slate-800 rounded-md p-0.5 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!readOnly && onMoveCategory && (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'up'); }} className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-libao-gold transition-all active:scale-95"><ArrowUp className="w-3 h-3" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'down'); }} className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-libao-gold transition-all active:scale-95"><ArrowDown className="w-3 h-3" /></button>
                                                </>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 font-bold">
                                                {cat.name}
                                                {!readOnly && <button onClick={(e) => { e.stopPropagation(); handleEdit(cat, 'name'); }} className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-libao-gold transition-colors opacity-0 group-hover:opacity-100"><Edit3 className="w-3 h-3" /></button>}
                                            </div>
                                            {cat.note && <div className="text-[10px] text-slate-500 font-medium italic mt-0.5 ml-0.5 leading-none">{cat.note}</div>}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5 text-center min-w-[40px]">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="font-mono font-bold text-libao-gold text-lg">
                                            {cat.allocationPercent.toFixed(2)}%
                                        </div>
                                        {!readOnly && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEdit(cat, 'allocation'); }}
                                                className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 text-slate-500 hover:text-libao-gold transition-all opacity-0 group-hover:opacity-100 scale-90"
                                                title="編輯配置"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="p-5 text-right font-mono text-slate-500 font-medium whitespace-nowrap">
                                    {maskValue(formatTWD(cat.projectedInvestment, isPrivacyMode))}
                                </td>
                                <td className="p-5 text-right font-mono text-slate-200 font-black whitespace-nowrap">
                                    {maskValue(formatTWD(cat.investedAmount, isPrivacyMode))}
                                </td>
                                <td className="p-5 text-right font-mono font-black whitespace-nowrap">
                                    <div className={cat.remainingCash < 0 ? 'text-red-400' : 'text-emerald-400'}>
                                        {maskValue(formatTWD(cat.remainingCash, isPrivacyMode))}
                                    </div>
                                </td>
                                <td className="p-5 text-right font-mono font-black whitespace-nowrap">
                                    <span className={cat.realizedPnL >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                                        {maskValue(formatTWD(cat.realizedPnL || 0, isPrivacyMode))}
                                    </span>
                                </td>
                                <td className="p-5">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${cat.investmentRatio > 100 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-libao-gold shadow-[0_0_8px_rgba(234,179,8,0.3)]'}`}
                                                style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[10px] font-black min-w-[35px] text-right text-slate-500 font-mono tracking-tighter">{strictMask(cat.investmentRatio.toFixed(0))}%</span>
                                    </div>
                                </td>
                                <td className="p-5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <button
                                            onClick={(e) => handleRefresh(e, cat.id)}
                                            disabled={refreshingIds.has(cat.id)}
                                            className={`p-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all active:scale-95 ${refreshingIds.has(cat.id) ? 'text-libao-gold' : 'text-slate-500'}`}
                                            title="更新價格"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingIds.has(cat.id) ? 'animate-spin' : ''}`} />
                                        </button>
                                        {!readOnly && onTransferCash && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTransferSource(cat);
                                                    setIsTransferModalOpen(true);
                                                }}
                                                disabled={cat.remainingCash <= 0 && (cat.availableProfit || 0) <= 0}
                                                className={`p-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all active:scale-95 ${cat.remainingCash <= 0 && (cat.availableProfit || 0) <= 0 ? 'opacity-30 cursor-not-allowed text-slate-700' : 'text-libao-gold'}`}
                                                title="資金轉移/再投入"
                                            >
                                                <TransferIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {!readOnly && onDeleteCategory && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                                                className="p-1.5 rounded-lg border border-red-900/30 hover:bg-red-900/20 text-red-400 hover:text-red-300 transition-all active:scale-95"
                                                title="刪除"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-libao-gold ml-1 transition-all group-hover:translate-x-1" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {/* Add Strategy Row */}
                        {onAddCategory && (
                            <tr
                                onClick={onAddCategory}
                                className="border-t border-white/5 hover:bg-slate-800 transition-all cursor-pointer group"
                            >
                                <td className="p-5 text-center text-slate-600">
                                    <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto group-hover:border-libao-gold group-hover:text-libao-gold transition-colors">
                                        <span className="text-lg leading-none mb-0.5">+</span>
                                    </div>
                                </td>
                                <td colSpan={9} className="p-5">
                                    <div className="flex items-center text-slate-500 font-bold font-mono group-hover:text-libao-gold transition-colors gap-2 tracking-[0.2em] uppercase text-[10px]">
                                        新增個人策略 (Add Strategy)
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
                    onSave={(id, name, alloc, note) => {
                        if (onEditCategory) onEditCategory(id, name, alloc, note);
                    }}
                    isPrivacyMode={isPrivacyMode}
                    initialMode={editMode}
                />
            )}

            {/* Transfer Modal */}
            {transferSource && (
                <CashTransferModal
                    isOpen={isTransferModalOpen}
                    onClose={() => { setIsTransferModalOpen(false); setTransferSource(null); }}
                    sourceCategory={transferSource}
                    allCategories={categories}
                    totalCapital={totalCapital}
                    isPrivacyMode={isPrivacyMode}
                    onTransfer={(fromId, toId, amount, mode) => {
                        if (onTransferCash) onTransferCash(fromId, toId, amount, mode);
                    }}
                />
            )}
        </div>
    );
};

export default PersonalSummary;
