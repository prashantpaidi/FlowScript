import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { HotkeyRecorder } from '../HotkeyRecorder';

interface TriggerNodeData {
  [key: string]: any;
  subtype?: string;
  key?: string;
  onUpdate?: (newData: any) => void;
  onRemove?: () => void;
}

export function TriggerNode({ data }: NodeProps<Node<TriggerNodeData>>) {
  const subtype = data.subtype || 'hotkey';

  return (
    <div className="bg-white border-2 border-amber-400 rounded-lg shadow-md min-w-[200px] overflow-hidden group">
      <div className="bg-amber-400 p-2 text-white font-bold flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span>Trigger</span>
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="bg-transparent text-xs border border-amber-200 rounded px-1 outline-none"
            value={subtype}
            onChange={(e) => data.onUpdate?.({ subtype: e.target.value })}
          >
            <option value="hotkey">Hotkey</option>
            <option value="pageload">Page Load</option>
          </select>
          <button 
            onClick={() => data.onRemove?.()}
            className="text-amber-100 hover:text-white transition-colors"
            title="Remove Node"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-3 bg-white">
        {subtype === 'hotkey' && (
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Hotkey</label>
            <HotkeyRecorder
              value={data.key || ''}
              onChange={(newKey) => data.onUpdate?.({ key: newKey })}
              placeholder="Record Hotkey"
            />
          </div>
        )}
        {subtype === 'pageload' && (
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">URL Regex</label>
            <input
              type="text"
              className="w-full text-xs p-2 border border-gray-200 rounded focus:border-amber-400 focus:outline-none bg-gray-50 font-mono"
              placeholder="e.g. .*google.com.*"
              value={data.urlRegex || ''}
              onChange={(e) => data.onUpdate?.({ urlRegex: e.target.value })}
            />
            <div className="flex gap-1">
              <button 
                onClick={() => data.onUpdate?.({ urlRegex: '.*' })}
                className="text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded transition-colors"
                title="Matches all sites"
              >
                All Sites
              </button>
              <button 
                onClick={async () => {
                  try {
                    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
                    if (tab?.url) {
                      const url = new URL(tab.url);
                      const host = url.hostname.replace('www.', '');
                      data.onUpdate?.({ urlRegex: `^https?://(www\\.)?${host.replace(/\./g, '\\.')}/.*` });
                    }
                  } catch (e) { console.error(e); }
                }}
                className="text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded transition-colors"
                title="Matches current website"
              >
                Current Website
              </button>
              <button 
                onClick={async () => {
                  try {
                    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
                    if (tab?.url) {
                      const escaped = tab.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      data.onUpdate?.({ urlRegex: `^${escaped}$` });
                    }
                  } catch (e) { console.error(e); }
                }}
                className="text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded transition-colors"
                title="Matches exact page"
              >
                Current Page
              </button>
            </div>
            <div className="text-[10px] text-gray-400 italic">
              Triggers when page loads matching this URL.
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="trigger"
        style={{ background: '#fbbf24', width: 8, height: 8 }}
      />
    </div>
  );
}
