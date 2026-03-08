import React, { useState, useRef } from 'react';
import {
    X, Upload, FileText, CheckCircle, AlertCircle, AlertTriangle,
    ChevronRight, Download, Info, SkipForward, ArrowLeft
} from 'lucide-react';
import { PortfolioState } from '../types';
import {
    parseCsvText,
    validateRows,
    applyImport,
    ValidatedRow,
    ImportFailure,
    ImportResult,
    ValidationResult,
} from '../services/importTradesService';
import { useToast } from '../contexts/ToastContext';
interface ImportTradesModalProps {
    isOpen: boolean;
    onClose: () => void;
    portfolio: PortfolioState;
    onImportComplete: (newPortfolio: PortfolioState) => void;
    onUndo?: () => void;
}

type Step = 'input' | 'preview' | 'done';

const ImportTradesModal: React.FC<ImportTradesModalProps> = ({
    isOpen,
    onClose,
    portfolio,
    onImportComplete,
    onUndo,
}) => {
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>('input');
    const [csvText, setCsvText] = useState('');
    const [fileName, setFileName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Results from validation
    const [validRows, setValidRows] = useState<ValidatedRow[]>([]);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

    // Final import result
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    if (!isOpen) return null;

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = ev => {
            setCsvText(ev.target?.result as string ?? '');
        };
        reader.readAsText(file, 'UTF-8');
        // Reset file input so same file can be re-selected
        e.target.value = '';
    };

    const handleParse = async () => {
        if (!csvText.trim()) {
            showToast('請先上傳 CSV 檔案或貼上 CSV 內容', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            const rawRows = parseCsvText(csvText);
            const result = validateRows(rawRows, portfolio);
            setValidationResult(result);
            setValidRows(result.valid);
            setStep('preview');
        } catch (err) {
            showToast(`解析失敗：${err instanceof Error ? err.message : String(err)}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!validationResult || validRows.length === 0) {
            showToast('沒有可匯入的有效資料', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            const result = applyImport(portfolio, validRows, { dryRun: false });
            // Merge duplicate info from validation
            result.skippedDuplicates = validationResult.duplicates.length;
            result.duplicatesDetail = validationResult.duplicates;

            setImportResult(result);

            if (result.newPortfolio) {
                onImportComplete(result.newPortfolio);
            }
            setStep('done');
        } catch (err) {
            showToast(`匯入失敗：${err instanceof Error ? err.message : String(err)}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setStep('input');
        setCsvText('');
        setFileName('');
        setValidRows([]);
        setValidationResult(null);
        setImportResult(null);
    };

    const downloadSampleCsv = () => {
        const sample = [
            'external_id,trade_date,portfolio,category_name,market,symbol,name,side,quantity,price,exchange_rate,fee,tax,note',
            '20220103-2330-BUY-1,2022-01-03,martingale,台股長波段,TW,2330,台積電,BUY,2000,620,1,1767,0,初始建倉',
            '20220601-2330-SELL-1,2022-06-01,martingale,台股長波段,TW,2330,台積電,SELL,1000,530,1,755,1590,部分停利',
            '20230201-AAPL-BUY-1,2023-02-01,martingale,美股成長,US,AAPL,Apple Inc.,BUY,30,140,30.5,0,0,'
        ].join('\n');
        const blob = new Blob(['\uFEFF' + sample], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'import_trades_sample.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // ---------------------------------------------------------------------------
    // Sub-components
    // ---------------------------------------------------------------------------

    const FailureTable = ({ failures, title }: { failures: ImportFailure[]; title: string }) => (
        <div className="mt-3">
            <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {title}（{failures.length} 筆）
            </p>
            <div className="overflow-x-auto rounded border border-red-200">
                <table className="w-full text-xs">
                    <thead className="bg-red-50">
                        <tr>
                            <th className="px-2 py-1 text-left text-red-600 font-medium whitespace-nowrap">行號</th>
                            <th className="px-2 py-1 text-left text-red-600 font-medium whitespace-nowrap">external_id</th>
                            <th className="px-2 py-1 text-left text-red-600 font-medium whitespace-nowrap">代號</th>
                            <th className="px-2 py-1 text-left text-red-600 font-medium whitespace-nowrap">日期</th>
                            <th className="px-2 py-1 text-left text-red-600 font-medium">原因</th>
                        </tr>
                    </thead>
                    <tbody>
                        {failures.map((f, i) => (
                            <tr key={i} className="border-t border-red-100 hover:bg-red-50/50">
                                <td className="px-2 py-1 font-mono text-red-800">{f.lineNumber}</td>
                                <td className="px-2 py-1 font-mono text-red-800 max-w-[120px] truncate" title={f.externalId}>{f.externalId}</td>
                                <td className="px-2 py-1 font-mono">{f.symbol}</td>
                                <td className="px-2 py-1 font-mono">{f.tradeDate}</td>
                                <td className="px-2 py-1 text-red-900">{f.reason}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-indigo-700 p-4 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <Upload className="w-5 h-5" />
                        歷史交易批次匯入
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex border-b shrink-0 bg-gray-50">
                    {(['input', 'preview', 'done'] as Step[]).map((s, i) => {
                        const labels = ['1. 上傳 CSV', '2. 預覽驗證', '3. 匯入完成'];
                        const isActive = step === s;
                        const isDone = (step === 'preview' && i === 0) || (step === 'done' && i <= 1);
                        return (
                            <div key={s} className={`flex-1 py-2 text-xs text-center font-medium transition-colors
                ${isActive ? 'text-indigo-700 border-b-2 border-indigo-600 bg-white' : ''}
                ${isDone ? 'text-green-600' : ''}
                ${!isActive && !isDone ? 'text-gray-400' : ''}
              `}>
                                {isDone ? <span className="inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" />{labels[i]}</span> : labels[i]}
                            </div>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* ---- STEP: input ---- */}
                    {step === 'input' && (
                        <>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600">上傳 CSV 檔案或直接貼上 CSV 內容。</p>
                                <button
                                    onClick={downloadSampleCsv}
                                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                                >
                                    <Download className="w-3 h-3" /> 下載範例 CSV
                                </button>
                            </div>

                            {/* File upload */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-indigo-300 rounded-xl p-6 text-center cursor-pointer hover:bg-indigo-50 transition-colors"
                            >
                                <FileText className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                                <p className="text-sm font-medium text-indigo-700">
                                    {fileName ? `已選擇：${fileName}` : '點擊選擇 CSV 檔案'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">支援 UTF-8 編碼</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            <div className="text-center text-xs text-gray-400">— 或直接貼上 CSV 內容 —</div>

                            <textarea
                                value={csvText}
                                onChange={e => setCsvText(e.target.value)}
                                placeholder={`external_id,trade_date,portfolio,category_name,market,symbol,name,side,quantity,price,...\n20220103-2330-BUY-1,2022-01-03,martingale,台股長波段,TW,2330,台積電,BUY,2000,620,...`}
                                className="w-full h-36 p-3 border rounded-lg font-mono text-xs resize-none focus:ring-2 focus:ring-indigo-400 outline-none"
                            />

                            {/* Field reference */}
                            <details className="bg-gray-50 rounded-lg border border-gray-200">
                                <summary className="px-3 py-2 text-xs font-medium text-gray-600 cursor-pointer flex items-center gap-1">
                                    <Info className="w-3 h-3" /> 欄位說明（點擊展開）
                                </summary>
                                <div className="px-3 pb-3 overflow-x-auto">
                                    <table className="w-full text-xs mt-2">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-1 pr-3 text-gray-500">欄位</th>
                                                <th className="text-left py-1 pr-3 text-gray-500">必填</th>
                                                <th className="text-left py-1 text-gray-500">說明</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {[
                                                ['external_id', '必填', '唯一識別符，建議 YYYYMMDD-SYMBOL-SIDE-N'],
                                                ['trade_date', '必填', 'YYYY-MM-DD 格式'],
                                                ['portfolio', '必填', 'personal 或 martingale'],
                                                ['category_name', '必填', '需與系統現有分類名稱完全相符'],
                                                ['market', '必填', 'TW 或 US'],
                                                ['symbol', '必填', '大寫股票代號'],
                                                ['name', '必填', '股票名稱'],
                                                ['side', '必填', 'BUY 或 SELL'],
                                                ['quantity', '必填', '正整數（TW）或正數（US）'],
                                                ['price', '必填', '原始幣別單價'],
                                                ['exchange_rate', '選填', '匯率，US 市場必填，預設 1'],
                                                ['fee', '選填', '手續費 TWD，預設 0'],
                                                ['tax', '選填', '交易稅 TWD，預設 0'],
                                                ['note', '選填', '備注'],
                                            ].map(([f, r, d]) => (
                                                <tr key={f}>
                                                    <td className="py-1 pr-3 font-mono font-bold text-indigo-700">{f}</td>
                                                    <td className="py-1 pr-3">{r === '必填' ? <span className="text-red-500 font-bold">{r}</span> : <span className="text-gray-400">{r}</span>}</td>
                                                    <td className="py-1 text-gray-600">{d}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        </>
                    )}

                    {/* ---- STEP: preview ---- */}
                    {step === 'preview' && validationResult && (
                        <>
                            {/* Summary cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-green-700">{validationResult.valid.length}</p>
                                    <p className="text-xs text-green-600 mt-1">✓ 可匯入</p>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-red-700">{validationResult.failures.length}</p>
                                    <p className="text-xs text-red-600 mt-1">✗ 驗證失敗</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-amber-700">{validationResult.duplicates.length}</p>
                                    <p className="text-xs text-amber-600 mt-1">⊘ 重複略過</p>
                                </div>
                            </div>

                            {/* Valid rows preview */}
                            {validationResult.valid.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> 即將匯入（{validationResult.valid.length} 筆）
                                    </p>
                                    <div className="overflow-x-auto rounded border border-green-200 max-h-48">
                                        <table className="w-full text-xs">
                                            <thead className="bg-green-50 sticky top-0">
                                                <tr>
                                                    {['行號', '組合', '分類', '代號', '方向', '股數', '單價', '匯率', '手續費', '稅', '日期'].map(h => (
                                                        <th key={h} className="px-2 py-1 text-left text-green-700 font-medium whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {validationResult.valid.map((r, i) => (
                                                    <tr key={i} className="border-t border-green-100 hover:bg-green-50/50">
                                                        <td className="px-2 py-1 font-mono text-gray-500">{r.lineNumber}</td>
                                                        <td className="px-2 py-1">{r.portfolio === 'martingale' ? '馬丁' : '個人'}</td>
                                                        <td className="px-2 py-1 max-w-[80px] truncate" title={r.categoryName}>{r.categoryName}</td>
                                                        <td className="px-2 py-1 font-mono font-bold">{r.symbol}</td>
                                                        <td className={`px-2 py-1 font-bold ${r.side === 'BUY' ? 'text-red-600' : 'text-green-700'}`}>{r.side}</td>
                                                        <td className="px-2 py-1 font-mono">{r.quantity.toLocaleString()}</td>
                                                        <td className="px-2 py-1 font-mono">{r.price}</td>
                                                        <td className="px-2 py-1 font-mono">{r.exchangeRate}</td>
                                                        <td className="px-2 py-1 font-mono">{r.fee}</td>
                                                        <td className="px-2 py-1 font-mono">{r.tax}</td>
                                                        <td className="px-2 py-1 font-mono whitespace-nowrap">{r.tradeDate.split('T')[0]}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Validation failures */}
                            {validationResult.failures.length > 0 && (
                                <FailureTable failures={validationResult.failures} title="驗證失敗（不匯入）" />
                            )}

                            {/* Duplicates */}
                            {validationResult.duplicates.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                                        <SkipForward className="w-3 h-3" /> 已存在略過（{validationResult.duplicates.length} 筆）
                                    </p>
                                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs font-mono text-amber-800 flex flex-wrap gap-2">
                                        {validationResult.duplicates.map(d => (
                                            <span key={d.externalId} className="bg-amber-100 px-2 py-0.5 rounded">
                                                行 {d.lineNumber}: {d.externalId}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {validationResult.valid.length === 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center text-sm text-yellow-800">
                                    <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-yellow-600" />
                                    沒有通過驗證的資料可匯入，請修正 CSV 後重試。
                                </div>
                            )}
                        </>
                    )}

                    {/* ---- STEP: done ---- */}
                    {step === 'done' && importResult && (
                        <>
                            <div className="text-center py-4">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                <p className="text-lg font-bold text-green-700">匯入完成</p>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-green-700">{importResult.successCount}</p>
                                    <p className="text-xs text-green-600 mt-1">✓ 成功匯入</p>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-red-700">{importResult.failureCount}</p>
                                    <p className="text-xs text-red-600 mt-1">✗ 匯入失敗</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-amber-700">{importResult.skippedDuplicates}</p>
                                    <p className="text-xs text-amber-600 mt-1">⊘ 重複略過</p>
                                </div>
                            </div>

                            {importResult.failures.length > 0 && (
                                <FailureTable failures={importResult.failures} title="匯入時失敗（請修正後重試）" />
                            )}

                            {importResult.duplicatesDetail.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                                        <SkipForward className="w-3 h-3" /> 已存在略過
                                    </p>
                                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs font-mono text-amber-800 flex flex-wrap gap-2">
                                        {importResult.duplicatesDetail.map(d => (
                                            <span key={d.externalId} className="bg-amber-100 px-2 py-0.5 rounded">
                                                行 {d.lineNumber}: {d.externalId}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer buttons */}
                <div className="border-t p-4 flex justify-between items-center shrink-0 bg-gray-50">
                    {step === 'input' && (
                        <>
                            <div className="flex gap-2">
                                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                                    取消
                                </button>
                                {onUndo && (
                                    <button
                                        onClick={() => { onUndo(); onClose(); }}
                                        className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1 border border-red-200 rounded-lg hover:bg-red-50"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> 復原上一步 (Undo)
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={handleParse}
                                disabled={!csvText.trim() || isProcessing}
                                className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isProcessing ? '解析中...' : <>解析並預覽 <ChevronRight className="w-4 h-4" /></>}
                            </button>
                        </>
                    )}

                    {step === 'preview' && (
                        <>
                            <button onClick={handleReset} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                                ← 重新上傳
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={validRows.length === 0 || isProcessing}
                                className="px-5 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isProcessing ? '匯入中...' : <>確認匯入 {validRows.length} 筆 <ChevronRight className="w-4 h-4" /></>}
                            </button>
                        </>
                    )}

                    {step === 'done' && (
                        <>
                            <div className="flex gap-2">
                                <button onClick={handleReset} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                                    繼續匯入
                                </button>
                                {onUndo && (
                                    <button
                                        onClick={() => { onUndo(); onClose(); }}
                                        className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1 border border-red-200 rounded-lg hover:bg-red-50"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> 復原上一步 (Undo)
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700"
                            >
                                關閉
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportTradesModal;
