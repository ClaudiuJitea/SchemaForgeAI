import { BaseDatabaseProvider, DatabaseConfig, ConnectionTestResult, SchemaDeploymentResult, Migration } from '../types';
import { SQLiteManager } from '../SQLiteManager';

export class SQLiteProvider extends BaseDatabaseProvider {
  private sqliteManager: SQLiteManager | null = null;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  private async getSQLiteManager(): Promise<SQLiteManager> {
    if (!this.sqliteManager) {
      this.sqliteManager = await SQLiteManager.getInstance({
        databaseName: this.config.database || 'schema.db',
        autoSave: true
      });
    }
    return this.sqliteManager;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      // Initialize SQLite manager
      const manager = await this.getSQLiteManager();
      
      // Test with a simple query
      const result = await manager.executeSQL('SELECT sqlite_version() as version');
      const latency = Date.now() - startTime;
      
      if (!result.success) {
        throw new Error(result.error || 'SQLite test query failed');
      }
      
      const version = result.data?.[0]?.version || 'SQLite 3.x';
      const stats = await manager.getStats();
      
      return {
        success: true,
        message: `SQLite database ready: ${this.config.database || 'schema.db'}`,
        latency,
        version: `SQLite ${version} (sql.js)`,
        features: [
          'Local browser storage',
          'ACID transactions',
          'Full SQL support',
          'Download/Upload .db files',
          `${stats.tables} tables, ${stats.totalRows} rows`
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: `SQLite connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async deploySchema(sql: string): Promise<SchemaDeploymentResult> {
    try {
      const manager = await this.getSQLiteManager();
      
      if (!sql.trim()) {
        return {
          success: false,
          message: 'No SQL schema provided for deployment'
        };
      }

      // Execute the SQL schema
      const result = await manager.executeSQL(sql);
      
      if (!result.success) {
        return {
          success: false,
          message: `Schema deployment failed: ${result.error}`,
          errors: [result.error || 'Unknown SQL error']
        };
      }

      // Get table count after deployment
      const tables = await manager.getTables();
      const statements = sql.split(';').filter(stmt => stmt.trim());
      const createTableStatements = statements.filter(stmt => 
        stmt.trim().toUpperCase().startsWith('CREATE TABLE')
      );

      return {
        success: true,
        message: `Schema deployed successfully to SQLite database '${this.config.database || 'schema.db'}'`,
        executedStatements: statements,
        tablesCreated: createTableStatements.length,
        migrationsApplied: 1
      };
    } catch (error) {
      return {
        success: false,
        message: `SQLite deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async executeQuery(query: string): Promise<any> {
    try {
      const manager = await this.getSQLiteManager();
      const result = await manager.executeSQL(query);
      
      if (!result.success) {
        throw new Error(result.error || 'Query execution failed');
      }
      
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        return {
          rows: result.data || [],
          rowCount: result.data?.length || 0,
          fields: result.columns || []
        };
      }
      
      return {
        affectedRows: result.changes || 0,
        insertId: result.lastInsertRowid || null
      };
    } catch (error) {
      throw new Error(`SQLite query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDatabaseInfo(): Promise<{
    name: string;
    version: string;
    tables: string[];
    features: string[];
  }> {
    try {
      const manager = await this.getSQLiteManager();
      const tables = await manager.getTables();
      const versionResult = await manager.executeSQL('SELECT sqlite_version() as version');
      const stats = await manager.getStats();
      
      const version = versionResult.success && versionResult.data?.[0]?.version 
        ? `SQLite ${versionResult.data[0].version}` 
        : 'SQLite 3.x';

      return {
        name: this.config.database || 'schema.db',
        version: `${version} (sql.js)`,
        tables,
        features: [
          'ACID transactions',
          'Foreign key constraints',
          'Triggers and Views',
          'Common Table Expressions',
          'JSON support',
          'Full-text search',
          `Database size: ${(stats.size / 1024).toFixed(1)} KB`,
          `Total rows: ${stats.totalRows}`
        ]
      };
    } catch (error) {
      return {
        name: this.config.database || 'schema.db',
        version: 'SQLite 3.x (sql.js)',
        tables: [],
        features: ['Error loading database info']
      };
    }
  }

  async generateMigration(fromSql: string, toSql: string): Promise<Migration> {
    // Simple migration generation for SQLite
    const migrationId = `migration_${Date.now()}`;
    const migrationName = `Schema_Update_${new Date().toISOString().slice(0, 10)}`;
    
    // For SQLite, we often need to recreate tables for schema changes
    // This is a simplified approach - a real implementation would be more sophisticated
    const migration: Migration = {
      id: migrationId,
      name: migrationName,
      sql: toSql, // Simplified - would contain actual migration steps
      checksum: this.generateChecksum(toSql),
      createdAt: new Date().toISOString(),
      rollbackSql: fromSql // Simplified rollback
    };

    return migration;
  }

  async applyMigration(migration: Migration): Promise<SchemaDeploymentResult> {
    try {
      // Apply the migration SQL
      return await this.deploySchema(migration.sql);
    } catch (error) {
      return {
        success: false,
        message: `Migration ${migration.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async validateSql(sql: string): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      // Basic SQL validation for SQLite
      const errors: string[] = [];
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        const trimmed = statement.trim().toUpperCase();
        
        // Check for basic syntax issues
        if (trimmed.startsWith('CREATE TABLE') && !trimmed.includes('(')) {
          errors.push('CREATE TABLE statement missing column definitions');
        }
        
        // Check for SQLite-specific features
        if (trimmed.includes('AUTO_INCREMENT')) {
          errors.push('Use AUTOINCREMENT instead of AUTO_INCREMENT in SQLite');
        }
      }
      
      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  private generateChecksum(content: string): string {
    // Simple checksum generation (in a real implementation, use a proper hash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Download SQLite database file
   */
  public async downloadDatabase(filename?: string): Promise<void> {
    try {
      const manager = await this.getSQLiteManager();
      const downloadName = filename || `${this.config.database || 'schema'}.db`;
      manager.downloadDatabase(downloadName);
    } catch (error) {
      throw new Error(`Failed to download database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload/Import SQLite database file
   */
  public async uploadDatabase(file: File): Promise<void> {
    try {
      const manager = await this.getSQLiteManager();
      const arrayBuffer = await file.arrayBuffer();
      await manager.importDatabase(arrayBuffer);
    } catch (error) {
      throw new Error(`Failed to upload database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all data from database
   */
  public async clearDatabase(): Promise<void> {
    try {
      const manager = await this.getSQLiteManager();
      await manager.clearDatabase();
    } catch (error) {
      throw new Error(`Failed to clear database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get SQLite manager instance for advanced operations
   */
  public async getSQLiteManagerInstance(): Promise<SQLiteManager> {
    return await this.getSQLiteManager();
  }
}