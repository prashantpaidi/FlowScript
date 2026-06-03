
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@flowscript/db';
import { coerceValue, TableSchema, TableRow, ColumnType, ColumnDefinition } from '@flowscript/schema';
import { 
  Table2, Trash2, Plus, Upload, X, Globe, Settings, AlertTriangle
} from 'lucide-react';

// Color palette for select/multiselect tags
const TAG_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
];

const getTagColor = (option: string) => {
  let hash = 0;
  for (let i = 0; i < option.length; i++) {
    hash = option.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
};

// CSV parsing helper
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
      // ignore
    } else {
      currentLine += char;
    }
  }
  if (currentLine) lines.push(currentLine);
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
          i++;
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

// CSV Type Inference
const inferColumnTypes = (headers: string[], rows: Record<string, any>[]): ColumnDefinition[] => {
  const sampleSize = Math.min(rows.length, 20);
  return headers.map(header => {
    let numCount = 0;
    let boolCount = 0;
    let dateCount = 0;
    let emptyCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      const val = String(rows[i][header] || '').trim();
      if (!val) {
        emptyCount++;
        continue;
      }

      // Check numeric
      if (!isNaN(Number(val)) && isFinite(Number(val))) {
        numCount++;
      }

      // Check boolean
      const lower = val.toLowerCase();
      if (['true', 'false', 'yes', 'no', '1', '0'].includes(lower)) {
        boolCount++;
      }

      // Check date (exclude small numbers that new Date parses as timestamps)
      if (isNaN(Number(val)) && !isNaN(Date.parse(val))) {
        dateCount++;
      }
    }

    const validSamples = sampleSize - emptyCount;
    let type: ColumnType = 'text';

    if (validSamples > 0) {
      if (numCount === validSamples) type = 'number';
      else if (boolCount === validSamples) type = 'boolean';
      else if (dateCount === validSamples) type = 'date';
    }

    return { name: header, type };
  });
};

interface TableEditorModalProps {
  tableId: string | null;
  onClose: () => void;
}

