
import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronRight, CheckCircle } from 'lucide-react';

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
}

const GuidedTour: React.FC<GuidedTourProps> = ({ isOpen, steps, onComplete, onSkip }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  // Reset step to 0 whenever the tour is opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen]);
  
  // Need to track window resize to update spotlight position
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      // Guard against stale state or empty steps
      if (!steps || steps.length === 0 || currentStepIndex >= steps.length) return;

      const step = steps[currentStepIndex];
      const element = document.getElementById(step.targetId);
      if (element) {
        // Add padding to the highlight
        const rect = element.getBoundingClientRect();
        
        // Check if element is actually visible (has dimensions)
        if (rect.width === 0 || rect.height === 0) {
             setTargetRect(null); 
             return;
        }

        setTargetRect(rect);
        // Scroll into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // If element not found (maybe hidden on mobile), set null
        setTargetRect(null); 
      }
    };

    // Small timeout to allow DOM to settle (especially if coming from modal close)
    const timeoutId = setTimeout(updatePosition, 100);
    
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen, currentStepIndex, steps]);

  if (!isOpen) return null;
  
  // Guard against invalid index
  if (currentStepIndex >= steps.length) return null;

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  // Spotlight Style Calculation
  // We use a massive box-shadow to dim the rest of the screen
  const spotlightStyle: React.CSSProperties = targetRect ? {
    top: targetRect.top - 4, // 4px padding
    left: targetRect.left - 4,
    width: targetRect.width + 8,
    height: targetRect.height + 8,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
    borderRadius: '8px',
    position: 'fixed',
    zIndex: 1000,
    pointerEvents: 'none', // Allow clicking through to the actual element if we wanted, but usually we block interaction during tour
    transition: 'all 0.4s ease-in-out'
  } : { display: 'none' }; // Hide if no target

  // Tooltip Position Logic
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed', zIndex: 1001, width: '300px', maxWidth: '90vw' };
    
    const gap = 16;
    let top = 0;
    let left = 0;
    const tooltipWidth = 300; // approx width

    // Basic layout logic (can be improved with popper.js but keeping it lightweight)
    if (window.innerWidth < 768) {
        // Mobile: Always bottom or top center
        left = window.innerWidth / 2 - (tooltipWidth / 2); // Center horizontally
        // Default to below, if not enough space, go above
        if (targetRect.bottom + 250 > window.innerHeight) {
             top = targetRect.top - 180; // Show above (approx height of card)
        } else {
             top = targetRect.bottom + gap; // Show below
        }
    } else {
        // Desktop
        left = targetRect.left; 
        top = targetRect.bottom + gap;
        
        // Overflow check
        if (left + tooltipWidth > window.innerWidth) {
            left = window.innerWidth - tooltipWidth - 20;
        }
        if (top + 200 > window.innerHeight) {
            top = targetRect.top - 180;
        }
    }

    return {
      top: top,
      left: left,
      position: 'fixed',
      zIndex: 1001,
      width: '300px', // Fixed width for tooltip
      maxWidth: '90vw'
    };
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
        {/* The Spotlight Hole */}
        {targetRect && <div style={spotlightStyle} className="animate-in fade-in duration-300 ring-2 ring-white/50" />}
        
        {/* The Tooltip Card */}
        <div 
            style={getTooltipStyle()} 
            className="bg-white rounded-xl shadow-2xl p-5 border border-gray-100 animate-in slide-in-from-bottom-4 duration-500"
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-800">{currentStep.title}</h3>
                <button onClick={onSkip} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {currentStep.content}
            </p>
            
            <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-400 font-mono">
                    Step {currentStepIndex + 1} / {steps.length}
                </span>
                <button 
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 shadow-lg transition-transform active:scale-95"
                >
                    {isLastStep ? '完成' : '下一步'} 
                    {isLastStep ? <CheckCircle className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                </button>
            </div>
        </div>
    </div>
  );
};

export default GuidedTour;
