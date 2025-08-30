'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { DiagramService, DiagramData } from '../../services/diagramService';

interface SchemaStats {
  tables: number;
  relationships: number;
  fields: number;
}

interface SchemaInfoProps {
  stats?: SchemaStats;
}

export default function SchemaInfo({ stats }: SchemaInfoProps) {
  const t = useTranslations('schemaInfo');
  const [liveStats, setLiveStats] = useState<SchemaStats>({ tables: 0, relationships: 0, fields: 0 });
  const diagramService = DiagramService.getInstance();

  useEffect(() => {
    // Load initial stats
    const initialData = diagramService.getDiagramData();
    updateStats(initialData);

    // Listen for diagram updates
    const handleDiagramUpdate = (data: DiagramData) => {
      updateStats(data);
    };

    diagramService.addListener(handleDiagramUpdate);

    return () => {
      diagramService.removeListener(handleDiagramUpdate);
    };
  }, []);

  const updateStats = (data: DiagramData) => {
    setLiveStats({
      tables: data.tables.length,
      relationships: data.relationships.length,
      fields: data.tables.reduce((total, table) => total + table.fields.length, 0)
    });
  };

  const currentStats = stats || liveStats;
  
  const statItems = [
    { label: t('tables'), value: currentStats.tables },
    { label: t('relationships'), value: currentStats.relationships },
    { label: t('fields'), value: currentStats.fields }
  ];

  return (
    <div className="w-64 bg-background-secondary border-l border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-text-primary">{t('title')}</h2>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-4">
        {statItems.map((item, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">{item.label}:</span>
            <span className="text-text-primary font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}