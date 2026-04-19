import React from 'react';
import { LayoutDashboard, Database, History, Settings, LogOut, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../src/db/database';

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; count?: number }> = ({ icon, label, active, onClick, count }) => (
    <button
        onClick={onClick}
        className={`
        w-full flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group text-left
        ${active
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}
    `}>
        <div className={`transition-transform group-hover:scale-110 ${active ? 'text-white' : ''}`}>
            {icon}
        </div>
        <span className="font-medium text-sm flex-1 truncate">{label}</span>
        {count !== undefined && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {count}
            </span>
        )}
    </button>
);

interface SidebarProps {
    selectedDataset: string | null;
    onSelectDataset: (name: string | null) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedDataset, onSelectDataset }) => {
    const datasets = useLiveQuery(async () => {
        const records = await db.scrapedRecords.toArray();
        const counts: Record<string, number> = {};
        records.forEach(r => {
            counts[r.datasetName] = (counts[r.datasetName] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count }));
    }, []);

    return (
        <aside className="w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 shrink-0">
            {/* Logo */}
            <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl italic shadow-lg shadow-indigo-500/30">
                    F
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-base tracking-tight text-slate-800 dark:text-white leading-none">Flowscript</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Data Engine</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
                <div className="space-y-1">
                    <p className="px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Library</p>
                    <SidebarItem
                        icon={<LayoutDashboard size={18} />}
                        label="All Data"
                        active={selectedDataset === null}
                        onClick={() => onSelectDataset(null)}
                    />
                </div>

                <div className="space-y-1">
                    <div className="px-4 flex items-center justify-between mb-3 text-slate-400 dark:text-slate-500">
                        <p className="text-[10px] font-bold uppercase tracking-widest">Datasets</p>
                        <Database size={12} />
                    </div>
                    {datasets?.map(ds => (
                        <SidebarItem
                            key={ds.name}
                            icon={<ChevronRight size={16} className={selectedDataset === ds.name ? 'rotate-90 transition-transform' : 'transition-transform'} />}
                            label={ds.name}
                            active={selectedDataset === ds.name}
                            count={ds.count}
                            onClick={() => onSelectDataset(ds.name)}
                        />
                    ))}
                    {(!datasets || datasets.length === 0) && (
                        <p className="px-4 py-2 text-xs text-slate-400 italic">No datasets yet</p>
                    )}
                </div>
            </nav>

            {/* Bottom Section */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Local Storage</p>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full w-12" />
                    </div>
                </div>
                <button className="w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors text-sm font-medium">
                    <LogOut size={18} />
                    Exit Dashboard
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
