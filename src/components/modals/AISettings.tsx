'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Key, Server, Zap, Check } from 'lucide-react';

interface AISettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AIConfig {
  provider: 'openrouter' | 'lmstudio';
  openRouterApiKey: string;
  openRouterModel: string;
  lmStudioEndpoint: string;
  lmStudioModel: string;
}

export default function AISettings({ isOpen, onClose }: AISettingsProps) {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'openrouter',
    openRouterApiKey: '',
    openRouterModel: '',
    lmStudioEndpoint: 'http://localhost:1234',
    lmStudioModel: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const loadAvailableModels = async (apiKey: string) => {
    if (!apiKey.trim()) {
      setAvailableModels([]);
      return;
    }

    setLoadingModels(true);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Schema Builder'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.data || []);
      } else {
        console.error('Failed to load models:', response.statusText);
        setAvailableModels([]);
      }
    } catch (error) {
      console.error('Error loading models:', error);
      setAvailableModels([]);
    }
    setLoadingModels(false);
  };

  const handleApiKeyChange = (apiKey: string) => {
    setConfig(prev => ({ ...prev, openRouterApiKey: apiKey }));
    loadAvailableModels(apiKey);
  };

  const filteredModels = availableModels.filter(model =>
    model.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
    model.id.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Save configuration to localStorage
      localStorage.setItem('aiConfig', JSON.stringify(config));
      console.log('Saved AI config:', config);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save AI config:', error);
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        className="w-full max-w-2xl mx-4 rounded-lg border border-border" 
        style={{ backgroundColor: '#2a3142' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-black" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">AI Configuration</h2>
              <p className="text-sm text-text-secondary">Configure your AI provider and settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-md hover:bg-surface-hover"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <h3 className="text-base font-semibold text-text-primary mb-3">AI Provider</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfig(prev => ({ ...prev, provider: 'openrouter' }))}
                className={`p-4 rounded-lg border-2 transition-colors text-left ${
                  config.provider === 'openrouter'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-text-secondary bg-background'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                    <Key size={16} className="text-black" />
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary">OpenRouter</h4>
                    <p className="text-xs text-text-secondary">Cloud AI models via API</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setConfig(prev => ({ ...prev, provider: 'lmstudio' }))}
                className={`p-4 rounded-lg border-2 transition-colors text-left ${
                  config.provider === 'lmstudio'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-text-secondary bg-background'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                    <Server size={16} className="text-black" />
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary">LM Studio</h4>
                    <p className="text-xs text-text-secondary">Local LLM hosting</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* OpenRouter Configuration */}
          {config.provider === 'openrouter' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-text-primary">OpenRouter Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={config.openRouterApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Get your API key from{' '}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    openrouter.ai/keys
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Model
                </label>
                <div className="relative" ref={dropdownRef}>
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => {
                      setModelSearch(e.target.value);
                      setShowModelDropdown(true);
                    }}
                    onFocus={() => setShowModelDropdown(true)}
                    placeholder={config.openRouterApiKey ? "Search models..." : "Enter API key first"}
                    disabled={!config.openRouterApiKey}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  
                  {loadingModels && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-text-secondary/20 border-t-text-secondary rounded-full animate-spin" />
                    </div>
                  )}

                  {showModelDropdown && filteredModels.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-background border border-border rounded-md shadow-lg z-10">
                      {filteredModels.slice(0, 50).map(model => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setConfig(prev => ({ ...prev, openRouterModel: model.id }));
                            setModelSearch(model.name);
                            setShowModelDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors"
                        >
                          <div className="font-medium text-text-primary text-sm">{model.name}</div>
                          <div className="text-xs text-text-secondary">{model.id}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {config.openRouterApiKey && !loadingModels && availableModels.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">
                      Failed to load models. Please check your API key.
                    </p>
                  )}
                </div>
                
                {config.openRouterModel && (
                  <div className="mt-2 p-2 bg-surface rounded text-xs">
                    <span className="text-text-secondary">Selected: </span>
                    <span className="text-text-primary font-mono">{config.openRouterModel}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LM Studio Configuration */}
          {config.provider === 'lmstudio' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-text-primary">LM Studio Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Endpoint URL
                </label>
                <input
                  type="text"
                  value={config.lmStudioEndpoint}
                  onChange={(e) => setConfig(prev => ({ ...prev, lmStudioEndpoint: e.target.value }))}
                  placeholder="http://localhost:1234"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Default LM Studio local server endpoint
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Model Name
                </label>
                <input
                  type="text"
                  value={config.lmStudioModel}
                  onChange={(e) => setConfig(prev => ({ ...prev, lmStudioModel: e.target.value }))}
                  placeholder="llama-3.1-8b-instruct"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Name of the model loaded in LM Studio
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <div className="flex items-center space-x-2">
            {showSuccess && (
              <>
                <Check size={16} className="text-green-400" />
                <span className="text-sm text-green-400">Configuration saved!</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium bg-primary text-black rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isSaving && (
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}