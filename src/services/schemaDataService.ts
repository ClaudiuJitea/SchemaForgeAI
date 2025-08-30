import { DiagramService, DiagramData } from './diagramService';
import { SchemaParser, TableSchema, SchemaRelationship } from './schemaParser';

export interface SchemaExportData {
  metadata: {
    exportedAt: string;
    version: string;
    format: 'json' | 'sql';
    application: 'ai-schema-builder';
  };
  tables: TableSchema[];
  relationships: SchemaRelationship[];
}

export interface SchemaBackup {
  id: string;
  name: string;
  createdAt: string;
  data: SchemaExportData;
}

export class SchemaDataService {
  private static instance: SchemaDataService;
  private diagramService: DiagramService;

  private constructor() {
    this.diagramService = DiagramService.getInstance();
  }

  public static getInstance(): SchemaDataService {
    if (!SchemaDataService.instance) {
      SchemaDataService.instance = new SchemaDataService();
    }
    return SchemaDataService.instance;
  }

  /**
   * Export current schema as JSON
   */
  public exportAsJSON(): string {
    const diagramData = this.diagramService.getDiagramData();
    const exportData: SchemaExportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        format: 'json',
        application: 'ai-schema-builder'
      },
      tables: this.convertDiagramTablesToSchema(diagramData.tables),
      relationships: this.convertDiagramRelationshipsToSchema(diagramData.relationships)
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export current schema as SQL
   */
  public exportAsSQL(): string {
    const sqlHeader = `-- Schema Export
-- Generated on: ${new Date().toISOString()}
-- Application: AI Schema Builder

`;

    const sqlContent = this.diagramService.exportSchemaAsSQL();
    return sqlHeader + sqlContent;
  }

  /**
   * Import schema from JSON string
   */
  public importFromJSON(jsonString: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const importData = JSON.parse(jsonString) as SchemaExportData;
        
        // Validate the JSON structure
        if (!this.validateImportData(importData)) {
          throw new Error('Invalid schema format');
        }

        // Convert to diagram format and update
        this.diagramService.updateFromSchema(importData.tables, importData.relationships);
        resolve();
      } catch (error) {
        reject(new Error(`Failed to import JSON schema: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Import schema from SQL string
   */
  public importFromSQL(sqlString: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const schemaParser = new SchemaParser();
        const parseResult = schemaParser.parseSQL(sqlString);
        
        if (!parseResult.success) {
          throw new Error(`SQL parsing failed: ${parseResult.error}`);
        }

        // Update diagram with parsed data
        this.diagramService.updateFromSchema(parseResult.tables || [], parseResult.relationships || []);
        resolve();
      } catch (error) {
        reject(new Error(`Failed to import SQL schema: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Create a backup of the current schema
   */
  public createBackup(name?: string): SchemaBackup {
    const diagramData = this.diagramService.getDiagramData();
    const backup: SchemaBackup = {
      id: Date.now().toString(),
      name: name || `Backup ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      data: {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          format: 'json',
          application: 'ai-schema-builder'
        },
        tables: this.convertDiagramTablesToSchema(diagramData.tables),
        relationships: this.convertDiagramRelationshipsToSchema(diagramData.relationships)
      }
    };

    // Save to localStorage
    this.saveBackup(backup);
    
    return backup;
  }

  /**
   * Get all backups from localStorage
   */
  public getBackups(): SchemaBackup[] {
    try {
      const backupsJson = localStorage.getItem('schemaBackups');
      if (!backupsJson) return [];
      
      const backups = JSON.parse(backupsJson) as SchemaBackup[];
      return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error loading backups:', error);
      return [];
    }
  }

  /**
   * Restore schema from backup
   */
  public restoreBackup(backupId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const backups = this.getBackups();
        const backup = backups.find(b => b.id === backupId);
        
        if (!backup) {
          throw new Error('Backup not found');
        }

        this.diagramService.updateFromSchema(backup.data.tables, backup.data.relationships);
        resolve();
      } catch (error) {
        reject(new Error(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Delete a backup
   */
  public deleteBackup(backupId: string): void {
    try {
      const backups = this.getBackups();
      const filteredBackups = backups.filter(b => b.id !== backupId);
      localStorage.setItem('schemaBackups', JSON.stringify(filteredBackups));
    } catch (error) {
      console.error('Error deleting backup:', error);
    }
  }

  /**
   * Download file with given content
   */
  public downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Private helper methods
   */
  private validateImportData(data: any): data is SchemaExportData {
    return (
      data &&
      typeof data === 'object' &&
      data.metadata &&
      Array.isArray(data.tables) &&
      Array.isArray(data.relationships)
    );
  }

  private saveBackup(backup: SchemaBackup): void {
    try {
      const existingBackups = this.getBackups();
      const updatedBackups = [backup, ...existingBackups];
      localStorage.setItem('schemaBackups', JSON.stringify(updatedBackups));
    } catch (error) {
      console.error('Error saving backup:', error);
    }
  }

  private convertDiagramTablesToSchema(diagramTables: any[]): TableSchema[] {
    return diagramTables.map(table => ({
      name: table.name,
      fields: table.fields.map((field: any) => ({
        name: field.name,
        type: field.type,
        primaryKey: field.isPrimaryKey,
        nullable: field.nullable,
        foreignKey: field.isForeignKey ? {
          referencedTable: '',
          referencedField: ''
        } : undefined
      }))
    }));
  }

  private convertDiagramRelationshipsToSchema(diagramRelationships: any[]): SchemaRelationship[] {
    return diagramRelationships.map(rel => ({
      fromTable: rel.fromTable,
      fromField: rel.fromField,
      toTable: rel.toTable,
      toField: rel.toField,
      type: 'foreign_key'
    }));
  }
}