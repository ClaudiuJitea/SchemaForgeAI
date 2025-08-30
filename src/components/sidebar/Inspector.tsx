'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash2, Plus, Key, Shield, X, Save } from 'lucide-react';
import { DiagramService } from '../../services/diagramService';
import { SchemaParser } from '../../services/schemaParser';

interface TableField {
  id: string;
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  nullable?: boolean;
}

interface TableInfo {
  name: string;
  fields: TableField[];
  relationships: number;
  indexes: number;
}

interface EditField {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  nullable: boolean;
  isNew?: boolean;
}

interface TableIndex {
  id: string;
  name: string;
  fields: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  unique: boolean;
}

interface TablePolicy {
  id: string;
  name: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  role: string;
  condition: string;
}

export default function Inspector() {
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [rlsEnabled, setRlsEnabled] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTable, setEditingTable] = useState<{
    name: string;
    fields: EditField[];
  } | null>(null);
  const [indexes, setIndexes] = useState<TableIndex[]>([]);
  const [policies, setPolicies] = useState<TablePolicy[]>([]);
  const [showCreateIndex, setShowCreateIndex] = useState(false);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [newIndex, setNewIndex] = useState<Partial<TableIndex>>({
    name: '',
    fields: [],
    type: 'btree',
    unique: false
  });
  const [newPolicy, setNewPolicy] = useState<Partial<TablePolicy>>({
    name: '',
    operation: 'SELECT',
    role: 'authenticated',
    condition: ''
  });
  const diagramService = DiagramService.getInstance();

  useEffect(() => {
    // Listen for table selection changes
    const handleTableSelection = (tableName: string | null) => {
      if (tableName) {
        const tableData = diagramService.getTableData(tableName);
        if (tableData) {
          const tableInfo: TableInfo = {
            name: tableData.name,
            fields: tableData.fields.map((field, index) => ({
              id: `${index}`,
              name: field.name,
              type: field.type,
              isPrimaryKey: field.isPrimaryKey,
              nullable: field.nullable
            })),
            relationships: tableData.relationships.incoming + tableData.relationships.outgoing,
            indexes: 0 // TODO: Add index tracking
          };
          setSelectedTable(tableInfo);
        }
      } else {
        setSelectedTable(null);
      }
    };

    // Set initial selection
    const initialSelection = diagramService.getSelectedTable();
    handleTableSelection(initialSelection);

    // Add listener
    diagramService.addSelectionListener(handleTableSelection);

    return () => {
      diagramService.removeSelectionListener(handleTableSelection);
    };
  }, [diagramService]);

  const handleEditTable = () => {
    if (selectedTable) {
      setEditingTable({
        name: selectedTable.name,
        fields: selectedTable.fields.map(field => ({
          id: field.id,
          name: field.name,
          type: field.type,
          isPrimaryKey: field.isPrimaryKey || false,
          nullable: field.nullable || true
        }))
      });
      setIsEditMode(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditingTable(null);
  };

  const handleSaveEdit = () => {
    if (editingTable && selectedTable) {
      // Generate SQL for the updated table
      const sqlFields = editingTable.fields.map(field => {
        let sql = `    ${field.name} `;
        
        // Map display types back to SQL types
        const typeMap: { [key: string]: string } = {
          'int8': 'SERIAL',
          'text': 'TEXT',
          'boolean': 'BOOLEAN',
          'numeric': 'NUMERIC',
          'timestamp': 'TIMESTAMP',
          'uuid': 'UUID',
          'json': 'JSON'
        };
        
        sql += typeMap[field.type] || 'TEXT';
        
        if (field.isPrimaryKey) {
          sql += ' PRIMARY KEY';
        }
        
        if (!field.nullable && !field.isPrimaryKey) {
          sql += ' NOT NULL';
        }
        
        return sql;
      }).join(',\n');

      const newSQL = `CREATE TABLE ${editingTable.name} (\n${sqlFields}\n);`;
      
      // Parse the new SQL and update the diagram
      const parsedSchema = SchemaParser.parseSQL(newSQL);
      if (parsedSchema.tables.length > 0) {
        // Remove the old table and add the updated one
        diagramService.removeTable(selectedTable.name);
        diagramService.updateFromSchema(parsedSchema.tables, parsedSchema.relationships);
      }
      
      setIsEditMode(false);
      setEditingTable(null);
    }
  };

  const handleFieldChange = (fieldId: string, property: keyof EditField, value: any) => {
    if (editingTable) {
      setEditingTable({
        ...editingTable,
        fields: editingTable.fields.map(field =>
          field.id === fieldId ? { ...field, [property]: value } : field
        )
      });
    }
  };

  const handleAddField = () => {
    if (editingTable) {
      const newField: EditField = {
        id: `new_${Date.now()}`,
        name: 'new_field',
        type: 'text',
        isPrimaryKey: false,
        nullable: true,
        isNew: true
      };
      setEditingTable({
        ...editingTable,
        fields: [...editingTable.fields, newField]
      });
    }
  };

  const handleRemoveField = (fieldId: string) => {
    if (editingTable) {
      setEditingTable({
        ...editingTable,
        fields: editingTable.fields.filter(field => field.id !== fieldId)
      });
    }
  };

  const handleDeleteTable = () => {
    if (selectedTable) {
      console.log('Delete table:', selectedTable.name);
    }
  };

  const handleCreateIndex = () => {
    if (selectedTable) {
      setNewIndex({
        name: `${selectedTable.name}_idx_${Date.now()}`,
        fields: [],
        type: 'btree',
        unique: false
      });
      setShowCreateIndex(true);
    }
  };

  const handleAddPolicy = () => {
    if (selectedTable) {
      setNewPolicy({
        name: `${selectedTable.name}_policy_${Date.now()}`,
        operation: 'SELECT',
        role: 'authenticated',
        condition: ''
      });
      setShowAddPolicy(true);
    }
  };

  const handleSaveIndex = () => {
    if (newIndex.name && newIndex.fields && newIndex.fields.length > 0) {
      const index: TableIndex = {
        id: `idx_${Date.now()}`,
        name: newIndex.name,
        fields: newIndex.fields,
        type: newIndex.type || 'btree',
        unique: newIndex.unique || false
      };
      setIndexes([...indexes, index]);
      setShowCreateIndex(false);
      setNewIndex({
        name: '',
        fields: [],
        type: 'btree',
        unique: false
      });
    }
  };

  const handleSavePolicy = () => {
    if (newPolicy.name && newPolicy.operation && newPolicy.role) {
      const policy: TablePolicy = {
        id: `pol_${Date.now()}`,
        name: newPolicy.name,
        operation: newPolicy.operation,
        role: newPolicy.role,
        condition: newPolicy.condition || ''
      };
      setPolicies([...policies, policy]);
      setShowAddPolicy(false);
      setNewPolicy({
        name: '',
        operation: 'SELECT',
        role: 'authenticated',
        condition: ''
      });
    }
  };

  const handleRemoveIndex = (indexId: string) => {
    setIndexes(indexes.filter(idx => idx.id !== indexId));
  };

  const handleRemovePolicy = (policyId: string) => {
    setPolicies(policies.filter(pol => pol.id !== policyId));
  };

  const toggleIndexField = (fieldName: string) => {
    const currentFields = newIndex.fields || [];
    if (currentFields.includes(fieldName)) {
      setNewIndex({
        ...newIndex,
        fields: currentFields.filter(f => f !== fieldName)
      });
    } else {
      setNewIndex({
        ...newIndex,
        fields: [...currentFields, fieldName]
      });
    }
  };

  if (!selectedTable) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Table Selected</h3>
          <p className="text-text-secondary">Click on a table in the diagram to view its details.</p>
        </div>
      </div>
    );
  }

  if (isEditMode && editingTable) {
    return (
      <>
        {/* Edit Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-text-primary">Edit Table</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSaveEdit}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <Save size={14} />
                <span>Save</span>
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <X size={14} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
          
          {/* Table Name Edit */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-primary mb-1">Table Name</label>
            <input
              type="text"
              value={editingTable.name}
              onChange={(e) => setEditingTable({ ...editingTable, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Fields Edit */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary">Fields ({editingTable.fields.length})</h3>
            <button
              onClick={handleAddField}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={14} />
              <span>Add Field</span>
            </button>
          </div>
          
          <div className="space-y-3">
            {editingTable.fields.map((field) => (
              <div key={field.id} className="p-3 bg-background rounded border border-border">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => handleFieldChange(field.id, 'name', e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-surface border border-border rounded text-text-primary focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Type</label>
                    <select
                      value={field.type}
                      onChange={(e) => handleFieldChange(field.id, 'type', e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-surface border border-border rounded text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="text">TEXT</option>
                      <option value="int8">INTEGER</option>
                      <option value="boolean">BOOLEAN</option>
                      <option value="numeric">NUMERIC</option>
                      <option value="timestamp">TIMESTAMP</option>
                      <option value="uuid">UUID</option>
                      <option value="json">JSON</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={field.isPrimaryKey}
                        onChange={(e) => handleFieldChange(field.id, 'isPrimaryKey', e.target.checked)}
                        className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
                      />
                      <span className="text-xs text-text-secondary">Primary Key</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={field.nullable}
                        onChange={(e) => handleFieldChange(field.id, 'nullable', e.target.checked)}
                        className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
                      />
                      <span className="text-xs text-text-secondary">Nullable</span>
                    </label>
                  </div>
                  
                  <button
                    onClick={() => handleRemoveField(field.id)}
                    className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    title="Remove field"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Table Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-text-primary">{selectedTable.name}</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleEditTable}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <Edit size={14} />
              <span>Edit</span>
            </button>
            <button
              onClick={handleDeleteTable}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          {selectedTable.fields.length} fields • {selectedTable.relationships} relationships • {selectedTable.indexes} indexes
        </p>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Fields Section */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2 mb-4">
            <Key size={16} className="text-text-secondary" />
            <h3 className="text-base font-semibold text-text-primary">Fields ({selectedTable.fields.length})</h3>
          </div>
          
          <div className="space-y-3">
            {selectedTable.fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between p-3 bg-background rounded border border-border">
                <div className="flex items-center space-x-3">
                  {field.isPrimaryKey && (
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-black">PK</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-text-primary">{field.name}</span>
                      <span className="text-sm text-text-secondary bg-surface px-2 py-0.5 rounded">
                        {field.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Indexes Section */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Key size={16} className="text-text-secondary" />
              <h3 className="text-base font-semibold text-text-primary">Indexes ({indexes.length})</h3>
            </div>
            <button
              onClick={handleCreateIndex}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={14} />
              <span>Create Index</span>
            </button>
          </div>
          
          {indexes.length > 0 ? (
            <div className="space-y-2">
              {indexes.map((index) => (
                <div key={index.id} className="flex items-center justify-between p-3 bg-background rounded border border-border">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-text-primary">{index.name}</span>
                      {index.unique && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">UNIQUE</span>
                      )}
                      <span className="text-xs bg-surface text-text-secondary px-2 py-0.5 rounded uppercase">
                        {index.type}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mt-1">
                      Fields: {index.fields.join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveIndex(index.id)}
                    className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    title="Remove index"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-text-secondary">No indexes defined for this table.</p>
            </div>
          )}

          {/* Create Index Modal */}
          {showCreateIndex && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Create Index</h3>
                  <button
                    onClick={() => setShowCreateIndex(false)}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Index Name</label>
                    <input
                      type="text"
                      value={newIndex.name || ''}
                      onChange={(e) => setNewIndex({ ...newIndex, name: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Fields to Index</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {selectedTable.fields.map((field) => (
                        <label key={field.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={(newIndex.fields || []).includes(field.name)}
                            onChange={() => toggleIndexField(field.name)}
                            className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
                          />
                          <span className="text-sm text-text-primary">{field.name}</span>
                          <span className="text-xs text-text-secondary">({field.type})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">Index Type</label>
                      <select
                        value={newIndex.type || 'btree'}
                        onChange={(e) => setNewIndex({ ...newIndex, type: e.target.value as any })}
                        className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:border-primary"
                      >
                        <option value="btree">B-Tree</option>
                        <option value="hash">Hash</option>
                        <option value="gin">GIN</option>
                        <option value="gist">GiST</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <input
                        type="checkbox"
                        checked={newIndex.unique || false}
                        onChange={(e) => setNewIndex({ ...newIndex, unique: e.target.checked })}
                        className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
                      />
                      <span className="text-sm text-text-primary">Unique</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowCreateIndex(false)}
                    className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveIndex}
                    disabled={!newIndex.name || !newIndex.fields || newIndex.fields.length === 0}
                    className="px-4 py-2 text-sm bg-primary text-black rounded hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Index
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security & Policies Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Shield size={16} className="text-text-secondary" />
              <h3 className="text-base font-semibold text-text-primary">Security & Policies</h3>
            </div>
            <button
              onClick={handleAddPolicy}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={14} />
              <span>Add Policy</span>
            </button>
          </div>

          {/* RLS Toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-600/30 rounded">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm font-medium text-text-primary">Row Level Security</span>
              </div>
              <button
                onClick={() => setRlsEnabled(!rlsEnabled)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  rlsEnabled 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                {rlsEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          {/* Policies List */}
          {policies.length > 0 ? (
            <div className="space-y-2">
              {policies.map((policy) => (
                <div key={policy.id} className="p-3 bg-background rounded border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-text-primary">{policy.name}</span>
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                        {policy.operation}
                      </span>
                      <span className="text-xs bg-surface text-text-secondary px-2 py-0.5 rounded">
                        {policy.role}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemovePolicy(policy.id)}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                      title="Remove policy"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {policy.condition && (
                    <p className="text-sm text-text-secondary font-mono bg-surface p-2 rounded">
                      {policy.condition}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-text-secondary">No policies found for this table.</p>
            </div>
          )}

          {/* Add Policy Modal */}
          {showAddPolicy && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Add Policy</h3>
                  <button
                    onClick={() => setShowAddPolicy(false)}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Policy Name</label>
                    <input
                      type="text"
                      value={newPolicy.name || ''}
                      onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">Operation</label>
                      <select
                        value={newPolicy.operation || 'SELECT'}
                        onChange={(e) => setNewPolicy({ ...newPolicy, operation: e.target.value as any })}
                        className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:border-primary"
                      >
                        <option value="SELECT">SELECT</option>
                        <option value="INSERT">INSERT</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                        <option value="ALL">ALL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">Role</label>
                      <select
                        value={newPolicy.role || 'authenticated'}
                        onChange={(e) => setNewPolicy({ ...newPolicy, role: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:border-primary"
                      >
                        <option value="authenticated">authenticated</option>
                        <option value="anon">anon</option>
                        <option value="public">public</option>
                        <option value="service_role">service_role</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Condition <span className="text-text-secondary">(optional)</span>
                    </label>
                    <textarea
                      value={newPolicy.condition || ''}
                      onChange={(e) => setNewPolicy({ ...newPolicy, condition: e.target.value })}
                      placeholder="e.g., auth.uid() = user_id"
                      rows={3}
                      className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:border-primary resize-none font-mono text-sm"
                    />
                    <p className="text-xs text-text-secondary mt-1">
                      SQL expression that must evaluate to true for the policy to apply
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowAddPolicy(false)}
                    className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePolicy}
                    disabled={!newPolicy.name || !newPolicy.operation || !newPolicy.role}
                    className="px-4 py-2 text-sm bg-primary text-black rounded hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Policy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}