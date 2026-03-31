import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

interface OutputNodeData {
  [key: string]: any;
  onRemove?: () => void;
}

export function OutputNode({ data }: NodeProps<Node<OutputNodeData>>) {
  return (
    <div className="bg-white border-2 border-emerald-400 rounded-lg shadow-md min-w-[150px] overflow-hidden group">
      <div className="bg-emerald-400 p-2 text-white font-bold flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xl flex-shrink-0">⛳</span>
          <span className="truncate">End</span>
        </div>
        <button 
          onClick={() => data.onRemove?.()}
          className="text-emerald-100 hover:text-white transition-colors"
          title="Remove Node"
        >
          ✕
        </button>
      </div>

      <div className="p-3 bg-white space-y-2">
        <p className="text-[10px] text-gray-400 uppercase font-semibold">Workflow Status</p>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span>Execution Finished</span>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="trigger-in"
        style={{ background: '#34d399', width: 8, height: 8 }}
      />
    </div>
  );
}
