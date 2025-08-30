import { DatabaseProvider } from './database/types';
import { SQLSyntaxMapper } from './database/sqlSyntaxMapper';

interface AIConfig {
  provider: 'openrouter' | 'lmstudio';
  openRouterApiKey: string;
  openRouterModel: string;
  lmStudioEndpoint: string;
  lmStudioModel: string;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  success: boolean;
  content: string;
  error?: string;
}

export class AIService {
  private config: AIConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      // Check if we're running in a browser environment
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      
      const savedConfig = localStorage.getItem('aiConfig');
      if (savedConfig) {
        this.config = JSON.parse(savedConfig);
      }
    } catch (error) {
      console.error('Failed to load AI config:', error);
    }
  }

  public isConfigured(): boolean {
    if (!this.config) return false;
    
    if (this.config.provider === 'openrouter') {
      return !!(this.config.openRouterApiKey && this.config.openRouterModel);
    } else {
      return !!(this.config.lmStudioEndpoint && this.config.lmStudioModel);
    }
  }

  public reloadConfig(): void {
    this.loadConfig();
  }

  private detectConversationIntent(userPrompt: string): boolean {
    const conversationKeywords = [
      'hello', 'hi', 'hey', 'how are you', 'thanks', 'thank you', 'bye', 'goodbye',
      'what are you', 'who are you', 'help me understand', 'explain', 'how does this work',
      'what can you do', 'what is this', 'how to use', 'tutorial', 'guide'
    ];
    
    const sqlKeywords = [
      'create table', 'database', 'schema', 'sql', 'table', 'column', 'field',
      'primary key', 'foreign key', 'relationship', 'users table', 'products table',
      'build a database', 'design schema', 'data model', 'entity'
    ];
    
    const lowerPrompt = userPrompt.toLowerCase();
    
    // Check for explicit SQL keywords
    const hasSqlKeywords = sqlKeywords.some(keyword => lowerPrompt.includes(keyword));
    if (hasSqlKeywords) return false; // Generate SQL
    
    // Check for conversation keywords
    const hasConversationKeywords = conversationKeywords.some(keyword => lowerPrompt.includes(keyword));
    if (hasConversationKeywords) return true; // Have conversation
    
    // If prompt is very short and casual, treat as conversation
    if (userPrompt.trim().length < 20 && !lowerPrompt.includes('table')) {
      return true;
    }
    
    // Default to SQL generation for longer, more specific requests
    return false;
  }

  public async amendSchema(
    userPrompt: string, 
    currentSchema: string, 
    targetProvider: DatabaseProvider = 'postgresql'
  ): Promise<AIResponse> {
    // Reload config in case it was updated
    this.loadConfig();
    
    if (!this.isConfigured()) {
      return {
        success: false,
        content: '',
        error: 'AI not configured. Please configure your AI provider in Settings.'
      };
    }

    // Get database-specific prompt
    const databaseSpecificPrompt = SQLSyntaxMapper.generateDatabaseSpecificPrompt(targetProvider);
    
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a SQL database schema expert. You will be given an existing database schema and a user request to modify it.

CRITICAL REQUIREMENTS:
1. ALWAYS preserve the existing schema structure unless specifically asked to change it
2. Only modify what the user explicitly requests
3. Add new tables/columns/relationships as requested
4. **MAINTAIN ALL EXISTING FOREIGN KEY RELATIONSHIPS** - This is critical!
5. Include REFERENCES clauses for all foreign key relationships from the original schema
6. Use ${targetProvider.toUpperCase()} syntax specifically
7. Return the COMPLETE updated schema, not just the changes
8. Include appropriate data types for ${targetProvider.toUpperCase()}
9. Add PRIMARY KEY and FOREIGN KEY constraints appropriately
10. Use NOT NULL constraints where appropriate
11. Only return the SQL statements, no explanations

When making changes:
- To add a table: Include it alongside existing tables
- To modify a table: Update only the specified columns/constraints
- To add relationships: Add appropriate FOREIGN KEY constraints
- To remove something: Only remove what's explicitly requested

**CRITICAL**: Always output the COMPLETE schema including:
- ALL original tables (unchanged and modified)
- ALL new tables being added
- ALL relationships (original + new)
- Complete, valid SQL that ends with semicolons

Never return partial schemas or truncated SQL!

${databaseSpecificPrompt.split('Rules:')[1] || ''}`
      },
      {
        role: 'user',
        content: `Current Database Schema:
\`\`\`sql
${currentSchema}
\`\`\`

User Request: ${userPrompt}

Please provide the updated complete database schema:`
      }
    ];

    try {
      if (this.config!.provider === 'openrouter') {
        return await this.callOpenRouter(messages);
      } else {
        return await this.callLMStudio(messages);
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  public async generateSQL(userPrompt: string, targetProvider: DatabaseProvider = 'postgresql'): Promise<AIResponse> {
    // Reload config in case it was updated
    this.loadConfig();
    
    if (!this.isConfigured()) {
      return {
        success: false,
        content: '',
        error: 'AI not configured. Please configure your AI provider in Settings.'
      };
    }
    
    console.log('Using AI config:', {
      provider: this.config!.provider,
      hasApiKey: !!this.config!.openRouterApiKey,
      model: this.config!.openRouterModel,
      endpoint: this.config!.lmStudioEndpoint
    });

    const isConversation = this.detectConversationIntent(userPrompt);
    
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: isConversation ? 
          `You are a helpful AI database assistant. You help users understand databases and SQL schema design. Be friendly and conversational. When users greet you or ask casual questions, respond naturally. 

If they ask about databases or want to create schemas, guide them on how to describe their requirements. You can explain database concepts, but only generate actual SQL code when they specifically request database tables or schemas.

Be concise but helpful in your responses.` 
          : 
          SQLSyntaxMapper.generateDatabaseSpecificPrompt(targetProvider)
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    try {
      if (this.config!.provider === 'openrouter') {
        return await this.callOpenRouter(messages);
      } else {
        return await this.callLMStudio(messages);
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async callOpenRouter(messages: AIMessage[]): Promise<AIResponse> {
    const requestBody = {
      model: this.config!.openRouterModel,
      messages: messages,
      temperature: 0.1,
      max_tokens: 4000
    };

    console.log('OpenRouter request:', {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${this.config!.openRouterApiKey.substring(0, 10)}...`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'Schema Builder'
      },
      body: requestBody
    });

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config!.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
          'X-Title': 'Schema Builder'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('OpenRouter response status:', response.status, response.statusText);

      const responseText = await response.text();
      console.log('OpenRouter raw response:', responseText);

      if (!response.ok) {
        throw new Error(`OpenRouter API error (${response.status}): ${response.statusText} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('OpenRouter parsed response:', data);
      
      if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from OpenRouter');
      }

      return {
        success: true,
        content: data.choices[0].message.content || ''
      };
    } catch (fetchError) {
      console.error('OpenRouter fetch error:', fetchError);
      throw new Error(`OpenRouter API error: ${fetchError instanceof Error ? fetchError.message : 'Network error'}`);
    }
  }

  private async callLMStudio(messages: AIMessage[]): Promise<AIResponse> {
    const response = await fetch(`${this.config!.lmStudioEndpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config!.lmStudioModel,
        messages: messages,
        temperature: 0.1,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      content: data.choices?.[0]?.message?.content || ''
    };
  }
}

export const aiService = new AIService();