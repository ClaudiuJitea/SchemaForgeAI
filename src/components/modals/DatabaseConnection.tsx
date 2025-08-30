'use client';

import { useState, useEffect } from 'react';
import { X, Database, Check, AlertCircle, Loader2, Plus, Settings, Trash2, Zap, Upload, Play, History } from 'lucide-react';
import { DatabaseConfig, DatabaseProvider, ConnectionTestResult } from '@/services/database/types';
import { DATABASE_PROVIDERS, getProviderInfo } from '@/services/database/providers';
import { DatabaseService } from '@/services/database/DatabaseService';
import { DeploymentService } from '@/services/database/DeploymentService';

interface DatabaseConnectionProps {
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
          ? 'border-primary text-text-primary'
          : 'border-transparent text-text-secondary hover:text-text-primary hover:border-text-secondary/30'
      }`}
    >
      {label}
    </button>
  );
}

export default function DatabaseConnection({ isOpen, onClose }: DatabaseConnectionProps) {
  const [activeTab, setActiveTab] = useState('connect');
  const [selectedProvider, setSelectedProvider] = useState<DatabaseProvider>('supabase');
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [configs, setConfigs] = useState<DatabaseConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  
  const databaseService = DatabaseService.getInstance();
  const deploymentService = DeploymentService.getInstance();

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
      setTestResult(null);
      setFormData({});
    }
  }, [isOpen]);

  const loadConfigs = () => {
    const loadedConfigs = databaseService.getConfigs();
    setConfigs(loadedConfigs);
    
    const activeConfig = databaseService.getActiveConfig();
    setActiveConfigId(activeConfig?.id || null);
  };

  const handleProviderSelect = (provider: DatabaseProvider) => {
    setSelectedProvider(provider);
    setFormData({});
    setTestResult(null);
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const generateConnectionString = (provider: DatabaseProvider): string => {
    const providerInfo = getProviderInfo(provider);
    if (!providerInfo) return '';

    switch (provider) {
      case 'supabase':
        if (formData.projectRef && formData.password) {
          return `postgresql://postgres:${formData.password}@db.${formData.projectRef}.supabase.co:5432/postgres`;
        }
        break;
      case 'planetscale':
        if (formData.host && formData.username && formData.password && formData.database) {
          return `mysql://${formData.username}:${formData.password}@${formData.host}/${formData.database}?sslaccept=strict`;
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
    alert('Connection saved successfully!');
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

  if (!isOpen) return null;

  const providerInfo = getProviderInfo(selectedProvider);
  const canTestConnection = providerInfo && providerInfo.fields.every(field => 
    !field.required || formData[field.key]
  );

  const canSaveConnection = canTestConnection && testResult?.success;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        className="w-full max-w-4xl mx-4 rounded-lg border border-border" 
        style={{ backgroundColor: '#2a3142' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Database size={20} className="text-black" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Database Connections</h2>
              <p className="text-sm text-text-secondary">Connect to your database and deploy schemas</p>
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
          <Tab id="connect" label="New Connection" isActive={activeTab === 'connect'} onClick={setActiveTab} />
          <Tab id="manage" label="Manage Connections" isActive={activeTab === 'manage'} onClick={setActiveTab} />
          <Tab id="deploy" label="Deploy Schema" isActive={activeTab === 'deploy'} onClick={setActiveTab} />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* New Connection Tab */}
          {activeTab === 'connect' && (
            <div className="space-y-6">
              {/* Provider Selection */}
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-4">Choose Database Provider</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {DATABASE_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => handleProviderSelect(provider.id)}
                      className={`p-4 rounded-lg border-2 transition-colors text-left ${
                        selectedProvider === provider.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-text-secondary bg-background'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{provider.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-text-primary">{provider.name}</h4>
                            {provider.freeOption && (
                              <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">FREE</span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-1">{provider.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Connection Configuration */}
              {providerInfo && (
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-4">
                    Configure {providerInfo.name} Connection
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Connection Name */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Connection Name
                      </label>
                      <input
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder={`My ${providerInfo.name} Database`}
                        className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {/* Provider-specific fields */}
                    {providerInfo.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          {field.label} {field.required && <span className="text-red-400">*</span>}
                        </label>
                        <input
                          type={field.type}
                          value={formData[field.key] || ''}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                        {field.description && (
                          <p className="text-xs text-text-secondary mt-1">{field.description}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Test Connection */}
                  <div className="mt-6 space-y-4">
                    {testResult && (
                      <div className={`p-3 rounded-lg border ${
                        testResult.success 
                          ? 'bg-green-900/20 border-green-500/30' 
                          : 'bg-red-900/20 border-red-500/30'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {testResult.success ? (
                            <Check size={16} className="text-green-400" />
                          ) : (
                            <AlertCircle size={16} className="text-red-400" />
                          )}
                          <p className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                            {testResult.message}
                          </p>
                        </div>
                        {testResult.success && testResult.latency && (
                          <p className="text-xs text-text-secondary mt-1">
                            Latency: {testResult.latency}ms
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleTestConnection}
                        disabled={!canTestConnection || isConnecting}
                        className="flex items-center space-x-2 px-4 py-2 bg-background border border-border text-text-primary rounded-md hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isConnecting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Zap size={16} />
                        )}
                        <span>{isConnecting ? 'Testing...' : 'Test Connection'}</span>
                      </button>

                      <button
                        onClick={handleSaveConnection}
                        disabled={!canSaveConnection}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary text-black rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={16} />
                        <span>Save Connection</span>
                      </button>
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
                  <div className="text-sm text-text-secondary">
                    Active: {configs.find(c => c.id === activeConfigId)?.name}
                  </div>
                )}
              </div>

              {configs.length > 0 ? (
                <div className="space-y-3">
                  {configs.map((config) => {
                    const providerInfo = getProviderInfo(config.provider);
                    const isActive = config.id === activeConfigId;
                    
                    return (
                      <div
                        key={config.id}
                        className={`p-4 border rounded-lg ${
                          isActive 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border bg-background'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="text-xl">{providerInfo?.icon}</div>
                            <div>
                              <h4 className="font-medium text-text-primary">{config.name}</h4>
                              <p className="text-sm text-text-secondary">
                                {providerInfo?.name} • {config.provider}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!isActive && (
                              <button
                                onClick={() => handleSetActive(config.id)}
                                className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary transition-colors rounded hover:bg-surface-hover"
                              >
                                Set Active
                              </button>
                            )}
                            {isActive && (
                              <span className="px-3 py-1 text-sm bg-primary text-black rounded font-medium">
                                Active
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteConfig(config.id)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors rounded hover:bg-red-900/20"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Database size={48} className="mx-auto text-text-secondary mb-4 opacity-50" />
                  <h4 className="text-lg font-medium text-text-primary mb-2">No Connections</h4>
                  <p className="text-text-secondary mb-4">
                    Create your first database connection to get started.
                  </p>
                  <button
                    onClick={() => setActiveTab('connect')}
                    className="px-4 py-2 bg-primary text-black rounded-md font-medium hover:bg-primary/90 transition-colors"
                  >
                    Add Connection
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Deploy Tab */}
          {activeTab === 'deploy' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Deploy Schema</h3>
                  <p className="text-text-secondary text-sm">
                    Deploy your current schema to the active database connection
                  </p>
                </div>
                {activeConfigId && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-text-primary">
                      Active: {configs.find(c => c.id === activeConfigId)?.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {getProviderInfo(configs.find(c => c.id === activeConfigId)?.provider || 'sqlite')?.name}
                    </p>
                  </div>
                )}
              </div>

              {!activeConfigId && (
                <div className="text-center py-8">
                  <Database size={48} className="mx-auto text-text-secondary mb-4 opacity-50" />
                  <h4 className="text-lg font-medium text-text-primary mb-2">No Active Connection</h4>
                  <p className="text-text-secondary mb-4">
                    Please connect to a database first to deploy your schema.
                  </p>
                  <button
                    onClick={() => setActiveTab('manage')}
                    className="px-4 py-2 bg-primary text-black rounded-md font-medium hover:bg-primary/90 transition-colors"
                  >
                    Manage Connections
                  </button>
                </div>
              )}

              {activeConfigId && (
                <div className="space-y-4">
                  {/* Deployment Result */}
                  {deploymentResult && (
                    <div className={`p-4 rounded-lg border ${
                      deploymentResult.success 
                        ? 'bg-green-900/20 border-green-500/30' 
                        : 'bg-red-900/20 border-red-500/30'
                    }`}>
                      <div className="flex items-start space-x-2">
                        {deploymentResult.success ? (
                          <Check size={20} className="text-green-400 mt-0.5" />
                        ) : (
                          <AlertCircle size={20} className="text-red-400 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className={`font-medium ${deploymentResult.success ? 'text-green-400' : 'text-red-400'}`}>
                            {deploymentResult.message}
                          </p>
                          {deploymentResult.details.tablesCreated && (
                            <p className="text-sm text-text-secondary mt-1">
                              Tables created: {deploymentResult.details.tablesCreated}
                            </p>
                          )}
                          {deploymentResult.details.validationErrors && (
                            <div className="mt-2 space-y-1">
                              {deploymentResult.details.validationErrors.map((error: string, index: number) => (
                                <p key={index} className="text-sm text-red-400">• {error}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Deploy Actions */}
                  <div className="border border-border rounded-lg p-4">
                    <h4 className="font-medium text-text-primary mb-3">Deployment Options</h4>
                    <div className="space-y-3">
                      <button
                        onClick={handleDeploy}
                        disabled={isDeploying}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-primary text-black rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeploying ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Deploying...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={16} />
                            <span>Deploy Schema</span>
                          </>
                        )}
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          disabled={isDeploying}
                          className="flex items-center justify-center space-x-2 px-3 py-2 bg-background border border-border text-text-primary rounded-md hover:bg-surface-hover transition-colors disabled:opacity-50"
                        >
                          <Play size={14} />
                          <span className="text-sm">Test Deploy</span>
                        </button>
                        
                        <button
                          disabled={isDeploying}
                          className="flex items-center justify-center space-x-2 px-3 py-2 bg-background border border-border text-text-primary rounded-md hover:bg-surface-hover transition-colors disabled:opacity-50"
                        >
                          <History size={14} />
                          <span className="text-sm">View History</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Schema Preview */}
                  <div className="border border-border rounded-lg p-4">
                    <h4 className="font-medium text-text-primary mb-3">Schema Preview</h4>
                    <div className="bg-background rounded border p-3 max-h-48 overflow-y-auto">
                      <pre className="text-xs text-text-secondary whitespace-pre-wrap">
                        {/* This would show the current schema SQL */}
                        -- Current schema will be displayed here
                        -- Use DiagramService to get current schema
                      </pre>
                    </div>
                  </div>
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