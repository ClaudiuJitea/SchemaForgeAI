import { DatabaseConfig, BaseDatabaseProvider, SchemaDeploymentResult, ConnectionTestResult, Migration } from './types';
import { SQLiteProvider } from './providers/SQLiteProvider';
import { PostgreSQLProvider } from './providers/PostgreSQLProvider';
import { MySQLProvider } from './providers/MySQLProvider';

export class DatabaseService {
  private static instance: DatabaseService;
  private providers: Map<string, BaseDatabaseProvider> = new Map();
  private activeConfig: DatabaseConfig | null = null;
  private configs: DatabaseConfig[] = [];

  private constructor() {
    this.loadConfigs();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Save a database configuration
   */
  public saveConfig(config: DatabaseConfig): void {
    const existingIndex = this.configs.findIndex(c => c.id === config.id);
    if (existingIndex !== -1) {
      this.configs[existingIndex] = config;
    } else {
      this.configs.push(config);
    }
    this.saveConfigs();
  }

  /**
   * Get all saved configurations
   */
  public getConfigs(): DatabaseConfig[] {
    return [...this.configs];
  }

  /**
   * Delete a configuration
   */
  public deleteConfig(configId: string): void {
    this.configs = this.configs.filter(c => c.id !== configId);
    if (this.activeConfig?.id === configId) {
      this.activeConfig = null;
    }
    this.providers.delete(configId);
    this.saveConfigs();
  }

  /**
   * Set the active database configuration
   */
  public setActiveConfig(configId: string): void {
    const config = this.configs.find(c => c.id === configId);
    if (config) {
      this.activeConfig = config;
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeDatabaseConfig', configId);
      }
    }
  }

  /**
   * Get the active database configuration
   */
  public getActiveConfig(): DatabaseConfig | null {
    return this.activeConfig;
  }

  /**
   * Get or create a provider for the given configuration
   */
  public getProvider(config: DatabaseConfig): BaseDatabaseProvider {
    if (!this.providers.has(config.id)) {
      const provider = this.createProvider(config);
      this.providers.set(config.id, provider);
    }
    return this.providers.get(config.id)!;
  }

  /**
   * Get the active provider
   */
  public getActiveProvider(): BaseDatabaseProvider | null {
    if (!this.activeConfig) return null;
    return this.getProvider(this.activeConfig);
  }

  /**
   * Test connection for a configuration
   */
  public async testConnection(config: DatabaseConfig): Promise<ConnectionTestResult> {
    try {
      const provider = this.createProvider(config);
      return await provider.testConnection();
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Deploy schema to the active database
   */
  public async deploySchema(sql: string): Promise<SchemaDeploymentResult> {
    const provider = this.getActiveProvider();
    if (!provider) {
      return {
        success: false,
        message: 'No active database connection'
      };
    }

    try {
      return await provider.deploySchema(sql);
    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate migration between two SQL schemas
   */
  public async generateMigration(fromSql: string, toSql: string): Promise<Migration | null> {
    const provider = this.getActiveProvider();
    if (!provider) return null;

    try {
      return await provider.generateMigration(fromSql, toSql);
    } catch (error) {
      console.error('Failed to generate migration:', error);
      return null;
    }
  }

  /**
   * Apply a migration to the active database
   */
  public async applyMigration(migration: Migration): Promise<SchemaDeploymentResult> {
    const provider = this.getActiveProvider();
    if (!provider) {
      return {
        success: false,
        message: 'No active database connection'
      };
    }

    try {
      return await provider.applyMigration(migration);
    } catch (error) {
      return {
        success: false,
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate SQL syntax
   */
  public async validateSql(sql: string): Promise<{ valid: boolean; errors?: string[] }> {
    const provider = this.getActiveProvider();
    if (!provider) {
      return { valid: false, errors: ['No active database connection'] };
    }

    try {
      return await provider.validateSql(sql);
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  /**
   * Create a provider instance based on the configuration
   */
  private createProvider(config: DatabaseConfig): BaseDatabaseProvider {
    switch (config.provider) {
      case 'sqlite':
        return new SQLiteProvider(config);
      case 'postgres-local':
        return new PostgreSQLProvider(config);
      case 'mysql-local':
        return new MySQLProvider(config);
      default:
        throw new Error(`Unsupported database provider: ${config.provider}`);
    }
  }

  /**
   * Load configurations from localStorage
   */
  private loadConfigs(): void {
    if (typeof window === 'undefined') {
      this.configs = [];
      return;
    }
    
    try {
      const saved = localStorage.getItem('databaseConfigs');
      if (saved) {
        this.configs = JSON.parse(saved);
      }

      const activeConfigId = localStorage.getItem('activeDatabaseConfig');
      if (activeConfigId) {
        this.activeConfig = this.configs.find(c => c.id === activeConfigId) || null;
      }
    } catch (error) {
      console.error('Failed to load database configurations:', error);
      this.configs = [];
    }
  }

  /**
   * Save configurations to localStorage
   */
  private saveConfigs(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('databaseConfigs', JSON.stringify(this.configs));
    } catch (error) {
      console.error('Failed to save database configurations:', error);
    }
  }
}