
import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, Info } from 'lucide-react';
import { AppSettings } from '../types';
import { useToast } from '../contexts/ToastContext';

interface FeeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

const FeeSettingsModal: React.FC<FeeSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings
}) => {
  const { showToast } = useToast();
  const [enableFees, setEnableFees] = useState(settings.enableFees ?? true);
  const [usBroker, setUsBroker] = useState(settings.usBroker || 'Firstrade');
  const [twDiscount, setTwDiscount] = useState(settings.twFeeDiscount?.toString() || '6');

  useEffect(() => {
    if (isOpen) {
      setEnableFees(settings.enableFees ?? true);
      setUsBroker(settings.usBroker || 'Firstrade');
      setTwDiscount(settings.twFeeDiscount?.toString() || '6');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    const numTwDiscount = parseFloat(twDiscount);
    onUpdateSettings({
      ...settings,
      enableFees,
      usBroker,
      twFeeDiscount: isNaN(numTwDiscount) ? 6 : numTwDiscount
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-lg">
             <Calculator className="w-5 h-5" /> 手續費偏好設定
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X className="w-6 h-6"/></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
             <div>
                <label className="text-sm font-bold text-indigo-900">啟用手續費自動計算</label>
                <p className="text-[10px] text-indigo-600">下單時自動帶入預設費率</p>
             </div>
             <input 
               type="checkbox"
               checked={enableFees}
               onChange={(e) => setEnableFees(e.target.checked)}
               className="w-6 h-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
             />
          </div>
          
          {enableFees && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
               <div className="space-y-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">台股 (TW Stock)</h3>
                  <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                     <label className="text-sm font-medium text-gray-700">電子下單手續費折扣</label>
                     <div className="flex items-center gap-1">
                        <input 
                          type="number"
                          value={twDiscount}
                          onChange={(e) => setTwDiscount(e.target.value)}
                          className="w-16 text-center text-sm font-bold p-2 border border-gray-200 bg-gray-50/50 rounded focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                        <span className="text-sm font-bold text-gray-500">折</span>
                     </div>
                  </div>
                  <div className="flex items-start gap-1.5 px-1">
                     <Info className="w-3 h-3 text-gray-400 mt-0.5" />
                     <p className="text-[10px] text-gray-400">系統將以 0.1425% 為基準計算折扣後的費用。</p>
                  </div>
               </div>

               <div className="space-y-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">美股 (US Stock)</h3>
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
                     <span className="text-sm font-medium text-gray-700 block">預設美股券商</span>
                     <div className="grid grid-cols-1 gap-2">
                        {['Firstrade', 'IBKR', 'Sub-brokerage'].map((broker) => (
                           <label key={broker} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${usBroker === broker ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-gray-100 hover:bg-gray-50'}`}>
                              <input 
                                type="radio" 
                                name="modal-usBroker" 
                                value={broker}
                                checked={usBroker === broker}
                                onChange={() => setUsBroker(broker as any)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className={`text-sm font-bold ${usBroker === broker ? 'text-indigo-700' : 'text-gray-600'}`}>
                                 {broker === 'Firstrade' ? 'Firstrade (免佣金)' : 
                                  broker === 'IBKR' ? 'IBKR (階梯式)' : '複委託 (TW Sub-brokerage)'}
                              </span>
                           </label>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" /> 儲存費率設定
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeeSettingsModal;
