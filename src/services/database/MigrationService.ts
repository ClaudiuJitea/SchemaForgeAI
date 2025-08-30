import { DatabaseService } from './DatabaseService';
import { Migration, SchemaDeploymentResult } from './types';
import { DiagramService } from '../diagramService';

export interface MigrationHistory {
  id: string;
  name: string;
  sql: string;
  appliedAt: string;
  rollbackSql?: string;
  status: 'pending' | 'applied' | 'failed';
  checksum: string;
}

export class MigrationService {
  private static instance: MigrationService;
  private databaseService: DatabaseService;
  private diagramService: DiagramService;
  private migrationHistory: MigrationHistory[] = [];

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.diagramService = DiagramService.getInstance();
    this.loadMigrationHistory();
  }

  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  /**
   * Generate a migration from the current schema to a new schema
   */
  public async generateMigration(name?: string): Promise<Migration | null> {
    const activeProvider = this.databaseService.getActiveProvider();
    if (!activeProvider) {
      throw new Error('No active database connection');
    }

    // Get current schema SQL from DiagramService
    const activeConfig = this.databaseService.getActiveConfig();
    const targetProvider = activeConfig?.provider || 'postgresql';
    const currentSchemaSQL = this.diagramService.exportSchemaAsSQL(targetProvider);
    
    // Get the last applied schema (if any)
    const lastMigration = this.getLastAppliedMigration();
    const lastSchemaSQL = lastMigration?.sql || '';

    if (currentSchemaSQL === lastSchemaSQL) {
      return null; // No changes to migrate
    }

    // Generate migration
    const migration = await activeProvider.generateMigration(lastSchemaSQL, currentSchemaSQL);
    
    // Customize migration name if provided
    if (name) {
      migration.name = name;
    }

    return migration;
  }

  /**
   * Apply a migration to the active database
   */
  public async applyMigration(migration: Migration): Promise<SchemaDeploymentResult> {
    const activeProvider = this.databaseService.getActiveProvider();
    if (!activeProvider) {
      throw new Error('No active database connection');
    }

    try {
      // Apply the migration
      const result = await activeProvider.applyMigration(migration);
      
      if (result.success) {
        // Check if this is a "ready for deployment" result (like Supabase manual execution)
        const status = result.details?.instructions ? 'pending' : 'applied';
        
        // Add to migration history
        this.addToHistory({
          id: migration.id,
          name: migration.name,
          sql: migration.sql,
          appliedAt: new Date().toISOString(),
          rollbackSql: migration.rollbackSql,
          status: status,
          checksum: migration.checksum
        });
        
        this.saveMigrationHistory();
      }

      return result;
    } catch (error) {
      // Add failed migration to history
      this.addToHistory({
        id: migration.id,
        name: migration.name,
        sql: migration.sql,
        appliedAt: new Date().toISOString(),
        rollbackSql: migration.rollbackSql,
        status: 'failed',
        checksum: migration.checksum
      });
      
      this.saveMigrationHistory();
      
      throw error;
    }
  }

  /**
   * Deploy current schema directly (without migration)
   */
  public async deployCurrentSchema(): Promise<SchemaDeploymentResult> {
    const activeProvider = this.databaseService.getActiveProvider();
    if (!activeProvider) {
      throw new Error('No active database connection');
    }

    const activeConfig = this.databaseService.getActiveConfig();
    const targetProvider = activeConfig?.provider || 'postgresql';
    const currentSchemaSQL = this.diagramService.exportSchemaAsSQL(targetProvider);
    
    if (!currentSchemaSQL.trim()) {
      return {
        success: false,
        message: 'No schema to deploy. Create some tables first.'
      };
    }

    try {
      const result = await activeProvider.deploySchema(currentSchemaSQL);
      
      if (result.success) {
        // Check if this is a "ready for deployment" result (like Supabase manual execution)
        const status = result.details?.instructions ? 'pending' : 'applied';
        const name = result.details?.instructions ? 'Schema Ready for Manual Deployment' : 'Direct Schema Deployment';
        
        // Record deployment attempt
        this.addToHistory({
          id: `deployment_${Date.now()}`,
          name: name,
          sql: currentSchemaSQL,
          appliedAt: new Date().toISOString(),
          status: status,
          checksum: this.generateChecksum(currentSchemaSQL)
        });
        
        this.saveMigrationHistory();
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Rollback the last migration
   */
  public async rollbackLastMigration(): Promise<SchemaDeploymentResult> {
    const lastMigration = this.getLastAppliedMigration();
    if (!lastMigration || !lastMigration.rollbackSql) {
      return {
        success: false,
        message: 'No migration to rollback or rollback SQL not available'
      };
    }

    const activeProvider = this.databaseService.getActiveProvider();
    if (!activeProvider) {
      throw new Error('No active database connection');
    }

    try {
      const result = await activeProvider.deploySchema(lastMigration.rollbackSql);
      
      if (result.success) {
        // Mark the migration as rolled back
        this.updateMigrationStatus(lastMigration.id, 'pending');
        this.saveMigrationHistory();
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get migration history
   */
  public getMigrationHistory(): MigrationHistory[] {
    return [...this.migrationHistory].sort((a, b) => 
      new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    );
  }

  /**
   * Get the last applied migration
   */
  public getLastAppliedMigration(): MigrationHistory | null {
    const applied = this.migrationHistory.filter(m => m.status === 'applied');
    if (applied.length === 0) return null;
    
    return applied.reduce((latest, current) => 
      new Date(current.appliedAt) > new Date(latest.appliedAt) ? current : latest
    );
  }

  /**
   * Check if there are pending migrations
   */
  public hasPendingMigrations(): boolean {
    return this.migrationHistory.some(m => m.status === 'pending');
  }

  /**
   * Clear migration history
   */
  public clearHistory(): void {
    this.migrationHistory = [];
    this.saveMigrationHistory();
  }

  /**
   * Validate current schema against database
   */
  public async validateSchema(): Promise<{ valid: boolean; errors?: string[] }> {
    const activeProvider = this.databaseService.getActiveProvider();
    if (!activeProvider) {
      return {
        valid: false,
        errors: ['No active database connection']
      };
    }

    const activeConfig = this.databaseService.getActiveConfig();
    const targetProvider = activeConfig?.provider || 'postgresql';
    const currentSchemaSQL = this.diagramService.exportSchemaAsSQL(targetProvider);
    return await activeProvider.validateSql(currentSchemaSQL);
  }

  /**
   * Generate migration preview
   */
  public async generateMigrationPreview(): Promise<{
    hasChanges: boolean;
    migration?: Migration;
    previewSql: string;
  }> {
    const migration = await this.generateMigration();
    
    if (!migration) {
      return {
        hasChanges: false,
        previewSql: 'No changes detected'
      };
    }

    return {
      hasChanges: true,
      migration,
      previewSql: migration.sql
    };
  }

  private addToHistory(migration: MigrationHistory): void {
    // Remove existing migration with same ID
    this.migrationHistory = this.migrationHistory.filter(m => m.id !== migration.id);
    this.migrationHistory.push(migration);
  }

  private updateMigrationStatus(migrationId: string, status: 'pending' | 'applied' | 'failed'): void {
    const migration = this.migrationHistory.find(m => m.id === migrationId);
    if (migration) {
      migration.status = status;
    }
  }

  private loadMigrationHistory(): void {
    if (typeof window === 'undefined') {
      this.migrationHistory = [];
      return;
    }
    
    try {
      const saved = localStorage.getItem('migrationHistory');
      if (saved) {
        this.migrationHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load migration history:', error);
      this.migrationHistory = [];
    }
  }

  private saveMigrationHistory(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('migrationHistory', JSON.stringify(this.migrationHistory));
    } catch (error) {
      console.error('Failed to save migration history:', error);
    }
  }

  private generateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}