import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

interface ActionNodeData {
  [key: string]: any;
  subtype?: string;
  selector?: string;
  scope?: string;
  regex?: string;
  color?: string;
  onUpdate?: (newData: any) => void;
  onRemove?: () => void;
}

export function ActionNode({ data }: NodeProps<Node<ActionNodeData>>) {
  const subtype = data.subtype || 'click';
  const [isPicking, setIsPicking] = React.useState(false);
  const [selectorOptions, setSelectorOptions] = React.useState<{ type: string, value: string }[]>([]);

  return (
    <div className="bg-white border-2 border-indigo-400 rounded-lg shadow-md min-w-[200px] overflow-hidden group">
      <div className="bg-indigo-400 p-2 text-white font-bold flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xl flex-shrink-0">⚙️</span>
          <span className="truncate">Action</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select 
            className="bg-transparent text-xs border border-indigo-200 rounded px-1 outline-none"
            value={subtype}
            onChange={(e) => data.onUpdate?.({ subtype: e.target.value })}
          >
            <option value="click">Click</option>
            <option value="highlight">Highlight</option>
          </select>
          <button 
            onClick={() => data.onRemove?.()}
            className="text-indigo-100 hover:text-white transition-colors"
            title="Remove Node"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-3 bg-white space-y-3">
        {subtype === 'click' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Selector</label>
              <button
                onClick={async () => {
                  try {
                    setIsPicking(true);
                    setSelectorOptions([]);
                    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
                    if (!tab?.id) {
                      alert('No active tab found.');
                      return;
                    }

                    const response = await browser.tabs.sendMessage(tab.id, { type: 'START_PICKING' });
                    if (response?.selectors) {
                      setSelectorOptions(response.selectors);
                      // Auto-select first robust option
                      if (response.selectors.length > 0) {
                        data.onUpdate?.({ selector: response.selectors[0].value });
                      }
                    }
                  } catch (e) {
                    console.error('Failed to start picker:', e);
                    alert('Could not start picker. Please ensure you are on a web page and try refreshing it.');
                  } finally {
                    setIsPicking(false);
                  }
                }}
                disabled={isPicking}
                className={`text-[9px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${
                  isPicking 
                    ? 'bg-amber-100 text-amber-600 animate-pulse' 
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
                }`}
                title="Pick element from page"
              >
                {isPicking ? '⏳ Picking...' : '🎯 Pick'}
              </button>
            </div>
            <input
              type="text"
              className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono"
              placeholder="#btn-submit"
              value={data.selector || ''}
              onChange={(e) => {
                data.onUpdate?.({ selector: e.target.value });
                if (selectorOptions.length > 0) setSelectorOptions([]);
              }}
            />
            {selectorOptions.length > 0 && (
              <div className="space-y-1 pt-1">
                <label className="block text-[9px] font-medium text-gray-400">Suggested Options:</label>
                <div className="flex flex-wrap gap-1">
                  {selectorOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        data.onUpdate?.({ selector: opt.value });
                        setSelectorOptions([]);
                      }}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
                        data.selector === opt.value
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-indigo-300 hover:bg-white'
                      }`}
                      title={opt.value}
                    >
                      <span className="font-bold mr-1 opacity-70">{opt.type}:</span>
                      <span className="truncate max-w-[120px] inline-block align-bottom">{opt.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {subtype === 'highlight' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Scope</label>
              <input
                type="text"
                className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono"
                placeholder="selector (e.g. body)"
                value={data.scope || ''}
                onChange={(e) => data.onUpdate?.({ scope: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Regex</label>
              <input
                type="text"
                className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono"
                placeholder="text pattern"
                value={data.regex || ''}
                onChange={(e) => data.onUpdate?.({ regex: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-8 w-8 rounded cursor-pointer"
                  value={data.color || '#ffeb3b'}
                  onChange={(e) => data.onUpdate?.({ color: e.target.value })}
                />
                <input 
                  type="text"
                  className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono"
                  value={data.color || '#ffeb3b'}
                  onChange={(e) => data.onUpdate?.({ color: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="trigger-in"
        style={{ background: '#818cf8', width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="trigger-out"
        style={{ background: '#818cf8', width: 8, height: 8 }}
      />
    </div>
  );
}
