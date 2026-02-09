
import React, { useState } from 'react';
import {
  X, ArrowRight, CheckCircle,
  Wallet, TrendingUp, Coins, Cloud, LogIn,
  PieChart, LineChart, NotebookPen, Download,
  Share, MoreVertical, ShieldAlert, Play
} from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginRequest: () => void;
  isLoggedIn: boolean;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, onLoginRequest, isLoggedIn }) => {
  if (!isOpen) return null;
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "歡迎來到 Libao 財經學院",
      desc: "這不僅僅是記帳工具，更是您的「投資戰情室」。我們專注於「資金控管」與「資產配置」，協助您在台美股市場透過系統化管理穩健成長。",
      icon: <span className="text-5xl animate-bounce">👋</span>,
      color: "bg-blue-600",
      content: (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col items-center text-center">
            <PieChart className="w-6 h-6 text-blue-600 mb-1" />
            <span className="text-[10px] font-bold text-blue-800">資產比例控管</span>
          </div>
          <div className="bg-green-50 p-3 rounded-xl border border-green-100 flex flex-col items-center text-center">
            <TrendingUp className="w-6 h-6 text-green-600 mb-1" />
            <span className="text-[10px] font-bold text-green-800">台美股實時損益</span>
          </div>
          <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 flex flex-col items-center text-center">
            <Coins className="w-6 h-6 text-purple-600 mb-1" />
            <span className="text-[10px] font-bold text-purple-800">自動股息帳本</span>
          </div>
          <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex flex-col items-center text-center">
            <Cloud className="w-6 h-6 text-orange-600 mb-1" />
            <span className="text-[10px] font-bold text-orange-800">多端雲端同步</span>
          </div>
        </div>
      )
    },
    {
      title: "免責聲明 (Disclaimer)",
      desc: "使用本服務前，請務必閱讀並同意以下條က်。",
      icon: <ShieldAlert className="w-16 h-16 text-white" />,
      color: "bg-gray-800",
      customRender: (
        <div className="mt-4 bg-white/95 rounded-xl p-4 shadow-sm text-left w-full max-w-xs mx-auto text-[11px] text-gray-600 h-48 overflow-y-auto border border-gray-200">
          <p className="font-bold mb-2 text-gray-800 border-b pb-1">1. 資訊僅供參考</p>
          <p className="mb-3">本應用程式（Libao 財經學院倉位管理）僅提供資產紀錄、試算與管理功能。所有數據（含股價、配息、新聞）皆來自第三方公開資訊，不保證其即時性、正確性或完整性。</p>
          <p className="font-bold mb-2 text-gray-800 border-b pb-1">2. 非投資建議</p>
          <p className="mb-3">本服務不提供任何投資建議、買賣推薦或獲利保證。用戶應自行判斷投資風險，並對其投資決策負完全責任。</p>
          <p className="font-bold mb-2 text-gray-800 border-b pb-1">3. 系統免責</p>
          <p>對於因系統中斷、資料遺失或第三方數據錯誤所導致之任何直接或間接損害，開發團隊不負賠償責任。強烈建議用戶定期利用「匯出備份」功能保存資料。進入系統即表示您已閱讀並同意上述條款。</p>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col relative h-[600px] max-h-[90vh]">

        <div className="h-1.5 bg-gray-100 w-full shrink-0">
          <div
            className={`h-full transition-all duration-500 ease-out ${step.color}`}
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className={`${step.color} h-2/5 flex flex-col items-center justify-center transition-colors duration-500 relative overflow-hidden shrink-0`}>
          <div className="relative z-10 transform transition-transform duration-500 hover:scale-110">
            {step.icon}
          </div>
          <div className="absolute inset-0 bg-white/10 opacity-30 transform rotate-12 scale-150 pointer-events-none"></div>
        </div>

        <div className="p-6 text-center flex-1 flex flex-col items-center justify-start overflow-y-auto">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3 transition-all duration-300">
            {step.title}
          </h2>
          <p className="text-gray-500 leading-relaxed text-sm md:text-base px-2">
            {step.desc}
          </p>

          {step.content && (
            <div className="w-full mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {step.content}
            </div>
          )}
          {step.customRender && (
            <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
              {step.customRender}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div className="flex gap-1.5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentStep ? 'bg-gray-800 w-4' : 'bg-gray-300'}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className={`px-6 py-2.5 rounded-full font-bold text-white shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${step.color}`}
          >
            {isLastStep ? (
              <>
                <Play className="w-4 h-4" />
                我同意並進入導覽
              </>
            ) : (
              <>下一步 <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
