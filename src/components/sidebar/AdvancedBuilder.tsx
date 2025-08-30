'use client';

import { useState } from 'react';
import { Plus, Database, Layout, Clock, Hash, Trash2 } from 'lucide-react';
import { DiagramService } from '../../services/diagramService';
import { SchemaParser } from '../../services/schemaParser';

interface Field {
  id: string;
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  foreignKey?: boolean;
}

export default function AdvancedBuilder() {
  const [activePreview, setActivePreview] = useState<'visual' | 'sql'>('visual');
  const [tableName, setTableName] = useState('');
  const [fields, setFields] = useState<Field[]>([]);
  const diagramService = DiagramService.getInstance();

  const addField = () => {
    const newField: Field = {
      id: crypto.randomUUID(),
      name: '',
      type: 'text',
      nullable: true
    };
    setFields([...fields, newField]);
  };

  const removeField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const updateField = (fieldId: string, updates: Partial<Field>) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const addIdField = () => {
    const idField: Field = {
      id: crypto.randomUUID(),
      name: 'id',
      type: 'int8',
      nullable: false,
      primaryKey: true,
      foreignKey: false
    };
    setFields([idField, ...fields]);
  };

  const addTimestamps = () => {
    const createdAtField: Field = {
      id: crypto.randomUUID(),
      name: 'created_at',
      type: 'timestamp',
      nullable: false,
      primaryKey: false,
      foreignKey: false
    };
    const updatedAtField: Field = {
      id: crypto.randomUUID(),
      name: 'updated_at',
      type: 'timestamp',
      nullable: false,
      primaryKey: false,
      foreignKey: false
    };
    setFields([...fields, createdAtField, updatedAtField]);
  };

  const generateSQL = () => {
    if (!tableName || fields.length === 0) return '';
    
    const sqlFields = fields.map(field => {
      let sql = `    ${field.name} `;
      
      // Map display types to SQL types
      const typeMap: { [key: string]: string } = {
        'int8': field.primaryKey ? 'SERIAL' : 'INTEGER',
        'text': 'TEXT',
        'boolean': 'BOOLEAN',
        'numeric': 'NUMERIC',
        'timestamp': field.name.includes('_at') ? 'TIMESTAMP DEFAULT NOW()' : 'TIMESTAMP',
        'uuid': 'UUID'
      };
      
      sql += typeMap[field.type] || 'TEXT';
      
      if (field.primaryKey && field.type !== 'int8') {
        sql += ' PRIMARY KEY';
      }
      
      if (!field.nullable && !field.primaryKey && !field.name.includes('_at')) {
        sql += ' NOT NULL';
      }
      
      return sql;
    }).join(',\n');

    return `CREATE TABLE ${tableName} (\n${sqlFields}\n);`;
  };

  const addToSchema = () => {
    if (!tableName || fields.length === 0) return;
    
    const sql = generateSQL();
    console.log('Generated SQL:', sql);
    
    // Parse the new table SQL
    const parsedSchema = SchemaParser.parseSQL(sql);
    if (parsedSchema.tables.length > 0) {
      const newTable = parsedSchema.tables[0];
      
      // Add the single new table to existing diagram without replacing others
      diagramService.addTable(newTable);
      
      // Clear the form after successful addition
      clearFields();
      
      console.log(`Table "${tableName}" added to diagram successfully!`);
    }
  };

  const clearFields = () => {
    setFields([]);
    setTableName('');
  };

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2 mb-2">
          <Database size={20} style={{ color: '#00D4AA' }} />
          <h2 className="text-lg font-semibold text-text-primary">Live SQL Builder</h2>
        </div>
        <p className="text-sm text-text-secondary">
          Visually build tables and see them in the diagram.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-border">
        <div className="flex space-x-2">
          <button 
            onClick={addIdField}
            className="flex items-center space-x-1 px-3 py-1.5 bg-background rounded text-sm text-text-secondary hover:text-text-primary transition-colors hover:bg-surface"
          >
            <Hash size={14} />
            <span>Add ID</span>
          </button>
          <button 
            onClick={addTimestamps}
            className="flex items-center space-x-1 px-3 py-1.5 bg-background rounded text-sm text-text-secondary hover:text-text-primary transition-colors hover:bg-surface"
          >
            <Clock size={14} />
            <span>Add Timestamps</span>
          </button>
        </div>
      </div>

      {/* Preview Tabs */}
      <div className="border-b border-border">
        <div className="flex">
          <button
            onClick={() => setActivePreview('visual')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activePreview === 'visual'
                ? 'text-text-primary border-primary bg-background rounded-t-xl'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:rounded-t-xl'
            }`}
          >
            Visual Builder
          </button>
          <button
            onClick={() => setActivePreview('sql')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activePreview === 'sql'
                ? 'text-text-primary border-primary bg-background rounded-t-xl'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:rounded-t-xl'
            }`}
          >
            SQL Preview
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activePreview === 'visual' && (
          <div className="p-4 space-y-6">
            {/* Table Configuration */}
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-3">Table Configuration</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Table Name
                  </label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="e.g., users, products, orders"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Fields */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-text-primary">Fields</h3>
                <button
                  onClick={addField}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-primary text-black text-sm font-medium rounded hover:bg-opacity-90 transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Field</span>
                </button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-8">
                  <Database size={48} className="mx-auto text-text-secondary/50 mb-3" />
                  <p className="text-sm text-text-secondary">No fields added yet</p>
                  <p className="text-xs text-text-secondary/75 mt-1">
                    Click &quot;Add Field&quot; to start building your table
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div key={field.id} className="flex items-center space-x-2 p-3 bg-background border border-border rounded group hover:border-border-hover transition-colors">
                      {/* Field name input */}
                      <div className="flex-1">
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateField(field.id, { name: e.target.value })}
                          placeholder="Field name"
                          className="w-full px-2 py-1 bg-surface border border-border rounded text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary"
                        />
                      </div>
                      
                      {/* Field type select */}
                      <div className="w-24">
                        <select
                          value={field.type}
                          onChange={(e) => updateField(field.id, { type: e.target.value })}
                          className="w-full px-2 py-1 bg-surface border border-border rounded text-sm text-text-primary focus:outline-none focus:border-primary"
                        >
                          <option value="text">TEXT</option>
                          <option value="int8">INT</option>
                          <option value="timestamp">TIMESTAMP</option>
                          <option value="numeric">NUMERIC</option>
                          <option value="boolean">BOOLEAN</option>
                          <option value="uuid">UUID</option>
                        </select>
                      </div>

                      {/* Constraints - clickable toggles */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => updateField(field.id, { primaryKey: !field.primaryKey })}
                          className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
                            field.primaryKey 
                              ? 'bg-primary text-black' 
                              : 'bg-surface text-text-secondary hover:bg-surface-hover'
                          }`}
                          title="Toggle Primary Key"
                        >
                          PK
                        </button>
                        <button
                          onClick={() => updateField(field.id, { foreignKey: !field.foreignKey })}
                          className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
                            field.foreignKey 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-surface text-text-secondary hover:bg-surface-hover'
                          }`}
                          title="Toggle Foreign Key"
                        >
                          FK
                        </button>
                        <button
                          onClick={() => updateField(field.id, { nullable: !field.nullable })}
                          className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
                            !field.nullable 
                              ? 'bg-red-600 text-white' 
                              : 'bg-surface text-text-secondary hover:bg-surface-hover'
                          }`}
                          title="Toggle Nullable"
                        >
                          {field.nullable ? 'NULL' : 'NOT NULL'}
                        </button>
                      </div>
                      
                      {/* Remove button */}
                      <button
                        onClick={() => removeField(field.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-all duration-200"
                        title="Remove field"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activePreview === 'sql' && (
          <div className="p-4">
            <h3 className="text-base font-semibold text-text-primary mb-3">SQL Preview</h3>
            <div className="bg-background border border-border rounded p-4">
              {tableName && fields.length > 0 ? (
                <pre className="font-mono text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                  {generateSQL()}
                </pre>
              ) : (
                <div className="text-center py-8">
                  <Database size={48} className="mx-auto text-text-secondary/50 mb-3" />
                  <p className="text-sm text-text-secondary">Configure table and add fields to see SQL preview</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex items-center justify-between text-xs text-text-secondary mb-3">
          <span>{fields.length} fields configured</span>
          {fields.length > 0 && (
            <button
              onClick={clearFields}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        
        <button
          onClick={addToSchema}
          disabled={!tableName || fields.length === 0}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary text-black font-medium rounded hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Layout size={16} />
          <span>Add to Diagram</span>
        </button>
      </div>
    </>
  );
}