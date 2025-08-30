'use client';

import { useState, useRef, useEffect } from 'react';
import { Key, Hash } from 'lucide-react';

interface TableField {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

interface DatabaseTableProps {
  tableName: string;
  fields: TableField[];
  position: { x: number; y: number };
  accentColor?: string;
  isSelected?: boolean;
  onPositionChange?: (newPosition: { x: number; y: number }) => void;
  onTableClick?: (tableName: string) => void;
}

export default function DatabaseTable({ 
  tableName, 
  fields, 
  position,
  accentColor = '#F39C12', // Default gold/yellow accent
  isSelected = false,
  onPositionChange,
  onTableClick
}: DatabaseTableProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentPosition, setCurrentPosition] = useState(position);
  const [mouseDownTime, setMouseDownTime] = useState(0);
  const dragStateRef = useRef({ isDragging: false, hasMoved: false });
  const tableRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseDownTime(Date.now());
    
    // Allow dragging from anywhere on the table
    setDragStart({
      x: e.clientX - currentPosition.x,
      y: e.clientY - currentPosition.y
    });
    
    // Don't immediately set dragging - wait for mouse move
    // Only prevent default if we're not dealing with interactive elements
    const target = e.target as HTMLElement;
    if (!target.closest('button, input, textarea, select')) {
      e.preventDefault();
    }
    e.stopPropagation();
  };

  const handleTableClick = (e: React.MouseEvent) => {
    const clickDuration = Date.now() - mouseDownTime;
    
    // Only treat as click if it was quick (not a drag) and we're not currently dragging
    // Check both the state and ref to ensure we catch all dragging scenarios
    if (!isDragging && !dragStateRef.current.isDragging && clickDuration < 200) {
      onTableClick?.(tableName);
    }
  };

  // Global mouse event handlers for smooth dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (mouseDownTime > 0) {
        // Check if mouse has moved enough to consider it a drag
        const moveThreshold = 3; // Reduced threshold for more responsive dragging
        const deltaX = Math.abs(e.clientX - (currentPosition.x + dragStart.x));
        const deltaY = Math.abs(e.clientY - (currentPosition.y + dragStart.y));
        
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
          if (!dragStateRef.current.hasMoved) {
            dragStateRef.current.isDragging = true;
            dragStateRef.current.hasMoved = true;
            setIsDragging(true);
          }
        }
        
        if (dragStateRef.current.isDragging) {
          // Use requestAnimationFrame for smooth updates
          requestAnimationFrame(() => {
            const newPosition = {
              x: Math.max(0, e.clientX - dragStart.x),
              y: Math.max(0, e.clientY - dragStart.y)
            };
            setCurrentPosition(newPosition);
            onPositionChange?.(newPosition);
          });
        }
      }
    };

    const handleGlobalMouseUp = () => {
      const wasMouseDown = mouseDownTime > 0;
      const clickDuration = wasMouseDown ? Date.now() - mouseDownTime : 0;
      
      // Handle click if it was a short interaction without dragging
      if (wasMouseDown && !dragStateRef.current.isDragging && !isDragging && clickDuration < 200) {
        onTableClick?.(tableName);
      }
      
      dragStateRef.current.isDragging = false;
      dragStateRef.current.hasMoved = false;
      setIsDragging(false);
      setMouseDownTime(0);
    };

    if (mouseDownTime > 0 || isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      if (isDragging) {
        document.body.style.cursor = 'grabbing';
      }
    } else {
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = '';
    };
  }, [isDragging, mouseDownTime, dragStart, currentPosition, onPositionChange]);

  return (
    <div 
      ref={tableRef}
      data-table={tableName}
      className={`absolute bg-surface border rounded-lg shadow-lg overflow-hidden min-w-48 cursor-pointer ${
        isDragging ? 'shadow-xl scale-105' : 'shadow-lg'
      } ${
        isSelected ? 'border-primary border-2' : 'border-border'
      }`}
      style={{ 
        left: currentPosition.x, 
        top: currentPosition.y,
        backgroundColor: '#2a3142',
        borderColor: isSelected ? '#00D4AA' : '#374151',
        zIndex: isDragging ? 50 : (isSelected ? 20 : 10),
        cursor: isDragging ? 'grabbing' : (mouseDownTime > 0 ? 'grabbing' : 'grab'),
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease, transform 0.2s ease',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        willChange: isDragging ? 'transform' : 'auto'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Table Header */}
      <div 
        className="table-header px-4 py-3 text-black font-semibold text-sm flex items-center justify-between select-none"
        style={{ 
          backgroundColor: accentColor,
          cursor: 'grab'
        }}
      >
        <span>{tableName}</span>
        <div className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center">
          <span className="text-xs font-bold">{fields.length}</span>
        </div>
      </div>

      {/* Table Fields */}
      <div className="py-2">
        {fields.map((field, index) => (
          <div 
            key={index} 
            className={`px-4 py-2 flex items-center justify-between text-sm hover:bg-surface-hover transition-colors ${
              index !== fields.length - 1 ? 'border-b border-border/50' : ''
            }`}
          >
            <div className="flex items-center space-x-2">
              {field.isPrimaryKey && (
                <Key size={14} className="text-primary" />
              )}
              {field.isForeignKey && (
                <Hash size={14} className="text-blue-400" />
              )}
              <span className="text-text-primary font-medium">{field.name}</span>
            </div>
            <span className="text-text-secondary text-xs">{field.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}