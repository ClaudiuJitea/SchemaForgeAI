'use client';

import { useState, useEffect, useRef } from 'react';
import DatabaseTable from './DatabaseTable';
import ZoomToolbar from './ZoomToolbar';
import MiniMap from './MiniMap';
import { DiagramService, DiagramData } from '../../services/diagramService';

interface TableData {
  id: string;
  name: string;
  fields: Array<{
    name: string;
    type: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
  }>;
  position: { x: number; y: number };
  accentColor: string;
}

export default function DiagramWorkspace() {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [tables, setTables] = useState<TableData[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panStateRef = useRef({ isPanning: false, panStart: { x: 0, y: 0 } });
  const diagramService = DiagramService.getInstance();

  useEffect(() => {
    // Load initial diagram data
    const initialData = diagramService.getDiagramData();
    updateTablesFromDiagramData(initialData);

    // Listen for diagram updates
    const handleDiagramUpdate = (data: DiagramData) => {
      updateTablesFromDiagramData(data);
    };

    diagramService.addListener(handleDiagramUpdate);

    return () => {
      diagramService.removeListener(handleDiagramUpdate);
    };
  }, []);

  // Keyboard shortcuts for better UX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Reset view on Escape
        handleFitToScreen();
      } else if (e.key === ' ') {
        // Only prevent spacebar if not typing in an input or textarea
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return; // Don't prevent default for text inputs
        }
        // Spacebar for temporary pan mode (like Figma/Sketch)
        e.preventDefault();
        if (!isSpacePressed) {
          setIsSpacePressed(true);
          document.body.style.cursor = 'grab';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        setIsSpacePressed(false);
        panStateRef.current.isPanning = false;
        setIsPanning(false);
        document.body.style.cursor = '';
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.body.style.cursor = '';
    };
  }, [isSpacePressed]);

  const updateTablesFromDiagramData = (data: DiagramData) => {
    console.log('Diagram data updated:', data);
    console.log('Found relationships:', data.relationships);
    
    const convertedTables: TableData[] = data.tables.map(table => ({
      id: table.id,
      name: table.name,
      fields: table.fields.map(field => ({
        name: field.name,
        type: field.type,
        isPrimaryKey: field.isPrimaryKey,
        isForeignKey: field.isForeignKey
      })),
      position: table.position,
      accentColor: '#F39C12'
    }));

    setTables(convertedTables);
    setRelationships(data.relationships);
  };

  // Calculate dynamic canvas size based on table positions
  const calculateCanvasSize = () => {
    if (tables.length === 0) return { width: 1000, height: 1000 };

    const tableWidth = 192; // ~12rem (w-48 min width from DatabaseTable)
    const tableHeight = 250; // Approximate table height (header + fields)
    const padding = 200; // Extra padding around the content

    const maxX = Math.max(...tables.map(t => t.position.x + tableWidth));
    const maxY = Math.max(...tables.map(t => t.position.y + tableHeight));
    
    // Ensure minimum size and add padding
    const width = Math.max(1000, maxX + padding);
    const height = Math.max(1000, maxY + padding);

    return { width, height };
  };

  const canvasSize = calculateCanvasSize();

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleFitToScreen = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleTablePositionChange = (tableId: string, newPosition: { x: number; y: number }) => {
    // Update local state immediately for smooth dragging
    setTables(prev => prev.map(table => 
      table.id === tableId ? { ...table, position: newPosition } : table
    ));
    
    // Debounce diagram service updates to avoid excessive calls
    clearTimeout((window as any).positionUpdateTimeout);
    (window as any).positionUpdateTimeout = setTimeout(() => {
      diagramService.updateTablePosition(tableId, newPosition);
    }, 50);
  };

  const handleTableClick = (tableName: string) => {
    setSelectedTable(tableName);
    diagramService.selectTable(tableName);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Start panning if spacebar is pressed OR not clicking on a table element
    const target = e.target as HTMLElement;
    const isClickingOnTable = target.closest('[data-table]') !== null;
    
    if (isSpacePressed || !isClickingOnTable) {
      panStateRef.current.isPanning = true;
      panStateRef.current.panStart = {
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      };
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      });
      e.preventDefault();
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // This will be handled by the global mouse move handler for better performance
  };

  const handleCanvasMouseUp = () => {
    panStateRef.current.isPanning = false;
    setIsPanning(false);
  };

  // Global mouse event handlers for smooth dragging and panning
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (panStateRef.current.isPanning) {
        // Use requestAnimationFrame for smooth panning
        requestAnimationFrame(() => {
          setPanOffset({
            x: e.clientX - panStateRef.current.panStart.x,
            y: e.clientY - panStateRef.current.panStart.y
          });
        });
        e.preventDefault();
      } else if (isDragging) {
        // This will be handled by the individual table components
        e.preventDefault();
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      panStateRef.current.isPanning = false;
      setIsPanning(false);
    };

    if (isDragging || panStateRef.current.isPanning) {
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      if (panStateRef.current.isPanning) {
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
  }, [isDragging, isPanning, panStart]);

  return (
    <div 
      className="flex-1 relative bg-background grid-pattern overflow-hidden select-none"
      style={{ cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default' }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
    >
      <div 
        className="relative"
        style={{ 
          width: `${canvasSize.width}px`,
          height: `${canvasSize.height}px`,
          minWidth: '100%',
          minHeight: '100%',
          transform: `scale(${zoom}) translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`,
          transformOrigin: '0 0',
          transition: isPanning ? 'none' : 'transform 0.2s ease',
          willChange: isPanning ? 'transform' : 'auto'
        }}
      >
        {/* Render all tables */}
        {tables.map((table) => (
          <DatabaseTable
            key={table.id}
            tableName={table.name}
            fields={table.fields}
            position={table.position}
            accentColor={table.accentColor}
            isSelected={selectedTable === table.name}
            onPositionChange={(newPosition) => handleTablePositionChange(table.id, newPosition)}
            onTableClick={handleTableClick}
          />
        ))}

        {/* Dynamic Connection lines */}
        <svg 
          className="absolute pointer-events-none" 
          style={{ 
            zIndex: 2, 
            left: 0, 
            top: 0,
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
            overflow: 'visible'
          }}
        >
          {relationships.map((rel, index) => {
            const fromTable = tables.find(t => t.name === rel.fromTable);
            const toTable = tables.find(t => t.name === rel.toTable);
            
            if (!fromTable || !toTable) return null;

            // Get actual table dimensions (approximate based on common table sizes)
            const tableWidth = 192; // ~12rem (w-48 min width from DatabaseTable)
            const headerHeight = 48; // Header height
            const fieldHeight = 36; // Each field row height
            const fromTableHeight = headerHeight + (fromTable.fields.length * fieldHeight);
            const toTableHeight = headerHeight + (toTable.fields.length * fieldHeight);

            // Find the specific field positions within tables
            const fromFieldIndex = fromTable.fields.findIndex(f => f.name === rel.fromField);
            const toFieldIndex = toTable.fields.findIndex(f => f.name === rel.toField);
            
            // Calculate field Y positions (center of each field row)
            const fromFieldY = fromTable.position.y + headerHeight + (fromFieldIndex + 0.5) * fieldHeight;
            const toFieldY = toTable.position.y + headerHeight + (toFieldIndex + 0.5) * fieldHeight;

            // Determine connection points
            const fromCenterX = fromTable.position.x + tableWidth / 2;
            const toCenterX = toTable.position.x + tableWidth / 2;
            
            let x1, y1, x2, y2;
            let fromSide, toSide;

            // Determine which sides to connect based on table positions
            if (fromTable.position.x + tableWidth < toTable.position.x) {
              // From table is to the left of to table
              x1 = fromTable.position.x + tableWidth;
              x2 = toTable.position.x;
              fromSide = 'right';
              toSide = 'left';
            } else if (toTable.position.x + tableWidth < fromTable.position.x) {
              // To table is to the left of from table
              x1 = fromTable.position.x;
              x2 = toTable.position.x + tableWidth;
              fromSide = 'left';
              toSide = 'right';
            } else {
              // Tables are vertically aligned, use vertical connection
              if (fromTable.position.y + fromTableHeight < toTable.position.y) {
                // From table is above to table
                x1 = fromCenterX;
                y1 = fromTable.position.y + fromTableHeight;
                x2 = toCenterX;
                y2 = toTable.position.y;
                fromSide = 'bottom';
                toSide = 'top';
              } else {
                // To table is above from table
                x1 = fromCenterX;
                y1 = fromTable.position.y;
                x2 = toCenterX;
                y2 = toTable.position.y + toTableHeight;
                fromSide = 'top';
                toSide = 'bottom';
              }
            }

            // Set Y coordinates for horizontal connections
            if (fromSide === 'right' || fromSide === 'left') {
              y1 = fromFieldY;
              y2 = toFieldY;
            }

            // Create orthogonal path with 90-degree angles
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            let pathData;
            let labelPositions = [];
            
            if (fromSide === 'right' || fromSide === 'left') {
              // Horizontal then vertical routing
              if (fromSide === 'right') {
                // Go right, then down/up, then left to target
                const offsetX = Math.max(30, Math.abs(x2 - x1) / 2);
                const intermediateX = x1 + offsetX;
                pathData = `M ${x1} ${y1} L ${intermediateX} ${y1} L ${intermediateX} ${y2} L ${x2} ${y2}`;
                
                // Position labels along the horizontal segments
                const segment1MidX = (x1 + intermediateX) / 2;
                const segment3MidX = (intermediateX + x2) / 2;
                labelPositions = [
                  { x: segment1MidX, y: y1 - 8, rotation: 0, text: rel.fromField },
                  { x: segment3MidX, y: y2 - 8, rotation: 0, text: rel.toField }
                ];
              } else {
                // Go left, then down/up, then right to target
                const offsetX = Math.max(30, Math.abs(x2 - x1) / 2);
                const intermediateX = x1 - offsetX;
                pathData = `M ${x1} ${y1} L ${intermediateX} ${y1} L ${intermediateX} ${y2} L ${x2} ${y2}`;
                
                // Position labels along the horizontal segments
                const segment1MidX = (x1 + intermediateX) / 2;
                const segment3MidX = (intermediateX + x2) / 2;
                labelPositions = [
                  { x: segment1MidX, y: y1 - 8, rotation: 0, text: rel.fromField },
                  { x: segment3MidX, y: y2 - 8, rotation: 0, text: rel.toField }
                ];
              }
            } else {
              // Vertical then horizontal routing
              if (fromSide === 'bottom') {
                // Go down, then right/left, then up to target
                const offsetY = Math.max(30, Math.abs(y2 - y1) / 2);
                const intermediateY = y1 + offsetY;
                pathData = `M ${x1} ${y1} L ${x1} ${intermediateY} L ${x2} ${intermediateY} L ${x2} ${y2}`;
                
                // Position labels along the horizontal segment
                const segment2MidX = (x1 + x2) / 2;
                labelPositions = [
                  { x: segment2MidX, y: intermediateY - 8, rotation: 0, text: `${rel.fromField} → ${rel.toField}` }
                ];
              } else {
                // Go up, then right/left, then down to target
                const offsetY = Math.max(30, Math.abs(y2 - y1) / 2);
                const intermediateY = y1 - offsetY;
                pathData = `M ${x1} ${y1} L ${x1} ${intermediateY} L ${x2} ${intermediateY} L ${x2} ${y2}`;
                
                // Position labels along the horizontal segment
                const segment2MidX = (x1 + x2) / 2;
                labelPositions = [
                  { x: segment2MidX, y: intermediateY - 8, rotation: 0, text: `${rel.fromField} → ${rel.toField}` }
                ];
              }
            }
            
            return (
              <g key={`${rel.fromTable}-${rel.toTable}-${index}`}>
                {/* Main relationship line */}
                <path
                  d={pathData}
                  stroke="#00D4AA"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                />
                
                {/* Connection dots */}
                <circle
                  cx={x1} cy={y1}
                  r="3"
                  fill="#00D4AA"
                />
                <circle
                  cx={x2} cy={y2}
                  r="3"
                  fill="#00D4AA"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
                
                {/* Relationship labels along the path */}
                {labelPositions.map((label, labelIndex) => (
                  <text
                    key={labelIndex}
                    x={label.x}
                    y={label.y}
                    fontSize="10"
                    fill="#00D4AA"
                    textAnchor="middle"
                    className="select-none font-mono"
                    style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                    transform={label.rotation !== 0 ? `rotate(${label.rotation}, ${label.x}, ${label.y})` : undefined}
                  >
                    {label.text}
                  </text>
                ))}
              </g>
            );
          })}
          
          {/* Enhanced arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="12"
              markerHeight="8"
              refX="11"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon
                points="0 0, 12 4, 0 8"
                fill="#00D4AA"
                stroke="#00D4AA"
                strokeWidth="1"
              />
            </marker>
            
            {/* Drop shadow filter for better visibility */}
            <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="1" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.3"/>
            </filter>
          </defs>
        </svg>
      </div>

      {/* Zoom Toolbar */}
      <ZoomToolbar 
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={handleFitToScreen}
      />

      {/* MiniMap */}
      <MiniMap tables={tables} />
    </div>
  );
}