'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3, List, X, Database } from 'lucide-react';
import { DiagramService } from '../../services/diagramService';

interface ContentTab {
  id: string;
  label: string;
  icon: React.ElementType;
  active?: boolean;
  closeable?: boolean;
  tableName?: string;
}

interface ContentTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function ContentTabs({ activeTab, onTabChange }: ContentTabsProps) {
  const t = useTranslations('navigation');
  const [tabs, setTabs] = useState<ContentTab[]>([
    { id: 'diagram', label: t('diagram'), icon: BarChart3 },
    { id: 'migration-queue', label: t('migrationQueue'), icon: List }
  ]);
  const diagramService = DiagramService.getInstance();

  useEffect(() => {
    // Listen for table selections to create new tabs
    const handleTableSelection = (tableName: string | null) => {
      if (tableName) {
        const tableTabId = `table-${tableName}`;
        
        setTabs(prevTabs => {
          const existingTabIndex = prevTabs.findIndex(tab => tab.id === tableTabId);
          
          if (existingTabIndex === -1) {
            // Create new table tab
            const newTab: ContentTab = {
              id: tableTabId,
              label: tableName,
              icon: Database,
              closeable: true,
              tableName
            };
            return [...prevTabs, newTab];
          }
          return prevTabs;
        });
        
        // Switch to the table tab
        onTabChange(tableTabId);
      }
    };

    diagramService.addSelectionListener(handleTableSelection);

    return () => {
      diagramService.removeSelectionListener(handleTableSelection);
    };
  }, [onTabChange, diagramService]);

  // Separate effect for schema reset to avoid dependency issues
  useEffect(() => {
    const handleSchemaReset = () => {
      // Remove all table tabs and keep only the base tabs
      const baseTabs = [
        { id: 'diagram', label: t('diagram'), icon: BarChart3 },
        { id: 'migration-queue', label: t('migrationQueue'), icon: List }
      ];
      setTabs(baseTabs);
      
      // Switch to diagram tab if currently on a table tab
      if (activeTab.startsWith('table-')) {
        onTabChange('diagram');
      }
    };

    diagramService.addSchemaResetListener(handleSchemaReset);

    return () => {
      diagramService.removeSchemaResetListener(handleSchemaReset);
    };
  }, [activeTab, onTabChange, diagramService, t]);

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  const handleCloseTab = (tabId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Remove the tab
    const updatedTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(updatedTabs);
    
    // If the closed tab was active, switch to diagram tab
    if (activeTab === tabId) {
      onTabChange('diagram');
    }
  };

  return (
    <div className="bg-surface border-b border-border">
      <div className="flex justify-end">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium transition-colors border-r border-border cursor-pointer ${
              activeTab === tab.id
                ? 'bg-background text-text-primary border-b-2 border-b-primary rounded-t-xl'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:rounded-t-xl'
            }`}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {tab.closeable && (
              <button 
                onClick={(e) => handleCloseTab(tab.id, e)}
                className="ml-2 text-text-secondary hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}