import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch, Trash2 } from 'lucide-react';

export function ConditionalNode({ data, isConnectable }: any) {
  return (
    <div className="bg-white border-2 border-purple-400 rounded-xl shadow-xl min-w-[280px] overflow-hidden group/node">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 p-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
            <GitBranch size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 leading-none">Logic</span>
            <span className="font-bold text-sm tracking-tight">Conditional (If)</span>
          </div>
        </div>
        <button onClick={() => data.onRemove?.()} className="p-1 hover:bg-white/20 rounded-md transition-colors">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 bg-white">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Condition Type</label>
            <select
              className="w-full text-xs p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-purple-500/20 font-bold text-slate-600 outline-none"
              value={data.subtype || 'elementExists'}
              onChange={(e) => data.onUpdate?.({ subtype: e.target.value })}
            >
              <option value="elementExists">Element Exists</option>
              <option value="jsExpression">JS Expression</option>
            </select>
          </div>

          {data.subtype === 'elementExists' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DOM Selector</label>
              <input
                type="text"
                className="w-full text-xs p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-purple-500/20 font-mono"
                placeholder="e.g. .add-to-cart"
                value={data.selector || ''}
                onChange={(e) => data.onUpdate?.({ selector: e.target.value })}
              />
            </div>
          )}

          {data.subtype === 'jsExpression' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expression</label>
              <input
                type="text"
                className="w-full text-xs p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-purple-500/20 font-mono"
                placeholder="inputs.cartTotal > 100"
                value={data.expr || ''}
                onChange={(e) => data.onUpdate?.({ expr: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Branches Labels for clarity */}
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter pt-2 border-t border-slate-100">
          <div className="text-slate-400">Input Flow</div>
          <div className="flex gap-4">
            <span className="text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">True</span>
            <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded">False</span>
          </div>
        </div>
      </div>

      {/* Input Handle */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="in" 
        className="w-4 h-4 border-2 border-white bg-purple-500"
        style={{ top: '50%' }}
        isConnectable={isConnectable}
      />

      {/* True Handle */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="true" 
        style={{ top: '40%' }}
        className="w-4 h-4 border-2 border-white bg-emerald-500 !m-0"
        title="True branch"
        isConnectable={isConnectable}
      />

      {/* False Handle */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="false" 
        style={{ top: '80%' }}
        className="w-4 h-4 border-2 border-white bg-red-500 !m-0"
        title="False branch"
        isConnectable={isConnectable}
      />
    </div>
  );
}
