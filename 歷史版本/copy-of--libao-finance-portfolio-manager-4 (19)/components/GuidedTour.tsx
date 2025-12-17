
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
  onStepChange?: (stepIndex: number) => void; 
}

const GuidedTour: React.FC<GuidedTourProps> = ({ isOpen, steps, onComplete, onSkip, onStepChange }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  // Reset step to 0 whenever the tour is opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      if (onStepChange) onStepChange(0);
    }
  }, [isOpen]);
  
  // Trigger onStepChange when index changes
  useEffect(() => {
    if (isOpen && onStepChange) {
      onStepChange(currentStepIndex);
    }
  }, [currentStepIndex, isOpen, onStepChange]);

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
    const timeoutId = setTimeout(updatePosition, 300); 
    
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
  const spotlightStyle: React.CSSProperties = targetRect ? {
    top: targetRect.top - 4, // 4px padding
    left: targetRect.left - 4,
    width: targetRect.width + 8,
    height: targetRect.height + 8,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
    borderRadius: '8px',
    position: 'fixed',
    zIndex: 1000,
    pointerEvents: 'none', 
    transition: 'all 0.4s ease-in-out'
  } : { display: 'none' }; 

  // Tooltip Position Logic
  const getTooltipStyle = (): React.CSSProperties => {
    // 1. Fallback Center if no target
    if (!targetRect) return { 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)', 
        position: 'fixed', 
        zIndex: 1002, 
        width: '300px', 
        maxWidth: '90vw' 
    };
    
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const tooltipWidth = 300; 
    
    // 2. Large Target Detection (e.g. Full-screen Modals)
    // If target height > 60% of screen, fix tooltip to bottom center to ensure visibility
    if (targetRect.height > viewportHeight * 0.6) {
        return {
            position: 'fixed',
            bottom: '30px', 
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1002,
            width: '300px',
            maxWidth: '90vw'
        };
    }

    // 3. Standard Positioning Logic
    const gap = 16;
    const estimatedHeight = 200; // rough estimate of card height
    let top = 0;
    let left = 0;

    // Horizontal Calculation
    if (viewportWidth < 768) {
        // Mobile: Center horizontally
        left = (viewportWidth - tooltipWidth) / 2;
        if (left < 10) left = 10;
    } else {
        // Desktop: Align left, clamp to right
        left = targetRect.left; 
        if (left + tooltipWidth > viewportWidth) {
            left = viewportWidth - tooltipWidth - 20;
        }
    }

    // Vertical Calculation
    // Try Bottom First
    if (targetRect.bottom + estimatedHeight + gap < viewportHeight) {
         top = targetRect.bottom + gap;
    } 
    // Try Top Second
    else if (targetRect.top - estimatedHeight - gap > 0) {
         // Using estimated height for Top positioning is tricky without ref, 
         // but we can approximate or use bottom-aligned absolute positioning if we changed implementation.
         // Here we stick to `top` style with approximation.
         top = targetRect.top - 180; 
    } 
    // Fallback: Force Bottom Fixed
    else {
         return {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1002,
            width: '300px',
            maxWidth: '90vw'
        };
    }

    return {
      top: top,
      left: left,
      position: 'fixed',
      zIndex: 1002,
      width: '300px', 
      maxWidth: '90vw'
    };
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none">
        {/* The Spotlight Hole */}
        {targetRect && <div style={spotlightStyle} className="animate-in fade-in duration-300 ring-2 ring-white/50" />}
        
        {/* The Tooltip Card */}
        <div 
            style={getTooltipStyle()} 
            className="bg-white rounded-xl shadow-2xl p-5 border border-gray-100 animate-in slide-in-from-bottom-4 duration-500 pointer-events-auto"
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
