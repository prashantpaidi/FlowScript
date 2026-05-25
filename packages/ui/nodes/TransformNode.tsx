import { useWorkflowActions } from '../context';
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Terminal, Trash2, Cpu } from 'lucide-react';
import { VariablePicker } from '../components/VariablePicker';

interface TransformNodeData {
  [key: string]: any;
  input?: string;
  expression?: string;
  key?: string;
  dataKey?: string;
  alias?: string;
}

export function TransformNode({ id, data }: NodeProps<Node<any>>) {
  const { updateNodeData, removeNode } = useWorkflowActions();
  return (
    <div className="bg-white border-2 border-violet-400 rounded-xl shadow-xl min-w-[300px] overflow-hidden group/node">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
            <Terminal size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 leading-none">Power Layer</span>
            <span className="font-bold text-sm tracking-tight">Transform Data</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="w-24 bg-white/10 hover:bg-white/20 focus:bg-white/30 text-[10px] text-white placeholder-violet-200 border-none rounded px-2 py-1 outline-none transition-colors font-medium"
            placeholder="Node Alias"
            value={data.alias || ''}
            onChange={(e) => updateNodeData(id, { alias: e.target.value })}
          />
          <button 
            onClick={() => removeNode(id)}
            className="p-1 hover:bg-white/20 rounded-md transition-colors"
            title="Remove Node"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 bg-white">
        {/* Input Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Cpu size={10} />
              Source Input
            </label>
            <VariablePicker
              currentNodeId={id}
              onSelect={(v) => updateNodeData(id, { input: (data.input || '') + v })}
            />
          </div>
          <input
            type="text"
            className="w-full text-xs p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-violet-500/20 font-mono text-slate-600 outline-none"
            placeholder="{{$node.Scraper.price}}"
            value={data.input || ''}
            onChange={(e) => updateNodeData(id, { input: e.target.value })}
          />
        </div>

        {/* Expression Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">JS Expression</label>
            <VariablePicker
              currentNodeId={id}
              onSelect={(v) => updateNodeData(id, { expression: (data.expression || '') + v })}
            />
          </div>
          <textarea
            className="w-full text-xs p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-violet-500/20 font-mono text-slate-600 outline-none min-h-[80px] resize-none"
            placeholder="input.replace('$', '') * 0.9"
            value={data.expression || ''}
            onChange={(e) => updateNodeData(id, { expression: e.target.value })}
          />
          <div className="flex items-center gap-2 text-[9px] text-slate-400 italic">
            <span>Use <code className="bg-slate-100 px-1 rounded not-italic font-bold">input</code> for source value</span>
          </div>
        </div>

        {/* Output Key Field */}
        <div className="space-y-1.5 pt-2 border-t border-slate-50">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Save Result As</label>
          </div>
          <input
            type="text"
            className="w-full text-xs p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-violet-500/20 font-mono text-violet-600 font-bold outline-none"
            placeholder="discounted_price"
            value={data.key || data.dataKey || ''}
            onChange={(e) => updateNodeData(id, { key: e.target.value, dataKey: e.target.value })}
          />
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="trigger-in"
        className="w-3 h-3 border-2 border-white bg-violet-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="trigger-out"
        className="w-3 h-3 border-2 border-white bg-violet-500"
      />
    </div>
  );
}
