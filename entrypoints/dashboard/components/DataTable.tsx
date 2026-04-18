import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ScrapedRecord } from '../../../src/db/database';
import { ExternalLink, Clock, Globe, Hash, CornerDownRight, Download } from 'lucide-react';

interface DataTableProps {
    searchQuery: string;
    selectedDataset: string | null;
}

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

    if (!records) return (
        <div className="flex-1 flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
    );

    const filteredRecords = records.filter(record => {
        const query = searchQuery.toLowerCase();
        return (
            record.url.toLowerCase().includes(query) ||
            record.workflowId.toLowerCase().includes(query) ||
            record.datasetName.toLowerCase().includes(query) ||
            JSON.stringify(record.data).toLowerCase().includes(query)
        );
    });

    if (records.length === 0) return (
        <div className="flex-1 flex flex-col items-center justify-center p-20 text-slate-400">
            <Globe size={48} className="mb-4 opacity-10" />
            <p className="text-lg font-medium">No records found</p>
            <p className="text-sm">Data will appear here after workflow execution.</p>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                            <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 w-48">Timestamp | Workflow</th>
                            <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Scraped Value</th>
                            <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 w-64 text-right">Source URL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                                <td className="px-6 py-4 align-top">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                            <Clock size={12} className="text-slate-400" />
                                            {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 w-fit">
                                            <Hash size={10} />
                                            {record.workflowId.slice(0, 8)}...
                                        </div>
                                        {!selectedDataset && (
                                            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">
                                                📁 {record.datasetName}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="max-h-[120px] overflow-auto scrollbar-hide">
                                        {Array.isArray(record.data) ? (
                                            <div className="space-y-2">
                                                {record.data.map((item, i) => (
                                                    <div key={i} className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                                        {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <pre className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                                {typeof record.data === 'object' ? JSON.stringify(record.data, null, 2) : String(record.data)}
                                            </pre>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top text-right">
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                                            {new URL(record.url).hostname}
                                            <ExternalLink size={10} />
                                        </div>
                                        <div className="text-[9px] text-slate-400 truncate max-w-[200px]" title={record.url}>
                                            {record.url}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-auto px-8 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Showing {filteredRecords.length} records
                </span>
            </div>
        </div>
    );
};

export default DataTable;
