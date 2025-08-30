'use client';

import { useTranslations } from 'next-intl';
import { User, Brain, Code, Database, RefreshCw, Save } from 'lucide-react';
import { createContext, useContext, useState } from 'react';

export type ProcessingStep = 'userPrompt' | 'aiReasoning' | 'sqlGeneration' | 'schemaParsing' | 'diagramUpdate';
export type StepStatus = 'waiting' | 'active' | 'completed';

interface StatusStep {
  key: ProcessingStep;
  label: string;
  icon: React.ElementType;
  status: StepStatus;
}

interface ProcessingContextType {
  currentStep: ProcessingStep | null;
  stepStatuses: Record<ProcessingStep, StepStatus>;
  setCurrentStep: (step: ProcessingStep | null) => void;
  updateStepStatus: (step: ProcessingStep, status: StepStatus) => void;
  resetSteps: () => void;
}

const ProcessingContext = createContext<ProcessingContextType | null>(null);

export const useProcessing = () => {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
};

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState<ProcessingStep | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<ProcessingStep, StepStatus>>({
    userPrompt: 'waiting',
    aiReasoning: 'waiting',
    sqlGeneration: 'waiting',
    schemaParsing: 'waiting',
    diagramUpdate: 'waiting'
  });

  const updateStepStatus = (step: ProcessingStep, status: StepStatus) => {
    setStepStatuses(prev => ({
      ...prev,
      [step]: status
    }));
  };

  const resetSteps = () => {
    setCurrentStep(null);
    setStepStatuses({
      userPrompt: 'waiting',
      aiReasoning: 'waiting',
      sqlGeneration: 'waiting',
      schemaParsing: 'waiting',
      diagramUpdate: 'waiting'
    });
  };

  return (
    <ProcessingContext.Provider value={{
      currentStep,
      stepStatuses,
      setCurrentStep,
      updateStepStatus,
      resetSteps
    }}>
      {children}
    </ProcessingContext.Provider>
  );
}

export default function StatusBar() {
  const t = useTranslations('statusBar');
  const { stepStatuses } = useProcessing();

  const steps: StatusStep[] = [
    { key: 'userPrompt', label: t('userPrompt'), icon: User, status: stepStatuses.userPrompt },
    { key: 'aiReasoning', label: t('aiReasoning'), icon: Brain, status: stepStatuses.aiReasoning },
    { key: 'schemaParsing', label: t('schemaParsing'), icon: Database, status: stepStatuses.schemaParsing },
    { key: 'diagramUpdate', label: t('diagramUpdate'), icon: RefreshCw, status: stepStatuses.diagramUpdate },
    { key: 'sqlGeneration', label: t('sqlGeneration'), icon: Code, status: stepStatuses.sqlGeneration }
  ];

  return (
    <footer style={{ backgroundColor: '#2a3142' }} className="px-3 py-2">
      <div className="flex items-center justify-center">
        {/* Process steps - simplified horizontal layout */}
        <div className="flex items-center space-x-4">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center space-x-2">
              <div 
                className="flex flex-col items-center justify-center space-y-1 px-3 py-2 rounded-md transition-colors border min-w-[100px]"
                style={{
                  backgroundColor: step.status === 'active' ? '#00D4AA20' : step.status === 'completed' ? '#22c55e20' : 'transparent',
                  borderColor: step.status === 'active' ? '#00D4AA50' : step.status === 'completed' ? '#22c55e50' : '#374151',
                  color: step.status === 'active' ? '#00D4AA' : step.status === 'completed' ? '#22c55e' : '#9ca3af'
                }}
              >
                <div className="flex items-center justify-center w-full">
                  <step.icon size={14} className="mr-1.5 flex-shrink-0" />
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
              </div>
              
              {index < steps.length - 1 && (
                <div className="flex items-center justify-center w-12">
                  <div 
                    className="h-0.5 w-full transition-colors duration-300"
                    style={{ 
                      backgroundColor: step.status === 'completed' && steps[index + 1].status !== 'waiting' 
                        ? '#00D4AA' 
                        : '#374151'
                    }} 
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}