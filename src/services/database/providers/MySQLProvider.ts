import { BaseDatabaseProvider, DatabaseConfig, ConnectionTestResult, SchemaDeploymentResult, Migration } from '../types';

export class MySQLProvider extends BaseDatabaseProvider {
  constructor(config: DatabaseConfig) {
    super(config);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      // Test MySQL connection
      if (this.config.provider === 'planetscale') {
        return await this.testPlanetScaleConnection();
      } else {
        return await this.testGenericMySQLConnection();
      }
    } catch (error) {
      return {
        success: false,
        message: `MySQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async deploySchema(sql: string): Promise<SchemaDeploymentResult> {
    try {
      // Convert PostgreSQL syntax to MySQL if necessary
      const mysqlSql = this.convertToMySQLSyntax(sql);
      
      const statements = mysqlSql.split(';').filter(stmt => stmt.trim());
      const executedStatements: string[] = [];
      let tablesCreated = 0;

      for (const statement of statements) {
        const trimmedStatement = statement.trim();
        if (!trimmedStatement) continue;

        try {
          await this.executeMySQLQuery(trimmedStatement);
          executedStatements.push(trimmedStatement);
          
          if (trimmedStatement.toUpperCase().startsWith('CREATE TABLE')) {
            tablesCreated++;
          }
        } catch (error) {
          return {
            success: false,
            message: `Failed to execute statement: ${trimmedStatement}`,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            executedStatements
          };
        }
      }

      return {
        success: true,
        message: `Schema deployed to MySQL successfully. ${tablesCreated} tables created.`,
        executedStatements,
        tablesCreated,
        migrationsApplied: 1
      };
    } catch (error) {
      return {
        success: false,
        message: `MySQL deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async executeQuery(query: string): Promise<any> {
    return await this.executeMySQLQuery(query);
  }

  async getDatabaseInfo(): Promise<{
    name: string;
    version: string;
    tables: string[];
    features: string[];
  }> {
    try {
      const response = await fetch('/api/mysql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: this.config,
          query: '',
          operation: 'info'
        })
      });

      const result = await response.json();
      
      if (result.success && result.data) {
        return {
          name: result.data.name,
          version: result.data.version,
          tables: result.data.tables || [],
          features: result.data.features || this.getMySQLFeatures()
        };
      }

      throw new Error(result.message || 'Failed to get database info');
    } catch (error) {
      return {
        name: this.extractDatabaseName(),
        version: 'MySQL 8.0',
        tables: [],
        features: this.getMySQLFeatures()
      };
    }
  }

  async generateMigration(fromSql: string, toSql: string): Promise<Migration> {
    const migrationId = `mysql_migration_${Date.now()}`;
    const migrationName = `Schema_Update_${new Date().toISOString().slice(0, 10)}`;
    
    const migration: Migration = {
      id: migrationId,
      name: migrationName,
      sql: this.generateMySQLMigrationSql(fromSql, toSql),
      checksum: this.generateChecksum(toSql),
      createdAt: new Date().toISOString(),
      rollbackSql: this.generateRollbackSql(fromSql, toSql)
    };

    return migration;
  }

  async applyMigration(migration: Migration): Promise<SchemaDeploymentResult> {
    try {
      // Apply migration
      await this.executeMySQLQuery(migration.sql);

      // Record migration
      await this.recordMigration(migration);

      return {
        success: true,
        message: `MySQL migration ${migration.id} applied successfully`,
        executedStatements: [migration.sql],
        migrationsApplied: 1
      };
    } catch (error) {
      return {
        success: false,
        message: `MySQL migration ${migration.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async validateSql(sql: string): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const errors: string[] = [];
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        const trimmed = statement.trim().toUpperCase();
        
        // MySQL validation
        if (trimmed.startsWith('CREATE TABLE') && !trimmed.includes('(')) {
          errors.push('CREATE TABLE statement missing column definitions');
        }
        
        // Check for PostgreSQL-specific syntax
        if (trimmed.includes('SERIAL')) {
          errors.push('Use AUTO_INCREMENT instead of SERIAL in MySQL');
        }
        
        if (trimmed.includes('BOOLEAN')) {
          errors.push('Consider using TINYINT(1) instead of BOOLEAN in MySQL for better compatibility');
        }
        
        // PlanetScale-specific validations
        if (this.config.provider === 'planetscale') {
          if (trimmed.includes('FOREIGN KEY')) {
            errors.push('PlanetScale does not support foreign key constraints');
          }
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

  private async testPlanetScaleConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    const host = this.config.host;
    const username = this.config.username;
    const password = this.config.password;
    
    if (!host || !username || !password) {
      throw new Error('PlanetScale host, username, and password are required');
    }

    try {
      const response = await fetch('/api/mysql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: this.config,
          query: '',
          operation: 'test'
        })
      });

      const result = await response.json();
      const latency = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.message || 'Connection test failed');
      }

      return {
        success: true,
        message: 'PlanetScale connection successful',
        latency,
        version: result.version + ' (PlanetScale)',
        features: [
          'Serverless MySQL',
          'Database branching',
          'Non-blocking schema changes',
          'Automatic backups',
          'Connection pooling',
          'Global read replicas',
          'Vitess-powered scaling'
        ]
      };
    } catch (error) {
      throw error;
    }
  }

  private async testGenericMySQLConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    const connectionString = this.config.connectionString;
    
    if (!connectionString && !this.config.host) {
      throw new Error('MySQL connection string or host is required');
    }

    try {
      const response = await fetch('/api/mysql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: this.config,
          query: '',
          operation: 'test'
        })
      });

      const result = await response.json();
      const latency = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.message || 'Connection test failed');
      }

      return {
        success: true,
        message: 'MySQL connection successful',
        latency,
        version: result.version,
        features: this.getMySQLFeatures()
      };
    } catch (error) {
      throw error;
    }
  }

  private async executeMySQLQuery(query: string): Promise<any> {
    if (this.config.provider === 'planetscale') {
      return await this.executePlanetScaleQuery(query);
    } else {
      return await this.executeGenericMySQLQuery(query);
    }
  }

  private async executePlanetScaleQuery(query: string): Promise<any> {
    // PlanetScale uses HTTP API - for now, treat it like generic MySQL
    return await this.executeGenericMySQLQuery(query);
  }

  private async executeGenericMySQLQuery(query: string): Promise<any> {
    try {
      const response = await fetch('/api/mysql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: this.config,
          query,
          operation: 'execute'
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || result.error || 'Database query failed');
      }

      return result.results || [];
    } catch (error) {
      console.error('MySQL query execution failed:', error);
      throw error;
    }
  }

  private convertToMySQLSyntax(sql: string): string {
    // Convert PostgreSQL-specific syntax to MySQL
    let mysqlSql = sql;
    
    // Replace SERIAL with AUTO_INCREMENT
    mysqlSql = mysqlSql.replace(/\bSERIAL\b/gi, 'INT AUTO_INCREMENT');
    
    // Replace BOOLEAN with TINYINT(1)
    mysqlSql = mysqlSql.replace(/\bBOOLEAN\b/gi, 'TINYINT(1)');
    
    // Replace TEXT with appropriate MySQL text types
    mysqlSql = mysqlSql.replace(/\bTEXT\b/gi, 'TEXT');
    
    // Replace UUID with CHAR(36) if needed
    mysqlSql = mysqlSql.replace(/\bUUID\b/gi, 'CHAR(36)');
    
    return mysqlSql;
  }

  private extractDatabaseName(): string {
    if (this.config.database) {
      return this.config.database;
    }
    
    const connectionString = this.config.connectionString || '';
    const match = connectionString.match(/\/([^/?]+)(?:\?|$)/);
    return match ? match[1] : 'mysql';
  }

  private getMySQLFeatures(): string[] {
    const baseFeatures = [
      'ACID transactions',
      'Foreign key constraints',
      'Triggers',
      'Views',
      'Stored procedures',
      'Indexing',
      'Full-text search',
      'JSON data type',
      'Partitioning'
    ];

    if (this.config.provider === 'planetscale') {
      return [
        ...baseFeatures,
        'Serverless scaling',
        'Database branching',
        'Non-blocking schema changes',
        'Automatic backups',
        'Global read replicas'
      ];
    }

    return baseFeatures;
  }

  private generateMySQLMigrationSql(fromSql: string, toSql: string): string {
    const timestamp = new Date().toISOString();
    const mysqlSql = this.convertToMySQLSyntax(toSql);
    
    return `
-- MySQL Migration generated at ${timestamp}
-- This migration was auto-generated by AI Schema Builder

START TRANSACTION;

${mysqlSql}

COMMIT;
    `.trim();
  }

  private generateRollbackSql(fromSql: string, toSql: string): string {
    const mysqlSql = this.convertToMySQLSyntax(fromSql);
    return `-- MySQL Rollback Migration\nSTART TRANSACTION;\n${mysqlSql}\nCOMMIT;`;
  }

  private async recordMigration(migration: Migration): Promise<void> {
    const insertQuery = `
      INSERT INTO schema_migrations (id, name, checksum, applied_at) 
      VALUES ('${migration.id}', '${migration.name}', '${migration.checksum}', NOW())
    `;
    
    try {
      await this.executeMySQLQuery(insertQuery);
    } catch (error) {
      // If migrations table doesn't exist, create it
      await this.createMigrationsTable();
      await this.executeMySQLQuery(insertQuery);
    }
  }

  private async createMigrationsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await this.executeMySQLQuery(createTableQuery);
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