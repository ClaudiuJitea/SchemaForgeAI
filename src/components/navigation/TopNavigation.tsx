'use client';

import { useTranslations } from 'next-intl';
import { Settings, Database, Brain, Layers3 } from 'lucide-react';

interface TopNavigationProps {
  onOpenAISettings?: () => void;
  onOpenAdvancedOperations?: () => void;
  onOpenDatabaseConnection?: () => void;
}

export default function TopNavigation({ onOpenAISettings, onOpenAdvancedOperations, onOpenDatabaseConnection }: TopNavigationProps) {
  const t = useTranslations('navigation');

  return (
    <header 
      className="relative border-b px-5 py-3"
      style={{ 
        backgroundColor: '#2a3142',
        borderBottomColor: '#374151',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
      }}
    >
      
      <div className="relative flex items-center justify-between h-10">
        {/* Left - Logo with modern styling */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div 
              className="absolute inset-0 rounded-lg blur-sm opacity-30"
              style={{ backgroundColor: '#00D4AA' }}
            />
            <div 
              className="relative p-1.5 rounded-lg shadow-sm"
              style={{ backgroundColor: '#00D4AA' }}
            >
              <Brain size={20} style={{ color: '#1a1f2e' }} />
            </div>
          </div>
          <div>
            <h1 
              className="text-xl font-bold"
              style={{ color: '#ffffff' }}
            >
              SchemaForgeAI
            </h1>
            <div 
              className="h-0.5 rounded-full w-20 mt-0.5"
              style={{ backgroundColor: '#00D4AA' }}
            />
          </div>
        </div>

        {/* Right - Action buttons */}
        <div className="flex items-center space-x-1">
          <button 
            onClick={onOpenAISettings}
            className="group flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 border"
            style={{ 
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: '#9ca3af'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#323849';
              e.currentTarget.style.borderColor = '#374151';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <Settings size={16} />
            <span className="text-sm font-medium">Settings</span>
          </button>
          
          <button 
            onClick={onOpenAdvancedOperations}
            className="group flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 border"
            style={{ 
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: '#9ca3af'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#323849';
              e.currentTarget.style.borderColor = '#374151';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <Layers3 size={16} />
            <span className="text-sm font-medium">{t('advanced')}</span>
          </button>
          
          <div 
            className="w-px h-5 mx-2"
            style={{ backgroundColor: '#374151' }}
          />
          
          <button 
            onClick={onOpenDatabaseConnection}
            className="group relative flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 overflow-hidden shadow-sm"
            style={{ 
              backgroundColor: '#00D4AA',
              color: '#1a1f2e'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 212, 170, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
            }}
          >
            <Database size={16} />
            <span className="text-sm font-semibold">Database</span>
            
            {/* Subtle shine effect */}
            <div 
              className="absolute inset-0 -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-500 ease-out opacity-20"
              style={{ backgroundColor: 'white' }}
            />
          </button>
        </div>
      </div>
    </header>
  );
}