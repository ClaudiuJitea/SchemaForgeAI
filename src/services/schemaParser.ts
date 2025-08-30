export interface TableField {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
  defaultValue?: string;
}

export interface TableSchema {
  name: string;
  fields: TableField[];
}

export interface SchemaRelationship {
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
}

export interface ParsedSchema {
  tables: TableSchema[];
  relationships: SchemaRelationship[];
}

export class SchemaParser {
  public static parseSQL(sql: string): ParsedSchema {
    const tables: TableSchema[] = [];
    const relationships: SchemaRelationship[] = [];
    
    console.log('Parsing SQL:', sql);
    
    // Clean up the SQL and split by CREATE TABLE statements
    const cleanSQL = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
    const createTableRegex = /CREATE\s+TABLE\s+(\w+)\s*\((.*?)\);/gi;
    
    let match;
    while ((match = createTableRegex.exec(cleanSQL)) !== null) {
      const tableName = match[1].toLowerCase();
      const columnDefinitions = match[2];
      
      const table: TableSchema = {
        name: tableName,
        fields: []
      };
      
      // Parse column definitions
      const columns = this.parseColumnDefinitions(columnDefinitions);
      table.fields = columns.fields;
      
      // Extract explicit relationships
      columns.relationships.forEach(rel => {
        console.log('Found explicit relationship:', {
          fromTable: tableName,
          fromField: rel.fromField,
          toTable: rel.toTable,
          toField: rel.toField
        });
        relationships.push({
          fromTable: tableName,
          fromField: rel.fromField,
          toTable: rel.toTable,
          toField: rel.toField
        });
      });
      
      tables.push(table);
    }
    
    // After parsing all tables, detect implicit foreign key relationships
    this.detectImplicitRelationships(tables, relationships);
    
    console.log('Final parsed result:', { tables: tables.length, relationships: relationships.length });
    console.log('Relationships found:', relationships);
    
    return { tables, relationships };
  }
  
  private static parseColumnDefinitions(columnDefs: string): {
    fields: TableField[];
    relationships: Array<{ fromField: string; toTable: string; toField: string; }>;
  } {
    const fields: TableField[] = [];
    const relationships: Array<{ fromField: string; toTable: string; toField: string; }> = [];
    
    // Split by commas that are not inside parentheses
    const columns = this.splitColumnDefinitions(columnDefs);
    
    for (const column of columns) {
      const field = this.parseColumnDefinition(column.trim());
      if (field) {
        fields.push(field);
        
        // Check for foreign key relationships
        if (field.foreignKey) {
          relationships.push({
            fromField: field.name,
            toTable: field.foreignKey.table,
            toField: field.foreignKey.column
          });
        }
      }
    }
    
    return { fields, relationships };
  }
  
  private static splitColumnDefinitions(columnDefs: string): string[] {
    const columns: string[] = [];
    let current = '';
    let parenCount = 0;
    
    for (let i = 0; i < columnDefs.length; i++) {
      const char = columnDefs[i];
      
      if (char === '(') parenCount++;
      else if (char === ')') parenCount--;
      else if (char === ',' && parenCount === 0) {
        if (current.trim()) {
          columns.push(current.trim());
          current = '';
          continue;
        }
      }
      
      current += char;
    }
    
    if (current.trim()) {
      columns.push(current.trim());
    }
    
    return columns;
  }
  
  private static parseColumnDefinition(columnDef: string): TableField | null {
    // Skip constraint definitions that don't start with a column name
    if (columnDef.toUpperCase().startsWith('CONSTRAINT') || 
        columnDef.toUpperCase().startsWith('PRIMARY KEY') ||
        columnDef.toUpperCase().startsWith('FOREIGN KEY')) {
      return null;
    }
    
    const parts = columnDef.split(/\s+/);
    if (parts.length < 2) return null;
    
    const name = parts[0].toLowerCase();
    const type = this.normalizeType(parts[1].toUpperCase());
    
    let nullable = true;
    let primaryKey = false;
    let foreignKey: { table: string; column: string; } | undefined;
    let defaultValue: string | undefined;
    
    const upperDef = columnDef.toUpperCase();
    
    // Check for constraints
    if (upperDef.includes('NOT NULL')) nullable = false;
    if (upperDef.includes('PRIMARY KEY')) primaryKey = true;
    
    // Check for SERIAL type (auto-increment primary key)
    if (type === 'SERIAL' || type === 'BIGSERIAL') {
      primaryKey = true;
      nullable = false;
    }
    
    // Check for foreign key references
    const referencesMatch = upperDef.match(/REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/);
    if (referencesMatch) {
      console.log('Found REFERENCES clause:', referencesMatch[0]);
      foreignKey = {
        table: referencesMatch[1].toLowerCase(),
        column: referencesMatch[2].toLowerCase()
      };
      console.log('Parsed foreign key:', foreignKey);
    }
    
    // Check for default values
    const defaultMatch = upperDef.match(/DEFAULT\s+([^,\s]+)/);
    if (defaultMatch) {
      defaultValue = defaultMatch[1];
    }
    
    return {
      name,
      type,
      nullable,
      primaryKey,
      foreignKey,
      defaultValue
    };
  }
  
