import React from 'react';
import { LayoutDashboard, Database, Trash2, Download, Settings, ChevronRight, Table2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@flowscript/db';

const SidebarItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  onClick?: () => void; 
  count?: number 
}> = ({ icon, label, active, onClick, count }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group text-left relative pr-10
      ${active
        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}
    `}
  >
    <div className={`transition-transform group-hover:scale-110 ${active ? 'text-white' : ''}`}>
      {icon}
    </div>
    <span className="font-medium text-sm flex-1 truncate mr-2">{label}</span>
    {count !== undefined && (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 group-hover:opacity-0 transition-opacity ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
        {count}
      </span>
    )}
  </button>
);

interface SidebarProps {
  selectedTableId: string | null;
  onSelectTableId: (id: string | null) => void;
  onEditTableId: (id: string | null) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedTableId, onSelectTableId, onEditTableId }) => {
  const tables = useLiveQuery(async () => {
    const list = await db.globalTables.toArray();
    const tableCounts = await Promise.all(
      list.map(async (t) => {
        const count = await db.tableRows.where('tableId').equals(t.id).count();
        return { ...t, count };
      })
    );
    return tableCounts;
  }, []);

  const handleDeleteTable = async (e: React.MouseEvent, tableId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete table "${name}" and all its rows?`)) return;
    await db.globalTables.delete(tableId);
    const rowsToDelete = await db.tableRows.where('tableId').equals(tableId).toArray();
    await db.tableRows.bulkDelete(rowsToDelete.map(r => r.id!));
    if (selectedTableId === tableId) {
      onSelectTableId(null);
    }
  };

  const handleRenameTable = async (e: React.MouseEvent, tableId: string, currentName: string) => {
    e.stopPropagation();
    const newName = prompt("Rename table:", currentName);
    if (newName && newName.trim() !== currentName) {
      await db.globalTables.update(tableId, { name: newName.trim(), updatedAt: Date.now() });
    }
  };

  const handleExportTable = async (e: React.MouseEvent, tableId: string, name: string) => {
    e.stopPropagation();
    const schema = await db.globalTables.get(tableId);
    const rows = await db.tableRows.where('tableId').equals(tableId).toArray();
    if (!schema) return;

    const headers = schema.columns.map(c => c.name);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => {
        const rowData = row.data || {};
        return headers.map(h => {
          const val = rowData[h];
          const displayVal = val !== undefined && val !== null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '';
          return `"${displayVal.replace(/"/g, '""')}"`;
        }).join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${name}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  return (
    <aside className="w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 shrink-0 select-none">
      {/* Logo */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl italic shadow-lg shadow-indigo-500/30">
          F
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base tracking-tight text-slate-800 dark:text-white leading-none">Flowscript</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Data Workspace</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar">
        <div className="space-y-1">
          <p className="px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Library</p>
          <SidebarItem
            icon={<LayoutDashboard size={18} />}
            label="All Tables Overview"
            active={selectedTableId === null}
            onClick={() => onSelectTableId(null)}
          />
        </div>

        <div className="space-y-1">
          <div className="px-4 flex items-center justify-between mb-3 text-slate-400 dark:text-slate-500">
            <p className="text-[10px] font-bold uppercase tracking-widest">Relational Tables</p>
            <Database size={12} />
          </div>
          {tables?.map(t => (
            <div key={t.id} className="relative group/item">
              <SidebarItem
                icon={<ChevronRight size={16} className={selectedTableId === t.id ? 'rotate-95 transition-transform' : 'transition-transform'} />}
                label={t.name}
                active={selectedTableId === t.id}
                count={t.count}
                onClick={() => {
                  onSelectTableId(t.id);
                  onEditTableId(t.id);
                }}
              />
              
              {/* Hover Actions */}
              <div className="absolute right-2 top-2 hidden group-hover/item:flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm z-10">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTableId(t.id);
                  }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-pink-600 rounded cursor-pointer"
                  title="Manage Table"
                >
                  <Table2 size={10} />
                </button>
                <button 
                  onClick={(e) => handleRenameTable(e, t.id, t.name)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                  title="Rename"
                >
                  <Settings size={10} />
                </button>
                <button 
                  onClick={(e) => handleExportTable(e, t.id, t.name)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                  title="Export CSV"
                >
                  <Download size={10} />
                </button>
                <button 
                  onClick={(e) => handleDeleteTable(e, t.id, t.name)}
                  className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-300 hover:text-red-600 rounded cursor-pointer"
                  title="Delete Table"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
          {(!tables || tables.length === 0) && (
            <p className="px-4 py-2 text-xs text-slate-400 italic">No tables created yet</p>
          )}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Local Storage</p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full w-1/3" />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
