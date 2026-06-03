import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@flowscript/db';
import { TableSchema } from '@flowscript/schema';
import { useWorkflowActions } from '../context';
import { RefreshCw, Trash2, Globe, Sliders, Table2 } from 'lucide-react';

export function LoopNode({ id, data }: NodeProps<Node<any>>) {
  const { updateNodeData, removeNode, setEditingTableId } = useWorkflowActions();
  const alias = data.alias || 'Loop';

  // Fetch all global tables for select dropdown
  const globalTables = useLiveQuery(() => db.globalTables.toArray()) || [];
  
  const activeTable = useLiveQuery(() => 
    data.globalTableId ? db.globalTables.get(data.globalTableId) : Promise.resolve(undefined), 
    [data.globalTableId]
  );

  const filter = data.filter || {};

  const handleCreateGlobalTable = async () => {
    const name = prompt("Enter a name for the new global table:", alias || "New Global Table");
    if (!name) return;

    const newId = crypto.randomUUID();
    const newTableSchema: TableSchema = {
      id: newId,
      name,
      columns: [
        { name: 'Column 1', type: 'text' },
        { name: 'Column 2', type: 'number' }
      ],
      updatedAt: Date.now()
    };

    await db.globalTables.put(newTableSchema);
    
    // Add an initial empty row
    await db.tableRows.add({
      tableId: newId,
      timestamp: Date.now(),
      data: { 'Column 1': '', 'Column 2': '' }
    });

    updateNodeData(id, {
      globalSyncEnabled: true,
      globalTableId: newId,
      alias: name
    });
  };

  return (
    <div className="bg-white border-2 border-pink-400 rounded-xl shadow-xl min-w-[280px] overflow-hidden group/node">
      {/* Node Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-600 p-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
            <RefreshCw size={14} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 leading-none">Control Flow</span>
            <span className="font-bold text-xs tracking-tight">For Each Row</span>
          </div>
        </div>
        <div className="flex-1 px-3">
          <input
            type="text"
            className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/30 text-[10px] text-white placeholder-pink-200 border-none rounded px-2 py-0.5 outline-none transition-colors font-medium"
            placeholder="Table Alias"
            value={alias}
            onChange={(e) => {
              const newAlias = e.target.value;
              updateNodeData(id, { alias: newAlias });
              if (data.globalTableId) {
                db.globalTables.update(data.globalTableId, { name: newAlias, updatedAt: Date.now() });
              }
            }}
          />
        </div>
        <button
          onClick={() => removeNode(id)}
          className="p-1 hover:bg-white/20 rounded-md transition-colors text-white/80 hover:text-white cursor-pointer"
          title="Remove Node"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Mini-View (Canvas preview) */}
      <div className="p-3 bg-white space-y-3">
        {/* Global Sync / Linker Section */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Globe size={11} className={data.globalTableId ? "text-pink-500 animate-pulse" : "text-slate-400"} />
            Target Table
          </label>

          <div className="flex flex-col gap-1.5">
            <select
              value={data.globalTableId || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__new__') {
                  handleCreateGlobalTable();
                } else {
                  const matched = globalTables.find(t => t.id === val);
                  updateNodeData(id, {
                    globalTableId: val,
                    globalSyncEnabled: true,
                    alias: matched?.name || alias
                  });
                }
              }}
              className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 outline-none text-slate-655 font-bold focus:ring-1 focus:ring-pink-500/20 cursor-pointer"
            >
              <option value="" disabled>Select global table...</option>
              {globalTables.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              <option value="__new__" className="text-pink-600 font-bold">+ Create New Table...</option>
            </select>
          </div>
        </div>

        {/* Loop Filter Editor */}
        {data.globalTableId && activeTable && (
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sliders size={11} className="text-slate-400" />
                Loop Filter
              </label>
              {filter.column && (
                <button 
                  onClick={() => updateNodeData(id, { filter: null })} 
                  className="text-[9px] text-red-500 hover:text-red-700 font-bold"
                >
                  Clear
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-1">
              <select
                value={filter.column || ''}
                onChange={(e) => updateNodeData(id, { filter: { ...filter, column: e.target.value } })}
                className="text-[9px] bg-slate-50 border border-slate-200 rounded p-1 outline-none font-medium cursor-pointer"
              >
                <option value="">Choose Column...</option>
                {activeTable.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>

              <select
                value={filter.operator || ''}
                onChange={(e) => updateNodeData(id, { filter: { ...filter, operator: e.target.value } })}
                className="text-[9px] bg-slate-50 border border-slate-200 rounded p-1 outline-none font-medium cursor-pointer"
              >
                <option value="">Operator...</option>
                <option value="equals">Equals</option>
                <option value="notEquals">Not Equals</option>
                <option value="contains">Contains</option>
                <option value="gt">Greater Than</option>
                <option value="lt">Less Than</option>
                <option value="true">Is Checked</option>
                <option value="false">Is Unchecked</option>
              </select>

              {!['true', 'false'].includes(filter.operator) ? (
                <input
                  type="text"
                  placeholder="Value..."
                  value={filter.value || ''}
                  onChange={(e) => updateNodeData(id, { filter: { ...filter, value: e.target.value } })}
                  className="text-[9px] bg-slate-50 border border-slate-200 rounded p-1 outline-none font-medium"
                />
              ) : (
                <div className="bg-slate-100 rounded text-[9px] flex items-center justify-center text-slate-400 font-medium">
                  N/A
                </div>
              )}
            </div>
            
            <div className="mt-1">
              <input
                type="text"
                placeholder="Or custom filter, e.g. [Age] > 18"
                value={typeof data.filter === 'string' ? data.filter : ''}
                onChange={(e) => updateNodeData(id, { filter: e.target.value })}
                className="w-full text-[9px] bg-slate-50 border border-slate-250 rounded px-1.5 py-1 outline-none text-slate-500 font-mono"
              />
            </div>
          </div>
        )}

        {data.globalTableId && setEditingTableId && (
          <button
            onClick={() => setEditingTableId(data.globalTableId)}
            className="w-full bg-slate-50 hover:bg-pink-50 hover:text-pink-655 text-slate-655 border border-slate-100 hover:border-pink-100 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Table2 size={12} />
            Manage Table ↗
          </button>
        )}
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} id="trigger-in" className="w-2.5 h-2.5 border-2 border-white bg-pink-500" />
      <Handle type="source" position={Position.Right} id="trigger-out" className="w-2.5 h-2.5 border-2 border-white bg-pink-500" />
    </div>
  );
}
