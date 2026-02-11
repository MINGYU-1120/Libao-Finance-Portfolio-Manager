import React, { useState } from 'react';
import { CalculatedCategory } from '../types';
import { PieChart, RefreshCw, ChevronRight, GraduationCap, ArrowRight, Quote, ArrowUp, ArrowDown, Trash2, Check } from 'lucide-react';
import { formatTWD } from '../utils/formatting';

interface MartingaleSummaryProps {
    categories: CalculatedCategory[];
    totalCapital: number;
    onUpdateAllocation?: (id: string, percent: number) => void;
    onSelectCategory: (id: string) => void;
    onRefreshCategory?: (id: string) => Promise<void>;
    onDeleteCategory?: (id: string) => void;
    onMoveCategory?: (id: string, direction: 'up' | 'down') => void;
    onAddCategory?: () => void; // New prop
    isPrivacyMode: boolean;
    isMasked?: boolean;
    readOnly?: boolean;
}

const MartingaleSummary: React.FC<MartingaleSummaryProps> = ({
    categories,
    totalCapital,
    onUpdateAllocation,
    onSelectCategory,
    onRefreshCategory,
    onDeleteCategory,
    onMoveCategory,
    onAddCategory, // destructure
    isPrivacyMode,
    isMasked = false,
    readOnly = true
}) => {
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
    const [editingMobileId, setEditingMobileId] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState('');
    const [mobileEditMode, setMobileEditMode] = useState<'percent' | 'amount'>('percent');

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

    // Strict masking helper: If masked, show stars. If privacy mode, show stars.
    const maskValue = (val: string | number) => (isMasked || isPrivacyMode) ? '****' : val;
    const strictMask = (val: string | number) => (isMasked || isPrivacyMode) ? '****' : val;

    return (
        <div className="bg-slate-900 shadow-2xl rounded-2xl overflow-hidden border border-slate-700 ring-1 ring-white/10 animate-in fade-in zoom-in duration-300">
            {/* Premium Header */}
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
                {categories.map((cat, idx) => (
                    <div
                        key={cat.id}
                        className="group relative overflow-hidden p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 active:scale-[0.98] transition-all duration-200 hover:border-libao-gold/30 hover:bg-slate-800"
                        onClick={() => onSelectCategory(cat.id)}
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-libao-gold/0 via-libao-gold/50 to-libao-gold/0 opacity-50 group-hover:opacity-100 transition-opacity"></div>

                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${cat.market === 'TW' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                        {cat.market}
                                    </span>
                                    {!readOnly && onUpdateAllocation ? (
                                        editingMobileId === cat.id ? (
                                            <div className="flex flex-col gap-3 w-full p-2 bg-slate-900/50 rounded-lg border border-libao-gold/20" onClick={e => e.stopPropagation()}>
                                                {/* Mode Switcher */}
                                                <div className="flex p-0.5 bg-slate-800 rounded-md self-start">
                                                    <button
                                                        onClick={() => {
                                                            setMobileEditMode('percent');
                                                            setTempValue(cat.allocationPercent.toString());
                                                        }}
                                                        className={`px-3 py-1 text-[10px] font-black rounded transition-all ${mobileEditMode === 'percent' ? 'bg-libao-gold text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                                    >
                                                        比例 (%)
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setMobileEditMode('amount');
                                                            setTempValue(cat.projectedInvestment.toString());
                                                        }}
                                                        className={`px-3 py-1 text-[10px] font-black rounded transition-all ${mobileEditMode === 'amount' ? 'bg-libao-gold text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                                    >
                                                        金額 ($)
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        {mobileEditMode === 'percent' ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    autoFocus
                                                                    type="number"
                                                                    value={tempValue}
                                                                    onChange={e => setTempValue(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') {
                                                                            const val = Number(tempValue);
                                                                            if (!isNaN(val)) onUpdateAllocation(cat.id, val);
                                                                            setEditingMobileId(null);
                                                                        }
                                                                    }}
                                                                    className="w-full h-10 text-center bg-slate-800 border border-libao-gold/50 rounded text-libao-gold font-black text-lg focus:outline-none focus:border-libao-gold"
                                                                />
                                                                <span className="text-sm font-bold text-libao-gold">%</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    autoFocus
                                                                    type="number"
                                                                    placeholder="輸入金額"
                                                                    value={tempValue}
                                                                    onChange={e => setTempValue(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') {
                                                                            const val = Number(tempValue);
                                                                            if (!isNaN(val) && totalCapital > 0) {
                                                                                onUpdateAllocation(cat.id, (val / totalCapital) * 100);
                                                                            }
                                                                            setEditingMobileId(null);
                                                                        }
                                                                    }}
                                                                    className="w-full h-10 text-center bg-slate-800 border border-libao-gold/30 rounded text-slate-200 font-bold text-lg focus:outline-none focus:border-libao-gold"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const val = Number(tempValue);
                                                            if (!isNaN(val)) {
                                                                if (mobileEditMode === 'percent') {
                                                                    onUpdateAllocation(cat.id, val);
                                                                } else if (totalCapital > 0) {
                                                                    onUpdateAllocation(cat.id, (val / totalCapital) * 100);
                                                                }
                                                            }
                                                            setEditingMobileId(null);
                                                        }}
                                                        className="p-2.5 bg-libao-gold hover:bg-yellow-500 text-slate-900 rounded-lg shadow-lg shadow-libao-gold/40 active:scale-95 transition-all"
                                                    >
                                                        <Check className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingMobileId(cat.id);
                                                    setTempValue(cat.allocationPercent.toString());
                                                }}
                                                className="flex flex-col items-start gap-0.5 group/btn"
                                            >
                                                <div className="flex items-center gap-1 text-xs font-bold text-slate-500 group-hover/btn:text-libao-gold transition-colors">
                                                    <span className="uppercase tracking-wider border-b border-transparent hover:border-libao-gold/50">{cat.allocationPercent}% 配置</span>
                                                    <ChevronRight className="w-3 h-3 opacity-40" />
                                                </div>
                                                <div className="text-[10px] text-slate-600 font-medium">
                                                    約 {maskValue(formatTWD(cat.projectedInvestment, isPrivacyMode))}
                                                </div>
                                            </button>
                                        )
                                    ) : (
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat.allocationPercent}% 配置</span>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-slate-100 tracking-tight">{cat.name}</h3>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">已實現</div>
                                <div className={`font-mono font-bold text-base ${cat.realizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {cat.realizedPnL > 0 ? '+' : ''}{maskValue(formatTWD(cat.realizedPnL, isPrivacyMode))}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar Visual */}
                        <div className="mb-4">
                            <div className="flex justify-between text-xs font-medium text-slate-400 mb-1.5">
                                <span>資金使用率</span>
                                <span className="text-libao-gold">{cat.investmentRatio.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${cat.investmentRatio > 80 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-libao-gold to-yellow-500'}`}
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
                            <div className="flex items-center text-xs font-bold text-libao-gold gap-1">
                                查看明細 <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto bg-slate-900">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/50 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <th className="p-5 w-8 text-center">#</th>
                            <th className="p-5 w-8 text-center">市場</th>
                            <th className="p-5 min-w-[180px]">倉位名稱</th>
                            <th className="p-5 text-center min-w-[40px]">資金配置 (%)</th>
                            <th className="p-5 text-right w-32">預計總投入</th>
                            <th className="p-5 text-right min-w-[120px]">已投入金額</th>
                            <th className="p-5 text-right w-32">剩餘現金</th>
                            <th className="p-5 text-right min-w-[120px]">已實現損益</th>
                            <th className="p-5 text-center w-32">資金使用率</th>
                            {!readOnly && <th className="p-5 text-center w-16">操作</th>}
                            <th className="p-5 text-center w-20"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-lg">
                        {categories.map((cat, idx) => (
                            <tr
                                key={cat.id}
                                onClick={() => onSelectCategory(cat.id)}
                                className="hover:bg-slate-800/80 transition-all cursor-pointer group hover:shadow-[0_0_15px_rgba(234,179,8,0.1)] border-l-4 border-transparent hover:border-libao-gold"
                            >
                                <td className="p-5 text-center font-mono text-slate-600 text-sm group-hover:text-libao-gold/50">{idx + 1}</td>
                                <td className="p-5 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${cat.market === 'TW' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                        {cat.market}
                                    </span>
                                </td>
                                <td className="p-5">
                                    <div className="font-bold text-slate-200 group-hover:text-libao-gold transition-colors text-base flex items-center gap-2">
                                        {cat.name}
                                        {!readOnly && onMoveCategory && (
                                            <div className="flex flex-col ml-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'up'); }}
                                                    className="text-slate-400 hover:text-libao-gold active:scale-95"
                                                    title="上移"
                                                >
                                                    <ArrowUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id, 'down'); }}
                                                    className="text-slate-400 hover:text-libao-gold active:scale-95"
                                                    title="下移"
                                                >
                                                    <ArrowDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-5 text-center" onClick={(e) => e.stopPropagation()}>
                                    {!readOnly && onUpdateAllocation ? (
                                        <div className="flex items-center justify-center gap-0.5">
                                            <input
                                                type="text"
                                                value={isMasked ? '****' : cat.allocationPercent}
                                                onChange={(e) => onUpdateAllocation(cat.id, Number(e.target.value))}
                                                disabled={isMasked}
                                                className="w-12 text-center border-b border-libao-gold bg-transparent font-mono font-black text-libao-gold focus:outline-none focus:border-yellow-300 disabled:text-slate-500 text-lg"
                                            />
                                            <span className="text-slate-500 text-xs font-bold">%</span>
                                        </div>
                                    ) : (
                                        <span className="font-mono font-bold text-slate-400 text-lg">{cat.allocationPercent}%</span>
                                    )}
                                </td>
                                <td className="p-5 text-right" onClick={(e) => e.stopPropagation()}>
                                    {!readOnly && onUpdateAllocation ? (
                                        <div className="flex flex-col items-end gap-1">
                                            <input
                                                type="number"
                                                defaultValue={cat.projectedInvestment}
                                                key={cat.id + '-' + cat.projectedInvestment}
                                                onBlur={(e) => {
                                                    const val = Number(e.target.value);
                                                    if (!isNaN(val) && totalCapital > 0) {
                                                        onUpdateAllocation(cat.id, (val / totalCapital) * 100);
                                                    }
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        const val = Number((e.target as HTMLInputElement).value);
                                                        if (!isNaN(val) && totalCapital > 0) {
                                                            onUpdateAllocation(cat.id, (val / totalCapital) * 100);
                                                        }
                                                        (e.target as HTMLInputElement).blur();
                                                    }
                                                }}
                                                disabled={isMasked}
                                                className="w-32 text-right border-b border-white/10 bg-transparent font-mono font-medium text-slate-400 focus:outline-none focus:border-libao-gold transition-colors disabled:text-slate-500"
                                            />
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">金額 (Amount)</div>
                                        </div>
                                    ) : (
                                        <div className="font-mono text-slate-500 font-medium">{maskValue(formatTWD(cat.projectedInvestment, isPrivacyMode))}</div>
                                    )}
                                </td>
                                <td className="p-5 text-right">
                                    <div className="font-mono font-black text-slate-200 group-hover:text-white">{maskValue(formatTWD(cat.investedAmount, isPrivacyMode))}</div>
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
                                        <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${cat.investmentRatio > 100 ? 'bg-red-500' : 'bg-libao-gold'}`}
                                                style={{ width: `${Math.min(cat.investmentRatio, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs font-black min-w-[35px] text-right text-slate-400 font-mono">{strictMask(cat.investmentRatio.toFixed(0))}%</span>
                                    </div>
                                </td>
                                {!readOnly && (
                                    <td className="p-5 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button
                                                onClick={(e) => handleRefresh(e, cat.id)}
                                                disabled={refreshingIds.has(cat.id)}
                                                className={`p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-all active:scale-95 ${refreshingIds.has(cat.id) ? 'text-blue-400' : 'text-slate-400'}`}
                                                title="更新價格"
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${refreshingIds.has(cat.id) ? 'animate-spin' : ''}`} />
                                            </button>
                                            {onDeleteCategory && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                                                    className="p-1.5 rounded-lg border border-red-900/30 hover:bg-red-900/20 text-red-400 hover:text-red-300 transition-all active:scale-95"
                                                    title="刪除"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                                <td className="p-5 text-center">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                                        <ChevronRight className="w-6 h-6 text-libao-gold" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {/* New Add Strategy Row - Mobile & Desktop compatible logic inside table? Desktop Table only here. */}
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
        </div>
    );
};

export default MartingaleSummary;
