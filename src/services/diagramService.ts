import { TableSchema, SchemaRelationship } from './schemaParser';
import { DatabaseProvider } from './database/types';
import { SQLSyntaxMapper } from './database/sqlSyntaxMapper';

export interface DiagramTable {
  id: string;
  name: string;
  fields: Array<{
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    nullable: boolean;
  }>;
  position: {
    x: number;
    y: number;
  };
  relationships: {
    incoming: number;
    outgoing: number;
  };
}

export interface DiagramRelationship {
  id: string;
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
}

export interface DiagramData {
  tables: DiagramTable[];
  relationships: DiagramRelationship[];
}

export class DiagramService {
  private static instance: DiagramService;
  private diagramData: DiagramData = { tables: [], relationships: [] };
  private listeners: Array<(data: DiagramData) => void> = [];
  private selectedTableName: string | null = null;
  private selectionListeners: Array<(tableName: string | null) => void> = [];
  private schemaResetListeners: Array<() => void> = [];

  public static getInstance(): DiagramService {
    if (!DiagramService.instance) {
      DiagramService.instance = new DiagramService();
    }
    return DiagramService.instance;
  }

  public addListener(callback: (data: DiagramData) => void): void {
    this.listeners.push(callback);
  }

  public removeListener(callback: (data: DiagramData) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.diagramData));
  }

  public getDiagramData(): DiagramData {
    return this.diagramData;
  }

  public updateFromSchema(tables: TableSchema[], relationships: SchemaRelationship[], preservePositions: boolean = false): void {
    console.log('DiagramService.updateFromSchema called with:', {
      tablesCount: tables.length,
      relationshipsCount: relationships.length,
      preservePositions,
      existingTablesCount: this.diagramData.tables.length
    });
    
    // Notify that schema is being reset (this will close all table tabs)
    this.notifySchemaResetListeners();

    // Convert tables to diagram format
    const diagramTables: DiagramTable[] = tables.map((table, index) => {
      const existingTable = this.diagramData.tables.find(t => t.name === table.name);
      
      return {
        id: table.name,
        name: table.name,
        fields: table.fields.map(field => ({
          name: field.name,
          type: field.type,
          isPrimaryKey: field.primaryKey,
          isForeignKey: !!field.foreignKey,
          nullable: field.nullable
        })),
        position: (preservePositions && existingTable) 
          ? existingTable.position 
          : this.calculateTablePosition(index, tables.length),
        relationships: {
          incoming: relationships.filter(rel => rel.toTable === table.name).length,
          outgoing: relationships.filter(rel => rel.fromTable === table.name).length
        }
      };
    });

    // Convert relationships to diagram format
    const diagramRelationships: DiagramRelationship[] = relationships.map((rel, index) => ({
      id: `${rel.fromTable}_${rel.fromField}_${rel.toTable}_${rel.toField}`,
      fromTable: rel.fromTable,
      fromField: rel.fromField,
      toTable: rel.toTable,
      toField: rel.toField
    }));

    this.diagramData = {
      tables: diagramTables,
      relationships: diagramRelationships
    };

    console.log('DiagramService updated with:', {
      finalTablesCount: this.diagramData.tables.length,
      finalRelationshipsCount: this.diagramData.relationships.length,
      tables: this.diagramData.tables.map(t => t.name),
      relationships: this.diagramData.relationships.map(r => `${r.fromTable}.${r.fromField} → ${r.toTable}.${r.toField}`)
    });

    // Clear any selected table since schema changed
    this.selectedTableName = null;

    this.notifyListeners();
  }

  public addTable(table: TableSchema): void {
    const existingIndex = this.diagramData.tables.findIndex(t => t.name === table.name);
    const newTable: DiagramTable = {
      id: table.name,
      name: table.name,
      fields: table.fields.map(field => ({
        name: field.name,
        type: field.type,
        isPrimaryKey: field.primaryKey,
        isForeignKey: !!field.foreignKey,
        nullable: field.nullable
      })),
      position: this.calculateTablePosition(this.diagramData.tables.length, this.diagramData.tables.length + 1),
      relationships: {
        incoming: 0,
        outgoing: 0
      }
    };

    if (existingIndex !== -1) {
      // Update existing table
      this.diagramData.tables[existingIndex] = {
        ...newTable,
        position: this.diagramData.tables[existingIndex].position // Keep existing position
      };
    } else {
      // Add new table
      this.diagramData.tables.push(newTable);
    }

    this.notifyListeners();
  }

  public removeTable(tableName: string): void {
    this.diagramData.tables = this.diagramData.tables.filter(table => table.name !== tableName);
    this.diagramData.relationships = this.diagramData.relationships.filter(
      rel => rel.fromTable !== tableName && rel.toTable !== tableName
    );
    this.notifyListeners();
  }

  public updateTablePosition(tableName: string, position: { x: number; y: number }): void {
    const table = this.diagramData.tables.find(t => t.name === tableName);
    if (table) {
      table.position = position;
      this.notifyListeners();
    }
  }

  private calculateTablePosition(index: number, totalTables: number): { x: number; y: number } {
    const spacing = 400; // Increased spacing for better layout
    const maxCols = Math.min(4, totalTables); // Max 4 columns for better readability
    const cols = Math.ceil(Math.sqrt(totalTables));
    const actualCols = Math.min(maxCols, cols);
    
    const col = index % actualCols;
    const row = Math.floor(index / actualCols);
    
    return {
      x: 150 + (col * spacing), // More margin from edge
      y: 150 + (row * spacing)  // More margin from edge
    };
  }

  public getTableCount(): number {
    return this.diagramData.tables.length;
  }

  public getRelationshipCount(): number {
    return this.diagramData.relationships.length;
  }

  public getFieldCount(): number {
    return this.diagramData.tables.reduce((total, table) => total + table.fields.length, 0);
  }

  // Selection methods
  public addSelectionListener(callback: (tableName: string | null) => void): void {
    this.selectionListeners.push(callback);
  }

  public removeSelectionListener(callback: (tableName: string | null) => void): void {
    this.selectionListeners = this.selectionListeners.filter(listener => listener !== callback);
  }

  private notifySelectionListeners(): void {
    this.selectionListeners.forEach(listener => listener(this.selectedTableName));
  }

  public selectTable(tableName: string | null): void {
    this.selectedTableName = tableName;
    this.notifySelectionListeners();
  }

  public getSelectedTable(): string | null {
    return this.selectedTableName;
  }

  public getTableData(tableName: string): DiagramTable | null {
    return this.diagramData.tables.find(table => table.name === tableName) || null;
  }

  // Schema reset methods
  public addSchemaResetListener(callback: () => void): void {
    this.schemaResetListeners.push(callback);
  }

  public removeSchemaResetListener(callback: () => void): void {
    this.schemaResetListeners = this.schemaResetListeners.filter(listener => listener !== callback);
  }

  private notifySchemaResetListeners(): void {
    this.schemaResetListeners.forEach(listener => listener());
  }

  // Clear all diagram data and reset to empty state
  public clearDiagram(): void {
    // Notify that schema is being reset (this will close all table tabs)
    this.notifySchemaResetListeners();

    // Clear all data
    this.diagramData = { tables: [], relationships: [] };
    this.selectedTableName = null;

    // Notify listeners of the cleared state
    this.notifyListeners();
  }

  // Export current schema as SQL
  public exportSchemaAsSQL(provider: DatabaseProvider = 'postgresql'): string {
    if (this.diagramData.tables.length === 0) {
      return '';
    }

    const syntaxConfig = SQLSyntaxMapper.getSyntaxConfig(provider);
    const sqlStatements: string[] = [];

    // Generate CREATE TABLE statements
    this.diagramData.tables.forEach(table => {
      const fields = table.fields.map(field => {
        let fieldDefinition = `    ${field.name}`;
        
        // Handle primary key with auto-increment
        if (field.isPrimaryKey) {
          if (field.type.toLowerCase() === 'int8' || 
              field.type.toLowerCase() === 'integer' || 
              field.type.toLowerCase() === 'serial') {
            fieldDefinition += ` ${syntaxConfig.autoIncrement.syntax}`;
          } else {
            // Map the data type and add PRIMARY KEY
            const mappedType = SQLSyntaxMapper.mapDataType(field.type, provider);
            fieldDefinition += ` ${mappedType} ${syntaxConfig.constraints.primaryKey}`;
          }
        } else {
          // Map regular data types
          const mappedType = SQLSyntaxMapper.mapDataType(field.type, provider);
          fieldDefinition += ` ${mappedType}`;
        }
        
        // Add NOT NULL constraint for non-primary key fields
        if (!field.nullable && !field.isPrimaryKey) {
          fieldDefinition += ` ${syntaxConfig.constraints.notNull}`;
        }

        // Add inline foreign key references if this field has a relationship
        const relationship = this.diagramData.relationships.find(rel => 
          rel.fromTable === table.name && rel.fromField === field.name
        );
        if (relationship) {
          const foreignKeyConstraint = syntaxConfig.constraints.foreignKey(
            relationship.toTable, 
            relationship.toField
          );
          fieldDefinition += ` ${foreignKeyConstraint}`;
        }
        
        return fieldDefinition;
      });

      const createStatement = `CREATE TABLE IF NOT EXISTS ${table.name} (\n${fields.join(',\n')}\n);`;
      sqlStatements.push(createStatement);
    });

    return sqlStatements.join('\n\n');
  }

  // Legacy method for backward compatibility - defaults to PostgreSQL
  public exportSchemaAsSQLLegacy(): string {
    return this.exportSchemaAsSQL('postgresql');
  }
}