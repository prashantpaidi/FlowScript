import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { HotkeyRecorder } from '../HotkeyRecorder';

interface ActionNodeData {
  [key: string]: any;
  subtype?: string;
  selector?: string;
  scope?: string;
  regex?: string;
  coordinates?: {
    pageX: number;
    pageY: number;
    clientX: number;
    clientY: number;
  };
  keyData?: {
    key: string;
    code: string;
    modifiers: number;
    windowsVirtualKeyCode: number;
  };
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
          <span className="text-xl flex-shrink-0">
            {data.isNative ? '⚡' : '⚙️'}
          </span>
          <span className="truncate">Action</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            className="bg-transparent text-xs border border-indigo-200 rounded px-1 outline-none"
            value={subtype}
            onChange={(e) => data.onUpdate?.({ subtype: e.target.value })}
          >
            <option value="click">Click</option>
            <option value="type">Type</option>
            <option value="pressKey">Press Key</option>
            <option value="scrape">Scrape</option>
            <option value="transform">Transform</option>
            <option value="clipboard">Clipboard</option>
            <option value="highlight">Highlight</option>
            <option value="wait">Wait</option>
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
        <div className="space-y-2 pb-2 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => data.onUpdate?.({ isNative: !data.isNative })}>
              Bypass Bot Detection
            </label>
            <button
              onClick={() => data.onUpdate?.({ isNative: !data.isNative })}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${data.isNative ? 'bg-amber-500' : 'bg-gray-200'
                }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${data.isNative ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>
          {data.isNative && (
            <div className="bg-yellow-50 text-yellow-800 text-[9px] p-2 rounded flex gap-2 items-start border border-yellow-200">
              <span className="text-yellow-500 text-xs mt-0.5">⚠️</span>
              <span>
                Native actions skip standard JS events and simulate raw browser input. Necessary for strict anti-bot protections.
              </span>
            </div>
          )}
        </div>

        {(subtype === 'click' || subtype === 'type' || subtype === 'scrape') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Selector {data.isNative && subtype === 'type' ? '(Optional)' : ''}
              </label>
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
                className={`text-[9px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${isPicking
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
              placeholder={data.isNative && subtype === 'type' ? 'Optional: types at focus' : '#btn-submit'}
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
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${data.selector === opt.value
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
            {data.coordinates && (
              <div className="mt-2 space-y-1">
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Recorded Coordinates</label>
                <div className="flex gap-2 text-[9px] text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100 font-mono">
                  <div className="flex flex-col">
                    <span className="text-gray-400">Page</span>
                    <span>X:{data.coordinates.pageX} Y:{data.coordinates.pageY}</span>
                  </div>
                  <div className="w-px bg-gray-200"></div>
                  <div className="flex flex-col">
                    <span className="text-gray-400">Client (Viewport)</span>
                    <span>X:{data.coordinates.clientX} Y:{data.coordinates.clientY}</span>
                  </div>
                </div>
              </div>
            )}
            {subtype === 'scrape' && (
              <div className="space-y-1 mt-2">
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Output Key</label>
                <input
                  type="text"
                  className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono"
                  placeholder="e.g. elementA"
                  value={data.key || data.dataKey || ''}
                  onChange={(e) => data.onUpdate?.({ key: e.target.value, dataKey: e.target.value })}
                />
              </div>
            )}
          </div>
        )}
        {subtype === 'type' && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Type Mode</label>
                <select
                  className="w-full text-[10px] p-1.5 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50"
                  value={data.typeMode || 'overwrite'}
                  onChange={(e) => data.onUpdate?.({ typeMode: e.target.value })}
                >
                  <option value="overwrite">Overwrite</option>
                  <option value="append">Append</option>
                  <option value="prepend">Prepend</option>
                  <option value="insert">Insert at Cursor</option>
                  <option value="replace">Regex Replace</option>
                </select>
              </div>
              {data.typeMode === 'replace' && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Regex Pattern</label>
                  <input
                    type="text"
                    className="w-full text-[10px] p-1.5 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono"
                    placeholder="[0-9]+"
                    value={data.regexPattern || ''}
                    onChange={(e) => data.onUpdate?.({ regexPattern: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Text Content</label>
              <input
                type="text"
                className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono"
                placeholder="text to type"
                value={data.text || ''}
                onChange={(e) => data.onUpdate?.({ text: e.target.value })}
              />
            </div>
            {data.isNative && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Typing Delay</label>
                  <span className="text-[10px] text-gray-500">{data.delayMs || 0}ms</span>
                </div>
                <input
                  type="range"
                  min="0" max="1000" step="50"
                  value={data.delayMs || 0}
                  onChange={(e) => data.onUpdate?.({ delayMs: parseInt(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
        {subtype === 'pressKey' && (
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Keys</label>
            <HotkeyRecorder
              value={data.keys ? data.keys.join('+') : (data.keyData ? data.keyData.key : '')}
              onChange={(val) => data.onUpdate?.({ keys: val.split('+'), keyData: undefined })}
            />
            {data.keyData && (
              <div className="mt-1 space-y-1">
                <div className="flex gap-2 text-[9px] text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100 font-mono">
                  <div className="flex flex-col">
                    <span className="text-gray-400">Code</span>
                    <span>{data.keyData.code}</span>
                  </div>
                  <div className="w-px bg-gray-200"></div>
                  <div className="flex flex-col">
                    <span className="text-gray-400">VKey</span>
                    <span>{data.keyData.windowsVirtualKeyCode}</span>
                  </div>
                  <div className="w-px bg-gray-200"></div>
                  <div className="flex flex-col">
                    <span className="text-gray-400">Mods</span>
                    <span>{data.keyData.modifiers}</span>
                  </div>
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
        {subtype === 'wait' && (
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Delay (ms)</label>
            <input
              type="number"
              className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono"
              placeholder="2000"
              value={data.delay || 0}
              onChange={(e) => data.onUpdate?.({ delay: parseInt(e.target.value) || 0 })}
            />
            {data.description && (
              <div className="text-[10px] text-gray-400 italic mt-1">
                {data.description}
              </div>
            )}
          </div>
        )}
        {subtype === 'transform' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">JS Expression</label>
              <textarea
                className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono min-h-[60px]"
                placeholder="inputs.elementA + inputs.elementB"
                value={data.expression || ''}
                onChange={(e) => data.onUpdate?.({ expression: e.target.value })}
              />
              <p className="text-[9px] text-gray-400">
                Use <code className="bg-gray-100 px-1 rounded">inputs.YOUR_KEY</code> to access scraped data.
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Output Key</label>
              <input
                type="text"
                className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono"
                placeholder="e.g. elementA"
                value={data.key || data.dataKey || 'data'}
                onChange={(e) => data.onUpdate?.({ key: e.target.value, dataKey: e.target.value })}
              />
            </div>
          </div>
        )}
        {subtype === 'clipboard' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Text to Copy</label>
              <textarea
                className="w-full text-xs p-2 border border-gray-200 rounded focus:border-indigo-400 focus:outline-none bg-gray-50 font-mono min-h-[60px]"
                placeholder="text to copy"
                value={data.text || ''}
                onChange={(e) => data.onUpdate?.({ text: e.target.value })}
              />
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
