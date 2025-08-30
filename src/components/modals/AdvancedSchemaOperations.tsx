'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, Save, FileText, Database, Package, Trash2, RotateCcw } from 'lucide-react';
import { SchemaDataService, SchemaBackup } from '@/services/schemaDataService';

interface AdvancedSchemaOperationsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TabProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: (id: string) => void;
}

function Tab({ id, label, isActive, onClick }: TabProps) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-primary text-text-primary rounded-t-xl'
          : 'border-transparent text-text-secondary hover:text-text-primary hover:border-text-secondary/30 hover:rounded-t-xl'
      }`}
    >
      {label}
    </button>
  );
}

export default function AdvancedSchemaOperations({ isOpen, onClose }: AdvancedSchemaOperationsProps) {
  const [activeTab, setActiveTab] = useState('import');
  const [exportFormat, setExportFormat] = useState<'sql' | 'json'>('sql');
  const [backups, setBackups] = useState<SchemaBackup[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importError, setImportError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const schemaDataService = SchemaDataService.getInstance();

  // Load backups when modal opens
  useEffect(() => {
    if (isOpen) {
      setBackups(schemaDataService.getBackups());
      setImportError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          await schemaDataService.importFromJSON(content);
        } else if (file.name.endsWith('.sql')) {
          await schemaDataService.importFromSQL(content);
        } else {
          throw new Error('Unsupported file format. Please use .json or .sql files.');
        }
        
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Show success message or close modal
        alert('Schema imported successfully!');
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Failed to import schema');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      let content = '';
      let filename = '';
      let mimeType = '';

      if (exportFormat === 'json') {
        content = schemaDataService.exportAsJSON();
        filename = `schema-export-${Date.now()}.json`;
        mimeType = 'application/json';
      } else {
        content = schemaDataService.exportAsSQL();
        filename = `schema-export-${Date.now()}.sql`;
        mimeType = 'application/sql';
      }

      schemaDataService.downloadFile(content, filename, mimeType);
    } catch (error) {
      alert(`Failed to export schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateBackup = () => {
    try {
      const backup = schemaDataService.createBackup();
      setBackups(prev => [backup, ...prev]);
    } catch (error) {
      alert(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    try {
      await schemaDataService.restoreBackup(backupId);
      alert('Backup restored successfully!');
    } catch (error) {
      alert(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteBackup = (backupId: string) => {
    if (confirm('Are you sure you want to delete this backup?')) {
      schemaDataService.deleteBackup(backupId);
      setBackups(prev => prev.filter(b => b.id !== backupId));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        className="w-full max-w-3xl mx-4 rounded-lg border border-border" 
        style={{ backgroundColor: '#2a3142' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Package size={20} className="text-black" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Advanced Schema Operations</h2>
              <p className="text-sm text-text-secondary">Import, export, backup, and manage your schema</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-md hover:bg-surface-hover"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          <Tab id="import" label="Import" isActive={activeTab === 'import'} onClick={setActiveTab} />
          <Tab id="export" label="Export" isActive={activeTab === 'export'} onClick={setActiveTab} />
          <Tab id="backup" label="Backup" isActive={activeTab === 'backup'} onClick={setActiveTab} />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">Import Schema</h3>
                <p className="text-text-secondary text-sm mb-4">
                  Import your schema from SQL or JSON files. This will replace your current diagram.
                </p>
              </div>

              {importError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{importError}</p>
                </div>
              )}

              <div className={`border-2 border-dashed border-border rounded-lg p-8 text-center ${isImporting ? 'opacity-50' : ''}`}>
                {isImporting ? (
                  <>
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-text-secondary/20 border-t-text-secondary rounded-full animate-spin"></div>
                    <h4 className="text-lg font-medium text-text-primary mb-2">Importing Schema...</h4>
                    <p className="text-text-secondary text-sm">Please wait while we process your file.</p>
                  </>
                ) : (
                  <>
                    <Upload size={48} className="mx-auto text-text-secondary mb-4" />
                    <h4 className="text-lg font-medium text-text-primary mb-2">Upload Schema File</h4>
                    <p className="text-text-secondary text-sm mb-4">
                      Drag and drop your SQL or JSON file here, or click to browse
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".sql,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isImporting}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                      className="px-6 py-2 bg-primary text-black rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Choose File
                    </button>
                    <p className="text-xs text-text-secondary mt-2">
                      Supported formats: .sql, .json
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">Export Schema</h3>
                <p className="text-text-secondary text-sm mb-4">
                  Export your current schema in your preferred format.
                </p>
              </div>

              <div>
                <h4 className="text-base font-medium text-text-primary mb-3">Format</h4>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={() => setExportFormat('sql')}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                      exportFormat === 'sql'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-text-secondary bg-background'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                        <Database size={16} className="text-black" />
                      </div>
                      <div>
                        <h5 className="font-medium text-text-primary">SQL</h5>
                        <p className="text-xs text-text-secondary">Standard SQL DDL format</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setExportFormat('json')}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                      exportFormat === 'json'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-text-secondary bg-background'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                        <FileText size={16} className="text-black" />
                      </div>
                      <div>
                        <h5 className="font-medium text-text-primary">JSON</h5>
                        <p className="text-xs text-text-secondary">Structured JSON format</p>
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-primary text-black rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Export Schema</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Backup Tab */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Schema Backups</h3>
                  <p className="text-text-secondary text-sm">
                    Create and manage backups of your schema.
                  </p>
                </div>
                <button
                  onClick={handleCreateBackup}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary text-black rounded-md font-medium hover:bg-primary/90 transition-colors"
                >
                  <Save size={16} />
                  <span>Create Backup</span>
                </button>
              </div>

              {backups.length > 0 ? (
                <div className="space-y-3">
                  {backups.map((backup) => (
                    <div
                      key={backup.id}
                      className="p-4 border border-border rounded-lg bg-background"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-text-primary">{backup.name}</h4>
                          <div className="text-sm text-text-secondary mt-1">
                            <p>Created: {new Date(backup.createdAt).toLocaleString()}</p>
                            <p>Tables: {backup.data.tables.length} | Relationships: {backup.data.relationships.length}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleRestoreBackup(backup.id)}
                            className="flex items-center space-x-1 px-3 py-1 text-sm text-text-secondary hover:text-text-primary transition-colors rounded hover:bg-surface-hover"
                          >
                            <RotateCcw size={14} />
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(backup.id)}
                            className="flex items-center space-x-1 px-3 py-1 text-sm text-red-400 hover:text-red-300 transition-colors rounded hover:bg-red-900/20"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Save size={48} className="mx-auto text-text-secondary mb-4 opacity-50" />
                  <h4 className="text-lg font-medium text-text-primary mb-2">No Backups</h4>
                  <p className="text-text-secondary">
                    Create your first backup to protect your schema.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}