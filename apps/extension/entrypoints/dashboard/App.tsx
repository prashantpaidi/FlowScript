import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import DataTable from './components/DataTable';
import { Database, Search, Layers, Clock } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@flowscript/db';
import { TableEditorModal } from '@flowscript/ui';

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  // Relational database stats
  const stats = useLiveQuery(async () => {
    const tables = await db.globalTables.toArray();
    
    let totalRows = 0;
    if (selectedTableId) {
      totalRows = await db.tableRows.where('tableId').equals(selectedTableId).count();
    } else {
      totalRows = await db.tableRows.count();
    }

    const latestTable = tables.reduce((latest, current) => {
      return !latest || current.updatedAt > latest.updatedAt ? current : latest;
    }, null as any);

    return {
      tablesCount: tables.length,
      rowsCount: totalRows,
      lastUpdated: latestTable ? new Date(latestTable.updatedAt).toLocaleTimeString() : 'Never'
    };
  }, [selectedTableId]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden">
      <Sidebar 
        selectedTableId={selectedTableId} 
        onSelectTableId={setSelectedTableId} 
        onEditTableId={setEditingTableId}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Dashboard Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-8 shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Database size={20} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white leading-none">
                {selectedTableId ? 'Relational Grid Inspector' : 'Tables Workspace'}
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1 flex items-center gap-2">
                <span className={selectedTableId ? 'text-indigo-500' : 'text-emerald-500'}>●</span>
                {selectedTableId ? 'Active Grid' : 'All Tables Summary'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search rows..."
                className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500/20 w-64 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none">
              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 rounded-xl">
                  <Database size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Total Tables</p>
                  <h2 className="text-2xl font-black font-mono text-slate-800 dark:text-white leading-none">{stats?.tablesCount ?? '--'}</h2>
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-xl">
                  <Layers size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">
                    {selectedTableId ? 'Table Rows' : 'Total Rows'}
                  </p>
                  <h2 className="text-2xl font-black font-mono text-slate-800 dark:text-white leading-none">{stats?.rowsCount ?? '--'}</h2>
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 rounded-xl">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Last Schema Update</p>
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">{stats?.lastUpdated ?? '--'}</h2>
                </div>
              </div>
            </div>

            {/* Data Grid Table Panel */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
              <DataTable 
                searchQuery={searchQuery} 
                selectedTableId={selectedTableId} 
                onSelectTableId={setSelectedTableId} 
                onEditTableId={setEditingTableId}
              />
            </div>

          </div>
        </div>
      </main>
      <TableEditorModal tableId={editingTableId} onClose={() => setEditingTableId(null)} />
    </div>
  );
};

export default App;
