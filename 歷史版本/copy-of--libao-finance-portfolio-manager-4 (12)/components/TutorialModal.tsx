
import React, { useState } from 'react';
import { 
  X, ArrowRight, CheckCircle, 
  Wallet, TrendingUp, Coins, Cloud, LogIn,
  PieChart, LineChart, NotebookPen, Download,
  Share, MoreVertical, ShieldAlert
} from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginRequest: () => void;
  isLoggedIn: boolean;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, onLoginRequest, isLoggedIn }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [pwaTab, setPwaTab] = useState<'iOS' | 'Android'>('iOS');

  // Logic to detect OS for better default tab
  React.useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/android/i.test(userAgent)) {
      setPwaTab('Android');
    }
  }, []);

  const steps = [
    {
      title: "歡迎來到 Libao 財經學院",
      desc: "這不僅僅是記帳工具，更是您的「投資戰情室」。我們專注於「資金控管」與「資產配置」，協助您在台美股市場穩健獲利。",
      icon: <span className="text-5xl animate-bounce">👋</span>,
      color: "bg-blue-600",
      content: null
    },
    {
      title: "1. 核心觀念：資金控管",
      desc: "投資的第一步是保護本金。在此設定您的總資金，系統會即時計算「現金水位」與「曝險比例」，避免過度槓桿。",
      icon: <Wallet className="w-16 h-16 text-white" />,
      color: "bg-gray-800",
      content: (
         <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600 mt-2 text-left space-y-1">
            <p>✅ <span className="font-bold text-gray-800">總資金追蹤：</span>隨時掌握還有多少子彈。</p>
            <p>✅ <span className="font-bold text-gray-800">出入金紀錄：</span>清楚記錄每一筆資金流向。</p>
         </div>
      )
    },
    {
      title: "2. 智能交易輔助",
      desc: "告別憑感覺下單。輸入代號後，我們提供 K 線圖參考、自動計算手續費，並支援以「資金佔比 (%)」反推股數。",
      icon: <TrendingUp className="w-16 h-16 text-white" />,
      color: "bg-red-600",
      content: (
         <div className="flex justify-center gap-4 mt-2">
            <div className="flex flex-col items-center">
               <div className="bg-white p-2 rounded-full mb-1 shadow-sm"><PieChart className="w-5 h-5 text-red-500"/></div>
               <span className="text-xs text-gray-500">佔比計算</span>
            </div>
            <div className="flex flex-col items-center">
               <div className="bg-white p-2 rounded-full mb-1 shadow-sm"><LineChart className="w-5 h-5 text-blue-500"/></div>
               <span className="text-xs text-gray-500">即時K線</span>
            </div>
            <div className="flex flex-col items-center">
               <div className="bg-white p-2 rounded-full mb-1 shadow-sm"><NotebookPen className="w-5 h-5 text-yellow-500"/></div>
               <span className="text-xs text-gray-500">交易筆記</span>
            </div>
         </div>
      )
    },
    {
      title: "3. 自動化股息帳本",
      desc: "被動收入一目了然。系統可一鍵掃描您的歷史持倉與配息紀錄，自動試算預扣稅額與實領金額，省去手動記帳的繁瑣。",
      icon: <Coins className="w-16 h-16 text-white" />,
      color: "bg-purple-600",
      content: null
    },
    {
      title: "4. 安裝到手機 (App 體驗)",
      desc: "將此網頁加入主畫面，即可享有全螢幕、無網址列的原生 App 操作體驗。",
      icon: <Download className="w-16 h-16 text-white" />,
      color: "bg-indigo-600",
      customRender: (
        <div className="mt-4 bg-white/90 rounded-xl p-4 shadow-sm text-left w-full max-w-xs mx-auto">
           <div className="flex bg-gray-100 p-1 rounded-lg mb-3">
              <button onClick={() => setPwaTab('iOS')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${pwaTab === 'iOS' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>iOS (iPhone)</button>
              <button onClick={() => setPwaTab('Android')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${pwaTab === 'Android' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>Android</button>
           </div>
           
           {pwaTab === 'iOS' ? (
              <div className="space-y-2 text-sm text-gray-700">
                 <p className="flex items-center gap-2">1. 點擊 Safari 下方的 <Share className="w-4 h-4 text-blue-500" /> 分享按鈕</p>
                 <p className="flex items-center gap-2">2. 往下滑動選單</p>
                 <p className="flex items-center gap-2">3. 選擇「加入主畫面」</p>
              </div>
           ) : (
              <div className="space-y-2 text-sm text-gray-700">
                 <p className="flex items-center gap-2">1. 點擊 Chrome 右上角的 <MoreVertical className="w-4 h-4 text-gray-600" /> 選單</p>
                 <p className="flex items-center gap-2">2. 選擇「安裝應用程式」或</p>
                 <p className="flex items-center gap-2 pl-6">「加到主畫面」</p>
              </div>
           )}
        </div>
      )
    },
    {
      title: "5. 雲端同步 & 備份",
      desc: isLoggedIn 
        ? "您目前已登入！您的資料將安全地同步至雲端，更換手機也不怕資料遺失。"
        : "強烈建議您登入 Google 帳號開啟雲端同步，確保您的投資數據永久保存，跨裝置隨時查看。",
      icon: <Cloud className="w-16 h-16 text-white" />,
      color: "bg-green-600",
      content: null
    },
    {
      title: "免責聲明 (Disclaimer)",
      desc: "使用本服務前，請務必閱讀並同意以下條款。",
      icon: <ShieldAlert className="w-16 h-16 text-white" />,
      color: "bg-gray-800",
      customRender: (
         <div className="mt-4 bg-white/95 rounded-xl p-4 shadow-sm text-left w-full max-w-xs mx-auto text-xs text-gray-600 h-40 overflow-y-auto border border-gray-200">
            <p className="font-bold mb-2 text-gray-800">1. 資訊僅供參考</p>
            <p className="mb-2">本應用程式（Libao 財經學院倉位管理）僅提供資產紀錄、試算與管理功能。所有數據（含股價、配息、新聞）皆來自第三方公開資訊，不保證其即時性、正確性或完整性。</p>
            <p className="font-bold mb-2 text-gray-800">2. 非投資建議</p>
            <p className="mb-2">本服務不提供任何投資建議、買賣推薦或獲利保證。用戶應自行判斷投資風險，並對其投資決策負完全責任。</p>
            <p className="font-bold mb-2 text-gray-800">3. 系統免責</p>
            <p>對於因系統中斷、資料遺失或第三方數據錯誤所導致之任何直接或間接損害，開發團隊不負賠償責任。建議用戶定期利用「匯出備份」功能保存資料。</p>
         </div>
      )
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
    // Check if on last step (Disclaimer) to enforce "Accept" visual flow, 
    // but technically we allow closing.
    onClose();
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col relative h-[600px] max-h-[90vh]">
        
        {/* Progress Bar */}
        <div className="h-1.5 bg-gray-100 w-full shrink-0">
          <div 
            className={`h-full transition-all duration-500 ease-out ${step.color}`} 
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Skip Button (Hide on last step to encourage clicking 'Agree') */}
        {!isLastStep && (
          <button 
            onClick={handleSkip} 
            className="absolute top-4 right-4 text-white/80 hover:text-white z-20 px-3 py-1 bg-black/20 rounded-full text-xs hover:bg-black/30 transition-colors backdrop-blur-sm"
          >
            跳過教學
          </button>
        )}

        {/* Visual Header */}
        <div className={`${step.color} h-2/5 flex flex-col items-center justify-center transition-colors duration-500 relative overflow-hidden shrink-0`}>
           <div className="relative z-10 transform transition-transform duration-500 hover:scale-110">
              {step.icon}
           </div>
           {/* Background Decoration */}
           <div className="absolute inset-0 bg-white/10 opacity-30 transform rotate-12 scale-150 pointer-events-none"></div>
        </div>

        {/* Content */}
        <div className="p-6 text-center flex-1 flex flex-col items-center justify-start overflow-y-auto">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3 transition-all duration-300">
            {step.title}
          </h2>
          <p className="text-gray-500 leading-relaxed text-sm md:text-base px-2">
            {step.desc}
          </p>
          
          {/* Custom Content Render */}
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

        {/* Footer Actions */}
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
              isLoggedIn ? (
                 <>
                    <CheckCircle className="w-4 h-4" />
                    我同意並開始使用
                 </>
              ) : (
                 <>
                    <LogIn className="w-4 h-4" /> 
                    我同意並登入
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
