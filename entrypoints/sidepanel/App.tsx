import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
// import { storage } from 'wxt/storage';

interface Trigger {
  type: 'hotkey' | 'pageload';
  key?: string;
}

interface Action {
  type: 'click' | 'highlight';
  selector?: string;
  scope?: string;
  regex?: string;
  color?: string;
}

interface Automation {
  trigger: Trigger;
  action: Action;
  urlRegex?: string;
}

interface LogEntry {
  timestamp: number;
  message: string;
}

export default function App() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tempTriggerType, setTempTriggerType] = useState<'hotkey' | 'pageload'>('hotkey');
  const [tempActionType, setTempActionType] = useState<'click' | 'highlight'>('click');
  const [tempKey, setTempKey] = useState('alt+a');
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [tempSelector, setTempSelector] = useState('#button');
  const [tempHighlightScope, setTempHighlightScope] = useState('p');
  const [tempHighlightRegex, setTempHighlightRegex] = useState('test');
  const [tempHighlightColor, setTempHighlightColor] = useState('#ffff00');
  const [tempUrlRegex, setTempUrlRegex] = useState('.*');
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]?.url && !tabs[0].url.startsWith('chrome://')) {
        setCurrentTabUrl(tabs[0].url);
      }
    });

    storage.getItem<Automation[]>('local:automations').then((res) => {
      if (res) {
        setAutomations(res);
      }
    });

    storage.getItem<LogEntry[]>('local:logs').then((res) => {
      if (res) setLogs(res);
    });

    const unwatch = storage.watch<Automation[]>('local:automations', (newVal) => {
      if (newVal) setAutomations(newVal);
    });

    const unwatchLogs = storage.watch<LogEntry[]>('local:logs', (newVal) => {
      if (newVal) setLogs(newVal);
    });

    return () => {
      unwatch();
      unwatchLogs();
    };
  }, []);

  const clearLogs = () => {
    storage.setItem('local:logs', []);
  };

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const getUrlPresets = () => {
    const presets = [{ label: 'All Sites', value: '.*' }];
    if (currentTabUrl) {
      try {
        const urlObj = new URL(currentTabUrl);
        const siteRegex = `.*${escapeRegExp(urlObj.hostname)}.*`;
        const exactPage = `^${escapeRegExp(urlObj.origin + urlObj.pathname)}.*`;
        
        presets.push({ label: 'Current Website', value: siteRegex });
        presets.push({ label: 'Current Page', value: exactPage });
      } catch (e) {
        // ignore invalid urls
      }
    }
    return presets;
  };

  const urlRegexPresets = getUrlPresets();

  const saveAutomation = () => {
    const key = tempKey.trim();
    const selector = tempSelector.trim();
    const scope = tempHighlightScope.trim();

    if (tempTriggerType === 'hotkey' && !key) return;
    if (tempActionType === 'click' && !selector) return;
    if (tempActionType === 'highlight' && (!scope || !tempHighlightRegex)) return;

    const newAutomation: Automation = {
      trigger: { type: tempTriggerType, key: tempTriggerType === 'hotkey' ? key : undefined },
      action: { 
        type: tempActionType, 
        selector: tempActionType === 'click' ? selector : undefined,
        scope: tempActionType === 'highlight' ? scope : undefined,
        regex: tempActionType === 'highlight' ? tempHighlightRegex : undefined,
        color: tempActionType === 'highlight' ? tempHighlightColor : undefined
      },
      urlRegex: tempUrlRegex,
    };
    storage.setItem('local:automations', [...automations, newAutomation]);
  };

  const removeAutomation = (index: number) => {
    const next = [...automations];
    next.splice(index, 1);
    storage.setItem('local:automations', next);
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen text-gray-900 font-sans">
      <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Flowscript</h1>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 transition-all hover:shadow-md">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 tracking-wide uppercase">Add Automation</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Trigger</label>
              <select
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                value={tempTriggerType}
                onChange={(e) => setTempTriggerType(e.target.value as any)}
              >
                <option value="hotkey">Hotkey</option>
                <option value="pageload">Page Load</option>
              </select>
            </div>
            {tempTriggerType === 'hotkey' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-medium text-gray-500">Hotkey Key</label>
                  {isRecordingHotkey && <span className="text-[10px] font-medium text-blue-600 animate-pulse bg-blue-50 px-1.5 py-0.5 rounded">Recording...</span>}
                </div>
                <input
                  type="text"
                  className={`w-full text-sm border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                    isRecordingHotkey 
                    ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50 text-blue-700 font-mono shadow-inner' 
                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100 bg-gray-50 focus:bg-white font-mono'
                  }`}
                  value={tempKey}
                  readOnly
                  onClick={() => {
                    setIsRecordingHotkey(true);
                    setTempKey('');
                  }}
                  onBlur={() => {
                    setIsRecordingHotkey(false);
                    setTempKey(prev => (!prev || prev.endsWith('+...')) ? 'alt+a' : prev);
                  }}
                  onKeyDown={(e) => {
                    if (!isRecordingHotkey) return;
                    e.preventDefault();
                    e.stopPropagation();

                    const key = e.key.toLowerCase();
                    const isModifier = ['control', 'alt', 'shift', 'meta'].includes(key);

                    const keys = [];
                    if (e.ctrlKey) keys.push('ctrl');
                    if (e.altKey) keys.push('alt');
                    if (e.shiftKey) keys.push('shift');
                    if (e.metaKey) keys.push('meta');

                    if (!isModifier) {
                      if (key === ' ') {
                        keys.push('space');
                      } else {
                        keys.push(key);
                      }
                      setTempKey(keys.join('+'));
                      setIsRecordingHotkey(false);
                      e.currentTarget.blur();
                    } else {
                      setTempKey(keys.join('+') + '+...');
                    }
                  }}
                  placeholder={isRecordingHotkey ? "Press key..." : "Click to record"}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={tempActionType !== 'click' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Action</label>
              <select
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                value={tempActionType}
                onChange={(e) => setTempActionType(e.target.value as any)}
              >
                <option value="click">Click Element</option>
                <option value="highlight">Highlight Text</option>
              </select>
            </div>
            {tempActionType === 'click' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">CSS Selector</label>
                <input
                  type="text"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                  value={tempSelector}
                  onChange={e => setTempSelector(e.target.value)}
                  placeholder="e.g. .btn-submit"
                />
              </div>
            )}
          </div>
          {tempActionType === 'highlight' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Scope</label>
                <input
                  type="text"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                  value={tempHighlightScope}
                  onChange={e => setTempHighlightScope(e.target.value)}
                  placeholder="e.g. p"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Regex</label>
                <input
                  type="text"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white font-mono"
                  value={tempHighlightRegex}
                  onChange={e => setTempHighlightRegex(e.target.value)}
                  placeholder="e.g. urgent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Color</label>
                <div className="flex items-center gap-2 h-[42px] border border-gray-200 rounded-lg px-2 bg-gray-50">
                  <input
                    type="color"
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                    value={tempHighlightColor}
                    onChange={e => setTempHighlightColor(e.target.value)}
                  />
                  <span className="text-xs font-mono text-gray-500 uppercase">{tempHighlightColor}</span>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Target URLs (Regex)</label>
            <input
              type="text"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white font-mono"
              value={tempUrlRegex}
              onChange={e => setTempUrlRegex(e.target.value)}
              placeholder="e.g. .*google\.com.*"
            />
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {urlRegexPresets.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => setTempUrlRegex(preset.value)}
                  className={`text-[10px] px-2.5 py-1 rounded shadow-sm border transition-colors font-medium font-mono ${
                    tempUrlRegex === preset.value 
                    ? 'bg-blue-100 border-blue-300 text-blue-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={saveAutomation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm shadow-sm active:scale-[0.98]"
          >
            Add Automation
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 tracking-wide uppercase">Active Automations</h2>
        {automations.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center">
            <p className="text-sm text-gray-500 italic">No automations configured.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {automations.map((auto, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between group hover:border-blue-300 transition-colors">
                <div className="mb-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block text-xs px-2.5 py-1 rounded-md font-mono font-medium ${auto.trigger.type === 'pageload' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                      {auto.trigger.type === 'pageload' ? 'pageload' : auto.trigger.key}
                    </span>
                    <span className="text-gray-400 text-sm">→</span>
                    <span 
                      className={`inline-block text-xs px-2.5 py-1 rounded-md font-mono font-medium truncate max-w-[150px] ${auto.action.type === 'click' ? 'bg-blue-100 text-blue-700' : ''}`} 
                      style={auto.action.type === 'highlight' ? { backgroundColor: auto.action.color || '#ffff00', color: '#000' } : undefined}
                      title={auto.action.type === 'click' ? auto.action.selector : `${auto.action.scope} | ${auto.action.regex}`}
                    >
                      {auto.action.type === 'click' ? `click: ${auto.action.selector}` : `highlight: ${auto.action.regex}`}
                    </span>
                  </div>
                  {auto.urlRegex && auto.urlRegex !== '.*' && (
                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className="font-medium text-gray-400">URL Match:</span>
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 truncate">{auto.urlRegex}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeAutomation(idx)}
                  className="text-xs text-red-500 hover:text-red-700 self-end font-medium px-2 py-1 rounded-md hover:bg-red-50 transition-colors opacity-80 group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">Activity Logs</h2>
          {logs.length > 0 && (
            <button onClick={clearLogs} className="text-xs font-medium text-gray-500 hover:text-red-600 transition-colors uppercase tracking-wider bg-gray-100 hover:bg-red-50 px-2 py-1 rounded">
              Clear
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="bg-white p-4 rounded-xl border border-gray-200 border-dashed text-center">
            <p className="text-xs text-gray-500 italic">No activity yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-h-60 overflow-y-auto custom-scrollbar">
            <div className="divide-y divide-gray-100">
              {logs.map((log, idx) => (
                <div key={idx} className="p-3 hover:bg-gray-50 transition-colors text-xs flex flex-col gap-1">
                  <div className="text-gray-400 font-mono text-[10px] uppercase tracking-wider">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div className="text-gray-700 font-medium leading-relaxed">{log.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
