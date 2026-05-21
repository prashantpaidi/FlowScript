import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node, useNodes } from '@xyflow/react';
import { createPortal } from 'react-dom';
import { Table2, Trash2, Plus, Upload, Maximize2, X, AlertCircle, Globe, Link2, PlusCircle } from 'lucide-react';

interface TableNodeData {
  [key: string]: any;
  columns?: string[];
  rows?: Record<string, any>[];
  alias?: string;
  globalSyncEnabled?: boolean;
  globalTableId?: string;
  onUpdate?: (newData: any) => void;
  onRemove?: () => void;
}

interface GlobalTable {
  id: string;
  name: string;
  columns: string[];
  rows: Record<string, any>[];
}

// Simple robust CSV parsing helper
const parseCSV = (text: string) => {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentLine += '""';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
        currentLine += '"';
      }
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else if (char === '\r') {
      // ignore carriage return
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return { columns: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentVal += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    result.push(currentVal.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h, i) => h.replace(/^"|"$/g, '').trim() || `col_${i + 1}`);
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(row);
  }

  return { columns: headers, rows };
};

const DEFAULT_COLUMNS: string[] = ['col1', 'col2'];
const DEFAULT_ROWS: Record<string, any>[] = [{ col1: '', col2: '' }];

export function StaticTableNode({ id, data }: NodeProps<Node<TableNodeData>>) {
  const columns = data.columns || DEFAULT_COLUMNS;
  const rows = data.rows || DEFAULT_ROWS;
  const alias = data.alias || 'Table';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [globalTables, setGlobalTables] = useState<GlobalTable[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const allNodes = useNodes();

  const otherTableNodes = useMemo(() => {
    return allNodes.filter(n => n.type === 'staticTableNode' && n.id !== id);
  }, [allNodes, id]);

  // Load global tables from storage on mount
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    chrome.storage.local.get('local:globalTables')
      .then(res => {
        setGlobalTables((res['local:globalTables'] || []) as GlobalTable[]);
      })
      .catch(err => console.error('Failed to load global tables:', err));

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes['local:globalTables']) {
        setGlobalTables((changes['local:globalTables'].newValue || []) as GlobalTable[]);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Listen to external global table changes and sync them with our local node data
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    if (data.globalSyncEnabled && data.globalTableId) {
      const matchedTable = globalTables.find(t => t.id === data.globalTableId);
      if (matchedTable) {
        const columnsChanged = JSON.stringify(matchedTable.columns) !== JSON.stringify(columns);
        const rowsChanged = JSON.stringify(matchedTable.rows) !== JSON.stringify(rows);
        if (columnsChanged || rowsChanged) {
          data.onUpdate?.({
            columns: matchedTable.columns,
            rows: matchedTable.rows
          });
        }
      }
    }
  }, [data.globalSyncEnabled, data.globalTableId, globalTables, columns, rows]);

  // Initial load when turning sync on or changing selected table
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    if (data.globalSyncEnabled && data.globalTableId) {
      chrome.storage.local.get('local:globalTables')
        .then(res => {
          const globalTablesList = (res['local:globalTables'] || []) as GlobalTable[];
          const matchedTable = globalTablesList.find(t => t.id === data.globalTableId);
          if (matchedTable) {
            const columnsChanged = JSON.stringify(matchedTable.columns) !== JSON.stringify(columns);
            const rowsChanged = JSON.stringify(matchedTable.rows) !== JSON.stringify(rows);
            if (columnsChanged || rowsChanged) {
              data.onUpdate?.({
                columns: matchedTable.columns,
                rows: matchedTable.rows
              });
            }
          }
        })
        .catch(err => console.error('Failed to sync global table:', err));
    }
  }, [data.globalSyncEnabled, data.globalTableId]);

  const updateTableData = async (newCols: string[], newRows: Record<string, any>[]) => {
    data.onUpdate?.({ columns: newCols, rows: newRows });

    // Update global storage if sync is active
    if (data.globalSyncEnabled && data.globalTableId && typeof chrome !== 'undefined' && chrome.storage) {
      const updatedTables = globalTables.map(t => {
        if (t.id === data.globalTableId) {
          return {
            ...t,
            columns: newCols,
            rows: newRows
          };
        }
        return t;
      });
      await chrome.storage.local.set({ 'local:globalTables': updatedTables })
        .catch(err => console.error('Failed to save global tables:', err));
    }
  };

  const handleCreateGlobalTable = async () => {
    const name = prompt("Enter a name for the new global table:", alias || "New Global Table");
    if (!name) return;

    const newId = crypto.randomUUID();
    const newGlobalTable: GlobalTable = {
      id: newId,
      name,
      columns: [...columns],
      rows: [...rows]
    };

    const updatedTables = [...globalTables, newGlobalTable];
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ 'local:globalTables': updatedTables })
        .catch(err => console.error('Failed to save created global table:', err));
    }
    
    data.onUpdate?.({
      globalSyncEnabled: true,
      globalTableId: newId,
      alias: name // update alias to match global table name
    });
  };

  // Grid editing helpers
  const handleCellChange = (rowIndex: number, colName: string, value: any) => {
    const newRows = [...rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colName]: value };
    updateTableData(columns, newRows);
  };

  const renameColumn = (oldName: string, newName: string) => {
    newName = newName.trim();
    if (!newName || oldName === newName) return;

    // Prevent duplicate column names
    if (columns.includes(newName)) {
      alert(`A column named "${newName}" already exists.`);
      return;
    }

    const newColumns = columns.map(c => c === oldName ? newName : c);
    const newRows = rows.map(row => {
      const newRow = { ...row };
      newRow[newName] = newRow[oldName] !== undefined ? newRow[oldName] : '';
      delete newRow[oldName];
      return newRow;
    });

    updateTableData(newColumns, newRows);
  };

  const addColumn = () => {
    let base = 'col';
    let index = columns.length + 1;
    let newColName = `${base}_${index}`;
    while (columns.includes(newColName)) {
      index++;
      newColName = `${base}_${index}`;
    }
    const newColumns = [...columns, newColName];
    const newRows = rows.map(row => ({ ...row, [newColName]: '' }));
    updateTableData(newColumns, newRows);
  };

  const deleteColumn = (colName: string) => {
    if (columns.length <= 1) {
      alert('A table must have at least one column.');
      return;
    }
    const newColumns = columns.filter(c => c !== colName);
    const newRows = rows.map(row => {
      const newRow = { ...row };
      delete newRow[colName];
      return newRow;
    });
    updateTableData(newColumns, newRows);
  };

  const addRow = () => {
    const newRow: Record<string, any> = {};
    columns.forEach(col => { newRow[col] = ''; });
    updateTableData(columns, [...rows, newRow]);
  };

  const deleteRow = (rowIndex: number) => {
    const newRows = rows.filter((_, idx) => idx !== rowIndex);
    updateTableData(columns, newRows);
  };

  // CSV Import handler
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      try {
        const { columns: parsedCols, rows: parsedRows } = parseCSV(text);
        if (parsedCols.length > 0) {
          updateTableData(parsedCols, parsedRows);
        } else {
          alert('CSV format error: No columns found');
        }
      } catch (err) {
        alert('Failed to parse CSV file: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Clipboard Paste handler (for Excel/Google Sheets TSV data)
  const handleCellPaste = (e: React.ClipboardEvent, rowIndex: number, colName: string) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.includes('\t') || pastedText.includes('\n')) {
      e.preventDefault();
      const rowsText = pastedText.split(/\r?\n/).filter(line => line.length > 0);
      const updatedRows = [...rows];

      rowsText.forEach((rowText, rOffset) => {
        const targetRowIndex = rowIndex + rOffset;
        if (targetRowIndex >= updatedRows.length) {
          const newRow: Record<string, any> = {};
          columns.forEach(col => { newRow[col] = ''; });
          updatedRows.push(newRow);
        }

        const colsText = rowText.split('\t');
        colsText.forEach((cellVal, cOffset) => {
          const startColIndex = columns.indexOf(colName);
          if (startColIndex !== -1) {
            const targetColIndex = startColIndex + cOffset;
            if (targetColIndex < columns.length) {
              const targetColName = columns[targetColIndex];
              updatedRows[targetRowIndex] = {
                ...updatedRows[targetRowIndex],
                [targetColName]: cellVal.trim(),
              };
            }
          }
        });
      });

      updateTableData(columns, updatedRows);
    }
  };

  return (
    <div className="bg-white border-2 border-pink-400 rounded-xl shadow-xl min-w-[300px] overflow-hidden group/node">
      {/* Node Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-600 p-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
            <Table2 size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 leading-none">Data Source</span>
            <span className="font-bold text-sm tracking-tight">Static Table</span>
          </div>
        </div>
        <div className="flex-1 px-4">
          <input
            type="text"
            className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/30 text-[10px] text-white placeholder-pink-200 border-none rounded px-2 py-1 outline-none transition-colors font-medium"
            placeholder="Node Alias"
            value={alias}
            onChange={(e) => {
              const newAlias = e.target.value;
              data.onUpdate?.({ alias: newAlias });
              if (data.globalSyncEnabled && data.globalTableId && typeof chrome !== 'undefined' && chrome.storage) {
                const updatedTables = globalTables.map(t => {
                  if (t.id === data.globalTableId) {
                    return { ...t, name: newAlias };
                  }
                  return t;
                });
                chrome.storage.local.set({ 'local:globalTables': updatedTables })
                  .catch(err => console.error('Failed to update global table alias:', err));
              }
            }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-1 hover:bg-white/20 rounded-md transition-colors text-white/80 hover:text-white"
            title="Edit Table"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={() => data.onRemove?.()}
            className="p-1 hover:bg-white/20 rounded-md transition-colors text-white/80 hover:text-white"
            title="Remove Node"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Mini-View (Canvas preview) */}
      <div className="p-3 bg-white">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-400 border border-dashed border-slate-100 rounded-lg">
            <AlertCircle size={16} className="mb-1 text-slate-300" />
            <span className="text-[10px] italic">Table is empty</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-[10px] text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {columns.slice(0, 3).map((col, idx) => (
                      <th key={idx} className="p-1.5 text-left font-bold truncate max-w-[80px]">
                        {col}
                      </th>
                    ))}
                    {columns.length > 3 && <th className="p-1.5 text-left font-bold">...</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-slate-50 last:border-none hover:bg-slate-50/50">
                      {columns.slice(0, 3).map((col, cIdx) => (
                        <td key={cIdx} className="p-1.5 truncate max-w-[80px]">
                          {row[col] !== undefined ? String(row[col]) : ''}
                        </td>
                      ))}
                      {columns.length > 3 && <td className="p-1.5 text-slate-400">...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-[9px] text-slate-400 px-0.5">
              <span>{columns.length} columns × {rows.length} rows</span>
              {rows.length > 3 && (
                <span className="font-semibold text-pink-500">
                  + {rows.length - 3} more rows
                </span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-3 w-full bg-slate-50 hover:bg-pink-50 hover:text-pink-600 text-slate-600 border border-slate-100 hover:border-pink-100 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Table2 size={12} />
          Edit Table Data
        </button>

        {/* Global Sync Section */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Globe size={11} className={data.globalSyncEnabled ? "text-pink-500 animate-pulse" : "text-slate-400"} />
              Global Sync
            </span>
            <button
              onClick={() => {
                data.onUpdate?.({
                  globalSyncEnabled: !data.globalSyncEnabled,
                });
              }}
              className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                data.globalSyncEnabled
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {data.globalSyncEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {data.globalSyncEnabled && (
            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <select
                value={data.globalTableId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__new__') {
                    handleCreateGlobalTable();
                  } else {
                    const matched = globalTables.find(t => t.id === val);
                    data.onUpdate?.({
                      globalTableId: val,
                      columns: matched?.columns || columns,
                      rows: matched?.rows || rows
                    });
                  }
                }}
                className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 outline-none text-slate-600 font-bold focus:ring-1 focus:ring-pink-500/20 cursor-pointer"
              >
                <option value="" disabled>Select global table...</option>
                {globalTables.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value="__new__" className="text-pink-600 font-bold">+ Create New...</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} id="trigger-in" className="w-2.5 h-2.5 border-2 border-white bg-pink-500" />
      <Handle type="source" position={Position.Right} id="trigger-out" className="w-2.5 h-2.5 border-2 border-white bg-pink-500" />

      {/* Full-Screen Data Editor Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-[95vw] max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-pink-100 text-pink-600 p-2 rounded-lg">
                  <Table2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-sm">Spreadsheet Table Editor</h3>
                    {data.globalSyncEnabled && (
                      <span className="bg-pink-100 text-pink-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Globe size={10} className="animate-spin-slow" />
                        Globally Synced
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {data.globalSyncEnabled ? 'Editing shared global table data' : 'Configure columns and enter static mock data'}
                  </p>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-3">
                
                {/* Clone Table Dropdown */}
                {otherTableNodes.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Clone Table:</span>
                    <select
                      className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none text-slate-600 font-bold"
                      defaultValue=""
                      onChange={(e) => {
                        const selectedNodeId = e.target.value;
                        const selectedNode = otherTableNodes.find(n => n.id === selectedNodeId);
                        if (selectedNode) {
                          const nodeData = selectedNode.data as TableNodeData;
                          const newCols = nodeData.columns || ['col1', 'col2'];
                          const newRows = nodeData.rows || [{ col1: '', col2: '' }];
                          updateTableData(newCols, newRows);
                        }
                        e.target.value = ''; // Reset
                      }}
                    >
                      <option value="" disabled>Select...</option>
                      {otherTableNodes.map(n => (
                        <option key={n.id} value={n.id}>
                          {(n.data as any).alias || `Table (${n.id.slice(0, 4)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* CSV Import */}
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleCSVImport}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Upload size={13} className="text-slate-400" />
                  Import CSV
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content - Table Grid */}
            <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-50">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full border-collapse text-xs text-slate-700">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {columns.map((col, colIdx) => (
                        <th key={colIdx} className="p-0 border-r border-slate-200 min-w-[150px] relative group/header">
                          <div className="flex items-center">
                            <input
                              type="text"
                              value={col}
                              onChange={(e) => renameColumn(col, e.target.value)}
                              className="w-full bg-transparent p-2.5 font-bold text-slate-700 border-none focus:outline-none focus:bg-slate-100 transition-colors"
                              title="Double click to rename column"
                            />
                            <button
                              onClick={() => deleteColumn(col)}
                              className="absolute right-2 opacity-0 group-hover/header:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
                              title="Delete column"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="p-2 text-left w-12 border-none"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-slate-150 hover:bg-slate-50/30">
                        {columns.map((col, cIdx) => (
                          <td key={cIdx} className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              value={row[col] !== undefined ? String(row[col]) : ''}
                              onChange={(e) => handleCellChange(rIdx, col, e.target.value)}
                              onPaste={(e) => handleCellPaste(e, rIdx, col)}
                              className="w-full bg-transparent p-2 border-none outline-none font-mono text-slate-600 focus:bg-pink-50/30 focus:ring-1 focus:ring-pink-500/20"
                            />
                          </td>
                        ))}
                        <td className="p-2 text-center w-12 border-none">
                          <button
                            onClick={() => deleteRow(rIdx)}
                            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete row"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={addColumn}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Plus size={13} className="text-slate-400" />
                  Add Column
                </button>
                <button
                  onClick={addRow}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Plus size={13} />
                  Add Row
                </button>
              </div>

              <div className="text-[10px] text-slate-400 font-medium italic flex items-center gap-1">
                <span>Tip: You can copy data from Excel/Google Sheets and paste directly into any grid cell.</span>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
