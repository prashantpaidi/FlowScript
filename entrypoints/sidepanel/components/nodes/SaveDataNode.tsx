import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

interface SaveDataNodeData {
    [key: string]: any;
    onUpdate?: (newData: any) => void;
    onRemove?: () => void;
}

export function SaveDataNode({ data }: NodeProps<Node<SaveDataNodeData>>) {
    return (
        <div className="bg-white border-2 border-emerald-500 rounded-xl shadow-xl min-w-[200px] overflow-hidden">
            <div className="bg-emerald-600 p-3 text-white font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">💾</span>
                    <span>Save Data</span>
                </div>
                <button onClick={() => data.onRemove?.()} className="text-emerald-200 hover:text-white transition-colors">✕</button>
            </div>

            <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Dataset Name</label>
                    <input
                        type="text"
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        placeholder="e.g. Amazon Prices"
                        value={data.datasetName || ''}
                        onChange={(e) => data.onUpdate?.({ datasetName: e.target.value })}
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
