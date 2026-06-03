import { useWorkflowActions } from '../context';
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@flowscript/db';
import { VariablePicker } from '../components/VariablePicker';
import { Database, Trash2, ArrowRight } from 'lucide-react';

export function AddRowNode({ id, data }: NodeProps<Node<any>>) {
  const { updateNodeData, removeNode, setEditingTableId } = useWorkflowActions();

  // Load global tables list
  const globalTables = useLiveQuery(() => db.globalTables.toArray()) || [];
  const selectedTable = useLiveQuery(() => 
    data.tableId ? db.globalTables.get(data.tableId) : Promise.resolve(undefined), 
    [data.tableId]
  );

  const mapping = data.mapping || {};

  const handleMappingChange = (colName: string, value: string) => {
    updateNodeData(id, {
      mapping: {
        ...mapping,
        [colName]: value
      }
    });
  };

  return (
    <div className="bg-white border-2 border-indigo-500 rounded-xl shadow-xl min-w-[240px] max-w-[320px] overflow-hidden group/node">
      {/* Node Header */}
      <div className="bg-indigo-600 p-3 text-white font-bold flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} />
          <span>Add Row</span>
        </div>
        <button 
          onClick={() => removeNode(id)} 
          className="text-indigo-200 hover:text-white transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Node Form */}
      <div className="p-4 space-y-4">
        {/* Table Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Target Table</label>
          <select
            value={data.tableId || ''}
            onChange={(e) => {
              updateNodeData(id, { 
                tableId: e.target.value,
                // Clear out old mapping when table changes
                mapping: {}
              });
            }}
            className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer font-medium"
          >
            <option value="" disabled>Select target table...</option>
            {globalTables.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {data.tableId && setEditingTableId && (
            <button
              onClick={() => setEditingTableId(data.tableId)}
              className="w-full bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-100 hover:border-indigo-100 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Database size={12} />
              Manage Table ↗
            </button>
          )}
        </div>

        {/* Dynamic Column Mapping Inputs */}
        {selectedTable ? (
          <div className="space-y-3.5 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Column Mapping</span>
            {selectedTable.columns.map(col => (
              <div key={col.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-600 truncate max-w-[150px]" title={col.name}>
                    {col.name} <span className="text-[8px] bg-slate-100 text-slate-400 px-1 py-0.5 rounded ml-1 font-extrabold uppercase">{col.type}</span>
                  </label>
                  <VariablePicker
                    currentNodeId={id}
                    onSelect={(v) => handleMappingChange(col.name, (mapping[col.name] || '') + v)}
                  />
                </div>
                <input
                  type="text"
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder={col.type === 'boolean' ? 'e.g. true or false' : `e.g. Value or {{expression}}`}
                  value={mapping[col.name] || ''}
                  onChange={(e) => handleMappingChange(col.name, e.target.value)}
                />
              </div>
            ))}
            {selectedTable.columns.length === 0 && (
              <p className="text-[10px] text-slate-400 italic">No columns in target table schema</p>
            )}
          </div>
        ) : data.tableId ? (
          <p className="text-[10px] text-slate-400 italic">Loading table schema...</p>
        ) : (
          <p className="text-[10px] text-slate-400 italic">Select a global table above to configure column mappings.</p>
        )}
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} id="trigger-in" style={{ background: '#4f46e5', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="trigger-out" style={{ background: '#4f46e5', width: 8, height: 8 }} />
    </div>
  );
}
