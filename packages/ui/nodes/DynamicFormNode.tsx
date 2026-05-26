import { useWorkflowActions } from '../context';
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Layout, Trash2, Plus, Zap, Settings2, GripVertical } from 'lucide-react';
import { VariablePicker } from '../components/VariablePicker';
import { KeywordPillInput } from '../components/KeywordPillInput';

interface MappingRow {
  id: string;
  label: string;
  include: string[];
  exclude: string[];
  value: string;
  isNative: boolean;
}

interface DynamicFormNodeData {
  [key: string]: any;
  mappings?: MappingRow[];
  globalNative?: boolean;
  alias?: string;
}

export function DynamicFormNode({ id, data }: NodeProps<Node<any>>) {
  const { updateNodeData, removeNode } = useWorkflowActions();
  const mappings = data.mappings || [];
  const globalNative = !!data.globalNative;

  const updateMappings = (newMappings: MappingRow[]) => {
    updateNodeData(id, { mappings: newMappings });
  };

  const addRow = () => {
    const newRow: MappingRow = {
      id: crypto.randomUUID(),
      label: '',
      include: [],
      exclude: [],
      value: '',
      isNative: globalNative,
    };
    updateMappings([...mappings, newRow]);
  };

  const removeRow = (rowId: string) => {
    updateMappings(mappings.filter((r) => r.id !== rowId));
  };

  const updateRow = (rowId: string, updates: Partial<MappingRow>) => {
    updateMappings(
      mappings.map((r) => (r.id === rowId ? { ...r, ...updates } : r))
    );
  };

  return (
    <div className="bg-white border-2 border-blue-400 rounded-xl shadow-xl min-w-[600px] overflow-hidden group/node">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
            <Layout size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 leading-none">Form</span>
            <span className="font-bold text-sm tracking-tight">Dynamic Mapping</span>
          </div>
        </div>
        
        <div className="flex-1 px-4">
          <input
            type="text"
            className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/30 text-[10px] text-white placeholder-blue-200 border-none rounded px-2 py-1 outline-none transition-colors font-medium"
            placeholder="Node Alias (e.g. CheckoutForm)"
            value={data.alias || ''}
            onChange={(e) => updateNodeData(id, { alias: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/20 px-2 py-1 rounded-lg">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">Native Mode</span>
            <button
              onClick={() => updateNodeData(id, { globalNative: !globalNative })}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${
                globalNative ? 'bg-amber-400' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  globalNative ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <button onClick={() => removeNode(id)} className="p-1 hover:bg-white/20 rounded-md transition-colors text-white/80 hover:text-white">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Content Table */}
      <div className="p-0 bg-white dark:bg-slate-900">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-[20%]">Field Name</th>
              <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-[25%]">Include (+)</th>
              <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-[25%]">NOT (-)</th>
              <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-[25%]">Value</th>
              {!globalNative && <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-[5%]">Native</th>}
              <th className="p-3 w-[40px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {mappings.map((row) => (
              <tr key={row.id} className="group/row hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="p-2">
                  <input
                    type="text"
                    className="w-full text-[11px] p-2 bg-transparent border border-transparent hover:border-slate-200 rounded-md focus:border-blue-400 focus:bg-white outline-none font-medium transition-all"
                    placeholder="e.g. Email"
                    value={row.label}
                    onChange={(e) => updateRow(row.id, { label: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <KeywordPillInput
                    value={row.include}
                    onChange={(val) => updateRow(row.id, { include: val })}
                    variant="positive"
                    placeholder="Required..."
                  />
                </td>
                <td className="p-2">
                  <KeywordPillInput
                    value={row.exclude}
                    onChange={(val) => updateRow(row.id, { exclude: val })}
                    variant="negative"
                    placeholder="Forbidden..."
                  />
                </td>
                <td className="p-2">
                  <div className="relative group/val">
                    <input
                      type="text"
                      className="w-full text-[11px] p-2 pr-8 bg-slate-50 dark:bg-slate-800 border-none rounded-md focus:ring-2 focus:ring-blue-500/20 font-mono"
                      placeholder="Input value..."
                      value={row.value}
                      onChange={(e) => updateRow(row.id, { value: e.target.value })}
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 scale-75 opacity-0 group-hover/val:opacity-100 transition-opacity">
                      <VariablePicker
                        currentNodeId={id}
                        onSelect={(v) => updateRow(row.id, { value: (row.value || '') + v })}
                      />
                    </div>
                  </div>
                </td>
                {!globalNative && (
                  <td className="p-2 text-center">
                    <button
                      onClick={() => updateRow(row.id, { isNative: !row.isNative })}
                      className={`p-1.5 rounded-md transition-all ${
                        row.isNative 
                          ? 'bg-amber-100 text-amber-600 shadow-inner' 
                          : 'text-slate-300 hover:text-slate-400'
                      }`}
                      title="Native Input Override"
                    >
                      <Zap size={14} fill={row.isNative ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                )}
                <td className="p-2">
                  <button
                    onClick={() => removeRow(row.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover/row:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {mappings.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-slate-50 rounded-full">
                      <Settings2 size={24} className="text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-400 font-medium">No fields mapped yet.</p>
                    <button
                      onClick={addRow}
                      className="mt-2 flex items-center gap-2 px-4 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      <Plus size={14} /> Add First Field
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {mappings.length > 0 && (
          <div className="p-3 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30">
            <button
              onClick={addRow}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm"
            >
              <Plus size={14} /> Add Field Row
            </button>
          </div>
        )}
      </div>

      {/* Ports */}
      <Handle type="target" position={Position.Left} id="trigger-in" style={{ background: '#3b82f6', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="trigger-out" style={{ background: '#3b82f6', width: 10, height: 10 }} />
    </div>
  );
}
