import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { HotkeyRecorder } from '../HotkeyRecorder';

interface TriggerNodeData {
  [key: string]: any;
  id?: string;
  subtype?: string;
  key?: string;
  urlRegex?: string; // Legacy support
  urlScope?: {
    pattern: string;
    matchIframes?: boolean;
  };
  onUpdate?: (newData: any) => void;
  onRemove?: () => void;
}

export function TriggerNode({ data, id }: NodeProps<Node<TriggerNodeData>>) {
  const subtype = data.subtype || 'hotkey';

  const updatePattern = (pattern: string) => {
    data.onUpdate?.({
      urlScope: {
        ...(data.urlScope || {}),
        pattern
      }
    });
  };

  const handleGetCurrentUrl = async (mode: 'site' | 'page') => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        if (mode === 'site') {
          const url = new URL(tab.url);
          const hostname = url.hostname.replace(/^www\./, '');
          const hostWithPort = hostname + (url.port ? `:${url.port}` : '');
          const escapedHost = hostWithPort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          updatePattern(`^https?://(www\\.)?${escapedHost}/.*`);
        } else {
          const escaped = tab.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          updatePattern(`^${escaped}$`);
        }
      }
    } catch (e) { console.error(e); }
  };

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

      <div className="p-3 bg-white space-y-4">
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

        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            {subtype === 'pageload' ? 'Trigger on URL (Regex)' : 'URL Scope (Regex)'}
          </label>
          <input
            type="text"
            className="w-full text-xs p-2 border border-gray-200 rounded focus:border-amber-400 focus:outline-none bg-gray-50 font-mono"
            placeholder="e.g. .*google.com.*"
            value={data.urlScope?.pattern || data.urlRegex || ''}
            onChange={(e) => updatePattern(e.target.value)}
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`matchIframes-${id}`}
                checked={data.urlScope?.matchIframes || false}
                onChange={(e) => data.onUpdate?.({
                  urlScope: {
                    ...(data.urlScope || {}),
                    pattern: data.urlScope?.pattern || data.urlRegex || '',
                    matchIframes: e.target.checked
                  }
                })}
                className="w-3 h-3 text-amber-400 focus:ring-amber-400 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor={`matchIframes-${id}`} className="text-[10px] text-gray-500 cursor-pointer">Run in Iframes</label>
            </div>
          </div>

          <div className="flex gap-1">
            <button 
              onClick={() => updatePattern('.*')}
              className="text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded transition-colors"
              title="Matches all sites"
            >
              All Sites
            </button>
            <button 
              onClick={() => handleGetCurrentUrl('site')}
              className="text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded transition-colors"
              title="Matches current website"
            >
              Current Website
            </button>
            <button 
              onClick={() => handleGetCurrentUrl('page')}
              className="text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded transition-colors"
              title="Matches exact page"
            >
              Current Page
            </button>
          </div>
          
          {subtype === 'pageload' && (
            <div className="text-[10px] text-gray-400 italic">
              Triggers when page loads matching this URL.
            </div>
          )}
        </div>
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