export function TableEditorModal({ tableId, onClose }: TableEditorModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeHeaderConfig, setActiveHeaderConfig] = useState<{ colIdx: number; element: HTMLElement } | null>(null);
  const [newOptionVal, setNewOptionVal] = useState('');

  // Synchronize data from Dexie
  const activeTable = useLiveQuery(() => 
    tableId ? db.globalTables.get(tableId) : Promise.resolve(undefined),
    [tableId]
  );
  const activeRows = useLiveQuery(() => 
    tableId ? db.tableRows.where('tableId').equals(tableId).toArray() : Promise.resolve([]),
    [tableId]
  ) || [];

  if (!tableId || !activeTable) {
    return null;
  }

  const handleCellChange = async (rowIndex: number, colName: string, value: any) => {
    const rowToUpdate = activeRows[rowIndex];
    if (!rowToUpdate) return;

    const updatedData = { ...rowToUpdate.data, [colName]: value };
    await db.tableRows.update(rowToUpdate.id!, {
      data: updatedData,
      timestamp: Date.now()
    });
  };

  const handleAddColumn = async () => {
    let base = 'Col';
    let index = activeTable.columns.length + 1;
    let newColName = `${base}_${index}`;
    while (activeTable.columns.some(c => c.name === newColName)) {
      index++;
      newColName = `${base}_${index}`;
    }

    const updatedColumns = [...activeTable.columns, { name: newColName, type: 'text' as ColumnType }];
    await db.globalTables.update(activeTable.id, {
      columns: updatedColumns,
      updatedAt: Date.now()
    });

    // Backfill empty value for new column in all rows
    for (const r of activeRows) {
      await db.tableRows.update(r.id!, {
        data: { ...r.data, [newColName]: '' }
      });
    }
  };

  const handleDeleteColumn = async (colName: string) => {
    if (activeTable.columns.length <= 1) {
      alert("A table must have at least one column.");
      return;
    }
    const updatedColumns = activeTable.columns.filter(c => c.name !== colName);
    await db.globalTables.update(activeTable.id, {
      columns: updatedColumns,
      updatedAt: Date.now()
    });

    // Remove property from all rows
    for (const r of activeRows) {
      const updatedData = { ...r.data };
      delete updatedData[colName];
      await db.tableRows.update(r.id!, {
        data: updatedData
      });
    }
    setActiveHeaderConfig(null);
  };

  const handleAddRow = async () => {
    const newRowData: Record<string, any> = {};
    activeTable.columns.forEach(c => {
      newRowData[c.name] = '';
    });

    await db.tableRows.add({
      tableId,
      timestamp: Date.now(),
      data: newRowData
    });
  };

  const handleDeleteRow = async (rowId: number) => {
    await db.tableRows.delete(rowId);
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const { columns: parsedCols, rows: parsedRows } = parseCSV(text);
        if (parsedCols.length === 0) {
          alert('CSV format error: No columns found');
          return;
        }

        // Infer Column Types
        const inferredColumns = inferColumnTypes(parsedCols, parsedRows);

        // Update Schema
        await db.globalTables.update(tableId, {
          columns: inferredColumns,
          updatedAt: Date.now()
        });

        // Clear existing rows and import new ones
        const existingIds = activeRows.map(r => r.id!);
        await db.tableRows.bulkDelete(existingIds);

        const newRowsToAdd = parsedRows.map(row => ({
          tableId,
          timestamp: Date.now(),
          data: row
        }));
        await db.tableRows.bulkAdd(newRowsToAdd);

      } catch (err) {
        alert('Failed to parse CSV file: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Coercion validator utility for cell styling
  const getCoercedCellInfo = (rawValue: any, column: ColumnDefinition) => {
    const res = coerceValue(rawValue, column.type, column.options);
    return {
      isValid: res.success,
      value: rawValue !== undefined && rawValue !== null ? String(rawValue) : '',
      error: res.error
    };
  };

  return createPortal(
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
                <h3 className="font-bold text-slate-800 text-sm">{activeTable.name}</h3>
                <span className="bg-pink-100 text-pink-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <Globe size={10} className="animate-spin-slow" />
                  Relational Table Schema
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Configure column types and edit table data. Changes are written to IndexedDB.
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
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
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Upload size={13} className="text-slate-400" />
              Import CSV & Infer Types
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content - Table Grid */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-50 relative">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full border-collapse text-xs text-slate-700 table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {activeTable.columns.map((col, colIdx) => (
                    <th key={colIdx} className="p-0 border-r border-slate-200 w-[200px] relative group/header text-left">
                      <div className="flex items-center justify-between p-2.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-slate-700 truncate">{col.name}</span>
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded uppercase font-extrabold">{col.type}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            const target = e.currentTarget.parentElement?.parentElement;
                            if (target) {
                              setActiveHeaderConfig({ colIdx, element: target });
                            }
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <Settings size={12} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 text-left w-12 border-none bg-slate-50"></th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, rIdx) => {
                  const rowData = row.data || {};
                  return (
                    <tr key={row.id || rIdx} className="border-b border-slate-150 hover:bg-slate-50/30">
                      {activeTable.columns.map((col, cIdx) => {
                        const rawValue = rowData[col.name];
                        const coerced = getCoercedCellInfo(rawValue, col);

                        return (
                          <td key={cIdx} className="p-2 border-r border-slate-200 relative group/cell min-h-[40px]">
                            {/* Warning Triangle for validation failure */}
                            {!coerced.isValid && (
                              <div className="absolute top-0 right-0 p-0.5 cursor-help z-10" title={coerced.error}>
                                <AlertTriangle size={10} className="text-amber-500" />
                              </div>
                            )}

                            {/* Cell Editor */}
                            {col.type === 'boolean' ? (
                              <input
                                type="checkbox"
                                checked={!!coerced.isValid && rawValue === true}
                                onChange={(e) => handleCellChange(rIdx, col.name, e.target.checked)}
                                className="rounded border-slate-300 text-pink-600 focus:ring-pink-500 cursor-pointer"
                              />
                            ) : col.type === 'select' ? (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={rawValue || ''}
                                  onChange={(e) => handleCellChange(rIdx, col.name, e.target.value)}
                                  className="w-full bg-transparent border-none outline-none font-medium py-0.5 cursor-pointer text-slate-700"
                                >
                                  <option value="">Select option...</option>
                                  {(col.options || []).map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                                {rawValue && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getTagColor(rawValue)}`}>
                                    Pill
                                  </span>
                                )}
                              </div>
                            ) : col.type === 'multiselect' ? (
                              <div className="flex flex-wrap gap-1 items-center">
                                {/* Render pills */}
                                {Array.isArray(rawValue) ? (
                                  rawValue.map(opt => (
                                    <span key={opt} className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold flex items-center gap-1 ${getTagColor(opt)}`}>
                                      {opt}
                                      <button
                                        onClick={() => {
                                          const nextArr = rawValue.filter(x => x !== opt);
                                          handleCellChange(rIdx, col.name, nextArr);
                                        }}
                                        className="hover:bg-black/10 rounded-full p-0.5 cursor-pointer"
                                      >
                                        <X size={8} />
                                      </button>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400">No items.</span>
                                )}

                                {/* Inline Selector */}
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                      const prev = Array.isArray(rawValue) ? rawValue : [];
                                      if (!prev.includes(val)) {
                                        handleCellChange(rIdx, col.name, [...prev, val]);
                                      }
                                    }
                                  }}
                                  className="text-[9px] bg-slate-100 border-none rounded p-0.5 outline-none font-medium cursor-pointer"
                                >
                                  <option value="">+ Add Tag</option>
                                  {(col.options || []).map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>
                            ) : col.type === 'date' ? (
                              <input
                                type="date"
                                value={rawValue || ''}
                                onChange={(e) => handleCellChange(rIdx, col.name, e.target.value)}
                                className="w-full bg-transparent border-none outline-none font-mono text-slate-700"
                              />
                            ) : col.type === 'number' ? (
                              <input
                                type="number"
                                value={rawValue !== undefined && rawValue !== null ? String(rawValue) : ''}
                                onChange={(e) => {
                                  const numVal = e.target.value === '' ? '' : Number(e.target.value);
                                  handleCellChange(rIdx, col.name, numVal);
                                }}
                                className="w-full bg-transparent border-none outline-none font-mono text-slate-700"
                              />
                            ) : (
                              <input
                                type="text"
                                value={rawValue !== undefined && rawValue !== null ? String(rawValue) : ''}
                                onChange={(e) => handleCellChange(rIdx, col.name, e.target.value)}
                                className="w-full bg-transparent border-none outline-none font-sans text-slate-700 focus:bg-pink-50/20"
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center w-12 border-none">
                        <button
                          onClick={() => handleDeleteRow(row.id!)}
                          className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Delete row"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Column Configurer Popover Portal */}
          {activeHeaderConfig && (() => {
            const colIdx = activeHeaderConfig.colIdx;
            const column = activeTable.columns[colIdx];
            const rect = activeHeaderConfig.element.getBoundingClientRect();

            return createPortal(
              <div 
                className="fixed z-[10000] bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-60 animate-in fade-in slide-in-from-top-2 duration-150"
                style={{
                  top: rect.bottom + window.scrollY + 6,
                  left: rect.left + window.scrollX
                }}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <span className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Column Config</span>
                  <button 
                    onClick={() => setActiveHeaderConfig(null)} 
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Name input */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Column Name</label>
                    <input
                      type="text"
                      value={column.name}
                      onChange={async (e) => {
                        const newName = e.target.value.trim();
                        if (!newName) return;
                        const updatedColumns = [...activeTable.columns];
                        
                        // Prevent collisions
                        if (updatedColumns.some((c, idx) => c.name === newName && idx !== colIdx)) {
                          return;
                        }

                        const oldName = column.name;
                        updatedColumns[colIdx] = { ...column, name: newName };

                        await db.globalTables.update(activeTable.id, {
                          columns: updatedColumns,
                          updatedAt: Date.now()
                        });

                        // Rename row properties
                        for (const r of activeRows) {
                          const updatedData = { ...r.data };
                          updatedData[newName] = updatedData[oldName];
                          delete updatedData[oldName];
                          await db.tableRows.update(r.id!, { data: updatedData });
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-pink-500 focus:bg-white"
                    />
                  </div>

                  {/* Column Type Select */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Data Type</label>
                    <select
                      value={column.type}
                      onChange={async (e) => {
                        const updatedColumns = [...activeTable.columns];
                        updatedColumns[colIdx] = { ...column, type: e.target.value as ColumnType };

                        await db.globalTables.update(activeTable.id, {
                          columns: updatedColumns,
                          updatedAt: Date.now()
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none cursor-pointer focus:border-pink-500 focus:bg-white"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Checkbox/Boolean</option>
                      <option value="date">Date</option>
                      <option value="select">Select Dropdown</option>
                      <option value="multiselect">Multi-Select Dropdown</option>
                    </select>
                  </div>

                  {/* Select/Multi-select options configurator */}
                  {['select', 'multiselect'].includes(column.type) && (
                    <div className="pt-2 border-t border-slate-100">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Dropdown Options</label>
                      <div className="max-h-24 overflow-y-auto space-y-1 mb-2 custom-scrollbar">
                        {(column.options || []).map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center justify-between bg-slate-55 px-2 py-1 rounded text-[10px] font-semibold text-slate-655">
                            <span className="truncate">{opt}</span>
                            <button
                              onClick={async () => {
                                const nextOpts = (column.options || []).filter((_, idx) => idx !== oIdx);
                                const updatedColumns = [...activeTable.columns];
                                updatedColumns[colIdx] = { ...column, options: nextOpts };
                                await db.globalTables.update(activeTable.id, { columns: updatedColumns });
                              }}
                              className="text-slate-400 hover:text-red-500 cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        {(column.options || []).length === 0 && (
                          <span className="text-[10px] text-slate-400 italic">No options added yet</span>
                        )}
                      </div>

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="New option..."
                          value={newOptionVal}
                          onChange={(e) => setNewOptionVal(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] outline-none"
                        />
                        <button
                          onClick={async () => {
                            const trimmed = newOptionVal.trim();
                            if (!trimmed) return;
                            const prev = column.options || [];
                            if (prev.includes(trimmed)) return;
                            const updatedColumns = [...activeTable.columns];
                            updatedColumns[colIdx] = { ...column, options: [...prev, trimmed] };
                            await db.globalTables.update(activeTable.id, { columns: updatedColumns });
                            setNewOptionVal('');
                          }}
                          className="bg-pink-600 text-white px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Menu */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => handleDeleteColumn(column.name)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded text-[10px] font-bold transition-all cursor-pointer"
                    >
                      <Trash2 size={12} />
                      Delete Column
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            );
          })()}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddColumn}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={13} className="text-slate-400" />
              Add Column
            </button>
            <button
              onClick={handleAddRow}
              className="bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={13} />
              Add Row
            </button>
          </div>

          <div className="text-[10px] text-slate-400 font-medium italic flex items-center gap-1 select-none">
            <span>Cell with mismatch flags <span className="inline-block w-2 h-2 bg-amber-500 rounded-sm inline-align" /> uses soft coercion on read.</span>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
