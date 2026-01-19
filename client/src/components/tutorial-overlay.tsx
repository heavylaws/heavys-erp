import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { X, ChevronLeft, ChevronRight, Play, SkipForward, Lightbulb } from 'lucide-react';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector for highlighting
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'type' | 'wait' | 'none';
  actionText?: string;
  tip?: string;
  prerequisite?: () => boolean;
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  tutorialName: string;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  steps,
  isActive,
  onComplete,
  onSkip,
  tutorialName
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [overlayPosition, setOverlayPosition] = useState({ top: 0, left: 0 });

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    // Check prerequisites
    if (currentStepData.prerequisite && !currentStepData.prerequisite()) {
      return;
    }

    // Find and highlight target element
    const targetElement = document.querySelector(currentStepData.target);
    if (targetElement) {
      setHighlightedElement(targetElement);
      
      // Calculate overlay position
      const rect = targetElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      let top = 0, left = 0;
      
      switch (currentStepData.position) {
        case 'top':
          top = rect.top + scrollTop - 20;
          left = rect.left + scrollLeft + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + scrollTop + 20;
          left = rect.left + scrollLeft + rect.width / 2;
          break;
        case 'left':
          top = rect.top + scrollTop + rect.height / 2;
          left = rect.left + scrollLeft - 20;
          break;
        case 'right':
          top = rect.top + scrollTop + rect.height / 2;
          left = rect.right + scrollLeft + 20;
          break;
        case 'center':
          top = window.innerHeight / 2 + scrollTop;
          left = window.innerWidth / 2 + scrollLeft;
          break;
      }
      
      setOverlayPosition({ top, left });

      // Add highlight class
      targetElement.classList.add('tutorial-highlight');
      
      // Scroll element into view
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return () => {
      // Remove highlight
      if (highlightedElement) {
        highlightedElement.classList.remove('tutorial-highlight');
      }
    };
  }, [currentStep, isActive, currentStepData]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTutorial = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove('tutorial-highlight');
    }
    onSkip();
  };

  if (!isActive || !currentStepData) return null;

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999]" />
      
      {/* Tutorial card */}
      <div 
        className="fixed z-[10000] transform -translate-x-1/2 -translate-y-1/2 max-w-md w-full mx-4"
        style={{ 
          top: overlayPosition.top, 
          left: overlayPosition.left,
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <Card className="shadow-2xl border-blue-200 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {tutorialName}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTutorial}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="h-5 w-5 text-blue-500" />
              {currentStepData.title}
            </CardTitle>
            <CardDescription className="text-sm">
              Step {currentStep + 1} of {steps.length}
            </CardDescription>
            <Progress value={progress} className="h-2" />
          </CardHeader>
          
          <CardContent className="pt-0">
            <p className="text-sm text-gray-700 mb-3">
              {currentStepData.description}
            </p>
            
            {currentStepData.action && currentStepData.actionText && (
              <div className="bg-blue-50 p-3 rounded-lg mb-3">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Action Required:
                </p>
                <p className="text-sm text-blue-700">
                  {currentStepData.actionText}
                </p>
              </div>
            )}
            
            {currentStepData.tip && (
              <div className="bg-amber-50 p-3 rounded-lg flex gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <strong>Tip:</strong> {currentStepData.tip}
                </p>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTutorial}
                className="flex items-center gap-1"
              >
                <SkipForward className="h-4 w-4" />
                Skip Tutorial
              </Button>
              
              <Button
                size="sm"
                onClick={nextStep}
                className="flex items-center gap-1"
              >
                {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
};

// Tutorial highlight styles (add to global CSS)
export const tutorialStyles = `
.tutorial-highlight {
  position: relative;
  z-index: 9998;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2) !important;
  border-radius: 8px !important;
  transition: all 0.3s ease;
}

.tutorial-highlight::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  background: transparent;
  border: 2px solid #3B82F6;
  border-radius: 8px;
  animation: tutorial-pulse 2s infinite;
  z-index: -1;
}

@keyframes tutorial-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.1);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.0);
  }
}
`;