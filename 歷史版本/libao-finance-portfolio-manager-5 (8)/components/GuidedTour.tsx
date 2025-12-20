
import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronRight } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface GuidedTourProps {
  isOpen: boolean;
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
  onStepChange?: (stepIndex: number) => void; 
}

const GuidedTour: React.FC<GuidedTourProps> = ({ isOpen, steps, onComplete, onSkip, onStepChange }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      if (onStepChange) onStepChange(0);
    }
  }, [isOpen]);

  const updatePosition = () => {
    if (!isOpen || !steps[currentStepIndex]) return;
    
    const step = steps[currentStepIndex];
    const element = document.getElementById(step.targetId);
    
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          // 只有當元素不在視野內才進行捲動
          const isInView = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
          );
          if (!isInView) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
    } else {
      setTargetRect(null); 
    }
  };
  
  // 監聽步驟切換
  useEffect(() => {
    if (!isOpen) return;
    
    setIsTransitioning(true);
    setTargetRect(null); 

    // 給予 UI 切換與動畫足夠的時間 (例如明細表展開動畫)
    const timer = setTimeout(() => {
      updatePosition();
      setIsTransitioning(false);
      
      // 動畫結束後再次校準位置，確保 100% 精準
      setTimeout(updatePosition, 300);
      setTimeout(updatePosition, 800);
    }, 500);

    if (onStepChange) onStepChange(currentStepIndex);
    
    return () => clearTimeout(timer);
  }, [currentStepIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, currentStepIndex]);

  if (!isOpen) return null;
  
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const spotlightStyle: React.CSSProperties = targetRect ? {
    top: targetRect.top - 8,
    left: targetRect.left - 8,
    width: targetRect.width + 16,
    height: targetRect.height + 16,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
    borderRadius: '12px',
    position: 'fixed',
    zIndex: 9999,
    pointerEvents: 'none', 
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: isTransitioning ? 0 : 1
  } : {
    top: '50%',
    left: '50%',
    width: '0',
    height: '0',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
    position: 'fixed',
    zIndex: 9999,
    pointerEvents: 'none',
    opacity: 0
  }; 

  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect || isTransitioning) return { 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)', 
        position: 'fixed', 
        zIndex: 10001, 
        width: '320px'
    };
    
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const tooltipHeight = 180;
    const tooltipWidth = Math.min(vw - 40, 320);

    let top = targetRect.bottom + 24;
    let left = Math.max(20, Math.min(targetRect.left, vw - tooltipWidth - 20));

    if (top + tooltipHeight > vh - 20) {
        top = targetRect.top - tooltipHeight - 24;
    }

    return {
      top: Math.max(20, Math.min(top, vh - tooltipHeight - 20)),
      left: left,
      position: 'fixed',
      zIndex: 10001,
      width: `${tooltipWidth}px`,
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    };
  };

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-none">
        <div style={spotlightStyle} />
        
        <div 
            style={getTooltipStyle()} 
            className={`bg-white rounded-2xl shadow-2xl p-6 border border-gray-100 pointer-events-auto transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-800 leading-tight">{currentStep?.title}</h3>
                <button onClick={onSkip} className="text-gray-400 hover:text-gray-600 p-1">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">{currentStep?.content}</p>
            
            <div className="flex justify-between items-center">
                <div className="flex gap-1">
                   {steps.map((_, idx) => (
                      <div key={idx} className={`w-1 h-1 rounded-full ${idx === currentStepIndex ? 'bg-blue-600 w-3' : 'bg-gray-200'} transition-all`} />
                   ))}
                </div>
                <button 
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg active:scale-95 shadow-blue-200"
                >
                    {isLastStep ? '完成導覽' : '下一個'} 
                    <ChevronRight className="w-4 h-4"/>
                </button>
            </div>
        </div>
    </div>
  );
};

export default GuidedTour;
