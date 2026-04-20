import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import DataTable from './components/DataTable';
import { Database, Download, FileText, LayoutDashboard, Search, Settings, Globe } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../src/db/database';

const App: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDataset, setSelectedDataset] = useState<string | null>(null);

    const stats = useLiveQuery(async () => {
        const query = selectedDataset
            ? db.scrapedRecords.where('datasetName').equals(selectedDataset)
            : db.scrapedRecords;

        const records = await query.toArray();
        const hostnames = new Set(records.map(r => {
            try {
                return new URL(r.url).hostname;
            } catch {
                return 'unknown';
            }
        }));
        return {
            total: records.length,
            uniqueHosts: hostnames.size
        };
    }, [selectedDataset]);

    const exportCurrent = async () => {
        const query = selectedDataset
            ? db.scrapedRecords.where('datasetName').equals(selectedDataset)
            : db.scrapedRecords;
        const records = await query.toArray();
        if (!records.length) return;

        const tableRows = records.flatMap((record) => {
            if (Array.isArray(record.data)) {
                return record.data.map(item => ({
                    ...item, // Scraped data first
                    ...record, // Metadata second (authoritative)
                    _originalData: item // Keep reference to data for csv mapping if needed
                }));
            }
            return [{
                ...(typeof record.data === 'object' ? record.data : {}),
                ...record,
                _originalData: record.data
            }];
        });

        const keys = Array.from(new Set(
            tableRows.flatMap(row => {
                if (row._originalData && typeof row._originalData === 'object' && !Array.isArray(row._originalData)) {
                    return Object.keys(row._originalData);
                }
                return [];
            })
        ));

        const hasDynamicKeys = keys.length > 0;
        const headers = ['ID', 'Dataset', 'Workflow ID', 'URL', 'Timestamp', ...(hasDynamicKeys ? keys : ['Value'])];

        const escape = (val: any) => {
            if (val === null || val === undefined) return '""';
            const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
            const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
            return `"${safe.replace(/"/g, '""')}"`;
        };

        const csvContent = [
            headers.join(','),
            ...tableRows.map(row => {
                const csvRow = [
                    row.id,
                    escape(row.datasetName),
                    escape(row.workflowId),
                    escape(row.url),
                    escape(new Date(row.timestamp).toISOString())
                ];

                if (hasDynamicKeys) {
                    keys.forEach(key => {
                        const val = row._originalData && typeof row._originalData === 'object' ? row._originalData[key] : '';
                        csvRow.push(escape(val));
                    });
                } else {
                    csvRow.push(escape(row._originalData));
                }

                return csvRow.join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${selectedDataset || 'all'}_data_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearCurrent = async () => {
        if (!confirm(`Are you sure you want to clear ${selectedDataset ? `the "${selectedDataset}" dataset` : 'ALL scraped records'}?`)) return;

        if (selectedDataset) {
            await db.scrapedRecords.where('datasetName').equals(selectedDataset).delete();
            setSelectedDataset(null);
        } else {
            await db.scrapedRecords.clear();
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden">
            <Sidebar selectedDataset={selectedDataset} onSelectDataset={setSelectedDataset} />

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white">
                            <Database size={20} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white leading-none">
                                {selectedDataset ? `Dataset: ${selectedDataset}` : 'All Scraped Data'}
                            </h1>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1 flex items-center gap-2">
                                <span className={selectedDataset ? 'text-indigo-500' : 'text-emerald-500'}>●</span>
                                {selectedDataset ? 'Filtered View' : 'Global View'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search records..."
                                className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500/20 w-64 outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-8">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Records</p>
                                <h2 className="text-3xl font-bold mt-2 font-mono text-slate-800 dark:text-white">{stats?.total ?? '--'}</h2>
                            </div>
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Source Domains</p>
                                <h2 className="text-3xl font-bold mt-2 font-mono text-slate-800 dark:text-white">{stats?.uniqueHosts ?? '--'}</h2>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={exportCurrent}
                                    className="flex-1 p-6 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-white shadow-lg shadow-indigo-500/20 transition-all flex flex-col justify-between items-start group active:scale-95"
                                >
                                    <Download size={24} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-sm font-bold mt-4">Download CSV</span>
                                </button>
                                <button
                                    onClick={clearCurrent}
                                    className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl text-slate-400 hover:text-red-500 transition-all flex flex-col justify-center items-center active:scale-95"
                                    title="Clear Data"
                                >
                                    <FileText size={24} />
                                    <span className="text-[10px] font-bold uppercase mt-2">Clear</span>
                                </button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                            <DataTable searchQuery={searchQuery} selectedDataset={selectedDataset} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
