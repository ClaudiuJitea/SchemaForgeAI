'use client';

import { useTranslations } from 'next-intl';
import { Plus, Minus, Square } from 'lucide-react';

interface ZoomToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitToScreen?: () => void;
}

export default function ZoomToolbar({ onZoomIn, onZoomOut, onFitToScreen }: ZoomToolbarProps) {
  const t = useTranslations('workspace');

  const buttons = [
    { icon: Plus, onClick: onZoomIn, title: t('zoomIn') },
    { icon: Minus, onClick: onZoomOut, title: t('zoomOut') },
    { icon: Square, onClick: onFitToScreen, title: t('fitToScreen') }
  ];

  return (
    <div className="absolute left-4 bottom-4 z-10">
      <div className="flex flex-col bg-surface border border-border rounded-lg shadow-lg" style={{ backgroundColor: '#2a3142', borderColor: '#374151' }}>
        {buttons.map((button, index) => (
          <button
            key={index}
            onClick={button.onClick}
            title={button.title}
            className={`p-3 transition-colors ${
              index !== buttons.length - 1 ? 'border-b' : ''
            }`}
            style={{
              color: '#9ca3af',
              borderBottomColor: index !== buttons.length - 1 ? '#374151' : 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#323849';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <button.icon size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}