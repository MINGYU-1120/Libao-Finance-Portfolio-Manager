
import React, { useState, useEffect } from 'react';
import { Briefcase, DollarSign, ArrowRight, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { PositionCategory } from '../types';

interface OnboardingModalProps {
   isOpen: boolean;
   initialCategories: PositionCategory[];
   onComplete: (capital: number, categories: PositionCategory[]) => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, initialCategories, onComplete }) => {
   const [step, setStep] = useState(1);
   const [capitalInput, setCapitalInput] = useState('1000000');
   const [categories, setCategories] = useState<PositionCategory[]>(initialCategories);
   const [isSubmitting, setIsSubmitting] = useState(false);

   useEffect(() => {
      if (isOpen) {
         setCategories(JSON.parse(JSON.stringify(initialCategories)));
         setStep(1);
         setIsSubmitting(false);
      }
   }, [isOpen, initialCategories]);

   // Derived state (Calculated instantly on every render)
   const totalPercent = Math.round(categories.reduce((sum, c) => sum + c.allocationPercent, 0) * 100) / 100;
   const isTotalValid = Math.abs(totalPercent - 100) < 0.1;
   const gStore = categories.find(c => c.id === 'tw-g')?.allocationPercent || 0;
   const dStore = categories.find(c => c.id === 'us-d')?.allocationPercent || 0;
   const coreRatio = gStore + dStore;

   // Logic Fix: >= 50% is safe
   const isCoreSafe = coreRatio >= 50;

   if (!isOpen) return null;

   const handleCapitalNext = () => {
      const cap = parseFloat(capitalInput);
      if (isNaN(cap) || cap <= 0) {
         alert("請輸入有效的資金金額");
         return;
      }
      if (cap > 100000000000000) {
         alert("金額過大，請檢查是否輸入錯誤");
         return;
      }
      setStep(2);
   };

   const handleAllocationChange = (id: string, val: string) => {
      let numVal = parseFloat(val);
      if (isNaN(numVal)) numVal = 0;
      if (numVal > 1000) numVal = 1000;

      setCategories(prev => prev.map(c => c.id === id ? { ...c, allocationPercent: numVal } : c));
   };

   const handleFinish = async () => {
      // 1. Validation
      if (!isTotalValid) {
         alert(`⚠️ 配置錯誤\n\n目前總和為 ${totalPercent}% (目標 100%)\n請調整各倉位比例直到總和為 100%。`);
         return;
      }

      if (!isCoreSafe) {
         // Text Update: "50% 以上"
         if (!window.confirm(`⚠️ 穩健性提示 \n\n建議「G倉 (台股長線)」與「D倉 (美股長線)」合計達到 50% 以上以確保核心資產穩定增長。\n\n目前核心配置僅 ${coreRatio}%，您確定要繼續嗎？`)) {
            return;
         }
      }

      // 2. Submit State
      setIsSubmitting(true);
      const cap = parseFloat(capitalInput);

      // 3. Execute
      try {
         // Use a small timeout to allow UI to render loading state
         setTimeout(() => {
            onComplete(cap, categories);
         }, 100);
      } catch (e) {
         console.error("Onboarding Error:", e);
         alert("設定儲存失敗，請檢查瀏覽器空間或權限。");
         setIsSubmitting(false);
      }
   };

   return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-95 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-in fade-in duration-300">
         <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Progress Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-2">
                  <div className="bg-gray-900 text-white p-1.5 rounded-lg">
                     <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-gray-800">投資組合初始化</span>
               </div>
               <div className="flex gap-1">
                  <div className={`h-2 w-8 rounded-full transition-colors ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                  <div className={`h-2 w-8 rounded-full transition-colors ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
               </div>
            </div>

            <div className="p-8 flex-1 overflow-y-auto">
               {step === 1 ? (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                     <div className="text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                           <DollarSign className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">預計總投入資金</h2>
                        <p className="text-gray-500 text-sm">
                           設定您的初始本金，這將作為計算投資比例與報酬率的基準。
                           <br />隨時可以在「資金管理」中追加或取出。
                        </p>
                     </div>

                     <div className="mt-8">
                        <label className="block text-sm font-bold text-gray-700 mb-2 text-center">金額 (TWD)</label>
                        <input
                           type="number"
                           value={capitalInput}
                           onChange={(e) => setCapitalInput(e.target.value)}
                           max="100000000000000"
                           className="w-full text-4xl font-mono font-bold text-center border-2 border-gray-300 focus:border-blue-600 outline-none py-3 text-black bg-white placeholder-gray-400 rounded-xl shadow-sm"
                           placeholder="1000000"
                           autoFocus
                           onWheel={(e) => e.currentTarget.blur()}
                        />
                     </div>
                  </div>
               ) : (
                  <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                     <div className="text-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800 mb-1">資產配置規劃</h2>
                        <p className="text-xs text-gray-500">設定各個投資帳戶的目標資金佔比</p>
                     </div>

                     {/* Core Holdings Warning */}
                     <div className={`p-3 rounded-lg border text-sm flex items-start gap-3 transition-colors ${isCoreSafe ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                        {isCoreSafe ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                        <div>
                           <span className="font-bold block mb-0.5">核心資產檢測 (G倉 + D倉)</span>
                           <span>目前合計：{coreRatio}% {isCoreSafe ? '(符合建議 50% 以上)' : '(建議提高至 50% 以上)'}</span>
                        </div>
                     </div>

                     <div className="space-y-3 pr-1">
                        {categories.map(cat => (
                           <div key={cat.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                              <div className={`w-1.5 h-8 rounded-full ${cat.market === 'TW' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                              <div className="flex-1">
                                 <div className="font-bold text-gray-800 text-sm">{cat.name}</div>
                                 <div className="text-[10px] text-gray-500">{cat.market === 'TW' ? '台股' : '美股'}</div>
                              </div>
                              <div className="flex items-center gap-1">
                                 <input
                                    type="number"
                                    value={cat.allocationPercent}
                                    onChange={(e) => handleAllocationChange(cat.id, e.target.value)}
                                    max="100"
                                    className="w-20 text-right font-mono font-bold text-lg text-black border-2 border-gray-200 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(e) => e.currentTarget.blur()}
                                 />
                                 <span className="text-gray-500 font-bold text-sm">%</span>
                              </div>
                           </div>
                        ))}
                     </div>

                     <div className="flex justify-between items-center px-2 pt-4 border-t border-gray-100">
                        <span className="text-sm font-bold text-gray-600">總計 (目標: 100%)</span>
                        <span className={`text-2xl font-mono font-bold ${isTotalValid ? 'text-green-600' : 'text-red-500'}`}>
                           {totalPercent}%
                        </span>
                     </div>
                  </div>
               )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between shrink-0">
               {step === 2 ? (
                  <button
                     type="button"
                     onClick={() => setStep(1)}
                     disabled={isSubmitting}
                     className="text-gray-600 font-bold px-4 py-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                     上一步
                  </button>
               ) : (
                  <div></div>
               )}

               <button
                  type="button"
                  onClick={step === 1 ? handleCapitalNext : handleFinish}
                  disabled={isSubmitting}
                  className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 active:scale-95 text-white disabled:opacity-70 disabled:cursor-not-allowed ${step === 1
                     ? 'bg-gray-900 hover:bg-gray-800'
                     : isTotalValid
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-red-500 hover:bg-red-600'
                     }`}
               >
                  {isSubmitting ? (
                     <>正在進入系統 <Loader2 className="w-4 h-4 animate-spin" /></>
                  ) : step === 1 ? (
                     <>下一步 <ArrowRight className="w-4 h-4" /></>
                  ) : (
                     isTotalValid
                        ? <>完成設定 <CheckCircle className="w-4 h-4" /></>
                        : <>目前總和: {totalPercent}%</>
                  )}
               </button>
            </div>

         </div>
      </div>
   );
};

export default OnboardingModal;
