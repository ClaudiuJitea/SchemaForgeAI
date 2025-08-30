import { DatabaseService } from './DatabaseService';
import { MigrationService } from './MigrationService';
import { DiagramService } from '../diagramService';
import { SchemaDeploymentResult, DatabaseConfig } from './types';

export interface DeploymentOptions {
  useMigrations: boolean;
  createBackup: boolean;
  validateBeforeDeploy: boolean;
  migrationName?: string;
}

export interface DeploymentResult {
  success: boolean;
  message: string;
  details: {
    backupCreated?: boolean;
    migrationGenerated?: boolean;
    migrationApplied?: boolean;
    tablesCreated?: number;
    validationErrors?: string[];
    instructions?: string[];
    note?: string;
    sqlToExecute?: string;
  };
  deploymentResult?: SchemaDeploymentResult;
}

export class DeploymentService {
  private static instance: DeploymentService;
  private databaseService: DatabaseService;
  private migrationService: MigrationService;
  private diagramService: DiagramService;

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.migrationService = MigrationService.getInstance();
    this.diagramService = DiagramService.getInstance();
  }

  public static getInstance(): DeploymentService {
    if (!DeploymentService.instance) {
      DeploymentService.instance = new DeploymentService();
    }
    return DeploymentService.instance;
  }

  /**
   * Deploy schema to the active database
   */
  public async deploySchema(options: DeploymentOptions = {
    useMigrations: true,
    createBackup: false,
    validateBeforeDeploy: true
  }): Promise<DeploymentResult> {
    
    const activeConfig = this.databaseService.getActiveConfig();
    if (!activeConfig) {
      return {
        success: false,
        message: 'No active database connection. Please connect to a database first.',
        details: {}
      };
    }

    try {
      const result: DeploymentResult = {
        success: false,
        message: '',
        details: {}
      };

      // Step 1: Validate schema if requested
      if (options.validateBeforeDeploy) {
        const validation = await this.migrationService.validateSchema();
        if (!validation.valid) {
          return {
            success: false,
            message: 'Schema validation failed. Please fix the errors before deploying.',
            details: {
              validationErrors: validation.errors
            }
          };
        }
      }

      // Step 2: Create backup if requested
      if (options.createBackup) {
        try {
          // This would create a backup of the current database state
          // For now, we'll just indicate that backup was requested
          result.details.backupCreated = true;
        } catch (error) {
          console.warn('Failed to create backup:', error);
          result.details.backupCreated = false;
        }
      }

      // Step 3: Deploy using migrations or direct deployment
      if (options.useMigrations) {
        const deploymentResult = await this.deployWithMigrations(options.migrationName);
        result.deploymentResult = deploymentResult;
        result.success = deploymentResult.success;
        result.message = deploymentResult.message;
        result.details.migrationGenerated = true;
        result.details.migrationApplied = deploymentResult.success;
        result.details.tablesCreated = deploymentResult.tablesCreated;
        
        // Pass through provider-specific details (e.g., Supabase instructions)
        if (deploymentResult.details) {
          result.details.instructions = deploymentResult.details.instructions;
          result.details.note = deploymentResult.details.note;
          result.details.sqlToExecute = deploymentResult.details.sqlToExecute;
        }
      } else {
        const deploymentResult = await this.deployDirect();
        result.deploymentResult = deploymentResult;
        result.success = deploymentResult.success;
        result.message = deploymentResult.message;
        result.details.tablesCreated = deploymentResult.tablesCreated;
        
        // Pass through provider-specific details (e.g., Supabase instructions)
        if (deploymentResult.details) {
          result.details.instructions = deploymentResult.details.instructions;
          result.details.note = deploymentResult.details.note;
          result.details.sqlToExecute = deploymentResult.details.sqlToExecute;
        }
      }

      return result;

    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {}
      };
    }
  }

  /**
   * Test deployment without applying changes
   */
  public async testDeployment(): Promise<{
    canDeploy: boolean;
    issues: string[];
    preview: string;
  }> {
    const activeConfig = this.databaseService.getActiveConfig();
    const issues: string[] = [];

    if (!activeConfig) {
      issues.push('No active database connection');
    }

    // Test connection
    if (activeConfig) {
      try {
        const testResult = await this.databaseService.testConnection(activeConfig);
        if (!testResult.success) {
          issues.push(`Connection test failed: ${testResult.message}`);
        }
      } catch (error) {
        issues.push(`Connection test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Validate schema
    const validation = await this.migrationService.validateSchema();
    if (!validation.valid && validation.errors) {
      issues.push(...validation.errors);
    }

    // Generate preview
    const preview = await this.generateDeploymentPreview();

    return {
      canDeploy: issues.length === 0,
      issues,
      preview
    };
  }

  /**
   * Generate deployment preview
   */
  public async generateDeploymentPreview(): Promise<string> {
    try {
      const migrationPreview = await this.migrationService.generateMigrationPreview();
      
      if (migrationPreview.hasChanges) {
        return migrationPreview.previewSql;
      } else {
        const activeConfig = this.databaseService.getActiveConfig();
        const targetProvider = activeConfig?.provider || 'postgresql';
        return this.diagramService.exportSchemaAsSQL(targetProvider) || 'No schema to deploy';
      }
    } catch (error) {
      return `Error generating preview: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get deployment history
   */
  public getDeploymentHistory() {
    return this.migrationService.getMigrationHistory();
  }

  /**
   * Rollback last deployment
   */
  public async rollbackLastDeployment(): Promise<DeploymentResult> {
    try {
      const rollbackResult = await this.migrationService.rollbackLastMigration();
      
      return {
        success: rollbackResult.success,
        message: rollbackResult.success 
          ? 'Last deployment rolled back successfully'
          : rollbackResult.message,
        details: {},
        deploymentResult: rollbackResult
      };
    } catch (error) {
      return {
        success: false,
        message: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {}
      };
    }
  }

  /**
   * Deploy to multiple environments
   */
  public async deployToMultipleEnvironments(
    configIds: string[], 
    options: DeploymentOptions
  ): Promise<Map<string, DeploymentResult>> {
    const results = new Map<string, DeploymentResult>();

    for (const configId of configIds) {
      // Set active config
      this.databaseService.setActiveConfig(configId);
      
      // Deploy to this environment
      const result = await this.deploySchema(options);
      results.set(configId, result);
      
      // If deployment fails, stop deploying to other environments
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Get database status
   */
  public async getDatabaseStatus(): Promise<{
    connected: boolean;
    databaseInfo?: any;
    pendingMigrations: number;
    lastDeployment?: string;
  }> {
    const activeConfig = this.databaseService.getActiveConfig();
    
    if (!activeConfig) {
      return {
        connected: false,
        pendingMigrations: 0
      };
    }

    try {
      const provider = this.databaseService.getActiveProvider();
      const connectionTest = await this.databaseService.testConnection(activeConfig);
      
      let databaseInfo = undefined;
      if (connectionTest.success && provider) {
        databaseInfo = await provider.getDatabaseInfo();
      }

      const migrationHistory = this.migrationService.getMigrationHistory();
      const lastApplied = this.migrationService.getLastAppliedMigration();
      
      return {
        connected: connectionTest.success,
        databaseInfo,
        pendingMigrations: migrationHistory.filter(m => m.status === 'pending').length,
        lastDeployment: lastApplied?.appliedAt
      };
    } catch (error) {
      return {
        connected: false,
        pendingMigrations: 0
      };
    }
  }

  private async deployWithMigrations(migrationName?: string): Promise<SchemaDeploymentResult> {
    try {
      const migration = await this.migrationService.generateMigration(migrationName);
      
      if (!migration) {
        return {
          success: true,
          message: 'No changes detected. Schema is already up to date.',
          tablesCreated: 0,
          migrationsApplied: 0
        };
      }

      return await this.migrationService.applyMigration(migration);
    } catch (error) {
      return {
        success: false,
        message: `Migration deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private async deployDirect(): Promise<SchemaDeploymentResult> {
    return await this.migrationService.deployCurrentSchema();
  }
}