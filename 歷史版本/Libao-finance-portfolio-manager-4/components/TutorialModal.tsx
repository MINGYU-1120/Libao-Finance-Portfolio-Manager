
import React, { useState, useEffect } from 'react';
import { 
  X, ArrowRight, CheckCircle, 
  Wallet, TrendingUp, Coins, Cloud, LogIn
} from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginRequest: () => void;
  isLoggedIn: boolean;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, onLoginRequest, isLoggedIn }) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Reset step to 0 whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = [
    {
      title: "歡迎來到 Libao 財經學院",
      desc: "這是一個專為您打造的專業資產管理工具。透過這個 App，您可以精準追蹤台股與美股的資金配置、成本與獲利。",
      icon: <span className="text-4xl">👋</span>,
      color: "bg-blue-500"
    },
    {
      title: "1. 資金管理",
      desc: "投資前，設定您的本金。系統會即時追蹤您的資金使用率與閒置現金。",
      icon: <Wallet className="w-12 h-12 text-white" />,
      color: "bg-gray-800"
    },
    {
      title: "2. 交易下單",
      desc: "點擊「下單」並輸入代號。我們支援「股數」或「資金佔比」計算，幫您快速分配倉位。",
      icon: <TrendingUp className="w-12 h-12 text-white" />,
      color: "bg-red-600"
    },
    {
      title: "3. 股息帳本",
      desc: "自動掃描歷史配息紀錄，輕鬆管理被動收入，不再需要手動敲打。",
      icon: <Coins className="w-12 h-12 text-white" />,
      color: "bg-purple-600"
    },
    {
      title: "4. 雲端同步 (重要)",
      desc: isLoggedIn 
        ? "您目前已登入！您的資料將安全地同步至雲端，隨時隨地皆可存取。"
        : "這是最後一步！請登入 Google 帳號開啟雲端同步，確保您的投資數據永久保存，跨裝置隨時查看。",
      icon: <Cloud className="w-12 h-12 text-white" />,
      color: "bg-green-600"
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      if (isLoggedIn) {
        onClose(); // Just close if already logged in
      } else {
        onLoginRequest(); // Trigger login/onboarding flow
      }
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Progress Bar */}
        <div className="h-1.5 bg-gray-100 w-full">
          <div 
            className={`h-full transition-all duration-500 ease-out ${step.color}`} 
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Skip Button */}
        <button 
          onClick={handleSkip} 
          className="absolute top-4 right-4 text-white/80 hover:text-white z-10 px-3 py-1 bg-black/20 rounded-full text-xs hover:bg-black/30 transition-colors backdrop-blur-sm"
        >
          略過教學
        </button>

        {/* Visual Header */}
        <div className={`${step.color} h-48 flex items-center justify-center transition-colors duration-500 relative overflow-hidden`}>
           <div className="relative z-10 transform transition-transform duration-500 scale-110">
              {step.icon}
           </div>
           {/* Background Decoration */}
           <div className="absolute inset-0 bg-white/10 opacity-30 transform rotate-12 scale-150 pointer-events-none"></div>
        </div>

        {/* Content */}
        <div className="p-8 text-center flex-1 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-3 transition-all duration-300">
            {step.title}
          </h2>
          <p className="text-gray-500 leading-relaxed text-sm md:text-base">
            {step.desc}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50">
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
              isLoggedIn ? (
                 <>
                    <CheckCircle className="w-4 h-4" />
                    開始使用
                 </>
              ) : (
                 <>
                    <LogIn className="w-4 h-4" /> 
                    立即登入同步
                 </>
              )
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
