import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@flowscript/db';
import { coerceValue, TableSchema, TableRow, ColumnDefinition, ColumnType } from '@flowscript/schema';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
  FilterFn,
} from '@tanstack/react-table';
import { 
  Clock, ArrowUp, ArrowDown, ArrowUpDown, Trash2, Download, 
  Filter, X, Plus, AlertTriangle, ExternalLink, HelpCircle, LayoutDashboard, Database, ListCollapse, Table2
} from 'lucide-react';

// Color palette for select/multiselect tags
const TAG_COLORS = [
  'bg-blue-150 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-150 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-amber-150 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-purple-150 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-pink-150 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-indigo-150 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'bg-cyan-150 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
];

const getTagColor = (option: string) => {
  let hash = 0;
  for (let i = 0; i < option.length; i++) {
    hash = option.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
};

interface DataTableProps {
  searchQuery: string;
  selectedTableId: string | null;
  onSelectTableId: (id: string | null) => void;
  onEditTableId: (id: string | null) => void;
}

// Custom TanStack Table filters
const numericRangeFilterFn: FilterFn<any> = (row, columnId, value) => {
  const rowValue = row.getValue(columnId) as any;
  if (rowValue === undefined || rowValue === null || rowValue === '') return true;
  
  const [min, max] = value as [number | undefined, number | undefined];
  const numValue = Number(rowValue);
  
  if (min !== undefined && numValue < min) return false;
  if (max !== undefined && numValue > max) return false;
  return true;
};

const booleanFilterFn: FilterFn<any> = (row, columnId, value) => {
  const rowValue = row.getValue(columnId) as any;
  if (value === 'all') return true;
  const targetBool = value === 'true';
  return !!rowValue === targetBool;
};

const selectFilterFn: FilterFn<any> = (row, columnId, value) => {
  if (value === 'all') return true;
  const rowValue = row.getValue(columnId) as any;
  if (Array.isArray(rowValue)) {
    return rowValue.includes(value);
  }
  return String(rowValue) === String(value);
};

// Inline Column Header Filter Component
function ColumnFilter({ column, colDef }: { column: any; colDef: ColumnDefinition }) {
  const columnFilterValue = column.getFilterValue();

  if (colDef.type === 'number') {
    return (
      <div className="flex items-center gap-1 mt-2" onClick={e => e.stopPropagation()}>
        <input
          type="number"
          value={(columnFilterValue as [number, number])?.[0] ?? ''}
          onChange={e => column.setFilterValue((old: [number, number]) => [e.target.value ? Number(e.target.value) : undefined, old?.[1]])}
          placeholder="Min"
          className="w-16 px-1.5 py-1 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
        />
        <span className="text-slate-400 dark:text-slate-500">-</span>
        <input
          type="number"
          value={(columnFilterValue as [number, number])?.[1] ?? ''}
          onChange={e => column.setFilterValue((old: [number, number]) => [old?.[0], e.target.value ? Number(e.target.value) : undefined])}
          placeholder="Max"
          className="w-16 px-1.5 py-1 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
        />
      </div>
    );
  }

  if (colDef.type === 'boolean') {
    return (
      <div className="mt-2" onClick={e => e.stopPropagation()}>
        <select
          value={columnFilterValue ?? 'all'}
          onChange={e => column.setFilterValue(e.target.value)}
          className="w-full min-w-[80px] px-1 py-1 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer font-medium"
        >
          <option value="all">All</option>
          <option value="true">Checked (True)</option>
          <option value="false">Unchecked (False)</option>
        </select>
      </div>
    );
  }

  if (['select', 'multiselect'].includes(colDef.type)) {
    return (
      <div className="mt-2" onClick={e => e.stopPropagation()}>
        <select
          value={columnFilterValue ?? 'all'}
          onChange={e => column.setFilterValue(e.target.value)}
          className="w-full min-w-[80px] px-1 py-1 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer font-medium"
        >
          <option value="all">All options</option>
          {(colDef.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="mt-2" onClick={e => e.stopPropagation()}>
      <input
        type="text"
        value={(columnFilterValue ?? '') as string}
        onChange={e => column.setFilterValue(e.target.value)}
        placeholder="Search..."
        className="w-full min-w-[80px] px-2 py-1 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
      />
    </div>
  );
}

const DataTable: React.FC<DataTableProps> = ({ searchQuery, selectedTableId, onSelectTableId, onEditTableId }) => {
  // 1. Fetch tables list for the overview dashboard
  const tablesList = useLiveQuery(() => db.globalTables.toArray()) || [];

  // 2. Fetch specific table schema and rows
  const activeTableSchema = useLiveQuery(() => 
    selectedTableId ? db.globalTables.get(selectedTableId) : Promise.resolve(undefined),
    [selectedTableId]
  );
  
  const activeRows = useLiveQuery(() => 
    selectedTableId ? db.tableRows.where('tableId').equals(selectedTableId).reverse().toArray() : Promise.resolve([]),
    [selectedTableId]
  ) || [];

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Memoize row list for TanStack table
  const tableData = useMemo(() => {
    return activeRows.map((row) => ({
      _rowId: String(row.id),
      _timestamp: row.timestamp,
      _tableId: row.tableId,
      ...(row.data || {})
    }));
  }, [activeRows]);

  // Construct columns based on schema
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!activeTableSchema) return [];

    const cols: ColumnDef<any>[] = [
      {
        id: 'select',
        header: ({ table }) => (
          <div className="px-1">
            <input
              type="checkbox"
              className="cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate" as any)}
              ref={input => {
                if (input) {
                  input.indeterminate = !table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected();
                }
              }}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="px-1">
            <input
              type="checkbox"
              className="cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
            />
          </div>
        ),
        size: 40,
        enableSorting: false,
        enableResizing: false,
      },
      {
        accessorKey: '_timestamp',
        header: 'Created At',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 whitespace-nowrap text-slate-500 font-medium text-xs">
            <Clock size={12} className="text-slate-400" />
            {new Date(row.original._timestamp).toLocaleString()}
          </div>
        ),
        size: 180,
      }
    ];

    activeTableSchema.columns.forEach((colDef) => {
      const isPrice = colDef.name.toLowerCase().includes('price') || colDef.name.toLowerCase().includes('cost');

      cols.push({
        id: colDef.name,
        accessorKey: colDef.name,
        header: () => (
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-800 text-[11px] truncate">{colDef.name}</span>
            <span className="text-[8px] bg-slate-100 text-slate-400 px-1 py-0.5 rounded w-fit font-extrabold uppercase mt-0.5">{colDef.type}</span>
          </div>
        ),
        filterFn: colDef.type === 'number' 
          ? numericRangeFilterFn 
          : colDef.type === 'boolean' 
          ? booleanFilterFn 
          : ['select', 'multiselect'].includes(colDef.type)
          ? selectFilterFn
          : 'includesString',
        cell: ({ getValue }) => {
          const rawVal = getValue();
          
          // Coerce and validate
          const coercion = coerceValue(rawVal, colDef.type, colDef.options);

          return (
            <div className="relative group/cell py-1.5 min-h-[36px] flex items-center">
              {/* Validation Warning badge */}
              {!coercion.success && (
                <div 
                  className="absolute top-0 right-0 p-0.5 text-amber-500 cursor-help"
                  title={`Validation Error: ${coercion.error || 'Mismatched type'}`}
                >
                  <AlertTriangle size={12} className="animate-bounce-subtle" />
                </div>
              )}

              {/* Type-Specific rendering */}
              {colDef.type === 'boolean' ? (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  coercion.success && coercion.value === true 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' 
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {coercion.success && coercion.value === true ? 'Yes' : 'No'}
                </span>
              ) : colDef.type === 'select' ? (
                coercion.value ? (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getTagColor(coercion.value)}`}>
                    {coercion.value}
                  </span>
                ) : (
                  <span className="text-slate-300">-</span>
                )
              ) : colDef.type === 'multiselect' ? (
                Array.isArray(coercion.value) && coercion.value.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {coercion.value.map((opt: string) => (
                      <span key={opt} className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${getTagColor(opt)}`}>
                        {opt}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-300">-</span>
                )
              ) : colDef.type === 'number' ? (
                <span className={`font-mono text-xs text-slate-700 font-bold ${isPrice ? 'text-indigo-600' : ''}`}>
                  {coercion.success && coercion.value !== null
                    ? (isPrice 
                      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(coercion.value) 
                      : coercion.value)
                    : String(rawVal || '')}
                </span>
              ) : colDef.type === 'date' ? (
                <span className="font-mono text-xs text-slate-600">{coercion.value || '-'}</span>
              ) : (
                <span className="text-xs text-slate-600 font-medium whitespace-pre-wrap break-all pr-2">
                  {String(rawVal !== undefined && rawVal !== null ? rawVal : '-')}
                </span>
              )}
            </div>
          );
        },
        size: 160,
      });
    });

    return cols;
  }, [activeTableSchema]);

  const table = useReactTable({
    data: tableData,
    columns,
    getRowId: (row) => row._rowId,
    state: {
      sorting,
      columnFilters,
      globalFilter: searchQuery,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getColumnCanGlobalFilter: () => true,
    enableRowSelection: true,
    columnResizeMode: 'onChange',
  });

  const handleDeleteSelected = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (!selectedRows.length) return;
    
    if (!confirm(`Delete ${selectedRows.length} selected row(s)?`)) return;

    const rowIds = selectedRows.map(r => Number(r.original._rowId));
    await db.tableRows.bulkDelete(rowIds);
    setRowSelection({});
  };

  const handleExportSelected = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (!selectedRows.length || !activeTableSchema) return;

    const headers = activeTableSchema.columns.map(c => c.name);
    const csvContent = [
      ['Created At', ...headers].join(','),
      ...selectedRows.map(row => {
        const rowData = row.original;
        const csvRow = [new Date(rowData._timestamp).toISOString()];
        headers.forEach(h => {
          const val = rowData[h];
          const displayVal = val !== undefined && val !== null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '';
          csvRow.push(`"${displayVal.replace(/"/g, '""')}"`);
        });
        return csvRow.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeTableSchema.name}_selected_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  // --- RENDER OVERVIEW IF NO TABLE SELECTED ---
  if (!selectedTableId) {
    return (
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900/30">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Data Library Overview</h2>
              <p className="text-xs text-slate-400">Select a relational table from the sidebar to inspect, filter, or export its items.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            {tablesList.map((t) => (
              <div 
                key={t.id} 
                onClick={() => onSelectTableId(t.id)}
                className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between h-40"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-base text-slate-700 dark:text-white group-hover:text-indigo-600 transition-colors truncate max-w-[150px]">
                      {t.name}
                    </h3>
                    <Database size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-16 overflow-hidden">
                    {t.columns.slice(0, 4).map(col => (
                      <span key={col.name} className="text-[9px] bg-slate-50 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md font-bold uppercase">
                        {col.name}
                      </span>
                    ))}
                    {t.columns.length > 4 && (
                      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-md font-bold">
                        +{t.columns.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {(t as any).count !== undefined ? (t as any).count : 0} Rows
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Table →
                  </span>
                </div>
              </div>
            ))}

            {tablesList.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-850 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Database size={40} className="mb-2 opacity-20" />
                <p className="font-bold text-sm">No relational tables found</p>
                <p className="text-xs">Linked tables created in the editor will appear here automatically.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER TABLE DATA IF TABLE SELECTED ---
  if (!activeTableSchema) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-white dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const hasSelection = Object.keys(rowSelection).length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/10">
      {/* Table Toolbar Header */}
      <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between bg-white dark:bg-slate-900 backdrop-blur-sm shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onSelectTableId(null)}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
          >
            ← Library
          </button>
          <div className="h-4 w-px bg-slate-250" />
          <h2 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            {activeTableSchema.name}
            <span className="text-[9px] bg-indigo-50 text-indigo-700 dark:bg-indigo-955/30 dark:text-indigo-400 px-1.5 py-0.5 rounded font-extrabold tracking-wider uppercase">
              {activeRows.length} Rows
            </span>
          </h2>
          <button
            onClick={() => onEditTableId(selectedTableId)}
            className="flex items-center gap-1.5 px-3 py-1 bg-pink-50 hover:bg-pink-100 text-pink-600 border border-pink-100 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
          >
            <Table2 size={11} />
            Manage Table ↗
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {table.getFilteredRowModel().rows.length} Filtered
          </span>
        </div>
      </div>

      {/* Bulk actions menu */}
      {hasSelection && (
        <div className="bg-indigo-50/80 dark:bg-indigo-950/10 px-6 py-2.5 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between shrink-0 transition-all select-none">
          <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
            {table.getFilteredSelectedRowModel().rows.length} row(s) selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-sm cursor-pointer"
            >
              <Download size={13} />
              Export CSV
            </button>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors shadow-sm cursor-pointer"
            >
              <Trash2 size={13} />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* TanStack Table rendering */}
      <div className="overflow-auto flex-1 relative bg-white dark:bg-slate-900 custom-scrollbar">
        <table className="text-left border-collapse min-w-full">
          <thead className="sticky top-0 z-15 bg-slate-50 dark:bg-slate-850 shadow-sm border-b border-slate-200 dark:border-slate-850">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const colDef = activeTableSchema.columns.find(c => c.name === header.id);
                  const isNumber = colDef?.type === 'number';

                  return (
                    <th
                      key={header.id}
                      className={`px-5 py-3 text-left font-extrabold align-top border-b border-slate-200 dark:border-slate-800 relative group w-[180px] ${
                        isNumber ? 'text-right' : ''
                      }`}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div className={`flex flex-col ${isNumber ? 'items-end' : 'items-start'}`}>
                          <div 
                            className={`flex items-center gap-1.5 select-none ${header.column.getCanSort() ? 'cursor-pointer hover:text-indigo-600' : ''}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <div className="text-slate-350 dark:text-slate-600 shrink-0">
                                {{
                                  asc: <ArrowUp size={11} className="text-indigo-500" />,
                                  desc: <ArrowDown size={11} className="text-indigo-500" />,
                                }[header.column.getIsSorted() as string] ?? <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                              </div>
                            )}
                          </div>
                          
                          {/* Column Filter Dropdown/Input */}
                          {header.column.getCanFilter() && colDef && (
                            <ColumnFilter column={header.column} colDef={colDef} />
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {table.getRowModel().rows.map(row => (
              <tr 
                key={row.id} 
                className={`transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/20 ${row.getIsSelected() ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}
              >
                {row.getVisibleCells().map(cell => (
                  <td 
                    key={cell.id} 
                    className="px-5 py-2 align-middle max-w-[240px] truncate"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider select-none">
                  No records match current filter rules.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-auto px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-4 shrink-0 select-none">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Showing {table.getRowModel().rows.length} of {tableData.length} records
        </span>
      </div>
    </div>
  );
};

export default DataTable;
