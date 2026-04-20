import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../src/db/database';
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
import { ExternalLink, Clock, Globe, Hash, ArrowUp, ArrowDown, ArrowUpDown, Trash2, Download, Filter, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';

// --- Filter AST Types ---
type Operator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'gt' | 'lt' | 'gte' | 'lte' | 'startsWith' | 'endsWith';
type Logic = 'AND' | 'OR';

interface FilterRule {
    id: string;
    type: 'rule';
    field: string;
    operator: Operator;
    value: any;
}

interface FilterGroup {
    id: string;
    type: 'group';
    logic: Logic;
    rules: (FilterRule | FilterGroup)[];
}

const evaluateAST = (item: any, node: FilterRule | FilterGroup): boolean => {
    if (node.type === 'rule') {
        const itemValue = item[node.field];
        const ruleValue = node.value;

        switch (node.operator) {
            case 'equals': return itemValue == ruleValue;
            case 'notEquals': return itemValue != ruleValue;
            case 'contains': return String(itemValue).toLowerCase().includes(String(ruleValue).toLowerCase());
            case 'notContains': return !String(itemValue).toLowerCase().includes(String(ruleValue).toLowerCase());
            case 'gt': return Number(itemValue) > Number(ruleValue);
            case 'lt': return Number(itemValue) < Number(ruleValue);
            case 'gte': return Number(itemValue) >= Number(ruleValue);
            case 'lte': return Number(itemValue) <= Number(ruleValue);
            case 'startsWith': return String(itemValue).toLowerCase().startsWith(String(ruleValue).toLowerCase());
            case 'endsWith': return String(itemValue).toLowerCase().endsWith(String(ruleValue).toLowerCase());
            default: return true;
        }
    } else {
        if (node.rules.length === 0) return true;
        if (node.logic === 'AND') {
            return node.rules.every(rule => evaluateAST(item, rule));
        } else {
            return node.rules.some(rule => evaluateAST(item, rule));
        }
    }
};

interface DataTableProps {
    searchQuery: string;
    selectedDataset: string | null;
}

// Custom filter function for numeric ranges
const numericRangeFilterFn: FilterFn<any> = (row, columnId, value, addMeta) => {
    const rowValue = row.getValue(columnId) as any;
    if (typeof rowValue !== 'number') return true;
    
    // value is an array like [min, max]
    const [min, max] = value as [number | undefined, number | undefined];
    
    if (min !== undefined && rowValue < min) return false;
    if (max !== undefined && rowValue > max) return false;
    return true;
};

// Inline Header Filter Component
function ColumnFilter({ column }: { column: any }) {
    const columnFilterValue = column.getFilterValue();
    const { filterVariant } = column.columnDef.meta ?? {};

    if (filterVariant === 'range') {
        return (
            <div className="flex items-center gap-1 mt-2">
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

    return (
        <div className="mt-2">
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
// --- Filter Builder UI Components ---

const OPERATORS: { label: string; value: Operator }[] = [
    { label: 'Equals', value: 'equals' },
    { label: 'Not Equals', value: 'notEquals' },
    { label: 'Contains', value: 'contains' },
    { label: 'Not Contains', value: 'notContains' },
    { label: 'Greater Than', value: 'gt' },
    { label: 'Less Than', value: 'lt' },
    { label: 'Greater or Equal', value: 'gte' },
    { label: 'Less or Equal', value: 'lte' },
    { label: 'Starts With', value: 'startsWith' },
    { label: 'Ends With', value: 'endsWith' },
];

const RuleView: React.FC<{
    rule: FilterRule;
    fields: string[];
    onUpdate: (updates: Partial<FilterRule>) => void;
    onRemove: () => void;
}> = ({ rule, fields, onUpdate, onRemove }) => {
    return (
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md grow">
            <select
                value={rule.field}
                onChange={(e) => onUpdate({ field: e.target.value })}
                className="bg-transparent border-none text-[12px] font-semibold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer"
            >
                {fields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <select
                value={rule.operator}
                onChange={(e) => onUpdate({ operator: e.target.value as Operator })}
                className="bg-slate-50 dark:bg-slate-900 border-none rounded px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 focus:ring-0 outline-none cursor-pointer"
            >
                {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>

            <input
                type="text"
                value={rule.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder="Value..."
                className="bg-slate-50 dark:bg-slate-900 border-none rounded px-2 py-1 text-[12px] text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500/20 outline-none grow"
            />

            <button onClick={onRemove} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded transition-colors">
                <X size={14} />
            </button>
        </div>
    );
};

const GroupView: React.FC<{
    group: FilterGroup;
    fields: string[];
    onUpdate: (updates: Partial<FilterGroup>) => void;
    onRemove?: () => void;
    depth?: number;
}> = ({ group, fields, onUpdate, onRemove, depth = 0 }) => {
    const addRule = () => {
        onUpdate({
            rules: [...group.rules, { id: crypto.randomUUID(), type: 'rule', field: fields[0], operator: 'contains', value: '' }]
        });
    };

    const addGroup = () => {
        onUpdate({
            rules: [...group.rules, { id: crypto.randomUUID(), type: 'group', logic: 'AND', rules: [] }]
        });
    };

    const updateItem = (id: string, updates: any) => {
        onUpdate({
            rules: group.rules.map(r => r.id === id ? { ...r, ...updates } : r)
        });
    };

    const removeItem = (id: string) => {
        onUpdate({
            rules: group.rules.filter(r => r.id !== id)
        });
    };

    return (
        <div className={`flex flex-col gap-3 p-4 rounded-xl border ${depth === 0 ? 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30' : 'border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-indigo-900/10'}`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button
                        onClick={() => onUpdate({ logic: 'AND' })}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${group.logic === 'AND' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        AND
                    </button>
                    <button
                        onClick={() => onUpdate({ logic: 'OR' })}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${group.logic === 'OR' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        OR
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={addRule} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm">
                        <Plus size={12} /> Add Rule
                    </button>
                    <button onClick={addGroup} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm">
                        <Plus size={12} /> Add Group
                    </button>
                    {onRemove && (
                        <button onClick={onRemove} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-3 pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/50 ml-6">
                {group.rules.map(rule => (
                    rule.type === 'rule' ? (
                        <RuleView
                            key={rule.id}
                            rule={rule}
                            fields={fields}
                            onUpdate={(upd) => updateItem(rule.id, upd)}
                            onRemove={() => removeItem(rule.id)}
                        />
                    ) : (
                        <GroupView
                            key={rule.id}
                            group={rule}
                            fields={fields}
                            onUpdate={(upd) => updateItem(rule.id, upd)}
                            onRemove={() => removeItem(rule.id)}
                            depth={depth + 1}
                        />
                    )
                ))}
                {group.rules.length === 0 && (
                    <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Empty Group</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const DataTable: React.FC<DataTableProps> = ({ searchQuery, selectedDataset }) => {
    const records = useLiveQuery(
        () => {
            const query = selectedDataset
                ? db.scrapedRecords.where('datasetName').equals(selectedDataset).reverse()
                : db.scrapedRecords.reverse();
            return query.toArray();
        },
        [selectedDataset]
    );

    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [filterRoot, setFilterRoot] = useState<FilterGroup>({
        id: 'root',
        type: 'group',
        logic: 'AND',
        rules: []
    });

    const tableData = useMemo(() => {
        if (!records) return [];

        let data = records.flatMap((record) => {
            if (Array.isArray(record.data)) {
                return record.data.map((item, itemIdx) => ({
                    ...item, // Scraped data first
                    ...record, // Metadata second (overwrites collisions with correct values)
                    _rowId: `${record.id}-${itemIdx}`,
                    _originalData: item
                }));
            }
            return [{
                ...(typeof record.data === 'object' ? record.data : {}), // Scraped data first
                ...record, // Metadata second
                _rowId: `${record.id}-0`,
                _originalData: record.data
            }];
        });

        // Apply Advanced Filters
        if (filterRoot.rules.length > 0) {
            data = data.filter(item => evaluateAST(item, filterRoot));
        }

        return data;
    }, [records, filterRoot]);

    const dynamicKeys = useMemo(() => {
        if (!records) return [];
        return Array.from(new Set(
            tableData.flatMap(row => {
                if (row._originalData && typeof row._originalData === 'object' && !Array.isArray(row._originalData)) {
                    return Object.keys(row._originalData);
                }
                return [];
            })
        ));
    }, [tableData, records]);

    const columns = useMemo<ColumnDef<any>[]>(() => {
        const hasDynamicKeys = dynamicKeys.length > 0;

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
                accessorKey: 'timestamp',
                header: 'Timestamp | Workflow',
                cell: ({ row }) => (
                    <div className="flex flex-col gap-1.5 whitespace-nowrap">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Clock size={12} className="text-slate-400" />
                            {new Date(row.getValue('timestamp')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 w-fit">
                            <Hash size={10} />
                            {(row.original.workflowId?.toString() || '').slice(0, 8)}...
                        </div>
                        {!selectedDataset && (
                            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">
                                📁 {row.original.datasetName}
                            </div>
                        )}
                    </div>
                ),
                enableResizing: true,
                size: 200,
            }
        ];

        if (hasDynamicKeys) {
            dynamicKeys.forEach(key => {
                // Heuristic for data types to see if it's mostly numeric
                let isNumericType = false;
                for (const row of tableData) {
                    if (row[key] !== undefined && row[key] !== null) {
                        isNumericType = typeof row[key] === 'number';
                        break; 
                    }
                }

                const isPrice = key.toLowerCase().includes('price') || key.toLowerCase().includes('cost');

                cols.push({
                    accessorKey: key,
                    header: key,
                    meta: {
                        filterVariant: isNumericType ? 'range' : 'text',
                        isNumeric: isNumericType,
                        alignRight: isNumericType,
                    },
                    filterFn: isNumericType ? numericRangeFilterFn : 'includesString',
                    cell: ({ getValue, column }) => {
                        const val = getValue();
                        if (val === undefined || val === null) return <span className="text-slate-300 dark:text-slate-600">-</span>;
                        
                        let displayValue = String(val);
                        if (typeof val === 'object') {
                            displayValue = JSON.stringify(val);
                        } else if (typeof val === 'number') {
                            if (isPrice) {
                                displayValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
                            }
                        }

                        const { alignRight } = column.columnDef.meta as { alignRight?: boolean } ?? {};
                        return (
                            <div className={`text-[12px] text-slate-600 dark:text-slate-300 font-medium whitespace-pre-wrap break-all ${alignRight ? 'text-right' : ''}`}>
                                {displayValue}
                            </div>
                        );
                    },
                    enableResizing: true,
                    size: 150,
                });
            });
        } else {
            cols.push({
                id: '_originalData',
                accessorKey: '_originalData',
                header: 'Scraped Value',
                cell: ({ getValue }) => {
                    const data = getValue();
                    return (
                        <div className="max-h-[120px] overflow-auto scrollbar-hide">
                            <pre className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                {typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)}
                            </pre>
                        </div>
                    );
                },
                size: 300,
            });
        }

        cols.push({
            accessorKey: 'url',
            header: 'Source URL',
            meta: {
                alignRight: true 
            },
            cell: ({ getValue }) => {
                const url = getValue() as string;
                let hostname = url;
                try { hostname = new URL(url).hostname; } catch {}
                
                return (
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center justify-end gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                            {hostname}
                            <ExternalLink size={10} />
                        </div>
                        <div className="text-[9px] text-slate-400 truncate max-w-[200px]" title={url}>
                            {url}
                        </div>
                    </div>
                );
            },
            size: 250,
        });

        return cols;
    }, [dynamicKeys, selectedDataset, tableData]);

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

    // Bulk actions
    const handleDeleteSelected = async () => {
        const selectedRows = table.getFilteredSelectedRowModel().rows;
        if (!selectedRows.length) return;
        
        if (!confirm(`This will delete the entire parent record(s) and all associated items. Proceed to delete ${selectedRows.length} selected row(s)?`)) return;

        const originalRecordIds = Array.from(new Set(selectedRows.map(r => r.original.id)));
        await db.scrapedRecords.bulkDelete(originalRecordIds);
        setRowSelection({});
    };

    const handleExportSelected = () => {
        const selectedRows = table.getFilteredSelectedRowModel().rows;
        if (!selectedRows.length) return;

        const tableRows = selectedRows.map(row => row.original);
        
        const hasDynamicKeys = dynamicKeys.length > 0;
        const headers = ['ID', 'Dataset', 'Workflow ID', 'URL', 'Timestamp', ...(hasDynamicKeys ? dynamicKeys : ['Value'])];
        
        const csvContent = [
            headers.join(','),
            ...tableRows.map(row => {
                const csvRow = [
                    row.id,
                    `"${row.datasetName}"`,
                    `"${row.workflowId}"`,
                    `"${row.url}"`,
                    new Date(row.timestamp).toISOString()
                ];

                if (hasDynamicKeys) {
                    dynamicKeys.forEach(key => {
                        const val = row._originalData && typeof row._originalData === 'object' ? row._originalData[key] : '';
                        csvRow.push(`"${String(val !== undefined ? val : '').replace(/"/g, '""')}"`);
                    });
                } else {
                    const fallbackVal = typeof row._originalData === 'object' ? JSON.stringify(row._originalData) : String(row._originalData);
                    csvRow.push(`"${String(fallbackVal).replace(/"/g, '""')}"`);
                }

                return csvRow.join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `selected_data_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!records) return (
        <div className="flex-1 flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
    );

    if (records.length === 0) return (
        <div className="flex-1 flex flex-col items-center justify-center p-20 text-slate-400">
            <Globe size={48} className="mb-4 opacity-10" />
            <p className="text-lg font-medium">No records found</p>
            <p className="text-sm">Data will appear here after workflow execution.</p>
        </div>
    );

    const hasSelection = Object.keys(rowSelection).length > 0;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showAdvancedFilter ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-500'}`}
                    >
                        <Filter size={14} />
                        Advanced Filters
                        {filterRoot.rules.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-[10px]">
                                {filterRoot.rules.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">
                        {table.getFilteredRowModel().rows.length} Visible
                    </span>
                </div>
            </div>

            {/* Advanced Filter Builder Panel */}
            {showAdvancedFilter && (
                <div className="p-6 bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[400px] shadow-inner">
                    <GroupView
                        group={filterRoot}
                        fields={['url', 'datasetName', 'workflowId', ...dynamicKeys]}
                        onUpdate={(upd) => setFilterRoot({ ...filterRoot, ...upd })}
                    />
                </div>
            )}
            {/* Bulk Actions Header */}
            {hasSelection && (
                <div className="bg-indigo-50/80 dark:bg-indigo-900/20 px-6 py-3 border-b border-indigo-100 dark:border-indigo-900 flex items-center justify-between shrink-0 transition-all">
                    <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                        {table.getFilteredSelectedRowModel().rows.length} row(s) selected
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportSelected}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
                        >
                            <Download size={14} />
                            Export Selected
                        </button>
                        <button
                            onClick={handleDeleteSelected}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shadow-sm"
                        >
                            <Trash2 size={14} />
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto flex-1 relative bg-white dark:bg-slate-900">
                <table 
                    className="text-left border-collapse"
                    style={{ width: table.getCenterTotalSize() }}
                >
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-slate-950/50">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => {
                                    const { alignRight } = header.column.columnDef.meta as { alignRight?: boolean } ?? {};
                                    return (
                                        <th
                                            key={header.id}
                                            className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest relative group align-top"
                                            style={{ width: header.getSize() }}
                                        >
                                            {header.isPlaceholder ? null : (
                                                <div className={`flex flex-col gap-2 ${alignRight ? 'items-end' : 'items-start'}`}>
                                                    <div 
                                                        className={`flex items-center gap-2 ${header.column.getCanSort() ? 'cursor-pointer hover:text-slate-800 dark:hover:text-slate-200' : ''}`}
                                                        onClick={header.column.getToggleSortingHandler()}
                                                    >
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                        {header.column.getCanSort() && (
                                                            <div className="text-slate-300 dark:text-slate-600">
                                                                {{
                                                                    asc: <ArrowUp size={12} className="text-indigo-500" />,
                                                                    desc: <ArrowDown size={12} className="text-indigo-500" />,
                                                                }[header.column.getIsSorted() as string] ?? <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {header.column.getCanFilter() && (
                                                        <div onClick={e => e.stopPropagation()} className="w-full mt-1">
                                                            <ColumnFilter column={header.column} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {header.column.getCanResize() && (
                                                <div
                                                    onMouseDown={header.getResizeHandler()}
                                                    onTouchStart={header.getResizeHandler()}
                                                    className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500 transition-colors select-none touch-none ${header.column.getIsResizing() ? 'bg-indigo-500' : ''}`}
                                                />
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
                                className={`transition-colors group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 ${row.getIsSelected() ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                            >
                                {row.getVisibleCells().map(cell => (
                                    <td 
                                        key={cell.id} 
                                        className="px-6 py-4 align-top"
                                        style={{ width: cell.column.getSize() }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {table.getRowModel().rows.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm font-medium text-slate-400">
                                    No records match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-auto px-8 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex flex-wrap items-center justify-between gap-4 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Showing {table.getRowModel().rows.length} of {tableData.length} records
                </span>
            </div>
        </div>
    );
};

export default DataTable;
