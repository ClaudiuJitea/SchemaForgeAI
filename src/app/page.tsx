'use client';

import { useState } from 'react';
import TopNavigation from '@/components/navigation/TopNavigation';
import AIAssistant from '@/components/sidebar/AIAssistant';
import DiagramWorkspace from '@/components/workspace/DiagramWorkspace';
import TableDataViewer from '@/components/workspace/TableDataViewer';
import ContentTabs from '@/components/workspace/ContentTabs';
import StatusBar from '@/components/statusbar/StatusBar';
import AISettings from '@/components/modals/AISettings';
import AdvancedSchemaOperations from '@/components/modals/AdvancedSchemaOperations';
import DatabaseConnection from '@/components/modals/DatabaseConnectionNew';
import { DiagramService } from '@/services/diagramService';

export default function Home() {
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isAdvancedOperationsOpen, setIsAdvancedOperationsOpen] = useState(false);
  const [isDatabaseConnectionOpen, setIsDatabaseConnectionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diagram');
  const diagramService = DiagramService.getInstance();

  // Helper function to get table schema from diagram service
  const getTableSchema = (tableName: string) => {
    const tableData = diagramService.getTableData(tableName);
    if (!tableData) return undefined;

    return tableData.fields.map(field => ({
      name: field.name,
      type: field.type,
      isPrimaryKey: field.isPrimaryKey,
      nullable: field.nullable
    }));
  };

  return (
    <div className="h-screen flex flex-col bg-background text-text-primary">
      {/* Top Navigation */}
      <TopNavigation 
        onOpenAISettings={() => setIsAISettingsOpen(true)}
        onOpenAdvancedOperations={() => setIsAdvancedOperationsOpen(true)}
        onOpenDatabaseConnection={() => setIsDatabaseConnectionOpen(true)}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - AI Assistant */}
          <AIAssistant />
          
          {/* Main Content with Tabs, Diagram, and Status Bar */}
          <div className="flex-1 flex flex-col">
            {/* Content Tabs */}
            <ContentTabs activeTab={activeTab} onTabChange={setActiveTab} />
            
            {/* Main Content Area - Conditional based on active tab */}
            {activeTab === 'diagram' && <DiagramWorkspace />}
            {activeTab === 'migration-queue' && (
              <div className="flex-1 flex items-center justify-center text-text-secondary">
                <p>Migration Queue - Coming Soon</p>
              </div>
            )}
            {activeTab.startsWith('table-') && (
              <TableDataViewer 
                tableName={activeTab.replace('table-', '')}
                tableSchema={getTableSchema(activeTab.replace('table-', ''))}
                onClose={() => setActiveTab('diagram')}
              />
            )}
          </div>
        </div>
        
        {/* Bottom separator line spanning full width */}
        <div style={{ borderTop: '1px solid #374151' }}></div>
        
        {/* Bottom Status Bar spanning full width */}
        <StatusBar />
      </div>

      {/* AI Settings Modal */}
      <AISettings 
        isOpen={isAISettingsOpen} 
        onClose={() => setIsAISettingsOpen(false)} 
      />

      {/* Advanced Schema Operations Modal */}
      <AdvancedSchemaOperations 
        isOpen={isAdvancedOperationsOpen} 
        onClose={() => setIsAdvancedOperationsOpen(false)} 
      />

      {/* Database Connection Modal */}
      <DatabaseConnection 
        isOpen={isDatabaseConnectionOpen} 
        onClose={() => setIsDatabaseConnectionOpen(false)} 
      />
    </div>
  );
}
