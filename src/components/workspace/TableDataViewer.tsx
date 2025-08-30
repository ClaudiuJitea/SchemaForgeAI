'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash2, Plus, Save, X, RefreshCw, Filter } from 'lucide-react';

interface TableRow {
  [key: string]: any;
}

interface TableColumn {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  nullable?: boolean;
}

interface TableData {
  tableName: string;
  columns: TableColumn[];
  rows: TableRow[];
  totalRows: number;
}

interface TableDataViewerProps {
  tableName: string;
  tableSchema?: TableColumn[]; // Optional schema to use instead of fetching
  onClose?: () => void;
}

export default function TableDataViewer({ tableName, tableSchema, onClose }: TableDataViewerProps) {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);
  const [filterValue, setFilterValue] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Load table data - should connect to actual database
  useEffect(() => {
    const loadTableData = async () => {
      setLoading(true);
      try {
        // This should connect to your actual database service
        // For now, show empty table structure only
        if (tableSchema) {
          setTableData({
            tableName,
            columns: tableSchema,
            rows: [],
            totalRows: 0
          });
        } else {
          setError('No table schema provided. Connect to database to load actual data.');
        }
      } catch (err) {
        setError('Failed to load table data');
      } finally {
        setLoading(false);
      }
    };

    loadTableData();
  }, [tableName, tableSchema]);

  const generateMockData = (tableName: string): TableData => {
    // Use provided schema or fetch from your schema service
    const columns = tableSchema || [
      { name: 'id', type: 'int8', isPrimaryKey: true },
      { name: 'name', type: 'text', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: false }
    ];

    const rows: TableRow[] = [];

    // Generate mock rows based on actual column definitions
    for (let i = 1; i <= 5; i++) {
      const row: TableRow = {};
      columns.forEach(col => {
        if (col.isPrimaryKey && (col.type === 'int8' || col.type === 'integer')) {
          row[col.name] = i;
        } else if (col.type === 'text') {
          row[col.name] = col.nullable && i % 3 === 0 ? null : `Sample ${col.name} ${i}`;
        } else if (col.type === 'timestamp') {
          row[col.name] = new Date().toISOString();
        } else if (col.type === 'boolean') {
          row[col.name] = i % 2 === 0;
        } else if (col.type === 'int8' || col.type === 'integer') {
          row[col.name] = col.nullable && i % 4 === 0 ? null : Math.floor(Math.random() * 100);
        } else {
          // Generic fallback for other types
          row[col.name] = col.nullable && i % 3 === 0 ? null : `Value ${i}`;
        }
      });
      rows.push(row);
    }

    return {
      tableName,
      columns,
      rows,
      totalRows: rows.length
    };
  };

  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  const handleEditRow = (row: TableRow) => {
    setEditingRow({ ...row });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editingRow && tableData) {
      const updatedRows = tableData.rows.map(row => 
        row.id === editingRow.id ? editingRow : row
      );
      setTableData({ ...tableData, rows: updatedRows });
      setIsEditing(false);
      setEditingRow(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingRow(null);
  };

  const handleDeleteRow = (rowId: any) => {
    if (tableData) {
      const updatedRows = tableData.rows.filter(row => row.id !== rowId);
      setTableData({ ...tableData, rows: updatedRows });
    }
  };

  const formatCellValue = (value: any, column: TableColumn): string => {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (column.type === 'timestamp' && typeof value === 'string') {
      return new Date(value).toLocaleString();
    }
    return String(value);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-text-secondary">
          <RefreshCw className="animate-spin" size={16} />
          <span>Loading table data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-primary hover:text-primary/80"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!tableData) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{tableData.tableName}</h2>
            <p className="text-sm text-text-secondary">
              Showing {tableData.rows.length} of {tableData.totalRows} total rows
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Filter..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="pl-10 pr-4 py-1 h-8 text-sm bg-surface border border-border rounded text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          
          <select 
            value={sortColumn || 'id'}
            onChange={(e) => handleSort(e.target.value)}
            className="px-3 py-1 h-8 text-sm bg-surface border border-border rounded text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="id">Sort by ID</option>
            {tableData.columns.map(col => (
              <option key={col.name} value={col.name}>Sort by {col.name}</option>
            ))}
          </select>
          
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center space-x-1 px-3 py-1 h-8 text-sm rounded transition-colors ${
              isEditing 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-primary text-black hover:bg-primary/80'
            }`}
          >
            {isEditing ? <X size={14} /> : <Edit size={14} />}
            <span>{isEditing ? 'Exit Edit' : 'Edit Data'}</span>
          </button>
          
          <button 
            onClick={() => {
              if (tableData?.rows.length === 0) {
                // Generate mock data if table is empty
                setLoading(true);
                setTimeout(() => {
                  const mockData = generateMockData(tableName);
                  setTableData(mockData);
                  setLoading(false);
                }, 500);
              } else {
                // Refresh existing data (would typically refetch from database)
                setLoading(true);
                setTimeout(() => {
                  const mockData = generateMockData(tableName);
                  setTableData(mockData);
                  setLoading(false);
                }, 500);
              }
            }}
            className="p-2 h-8 w-8 text-text-secondary hover:text-text-primary transition-colors"
            title={tableData?.rows.length === 0 ? "Load sample data" : "Refresh data"}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-surface border-b border-border sticky top-0">
            <tr>
              {tableData.columns.map((column) => (
                <th
                  key={column.name}
                  className="px-4 py-3 text-left text-sm font-medium text-text-primary cursor-pointer hover:bg-surface-hover"
                  onClick={() => handleSort(column.name)}
                >
                  <div className="flex items-center space-x-2">
                    <span>{column.name}</span>
                    {column.isPrimaryKey && (
                      <span className="text-xs bg-primary text-black px-1.5 py-0.5 rounded">PK</span>
                    )}
                    <span className="text-xs text-text-secondary">({column.type})</span>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tableData.rows.length === 0 ? (
              <tr>
                <td 
                  colSpan={tableData.columns.length + 1} 
                  className="px-4 py-8 text-center text-text-secondary"
                >
                  <div className="flex flex-col items-center space-y-2">
                    <p>No data available</p>
                    <p className="text-sm">Click the refresh button to load sample data or connect to a database</p>
                  </div>
                </td>
              </tr>
            ) : (
              tableData.rows.map((row, index) => (
                <tr key={index} className="hover:bg-surface-hover">
                  {tableData.columns.map((column) => (
                    <td key={column.name} className="px-4 py-3 text-sm text-text-primary">
                      <div className={`${
                        row[column.name] === null ? 'text-text-secondary italic' : ''
                      } ${
                        typeof row[column.name] === 'boolean' 
                          ? row[column.name] ? 'text-green-400' : 'text-red-400'
                          : ''
                      }`}>
                        {formatCellValue(row[column.name], column)}
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditRow(row)}
                          className="p-1 text-text-secondary hover:text-primary transition-colors"
                          title="Edit row"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 text-text-secondary hover:text-red-400 transition-colors"
                          title="Delete row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-text-secondary text-xs">Actions</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isEditing && editingRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">Edit Row</h3>
              <button onClick={handleCancelEdit} className="text-text-secondary hover:text-text-primary">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {tableData.columns.map((column) => (
                <div key={column.name}>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    {column.name}
                    {column.isPrimaryKey && (
                      <span className="ml-2 text-xs bg-primary text-black px-1.5 py-0.5 rounded">PK</span>
                    )}
                  </label>
                  {column.type === 'boolean' ? (
                    <select
                      value={editingRow[column.name]?.toString() || 'false'}
                      onChange={(e) => setEditingRow({
                        ...editingRow,
                        [column.name]: e.target.value === 'true'
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:border-primary"
                      disabled={column.isPrimaryKey}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      type={column.type === 'int8' ? 'number' : 'text'}
                      value={editingRow[column.name] || ''}
                      onChange={(e) => setEditingRow({
                        ...editingRow,
                        [column.name]: column.type === 'int8' ? parseInt(e.target.value) || null : e.target.value
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:border-primary"
                      disabled={column.isPrimaryKey}
                      placeholder={column.nullable ? 'NULL' : ''}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm bg-primary text-black rounded hover:bg-primary/80 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}