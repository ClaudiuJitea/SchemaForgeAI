export interface DatabaseConfig {
  id: string;
  name: string;
  provider: DatabaseProvider;
  connectionString: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  metadata?: Record<string, any>;
}

export type DatabaseProvider = 
  | 'sqlite'
  | 'postgres-local'
  | 'mysql-local';

export interface DatabaseProviderInfo {
  id: DatabaseProvider;
  name: string;
  description: string;
  type: 'postgres' | 'mysql' | 'sqlite';
  requiresConnectionString: boolean;
  fields: DatabaseField[];
  icon: string;
  website: string;
  freeOption: boolean;
}

export interface DatabaseField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'url';
  required: boolean;
  placeholder?: string;
  description?: string;
}

export interface SchemaDeploymentResult {
  success: boolean;
  message: string;
  executedStatements?: string[];
  errors?: string[];
  tablesCreated?: number;
  migrationsApplied?: number;
  details?: {
    instructions?: string[];
    note?: string;
    sqlToExecute?: string;
    validationErrors?: string[];
    [key: string]: any;
  };
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  version?: string;
  features?: string[];
}

export interface Migration {
  id: string;
  name: string;
  sql: string;
  checksum: string;
  createdAt: string;
  appliedAt?: string;
  rollbackSql?: string;
}

export abstract class BaseDatabaseProvider {
  protected config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract deploySchema(sql: string): Promise<SchemaDeploymentResult>;
  abstract executeQuery(query: string): Promise<any>;
  abstract getDatabaseInfo(): Promise<{
    name: string;
    version: string;
    tables: string[];
    features: string[];
  }>;
  abstract generateMigration(fromSql: string, toSql: string): Promise<Migration>;
  abstract applyMigration(migration: Migration): Promise<SchemaDeploymentResult>;
  abstract validateSql(sql: string): Promise<{ valid: boolean; errors?: string[] }>;
}