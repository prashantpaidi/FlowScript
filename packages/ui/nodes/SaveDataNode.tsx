import { useWorkflowActions } from '../context';
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { VariablePicker } from '../components/VariablePicker';

interface SaveDataNodeData {
    [key: string]: any;
}

export function SaveDataNode({ id, data }: NodeProps<Node<any>>) {
  const { updateNodeData, removeNode } = useWorkflowActions();
    return (
        <div className="bg-white border-2 border-emerald-500 rounded-xl shadow-xl min-w-[200px] overflow-hidden">
            <div className="bg-emerald-600 p-3 text-white font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">💾</span>
                    <span>Save Data</span>
                </div>
                <button onClick={() => removeNode(id)} className="text-emerald-200 hover:text-white transition-colors">✕</button>
            </div>

            <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Dataset Name</label>
                        <VariablePicker
                            currentNodeId={id}
                            onSelect={(v) => updateNodeData(id, { datasetName: (data.datasetName || '') + v })}
                        />
                    </div>
                    <input
                        type="text"
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        placeholder="e.g. Amazon Prices"
                        value={data.datasetName || ''}
                        onChange={(e) => updateNodeData(id, { datasetName: e.target.value })}
                    />
                </div>
                <p className="text-[10px] text-slate-400 italic leading-relaxed">
                    Persists all scraped data from upstream nodes to the local database under this dataset name.
                </p>
            </div>

            <Handle type="target" position={Position.Left} id="trigger-in" style={{ background: '#10b981', width: 10, height: 10 }} />
            <Handle type="source" position={Position.Right} id="trigger-out" style={{ background: '#10b981', width: 10, height: 10 }} />
        </div>
    );
}
