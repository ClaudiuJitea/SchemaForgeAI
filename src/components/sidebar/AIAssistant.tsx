'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Paperclip, Send, Bot, Terminal, Search, GripVertical, Loader, Copy, X, FileText } from 'lucide-react';
import AdvancedBuilder from './AdvancedBuilder';
import Inspector from './Inspector';
import { aiService } from '../../services/aiService';
import { SchemaParser } from '../../services/schemaParser';
import { DiagramService } from '../../services/diagramService';
import { DatabaseService } from '../../services/database/DatabaseService';
import { useProcessing } from '../statusbar/StatusBar';
import { DatabaseProvider } from '../../services/database/types';

// UUID generation function for compatibility
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return generateId();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

// Component to render message content with SQL code blocks
function MessageContent({ content, sender, isTyping = false }: { content: string; sender: 'user' | 'assistant'; isTyping?: boolean }) {
  const [copiedSql, setCopiedSql] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSql(text);
    setTimeout(() => setCopiedSql(null), 2000);
  };

  // Enhanced parsing for progressive SQL blocks
  const parseContentWithProgressiveSQL = (text: string) => {
    const parts = [];
    let currentIndex = 0;
    
    // Look for complete and incomplete SQL blocks
    const completeBlockRegex = /```sql\n([\s\S]*?)\n```/g;
    const incompleteBlockRegex = /```sql\n([\s\S]*)$/; // SQL block that hasn't been closed yet
    
    let match;
    const processedIndexes = new Set();
    
    // First, find all complete blocks
    while ((match = completeBlockRegex.exec(text)) !== null) {
      // Add text before this SQL block
      if (match.index > currentIndex && !processedIndexes.has(currentIndex)) {
        const beforeText = text.slice(currentIndex, match.index);
        if (beforeText.trim()) {
          parts.push({
            type: 'text',
            content: beforeText
          });
        }
        processedIndexes.add(currentIndex);
      }
      
      // Add the complete SQL block
      parts.push({
        type: 'sql',
        content: match[1],
        complete: true
      });
      
      currentIndex = match.index + match[0].length;
      processedIndexes.add(match.index);
    }
    
    // Check for incomplete SQL block at the end
    const remainingText = text.slice(currentIndex);
    const incompleteMatch = incompleteBlockRegex.exec(remainingText);
    
    if (incompleteMatch) {
      // Add any text before the incomplete block
      const beforeIncomplete = remainingText.slice(0, incompleteMatch.index);
      if (beforeIncomplete.trim()) {
        parts.push({
          type: 'text',
          content: beforeIncomplete
        });
      }
      
      // Add the incomplete SQL block
      parts.push({
        type: 'sql',
        content: incompleteMatch[1],
        complete: false
      });
    } else if (remainingText.trim()) {
      // Add remaining text if no incomplete SQL block
      parts.push({
        type: 'text',
        content: remainingText
      });
    }
    
    return parts;
  };

  const parts = parseContentWithProgressiveSQL(content);

  if (parts.length === 0) {
    // No special formatting needed
    return <div className="whitespace-pre-wrap">{content}{isTyping ? <span className="animate-pulse">|</span> : ''}</div>;
  }

  return (
    <div className="space-y-3">
      {parts.map((part, index) => (
        <div key={index}>
          {part.type === 'text' && part.content.trim() && (
            <div className="whitespace-pre-wrap">
              {part.content.trim()}
              {isTyping && index === parts.length - 1 && <span className="animate-pulse">|</span>}
            </div>
          )}
          {part.type === 'sql' && (
            <div className="relative group">
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-surface-hover border-b border-border">
                  <span className="text-xs font-medium text-text-secondary flex items-center">
                    <Terminal size={12} className="mr-1" />
                    SQL {!part.complete && <span className="ml-1 text-primary">•</span>}
                  </span>
                  {part.complete && (
                    <button
                      onClick={() => copyToClipboard(part.content)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface rounded text-text-secondary hover:text-text-primary"
                      title="Copy SQL"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
                <div className="p-3 overflow-x-auto">
                  <pre className="text-sm text-text-primary font-mono whitespace-pre">
                    {part.content}
                    {!part.complete && isTyping && index === parts.length - 1 && <span className="animate-pulse">|</span>}
                  </pre>
                </div>
              </div>
              {copiedSql === part.content && (
                <div className="absolute -top-8 right-2 bg-primary text-black text-xs px-2 py-1 rounded">
                  Copied!
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AIAssistant() {
  const t = useTranslations('aiAssistant');
  const navT = useTranslations('navigation');
  const { setCurrentStep, updateStepStatus, resetSteps } = useProcessing();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('ai-builder');
  const [sidebarWidth, setSidebarWidth] = useState(448); // 28rem = 448px
  const [isResizing, setIsResizing] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [typingMessage, setTypingMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [placeholderText, setPlaceholderText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const diagramService = DiagramService.getInstance();
  const databaseService = DatabaseService.getInstance();
  
  useEffect(() => {
    setMessages([
      {
        id: '1',
        content: t('greeting'),
        sender: 'assistant',
        timestamp: new Date()
      }
    ]);
    
    // Set initial placeholder
    updatePlaceholder();
  }, [t]);

  const updatePlaceholder = () => {
    const targetProvider = getTargetDatabaseProvider();
    const currentSchema = diagramService.exportSchemaAsSQL(targetProvider);
    const hasExistingSchema = currentSchema.trim().length > 0;
    
    if (hasExistingSchema) {
      setPlaceholderText("Add tables, modify existing ones, or ask questions...");
    } else {
      setPlaceholderText(t('placeholder'));
    }
  };

  // Update placeholder when diagram changes
  useEffect(() => {
    const handleDiagramUpdate = () => {
      updatePlaceholder();
    };

    diagramService.addListener(handleDiagramUpdate);

    return () => {
      diagramService.removeListener(handleDiagramUpdate);
    };
  }, [t]);

  useEffect(() => {
    // Check if AI is configured
    const checkAIConfig = () => {
      aiService.reloadConfig();
      const isConfigured = aiService.isConfigured();
      console.log('AI configured:', isConfigured);
      setAiConfigured(isConfigured);
    };

    checkAIConfig();

    // Check config every few seconds to catch changes
    const interval = setInterval(checkAIConfig, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Listen for table selection changes and auto-switch to Inspector
    const handleTableSelection = (tableName: string | null) => {
      if (tableName) {
        // Auto-switch to Inspector tab when a table is selected
        setActiveTab('inspector');
      }
    };

    // Add listener for table selection
    diagramService.addSelectionListener(handleTableSelection);

    return () => {
      diagramService.removeSelectionListener(handleTableSelection);
    };
  }, [diagramService]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 320 && newWidth <= 600) { // Min 320px, Max 600px
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const scrollToBottom = () => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  };

  const getTargetDatabaseProvider = (): DatabaseProvider => {
    try {
      const activeConfig = databaseService.getActiveConfig();
      if (activeConfig && activeConfig.provider) {
        console.log('Active database provider:', activeConfig.provider);
        return activeConfig.provider;
      }
    } catch (error) {
      console.warn('Error getting active database config:', error);
    }
    // Default to sqlite if no active connection
    return 'sqlite';
  };

  const typeMessage = async (message: string, onComplete?: () => void): Promise<void> => {
    setIsTyping(true);
    setTypingMessage('');
    
    for (let i = 0; i <= message.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 5)); // Typing speed (6x faster)
      setTypingMessage(message.slice(0, i));
      // Scroll to bottom during typing
      scrollToBottom();
    }
    
    setIsTyping(false);
    setTypingMessage('');
    
    // Add the complete message to messages
    const assistantMessage: Message = {
      id: generateId(),
      content: message,
      sender: 'assistant',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);
    
    // Scroll to bottom after message is added
    setTimeout(scrollToBottom, 100);
    
    // Call the completion callback if provided
    if (onComplete) {
      onComplete();
    }
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && attachedFiles.length === 0) || isAIProcessing) return;

    console.log('Sending message:', inputValue);
    console.log('Attached files:', attachedFiles.length);
    
    // Reset and start processing steps
    resetSteps();
    
    // Step 1: User Prompt
    updateStepStatus('userPrompt', 'active');
    setCurrentStep('userPrompt');

    // Process attached files
    let fileContents = '';
    if (attachedFiles.length > 0) {
      try {
        const fileTexts = await Promise.all(
          attachedFiles.map(async (file) => {
            const content = await readFileContent(file);
            return `\n\n--- File: ${file.name} ---\n${content}`;
          })
        );
        fileContents = fileTexts.join('\n');
      } catch (error) {
        console.error('Error reading files:', error);
      }
    }

    const fullContent = inputValue + fileContents;
    const userMessage: Message = {
      id: generateId(),
      content: inputValue + (attachedFiles.length > 0 ? ` (${attachedFiles.length} file${attachedFiles.length > 1 ? 's' : ''} attached)` : ''),
      sender: 'user',
      timestamp: new Date()
    };

    const currentInput = fullContent;
    setInputValue('');
    setAttachedFiles([]);
    setMessages(prev => [...prev, userMessage]);
    
    // Scroll to bottom after adding user message
    setTimeout(scrollToBottom, 100);
    
    // Complete user prompt step
    await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay for visual effect
    updateStepStatus('userPrompt', 'completed');

    // Check if AI is configured
    if (!aiConfigured) {
      console.log('AI not configured');
      updateStepStatus('userPrompt', 'completed');
      setCurrentStep(null);
      await typeMessage("AI is not configured. Please click the Settings button in the top navigation to configure your AI provider (OpenRouter or LM Studio).");
      return;
    }

    console.log('Starting AI processing');
    setIsAIProcessing(true);

    try {
      // Step 2: AI Reasoning
      updateStepStatus('aiReasoning', 'active');
      setCurrentStep('aiReasoning');
      
      // Get target database provider
      const targetProvider = getTargetDatabaseProvider();
      
      // Check if we have an existing schema to amend
      const currentSchema = diagramService.exportSchemaAsSQL(targetProvider);
      const hasExistingSchema = currentSchema.trim().length > 0;
      
      // Generate SQL using AI
      console.log('Calling AI service...');
      console.log('Has existing schema:', hasExistingSchema);
      console.log('Target database provider:', targetProvider);
      console.log('Current schema being sent to AI:', currentSchema);
      
      let aiResponse: any;
      if (hasExistingSchema) {
        console.log('Amending existing schema...');
        aiResponse = await aiService.amendSchema(currentInput, currentSchema, targetProvider);
      } else {
        console.log('Generating new schema...');
        aiResponse = await aiService.generateSQL(currentInput, targetProvider);
      }
      console.log('AI Response:', aiResponse);
      
      // Complete AI reasoning
      updateStepStatus('aiReasoning', 'completed');
      
      if (!aiResponse.success) {
        console.log('AI Response failed:', aiResponse.error);
        setCurrentStep(null);
        await typeMessage(`Error: ${aiResponse.error}`);
        return;
      }
      
      console.log('AI Response content:', aiResponse.content);

      // Check if this looks like SQL code (contains CREATE TABLE)
      const looksLikeSQL = aiResponse.content.toUpperCase().includes('CREATE TABLE');
      
      if (looksLikeSQL) {
        // Step 3: Schema Parsing
        updateStepStatus('schemaParsing', 'active');
        setCurrentStep('schemaParsing');
        
        // Parse the generated SQL
        const parsedSchema = SchemaParser.parseSQL(aiResponse.content);
        console.log('Parsed schema:', parsedSchema);
        console.log('AI Response SQL:', aiResponse.content);
        console.log('Relationships found:', parsedSchema.relationships.length);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        updateStepStatus('schemaParsing', 'completed');
        
        // Update diagram with new tables
        if (parsedSchema.tables.length > 0) {
          // Step 4: Diagram Update
          updateStepStatus('diagramUpdate', 'active');
          setCurrentStep('diagramUpdate');
          
          diagramService.updateFromSchema(parsedSchema.tables, parsedSchema.relationships, hasExistingSchema);
          
          await new Promise(resolve => setTimeout(resolve, 400));
          updateStepStatus('diagramUpdate', 'completed');
          
          // Step 5: SQL Generation (starts when we begin typing SQL blocks)
          updateStepStatus('sqlGeneration', 'active');
          setCurrentStep('sqlGeneration');
          
          const actionText = hasExistingSchema ? 'Amended' : 'Generated';
          await typeMessage(
            `✅ ${actionText} ${parsedSchema.tables.length} table(s) with ${parsedSchema.relationships.length} relationship(s). Updated the diagram!\n\n\`\`\`sql\n${aiResponse.content}\n\`\`\``,
            () => {
              // Complete SQL Generation step when SQL blocks are fully rendered
              updateStepStatus('sqlGeneration', 'completed');
              setCurrentStep(null);
            }
          );
        } else {
          setCurrentStep(null);
          await typeMessage(aiResponse.content);
        }
      } else {
        // For conversational responses, just show the message
        setCurrentStep(null);
        await typeMessage(aiResponse.content);
      }

    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      setCurrentStep(null);
      await typeMessage(`Failed to generate schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const clearChat = () => {
    // Clear chat messages
    setMessages([
      {
        id: '1',
        content: t('greeting'),
        sender: 'assistant',
        timestamp: new Date()
      }
    ]);

    // Clear the diagram and close all table tabs
    diagramService.clearDiagram();
    
    // Reset any current AI processing state
    setIsAIProcessing(false);
    setIsTyping(false);
    setTypingMessage('');
    setInputValue('');
    setAttachedFiles([]);
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      // Accept text files, SQL files, and other relevant formats
      const validTypes = [
        'text/plain',
        'text/sql', 
        'application/sql',
        'text/csv',
        'application/json',
        'text/markdown'
      ];
      const validExtensions = ['.sql', '.txt', '.csv', '.json', '.md', '.ddl'];
      
      return validTypes.includes(file.type) || 
             validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    });

    setAttachedFiles(prev => [...prev, ...validFiles]);
    
    // Clear the file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const leftTabs = [
    { id: 'ai-builder', label: navT('aiBuilder'), icon: Bot },
    { id: 'advanced-builder', label: navT('advancedBuilder'), icon: Terminal },
    { id: 'inspector', label: navT('inspector'), icon: Search }
  ];

  return (
    <div 
      ref={sidebarRef}
      className="flex flex-col h-full relative" 
      style={{ 
        width: `${sidebarWidth}px`,
        backgroundColor: '#2a3142', 
        borderRightColor: '#374151'
      }}
    >
      {/* Left Sidebar Tabs */}
      <div className="border-b border-border">
        <div className="flex">
          {leftTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-text-primary border-primary bg-background rounded-t-xl'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-hover hover:rounded-t-xl'
              }`}
            >
              <tab.icon size={14} />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Content - Conditional based on active tab */}
      {activeTab === 'advanced-builder' ? (
        <AdvancedBuilder />
      ) : activeTab === 'ai-builder' ? (
        <div className="h-full relative">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">{t('title')}</h2>
            <button
              onClick={clearChat}
              className="p-1 text-text-secondary hover:text-text-primary transition-colors"
              title={t('clearChat')}
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Messages - completely separate container */}
          <div ref={messagesRef} className="absolute top-16 left-0 right-0 bottom-32 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg text-sm ${
                      message.sender === 'user'
                        ? 'bg-primary text-black'
                        : 'bg-background text-text-primary'
                    }`}
                  >
                    <MessageContent content={message.content} sender={message.sender} />
                  </div>
                </div>
              ))}
              
              {/* Typing indicator */}
              {isAIProcessing && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg text-sm bg-background text-text-secondary flex items-center space-x-2">
                    <Loader size={14} className="animate-spin" />
                    <span>AI thinking...</span>
                  </div>
                </div>
              )}
              
              {/* Typing message */}
              {isTyping && typingMessage && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg text-sm bg-background text-text-primary">
                    <MessageContent content={typingMessage} sender="assistant" isTyping={true} />
                  </div>
                </div>
              )}
          </div>

          {/* Textbox - Fixed position at bottom, completely independent */}
          <div className="absolute -bottom-8 left-4 right-4 space-y-2" style={{ backgroundColor: '#2a3142', height: '120px' }}>
            {/* Attached Files Display */}
            {attachedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-text-secondary font-medium">Attached Files:</div>
                <div className="space-y-1">
                  {attachedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <FileText size={14} className="text-text-secondary flex-shrink-0" />
                        <span className="text-xs text-text-primary truncate">{file.name}</span>
                        <span className="text-xs text-text-secondary">({Math.round(file.size / 1024)}KB)</span>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-surface-hover rounded text-text-secondary hover:text-text-primary transition-colors ml-2"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-background rounded-lg relative" style={{ padding: '6px' }} suppressHydrationWarning>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                placeholder={placeholderText}
                rows={2}
                className="w-full bg-transparent text-text-primary placeholder-text-secondary outline-none resize-none"
              />
              
              {/* Icons positioned at bottom right of textarea */}
              <div className="absolute bottom-2 right-2 flex items-center space-x-1">
                <button 
                  onClick={handleFileAttach}
                  className="p-1.5 rounded-md border border-border hover:border-text-secondary text-text-secondary hover:text-text-primary transition-colors"
                  title="Attach files"
                >
                  <Paperclip size={16} />
                </button>
                
                <button
                  onClick={handleSendMessage}
                  disabled={isAIProcessing || (!inputValue.trim() && attachedFiles.length === 0)}
                  className="p-1.5 rounded-md border border-border hover:border-primary text-text-secondary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send message"
                >
                  {isAIProcessing ? (
                    <Loader size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".sql,.txt,.csv,.json,.md,.ddl,text/plain,text/sql,application/sql,text/csv,application/json,text/markdown"
              className="hidden"
            />
          </div>
        </div>
      ) : (
        /* Inspector Tab */
        <Inspector />
      )}
      
      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full bg-transparent hover:bg-primary/20 cursor-col-resize group"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-primary/40 rounded p-1">
            <GripVertical size={12} className="text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}