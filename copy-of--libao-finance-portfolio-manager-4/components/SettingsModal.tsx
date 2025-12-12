
import React, { useRef, useState } from 'react';
import { X, Save, Upload, Download, Settings } from 'lucide-react';
import { AppSettings, PortfolioState } from '../types';
import { useToast } from '../contexts/ToastContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  fullPortfolio: PortfolioState;
  onImportData: (data: PortfolioState) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  fullPortfolio,
  onImportData
}) => {
  const { showToast } = useToast();
  const [rate, setRate] = useState(settings.usExchangeRate.toString());
  const [enableFees, setEnableFees] = useState(settings.enableFees ?? true);
  const [usBroker, setUsBroker] = useState<'Firstrade' | 'IBKR' | 'Sub-brokerage'>(settings.usBroker || 'Firstrade');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate <= 0) {
      showToast("請輸入有效的匯率", 'error');
      return;
    }
    onUpdateSettings({ 
      ...settings, 
      usExchangeRate: numRate,
      enableFees,
      usBroker
    });
    onClose();
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullPortfolio, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `libao_portfolio_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast("備份檔案下載成功", 'success');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          if (event.target?.result) {
            const parsed = JSON.parse(event.target.result as string);
            // Basic validation
            if (!parsed.categories || !parsed.totalCapital) {
              throw new Error("Invalid file format");
            }
            if (window.confirm("確定要匯入此檔案嗎？這將會覆蓋當前的所有資料。")) {
              onImportData(parsed);
              onClose();
            }
          }
        } catch (err) {
          setImportError("檔案格式錯誤，請確保匯入正確的 JSON 備份檔。");
          showToast("匯入失敗：格式錯誤", 'error');
        }
      };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-lg">
             <Settings className="w-5 h-5" /> 系統設定
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X className="w-6 h-6"/></button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Exchange Rate Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b pb-1">基本設定</h3>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600">美金匯率 (USD/TWD)</label>
              <div className="flex-1 relative">
                 <input 
                   type="number" 
                   value={rate}
                   onChange={(e) => setRate(e.target.value)}
                   className="w-full p-2 border rounded-lg font-mono font-bold text-right pr-8 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                 />
                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">TWD</span>
              </div>
            </div>
          </div>

          {/* Fee Calculation Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b pb-1">手續費設定</h3>
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium text-gray-600">啟用手續費自動計算</label>
               <input 
                 type="checkbox"
                 checked={enableFees}
                 onChange={(e) => setEnableFees(e.target.checked)}
                 className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
               />
            </div>
            
            {enableFees && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2 animate-in fade-in slide-in-from-top-2">
                 <span className="text-xs font-bold text-gray-500 block">美股預設券商</span>
                 <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                       <input 
                         type="radio" 
                         name="usBroker" 
                         value="Firstrade"
                         checked={usBroker === 'Firstrade'}
                         onChange={() => setUsBroker('Firstrade')}
                         className="text-blue-600 focus:ring-blue-500"
                       />
                       Firstrade (0佣金)
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                       <input 
                         type="radio" 
                         name="usBroker" 
                         value="IBKR"
                         checked={usBroker === 'IBKR'}
                         onChange={() => setUsBroker('IBKR')}
                         className="text-blue-600 focus:ring-blue-500"
                       />
                       IBKR (Tiered)
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                       <input 
                         type="radio" 
                         name="usBroker" 
                         value="Sub-brokerage"
                         checked={usBroker === 'Sub-brokerage'}
                         onChange={() => setUsBroker('Sub-brokerage')}
                         className="text-blue-600 focus:ring-blue-500"
                       />
                       複委託 (TW Sub-brokerage)
                    </label>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-1 pl-1">
                    * 費率與低消可於下單介面個別調整
                 </p>
              </div>
            )}
          </div>

          {/* Data Management Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b pb-1">資料管理</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleExport}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors border border-blue-200"
              >
                <Download className="w-4 h-4" /> 匯出備份
              </button>
              
              <button 
                onClick={handleImportClick}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors border border-gray-200"
              >
                <Upload className="w-4 h-4" /> 匯入資料
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".json"
            />
            {importError && <p className="text-xs text-red-500 text-center">{importError}</p>}
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 flex items-center justify-center gap-2 mt-4"
          >
            <Save className="w-4 h-4" /> 儲存設定
          </button>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;