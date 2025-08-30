'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  X, Database, Check, AlertCircle, Loader2, Plus, Trash2, Zap, 
  Upload, Play, History, HardDrive, Sparkles, Train, Triangle, Globe, Server,
  ArrowRight, Circle, CheckCircle2, XCircle, Clock, Download, FileUp, ChevronDown, Shield
} from 'lucide-react';
import { DatabaseConfig, DatabaseProvider, ConnectionTestResult } from '@/services/database/types';
import { DATABASE_PROVIDERS, getProviderInfo } from '@/services/database/providers';
import { DatabaseService } from '@/services/database/DatabaseService';
import { DeploymentService } from '@/services/database/DeploymentService';
import { DiagramService } from '@/services/diagramService';

interface DatabaseConnectionProps {
  isOpen: boolean;
  onClose: () => void;
}

const iconMap = {
  harddrive: HardDrive,
  server: Server,
  database: Database,
  zap: Zap,
  sparkles: Sparkles,
  train: Train,
  triangle: Triangle,
  globe: Globe,
};

export default function DatabaseConnection({ isOpen, onClose }: DatabaseConnectionProps) {
  const [activeTab, setActiveTab] = useState('connect');
  const [selectedProvider, setSelectedProvider] = useState<DatabaseProvider>('sqlite');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [configs, setConfigs] = useState<DatabaseConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [schemaPreview, setSchemaPreview] = useState<string>('');
  const [isUploadingSQLite, setIsUploadingSQLite] = useState(false);
  const [isDownloadingSQLite, setIsDownloadingSQLite] = useState(false);
  const sqliteFileRef = useRef<HTMLInputElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  
  const databaseService = DatabaseService.getInstance();
  const deploymentService = DeploymentService.getInstance();
  const diagramService = DiagramService.getInstance();

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
      setTestResult(null);
      setFormData({});
      setDeploymentResult(null);
      loadSchemaPreview();
    }
  }, [isOpen]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setIsProviderDropdownOpen(false);
      }
    };

    if (isProviderDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProviderDropdownOpen]);

  const loadConfigs = () => {
    const loadedConfigs = databaseService.getConfigs();
    setConfigs(loadedConfigs);
    
    const activeConfig = databaseService.getActiveConfig();
    setActiveConfigId(activeConfig?.id || null);
  };

  const loadSchemaPreview = () => {
    const sql = diagramService.exportSchemaAsSQL();
    setSchemaPreview(sql || '-- No tables created yet\n-- Create some tables in the diagram to see SQL here');
  };

  const handleProviderSelect = (provider: DatabaseProvider) => {
    setSelectedProvider(provider);
    setFormData({});
    setTestResult(null);
    setIsProviderDropdownOpen(false);
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const generateConnectionString = (provider: DatabaseProvider): string => {
    const providerInfo = getProviderInfo(provider);
    if (!providerInfo) return '';

    switch (provider) {
      case 'postgres-local':
        if (formData.host && formData.port && formData.database && formData.username) {
          const password = formData.password ? `:${formData.password}` : '';
          return `postgresql://${formData.username}${password}@${formData.host}:${formData.port}/${formData.database}`;
        }
        break;
      case 'mysql-local':
        if (formData.host && formData.port && formData.database && formData.username) {
          const password = formData.password ? `:${formData.password}` : '';
          return `mysql://${formData.username}${password}@${formData.host}:${formData.port}/${formData.database}`;
        }
        break;
    }
    
    return formData.connectionString || '';
  };

  const handleTestConnection = async () => {
    setIsConnecting(true);
    setTestResult(null);

    try {
      const providerInfo = getProviderInfo(selectedProvider);
      if (!providerInfo) {
        throw new Error('Invalid provider selected');
      }

      const config: DatabaseConfig = {
        id: `temp-${Date.now()}`,
        name: `Test ${providerInfo.name}`,
        provider: selectedProvider,
        connectionString: generateConnectionString(selectedProvider),
        ...formData
      };


      const result = await databaseService.testConnection(config);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveConnection = () => {
    const providerInfo = getProviderInfo(selectedProvider);
    if (!providerInfo) return;

    const config: DatabaseConfig = {
      id: Date.now().toString(),
      name: formData.name || `${providerInfo.name} Connection`,
      provider: selectedProvider,
      connectionString: generateConnectionString(selectedProvider),
      ...formData
    };


    databaseService.saveConfig(config);
    loadConfigs();
    setActiveTab('manage');
  };

  const handleSetActive = (configId: string) => {
    databaseService.setActiveConfig(configId);
    setActiveConfigId(configId);
  };

  const handleDeleteConfig = (configId: string) => {
    if (confirm('Are you sure you want to delete this database connection?')) {
      databaseService.deleteConfig(configId);
      loadConfigs();
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentResult(null);

    try {
      const result = await deploymentService.deploySchema({
        useMigrations: true,
        createBackup: false,
        validateBeforeDeploy: true
      });

      setDeploymentResult(result);
    } catch (error) {
      setDeploymentResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {}
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSQLiteUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
      alert('Please select a valid SQLite database file (.db or .sqlite)');
      return;
    }

    setIsUploadingSQLite(true);

    try {
      const activeConfig = databaseService.getActiveConfig();
      if (!activeConfig || activeConfig.provider !== 'sqlite') {
        alert('Please select an SQLite connection first');
        return;
      }

      const provider = databaseService.getActiveProvider() as any;
      await provider.uploadDatabase(file);
      
      alert('SQLite database uploaded successfully!');
      
      // Clear the file input
      if (sqliteFileRef.current) {
        sqliteFileRef.current.value = '';
      }
    } catch (error) {
      alert(`Failed to upload database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingSQLite(false);
    }
  };

  const handleSQLiteDownload = async () => {
    setIsDownloadingSQLite(true);

    try {
      const activeConfig = databaseService.getActiveConfig();
      if (!activeConfig || activeConfig.provider !== 'sqlite') {
        alert('Please select an SQLite connection first');
        return;
      }

      const provider = databaseService.getActiveProvider() as any;
      await provider.downloadDatabase();
      
    } catch (error) {
      alert(`Failed to download database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloadingSQLite(false);
    }
  };


  if (!isOpen) return null;

  const providerInfo = getProviderInfo(selectedProvider);
  const canTestConnection = providerInfo && 
    providerInfo.fields.every(field => !field.required || formData[field.key]);
  const canSaveConnection = canTestConnection && testResult?.success;

  const getProviderIcon = (iconName: string) => {
    const Icon = iconMap[iconName as keyof typeof iconMap] || Database;
    return Icon;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col" 
        style={{ backgroundColor: '#2a3142' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Database size={20} className="text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">Database Connections</h2>
              <p className="text-sm text-text-secondary hidden sm:block">Connect, manage, and deploy to your databases</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-surface-hover"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          {[
            { id: 'connect', label: 'New Connection' },
            { id: 'manage', label: 'Connections' },
            { id: 'deploy', label: 'Deploy' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 sm:px-8 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-text-secondary/30 hover:rounded-t-xl'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">
          {/* New Connection Tab */}
          {activeTab === 'connect' && (
            <div className="space-y-6">
              {/* Provider Selection */}
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-4">Choose Database Provider</h3>
                <div className="relative" ref={providerDropdownRef}>
                  {/* Dropdown Button */}
                  <button
                    onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
                    className="w-full p-4 bg-background border border-border rounded-xl text-left flex items-center justify-between hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {(() => {
                        const selectedProviderInfo = getProviderInfo(selectedProvider);
                        const Icon = getProviderIcon(selectedProviderInfo?.icon || 'database');
                        return (
                          <>
                            <div className="p-2 rounded-lg bg-primary text-black">
                              <Icon size={16} />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-text-primary">
                                  {selectedProviderInfo?.name}
                                </span>
                                {selectedProviderInfo?.freeOption && (
                                  <span className="px-1.5 py-0.5 text-xs bg-green-600 text-white rounded font-medium">
                                    FREE
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <p className="text-sm text-text-secondary">
                                  {selectedProviderInfo?.description}
                                </p>
                                {selectedProviderInfo?.freeOption && (
                                  <span className="text-xs text-green-400 font-medium">• Free tier available</span>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <ChevronDown 
                      size={20} 
                      className={`text-text-secondary transition-transform ${isProviderDropdownOpen ? 'rotate-180' : ''}`} 
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isProviderDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                      {DATABASE_PROVIDERS.map((provider) => {
                        const Icon = getProviderIcon(provider.icon);
                        const isSelected = selectedProvider === provider.id;
                        return (
                          <button
                            key={provider.id}
                            onClick={() => handleProviderSelect(provider.id)}
                            className={`w-full p-3 text-left flex items-center space-x-3 hover:bg-surface-hover transition-colors first:rounded-t-xl last:rounded-b-xl ${
                              isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                            }`}
                          >
                            <div className={`p-2 rounded-lg ${
                              isSelected ? 'bg-primary text-black' : 'bg-surface text-text-secondary'
                            }`}>
                              <Icon size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-text-primary text-sm">
                                  {provider.name}
                                </span>
                                {provider.freeOption && (
                                  <span className="px-1.5 py-0.5 text-xs bg-green-600 text-white rounded font-medium">
                                    FREE
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-secondary">
                                {provider.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Connection Configuration */}
              {providerInfo && (
                <div className="bg-surface/30 rounded-xl border border-border overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-surface/20">
                    <h3 className="text-lg font-semibold text-text-primary">
                      Configure {providerInfo.name} Connection
                    </h3>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Form Fields - Takes 2/3 width */}
                      <div className="lg:col-span-2">
                        {/* All form fields with consistent alignment */}
                        <div className="space-y-4">
                          {/* Connection Name */}
                          <div className="grid grid-cols-4 gap-4 items-start">
                            <label className="col-span-1 text-sm font-medium text-text-primary pt-2.5 text-right">
                              Connection Name
                            </label>
                            <div className="col-span-3">
                              <input
                                type="text"
                                value={formData.name || ''}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder={`My ${providerInfo.name} Database`}
                                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm max-w-md"
                              />
                            </div>
                          </div>


                          {/* Provider-specific fields with aligned labels */}
                          {providerInfo.fields.map((field) => (
                            <div key={field.key} className="grid grid-cols-4 gap-4 items-start">
                              <label className="col-span-1 text-sm font-medium text-text-primary pt-2.5 text-right">
                                {field.label} {field.required && <span className="text-red-400">*</span>}
                              </label>
                              <div className="col-span-3">
                                <input
                                  type={field.type}
                                  value={formData[field.key] || ''}
                                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className={`w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm ${
                                    field.key === 'connectionString' ? 'max-w-2xl' : 'max-w-md'
                                  }`}
                                />
                                {field.description && (
                                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">{field.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions Panel - Takes 1/3 width */}
                      <div className="space-y-4">
                        {/* Connection Status */}
                        {testResult && (
                          <div className={`p-3 rounded-lg border text-sm ${
                            testResult.success 
                              ? 'bg-green-900/20 border-green-500/30' 
                              : 'bg-red-900/20 border-red-500/30'
                          }`}>
                            <div className="flex items-start space-x-2">
                              {testResult.success ? (
                                <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                              ) : (
                                <XCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div>
                                <p className={`font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                  {testResult.message}
                                </p>
                                {testResult.success && testResult.latency && (
                                  <p className="text-xs text-text-secondary mt-1">
                                    {testResult.latency}ms response
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2">
                          <button
                            onClick={handleTestConnection}
                            disabled={!canTestConnection || isConnecting}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-background border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            {isConnecting ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Zap size={14} />
                            )}
                            <span>{isConnecting ? 'Testing...' : 'Test Connection'}</span>
                          </button>

                          <button
                            onClick={handleSaveConnection}
                            disabled={!canSaveConnection}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-primary text-black rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            <Plus size={14} />
                            <span>Save Connection</span>
                          </button>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manage Connections Tab */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">Saved Connections</h3>
                {activeConfigId && (
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg">
                    <Circle size={8} className="fill-primary text-primary" />
                    <span className="text-sm font-medium text-primary">
                      Active: {configs.find(c => c.id === activeConfigId)?.name}
                    </span>
                  </div>
                )}
              </div>

              {configs.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {configs.map((config) => {
                    const providerInfo = getProviderInfo(config.provider);
                    const isActive = config.id === activeConfigId;
                    const Icon = getProviderIcon(providerInfo?.icon || 'database');
                    
                    return (
                      <div
                        key={config.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isActive 
                            ? 'border-primary bg-primary/5 shadow-lg' 
                            : 'border-border bg-background hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${
                              isActive ? 'bg-primary text-black' : 'bg-surface text-text-secondary'
                            }`}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-text-primary">{config.name}</h4>
                              <p className="text-sm text-text-secondary">
                                {providerInfo?.name} • {config.provider}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!isActive && (
                              <button
                                onClick={() => handleSetActive(config.id)}
                                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-surface-hover"
                              >
                                Set Active
                              </button>
                            )}
                            {isActive && (
                              <span className="px-3 py-1.5 text-sm bg-primary text-black rounded-lg font-medium">
                                Active
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteConfig(config.id)}
                              className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-lg hover:bg-red-900/20"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Database size={64} className="mx-auto text-text-secondary/50 mb-6" />
                  <h4 className="text-xl font-semibold text-text-primary mb-3">No Connections</h4>
                  <p className="text-text-secondary mb-6 max-w-md mx-auto">
                    Create your first database connection to start deploying your schemas.
                  </p>
                  <button
                    onClick={() => setActiveTab('connect')}
                    className="px-6 py-3 bg-primary text-black rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Add Connection
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Deploy Tab */}
          {activeTab === 'deploy' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Deploy Schema</h3>
                  <p className="text-text-secondary">
                    Deploy your current schema to the active database connection
                  </p>
                </div>
                {activeConfigId && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-text-primary">
                      Deploying to: {configs.find(c => c.id === activeConfigId)?.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {getProviderInfo(configs.find(c => c.id === activeConfigId)?.provider || 'sqlite')?.name}
                    </p>
                  </div>
                )}
              </div>

              {!activeConfigId ? (
                <div className="text-center py-16">
                  <Database size={64} className="mx-auto text-text-secondary/50 mb-6" />
                  <h4 className="text-xl font-semibold text-text-primary mb-3">No Active Connection</h4>
                  <p className="text-text-secondary mb-6 max-w-md mx-auto">
                    Please connect to a database first to deploy your schema.
                  </p>
                  <button
                    onClick={() => setActiveTab('manage')}
                    className="px-6 py-3 bg-primary text-black rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Manage Connections
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Deployment Panel */}
                  <div className="space-y-4">
                    {/* Deployment Result */}
                    {deploymentResult && (
                      <div className={`p-4 rounded-xl border ${
                        deploymentResult.success 
                          ? 'bg-green-900/20 border-green-500/30' 
                          : 'bg-red-900/20 border-red-500/30'
                      }`}>
                        <div className="flex items-start space-x-3">
                          {deploymentResult.success ? (
                            <CheckCircle2 size={24} className="text-green-400 mt-0.5" />
                          ) : (
                            <XCircle size={24} className="text-red-400 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className={`font-semibold mb-2 ${deploymentResult.success ? 'text-green-400' : 'text-red-400'}`}>
                              {deploymentResult.message}
                            </p>
                            {deploymentResult.details.tablesCreated && (
                              <p className="text-sm text-text-secondary">
                                Tables created: {deploymentResult.details.tablesCreated}
                              </p>
                            )}
                            {deploymentResult.details.validationErrors && (
                              <div className="mt-3 space-y-1">
                                {deploymentResult.details.validationErrors.map((error: string, index: number) => (
                                  <p key={index} className="text-sm text-red-400 flex items-center space-x-2">
                                    <span>•</span>
                                    <span>{error}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                            {deploymentResult.details.instructions && (
                              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                                <h5 className="text-sm font-medium text-blue-400 mb-2">Next Steps:</h5>
                                <div className="space-y-1">
                                  {deploymentResult.details.instructions.map((instruction: string, index: number) => (
                                    <p key={index} className="text-xs text-blue-300 flex items-start space-x-2">
                                      <span className="text-blue-400">{index + 1}.</span>
                                      <span>{instruction.replace(/^\d+\.\s*/, '')}</span>
                                    </p>
                                  ))}
                                </div>
                                {deploymentResult.details.note && (
                                  <p className="text-xs text-blue-300 mt-3 italic">
                                    Note: {deploymentResult.details.note}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Deploy Actions */}
                    <div className="bg-surface/30 rounded-xl p-4 border border-border">
                      <h4 className="font-semibold text-text-primary mb-4">Deployment Actions</h4>
                      <div className="space-y-4">
                        <button
                          onClick={handleDeploy}
                          disabled={isDeploying}
                          className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-primary text-black rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeploying ? (
                            <>
                              <Loader2 size={20} className="animate-spin" />
                              <span>Deploying Schema...</span>
                            </>
                          ) : (
                            <>
                              <Upload size={20} />
                              <span>Deploy Schema</span>
                            </>
                          )}
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            disabled={isDeploying}
                            className="flex items-center justify-center space-x-2 px-4 py-3 bg-background border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                          >
                            <Play size={16} />
                            <span className="text-sm">Test Deploy</span>
                          </button>
                          
                          <button
                            disabled={isDeploying}
                            className="flex items-center justify-center space-x-2 px-4 py-3 bg-background border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                          >
                            <History size={16} />
                            <span className="text-sm">View History</span>
                          </button>
                        </div>

                        {/* SQLite-specific file management */}
                        {configs.find(c => c.id === activeConfigId)?.provider === 'sqlite' && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h5 className="text-sm font-medium text-text-primary mb-3">SQLite File Management</h5>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={handleSQLiteDownload}
                                disabled={isDownloadingSQLite}
                                className="flex items-center justify-center space-x-2 px-3 py-2 bg-background border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                              >
                                {isDownloadingSQLite ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Download size={14} />
                                )}
                                <span className="text-sm">Download .db</span>
                              </button>
                              
                              <div>
                                <input
                                  ref={sqliteFileRef}
                                  type="file"
                                  accept=".db,.sqlite"
                                  onChange={handleSQLiteUpload}
                                  className="hidden"
                                  disabled={isUploadingSQLite}
                                />
                                <button
                                  onClick={() => sqliteFileRef.current?.click()}
                                  disabled={isUploadingSQLite}
                                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-background border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                                >
                                  {isUploadingSQLite ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <FileUp size={14} />
                                  )}
                                  <span className="text-sm">Upload .db</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Schema Preview */}
                  <div className="bg-surface/30 rounded-xl p-4 border border-border">
                    <h4 className="font-semibold text-text-primary mb-4">Schema Preview</h4>
                    <div className="bg-background rounded-lg border border-border p-3 max-h-64 overflow-auto">
                      <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                        {schemaPreview}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}