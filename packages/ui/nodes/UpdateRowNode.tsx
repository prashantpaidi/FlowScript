import { useWorkflowActions } from '../context';
import React from 'react';
import { Handle, Position, type NodeProps, type Node, useNodes } from '@xyflow/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@flowscript/db';
import { VariablePicker } from '../components/VariablePicker';
import { Database, Trash2, X } from 'lucide-react';

export function UpdateRowNode({ id, data }: NodeProps<Node<any>>) {
  const { updateNodeData, removeNode } = useWorkflowActions();
  const allNodes = useNodes();

  // Find all Table Loop nodes in the graph
  const parentTableLoops = allNodes.filter(n => n.type === 'staticTableNode');

  // Find the selected parent loop node's table schema
  const selectedParentNode = allNodes.find(n => n.id === data.parentTableNodeId);
  const tableId = selectedParentNode?.data?.globalTableId;

  const selectedTable = useLiveQuery(() => 
    tableId ? db.globalTables.get(tableId) : Promise.resolve(undefined), 
    [tableId]
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

  const handleRemoveMapping = (colName: string) => {
    const nextMapping = { ...mapping };
    delete nextMapping[colName];
    updateNodeData(id, { mapping: nextMapping });
  };

  const availableColumns = selectedTable?.columns.filter(c => !(c.name in mapping)) || [];

  return (
    <div className="bg-white border-2 border-indigo-500 rounded-xl shadow-xl min-w-[240px] max-w-[320px] overflow-hidden group/node">
      {/* Node Header */}
      <div className="bg-indigo-600 p-3 text-white font-bold flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} />
          <span>Update Row</span>
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
        {/* Parent Loop Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Parent Loop</label>
          <select
            value={data.parentTableNodeId || ''}
            onChange={(e) => {
              updateNodeData(id, { 
                parentTableNodeId: e.target.value,
                mapping: {} // Reset mappings on parent change
              });
            }}
            className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
          >
            <option value="" disabled>Select parent loop...</option>
            {parentTableLoops.map(n => (
              <option key={n.id} value={n.id}>
                {n.data.alias || `Loop (${n.id.slice(0, 4)})`}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Column Updates */}
        {selectedTable ? (
          <div className="space-y-3.5 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Update Columns</span>
            
            {/* Active mappings */}
            {Object.keys(mapping).map(colName => {
              const col = selectedTable.columns.find(c => c.name === colName);
              const colType = col?.type || 'text';

              return (
                <div key={colName} className="space-y-1 bg-slate-50/50 p-2 border border-slate-100 rounded-lg relative group/field">
                  <button
                    onClick={() => handleRemoveMapping(colName)}
                    className="absolute top-1 right-1 p-0.5 text-slate-300 hover:text-red-500 hover:bg-slate-100 rounded cursor-pointer"
                  >
                    <X size={10} />
                  </button>

                  <div className="flex items-center justify-between pr-4">
                    <label className="text-[10px] font-bold text-slate-700 truncate max-w-[130px]">
                      {colName} <span className="text-[7px] bg-slate-200 text-slate-500 px-1 py-0.5 rounded ml-1 font-extrabold uppercase">{colType}</span>
                    </label>
                    <VariablePicker
                      currentNodeId={id}
                      onSelect={(v) => handleMappingChange(colName, (mapping[colName] || '') + v)}
                    />
                  </div>

                  <input
                    type="text"
                    className="w-full text-xs p-1.5 border border-slate-250 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder={`e.g. Value or {{expression}}`}
                    value={mapping[colName]}
                    onChange={(e) => handleMappingChange(colName, e.target.value)}
                  />
                </div>
              );
            })}

            {Object.keys(mapping).length === 0 && (
              <p className="text-[10px] text-slate-400 italic">No columns selected to update yet.</p>
            )}

            {/* Field Adder Selector */}
            {availableColumns.length > 0 && (
              <div className="pt-1">
                <select
                  value=""
                  onChange={(e) => {
                    const colName = e.target.value;
                    if (colName) {
                      handleMappingChange(colName, '');
                    }
                  }}
                  className="w-full text-[10px] p-2 border border-dashed border-indigo-200 rounded-lg bg-indigo-50/10 text-indigo-600 font-bold hover:bg-indigo-50/30 transition-all outline-none cursor-pointer"
                >
                  <option value="">+ Choose column to update...</option>
                  {availableColumns.map(c => (
                    <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : data.parentTableNodeId ? (
          <p className="text-[10px] text-slate-400 italic">Loading parent loop schema...</p>
        ) : (
          <p className="text-[10px] text-slate-400 italic">Select a parent loop above to configure column updates.</p>
        )}
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} id="trigger-in" style={{ background: '#4f46e5', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="trigger-out" style={{ background: '#4f46e5', width: 8, height: 8 }} />
    </div>
  );
}
