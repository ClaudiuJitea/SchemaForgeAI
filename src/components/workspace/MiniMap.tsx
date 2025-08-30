'use client';

interface TableData {
  name: string;
  position: { x: number; y: number };
}

interface MiniMapProps {
  tables: TableData[];
}

export default function MiniMap({ tables }: MiniMapProps) {
  const scale = 0.1; // Scale factor for minimap

  return (
    <div className="absolute bottom-4 right-4 w-48 h-32 bg-background-secondary border border-gray-600 rounded-lg overflow-hidden">
      <div className="w-full h-full relative">
        {/* Mini tables */}
        {tables.map((table, index) => (
          <div
            key={index}
            className="absolute bg-primary rounded-sm"
            style={{
              left: table.position.x * scale,
              top: table.position.y * scale,
              width: 20,
              height: 12
            }}
          />
        ))}
        
        {/* Viewport indicator */}
        <div 
          className="absolute border-2 border-text-primary/50 rounded"
          style={{
            left: 0,
            top: 0,
            width: '100%',
            height: '100%'
          }}
        />
      </div>
    </div>
  );
}