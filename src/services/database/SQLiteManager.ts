import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

export interface SQLiteConfig {
  databaseName: string;
  autoSave: boolean;
  storageKey?: string;
}

export interface SQLiteQueryResult {
  success: boolean;
  data?: any[];
  columns?: string[];
  changes?: number;
  lastInsertRowid?: number;
  error?: string;
}

export interface SQLiteTableInfo {
  name: string;
  sql: string;
}

export class SQLiteManager {
  private static SQL: SqlJsStatic | null = null;
  private static instances: Map<string, SQLiteManager> = new Map();
  
  private db: Database | null = null;
  private config: SQLiteConfig;
  private isInitialized = false;

  private constructor(config: SQLiteConfig) {
    this.config = {
      autoSave: true,
      storageKey: `sqlite_${config.databaseName}`,
      ...config
    };
  }

  /**
   * Get or create SQLite manager instance
   */
  public static async getInstance(config: SQLiteConfig): Promise<SQLiteManager> {
    const key = config.databaseName;
    
    if (!SQLiteManager.instances.has(key)) {
      const instance = new SQLiteManager(config);
      await instance.initialize();
      SQLiteManager.instances.set(key, instance);
    }

    return SQLiteManager.instances.get(key)!;
  }

  /**
   * Initialize sql.js library and database
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize sql.js library if not already done
      if (!SQLiteManager.SQL) {
        SQLiteManager.SQL = await initSqlJs({
          // Load sql.js WASM from CDN
          locateFile: file => `https://sql.js.org/dist/${file}`
        });
      }

      // Try to load existing database from localStorage
      await this.loadFromStorage();
      
      if (!this.db) {
        // Create new empty database
        this.db = new SQLiteManager.SQL.Database();
        console.log(`Created new SQLite database: ${this.config.databaseName}`);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize SQLite:', error);
      throw new Error(`SQLite initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute SQL query
   */
  public async executeSQL(sql: string): Promise<SQLiteQueryResult> {
    if (!this.isInitialized || !this.db) {
      throw new Error('SQLite database not initialized');
    }

    try {
      console.log('Executing SQL:', sql);
      
      // Handle multiple statements
      const statements = sql.split(';').filter(stmt => stmt.trim());
      let totalChanges = 0;
      let lastResult: any = null;

      for (const statement of statements) {
        const trimmed = statement.trim();
        if (!trimmed) continue;

        if (trimmed.toUpperCase().startsWith('SELECT') || 
            trimmed.toUpperCase().startsWith('PRAGMA')) {
          // Query that returns data
          const stmt = this.db.prepare(trimmed);
          const result = [];
          const columns = stmt.getColumnNames();
          
          while (stmt.step()) {
            const row = stmt.getAsObject();
            result.push(row);
          }
          
          stmt.free();
          lastResult = { data: result, columns };
        } else {
          // DML/DDL statement
          this.db.run(trimmed);
          totalChanges += this.db.getRowsModified();
        }
      }

      // Auto-save if enabled
      if (this.config.autoSave) {
        await this.saveToStorage();
      }

      return {
        success: true,
        data: lastResult?.data || [],
        columns: lastResult?.columns || [],
        changes: totalChanges,
        lastInsertRowid: this.db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] as number
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown SQL error';
      console.error('SQL execution failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get database schema information
   */
  public async getSchema(): Promise<SQLiteTableInfo[]> {
    const result = await this.executeSQL(`
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    if (!result.success) {
      throw new Error(`Failed to get schema: ${result.error}`);
    }

    return result.data as SQLiteTableInfo[];
  }

  /**
   * Get list of tables
   */
  public async getTables(): Promise<string[]> {
    const result = await this.executeSQL(`
      SELECT name 
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    if (!result.success) {
      throw new Error(`Failed to get tables: ${result.error}`);
    }

    return result.data?.map((row: any) => row.name) || [];
  }

  /**
   * Check if database exists and has tables
   */
  public async hasData(): Promise<boolean> {
    const tables = await this.getTables();
    return tables.length > 0;
  }

  /**
   * Export database as ArrayBuffer for download
   */
  public exportDatabase(): Uint8Array {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db.export();
  }

  /**
   * Import database from file data
   */
  public async importDatabase(data: ArrayBuffer): Promise<void> {
    if (!SQLiteManager.SQL) {
      throw new Error('sql.js not initialized');
    }

    try {
      // Close existing database
      if (this.db) {
        this.db.close();
      }

      // Create new database from imported data
      this.db = new SQLiteManager.SQL.Database(new Uint8Array(data));
      
      // Save to storage if auto-save enabled
      if (this.config.autoSave) {
        await this.saveToStorage();
      }

      console.log(`Imported database: ${this.config.databaseName}`);
    } catch (error) {
      throw new Error(`Failed to import database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download database file
   */
  public downloadDatabase(filename?: string): void {
    try {
      const data = this.exportDatabase();
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `${this.config.databaseName}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Downloaded database: ${a.download}`);
    } catch (error) {
      throw new Error(`Failed to download database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all data from database
   */
  public async clearDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      // Get all tables
      const tables = await this.getTables();
      
      // Drop all tables
      for (const table of tables) {
        await this.executeSQL(`DROP TABLE IF EXISTS "${table}"`);
      }

      console.log(`Cleared database: ${this.config.databaseName}`);
    } catch (error) {
      throw new Error(`Failed to clear database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database statistics
   */
  public async getStats(): Promise<{
    tables: number;
    totalRows: number;
    size: number;
  }> {
    const tables = await this.getTables();
    let totalRows = 0;

    for (const table of tables) {
      const result = await this.executeSQL(`SELECT COUNT(*) as count FROM "${table}"`);
      if (result.success && result.data) {
        totalRows += (result.data[0] as any).count;
      }
    }

    const data = this.exportDatabase();

    return {
      tables: tables.length,
      totalRows,
      size: data.length
    };
  }

  /**
   * Save database to localStorage
   */
  private async saveToStorage(): Promise<void> {
    if (!this.db || !this.config.storageKey) return;

    try {
      const data = this.db.export();
      const dataArray = Array.from(data);
      localStorage.setItem(this.config.storageKey, JSON.stringify(dataArray));
      
      console.log(`Saved database to storage: ${this.config.storageKey}`);
    } catch (error) {
      console.error('Failed to save to storage:', error);
      // Don't throw error, just log it
    }
  }

  /**
   * Load database from localStorage
   */
  private async loadFromStorage(): Promise<void> {
    if (!this.config.storageKey) return;

    try {
      const saved = localStorage.getItem(this.config.storageKey);
      if (!saved) return;

      const dataArray = JSON.parse(saved);
      const data = new Uint8Array(dataArray);
      
      if (SQLiteManager.SQL) {
        this.db = new SQLiteManager.SQL.Database(data);
        console.log(`Loaded database from storage: ${this.config.storageKey}`);
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
      // Don't throw error, just continue with empty database
    }
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * Get database instance (for advanced operations)
   */
  public getDatabase(): Database | null {
    return this.db;
  }
}