  private static detectImplicitRelationships(tables: TableSchema[], relationships: SchemaRelationship[]): void {
    console.log('Detecting implicit foreign key relationships...');
    
    // Create a map of table names and their primary key fields
    const tableMap = new Map<string, string>();
    const tableNameVariations = new Map<string, string[]>();
    
    tables.forEach(table => {
      const pkField = table.fields.find(f => f.primaryKey);
      if (pkField) {
        tableMap.set(table.name, pkField.name);
        
        // Generate possible variations of the table name for FK detection
        const variations = [
          table.name,
          table.name.slice(0, -1), // Remove 's' for plural tables (e.g., books -> book)
          table.name + '_id',
          table.name.slice(0, -1) + '_id'
        ];
        tableNameVariations.set(table.name, variations);
      }
    });
    
    // Check each table for potential foreign key fields
    tables.forEach(fromTable => {
      fromTable.fields.forEach(field => {
        // Skip if field already has an explicit foreign key
        if (field.foreignKey) return;
        
        // Check if field name indicates it's a foreign key
        if (field.name.endsWith('_id') && !field.primaryKey) {
          const potentialTableName = field.name.replace('_id', '');
          
          // Find matching table
          for (const [tableName, variations] of tableNameVariations) {
            if (variations.some(variation => 
              variation === potentialTableName || 
              variation === potentialTableName + 's' ||
              variation === field.name
            )) {
              const pkField = tableMap.get(tableName);
              if (pkField) {
                // Check if this relationship already exists
                const existingRel = relationships.find(rel => 
                  rel.fromTable === fromTable.name && 
                  rel.fromField === field.name &&
                  rel.toTable === tableName
                );
                
                if (!existingRel) {
                  console.log('Found implicit foreign key relationship:', {
                    fromTable: fromTable.name,
                    fromField: field.name,
                    toTable: tableName,
                    toField: pkField
                  });
                  
                  // Add the implicit relationship
                  relationships.push({
                    fromTable: fromTable.name,
                    fromField: field.name,
                    toTable: tableName,
                    toField: pkField
                  });
                  
                  // Mark the field as a foreign key
                  field.foreignKey = {
                    table: tableName,
                    column: pkField
                  };
                }
                break;
              }
            }
          }
        }
      });
    });
    
    console.log(`Detected ${relationships.length} total relationships (explicit + implicit)`);
  }
  
  private static normalizeType(type: string): string {
    // Normalize common PostgreSQL types
    const typeMap: { [key: string]: string } = {
      'SERIAL': 'int8',
      'BIGSERIAL': 'int8',
      'INTEGER': 'int8',
      'INT': 'int8',
      'BIGINT': 'int8',
      'VARCHAR': 'text',
      'CHAR': 'text',
      'TEXT': 'text',
      'BOOLEAN': 'boolean',
      'BOOL': 'boolean',
      'TIMESTAMP': 'timestamp',
      'TIMESTAMPTZ': 'timestamp',
      'DATE': 'timestamp',
      'TIME': 'timestamp',
      'DECIMAL': 'numeric',
      'NUMERIC': 'numeric',
      'REAL': 'numeric',
      'DOUBLE': 'numeric',
      'FLOAT': 'numeric',
      'UUID': 'uuid',
      'JSON': 'json',
      'JSONB': 'json'
    };
    
    // Remove parentheses and everything inside them for type matching
    const baseType = type.split('(')[0];
    return typeMap[baseType] || 'text';
  }
}