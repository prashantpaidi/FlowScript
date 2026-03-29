import { useState, useEffect, useRef } from 'react';
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

interface SelectorOption {
  selector: string;
  label: string;
  stability: 'best' | 'good' | 'fragile';
}

export default function App() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tempTriggerType, setTempTriggerType] = useState<'hotkey' | 'pageload'>('hotkey');
  const [tempActionType, setTempActionType] = useState<'click' | 'highlight'>('click');
  const [tempKey, setTempKey] = useState('alt+a');
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [isSelectingElement, setIsSelectingElement] = useState<'selector' | 'scope' | false>(false);
  const lastSelectedTarget = useRef<'selector' | 'scope'>('selector');
  const [tempSelector, setTempSelector] = useState('#button');
  const [selectorOptions, setSelectorOptions] = useState<SelectorOption[]>([]);
  const [tempHighlightScope, setTempHighlightScope] = useState('p');
  const [tempHighlightRegex, setTempHighlightRegex] = useState('test');
  const [tempHighlightColor, setTempHighlightColor] = useState('#ffff00');
  const [tempUrlRegex, setTempUrlRegex] = useState('.*');
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === 'element-selected') {
        const target = lastSelectedTarget.current;
        if (message.options && Array.isArray(message.options)) {
          setSelectorOptions(message.options);
          if (message.options.length > 0) {
            if (target === 'selector') setTempSelector(message.options[0].selector);
            else if (target === 'scope') setTempHighlightScope(message.options[0].selector);
          }
        } else if (message.selector) {
          if (target === 'selector') setTempSelector(message.selector);
          else if (target === 'scope') setTempHighlightScope(message.selector);
        }
        setIsSelectingElement(false);
      } else if (message.action === 'dom-inspector-cancelled') {
        setIsSelectingElement(false);
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const broadcastHover = async (selector: string) => {
    if (!selector) return;
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        await browser.tabs.sendMessage(tabs[0].id, { action: 'hover-element', selector });
      }
    } catch(e) {}
  };

  const broadcastClearHover = async () => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        await browser.tabs.sendMessage(tabs[0].id, { action: 'clear-hover' });
      }
    } catch(e) {}
  };

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

  const resetForm = () => {
    setTempTriggerType('hotkey');
    setTempActionType('click');
    setTempKey('alt+a');
    setTempSelector('#button');
    setTempHighlightScope('p');
    setTempHighlightRegex('test');
    setTempHighlightColor('#ffff00');
    setTempUrlRegex('.*');
    setSelectorOptions([]);
    setEditingIndex(null);
  };

  const saveAutomation = () => {
    const key = tempKey.trim();
    const selector = tempSelector.trim();
    const scope = tempHighlightScope.trim();
    const regex = tempHighlightRegex.trim();

    if (tempTriggerType === 'hotkey' && !key) return;
    if (tempActionType === 'click' && !selector) return;
    if (tempActionType === 'highlight' && (!scope || !regex)) return;

    const newAutomation: Automation = {
      trigger: { type: tempTriggerType, key: tempTriggerType === 'hotkey' ? key : undefined },
      action: { 
        type: tempActionType, 
        selector: tempActionType === 'click' ? selector : undefined,
        scope: tempActionType === 'highlight' ? scope : undefined,
        regex: tempActionType === 'highlight' ? regex : undefined,
        color: tempActionType === 'highlight' ? tempHighlightColor : undefined
      },
      urlRegex: tempUrlRegex,
    };

    if (editingIndex !== null) {
      const next = [...automations];
      next[editingIndex] = newAutomation;
      storage.setItem('local:automations', next);
    } else {
      storage.setItem('local:automations', [...automations, newAutomation]);
    }
    resetForm();
  };

  const editAutomation = (index: number) => {
    const auto = automations[index];
    setTempTriggerType(auto.trigger.type);
    if (auto.trigger.type === 'hotkey') setTempKey(auto.trigger.key || '');
    
    setTempActionType(auto.action.type);
    if (auto.action.type === 'click') setTempSelector(auto.action.selector || '');
    if (auto.action.type === 'highlight') {
      setTempHighlightScope(auto.action.scope || '');
      setTempHighlightRegex(auto.action.regex || '');
      setTempHighlightColor(auto.action.color || '#ffff00');
    }
    setTempUrlRegex(auto.urlRegex || '.*');
    setEditingIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeAutomation = (index: number) => {
    if (editingIndex === index) {
      setEditingIndex(null);
      resetForm();
    }
    const next = [...automations];
    next.splice(index, 1);
    storage.setItem('local:automations', next);
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen text-gray-900 font-sans">
      <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Flowscript</h1>

      <div className={`bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 transition-all hover:shadow-md ${editingIndex !== null ? 'ring-2 ring-blue-500 border-transparent shadow-lg' : ''}`}>
        <h2 className="text-sm font-semibold text-gray-700 mb-4 tracking-wide uppercase">
          {editingIndex !== null ? 'Edit Automation' : 'Add Automation'}
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Trigger</label>
              <select
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                value={tempTriggerType}
                onChange={(e) => setTempTriggerType(e.target.value as 'hotkey' | 'pageload')}
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
                onChange={(e) => setTempActionType(e.target.value as 'click' | 'highlight')}
              >
                <option value="click">Click Element</option>
                <option value="highlight">Highlight Text</option>
              </select>
            </div>
            {tempActionType === 'click' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">CSS Selector</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white font-mono"
                    value={tempSelector}
                    onChange={e => {
                      setTempSelector(e.target.value);
                      setSelectorOptions([]); // clear if manually edited
                      broadcastHover(e.target.value);
                    }}
                    onFocus={() => broadcastHover(tempSelector)}
                    onBlur={() => broadcastClearHover()}
                    placeholder="e.g. .btn-submit"
                  />
                  <button
                    onClick={async () => {
                      setIsSelectingElement('selector');
                      lastSelectedTarget.current = 'selector';
                      setSelectorOptions([]); // clear options when starting new selection
                      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                      if (tabs[0]?.id) {
                        try {
                          await browser.tabs.sendMessage(tabs[0].id, { action: 'start-dom-inspector' });
                        } catch (e) {
                          console.error('Failed to send message to tab', e);
                          setIsSelectingElement(false);
                        }
                      } else {
                        setIsSelectingElement(false);
                      }
                    }}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border shadow-sm flex items-center justify-center min-w-[100px] ${
                      isSelectingElement === 'selector'
                        ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {isSelectingElement === 'selector' ? 'Selecting...' : 'Pick Element'}
                  </button>
                </div>
                {selectorOptions.length > 0 && lastSelectedTarget.current === 'selector' && (
                  <div className="mt-2.5 bg-gray-50 border border-gray-200 rounded-lg p-2 shadow-inner">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Generated Options</p>
                    <div className="flex flex-col gap-1.5">
                      {selectorOptions.map((opt, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            setTempSelector(opt.selector);
                            broadcastHover(opt.selector);
                          }}
                          onMouseEnter={() => broadcastHover(opt.selector)}
                          className={`text-xs p-2.5 rounded-md border cursor-pointer flex justify-between items-center transition-all ${
                            tempSelector === opt.selector 
                            ? 'border-blue-400 bg-blue-50 text-blue-900 shadow-sm ring-1 ring-blue-400' 
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span className="font-mono truncate mr-3" title={opt.selector}>{opt.selector}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded flex-shrink-0 font-medium whitespace-nowrap ${
                            opt.stability === 'best' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            opt.stability === 'good' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                            'bg-orange-100 text-orange-700 border border-orange-200'
                          }`}>
                            {opt.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {tempActionType === 'highlight' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Scope Selector</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white font-mono"
                    value={tempHighlightScope}
                    onChange={e => {
                      setTempHighlightScope(e.target.value);
                      setSelectorOptions([]); // clear if manually edited
                      broadcastHover(e.target.value);
                    }}
                    onFocus={() => broadcastHover(tempHighlightScope)}
                    onBlur={() => broadcastClearHover()}
                    placeholder="e.g. p, .container"
                  />
                  <button
                    onClick={async () => {
                      setIsSelectingElement('scope');
                      lastSelectedTarget.current = 'scope';
                      setSelectorOptions([]); // clear options when starting new selection
                      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                      if (tabs[0]?.id) {
                        try {
                          await browser.tabs.sendMessage(tabs[0].id, { action: 'start-dom-inspector' });
                        } catch (e) {
                          setIsSelectingElement(false);
                        }
                      } else {
                        setIsSelectingElement(false);
                      }
                    }}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border shadow-sm flex items-center justify-center min-w-[100px] ${
                      isSelectingElement === 'scope'
                        ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {isSelectingElement === 'scope' ? 'Selecting...' : 'Pick Element'}
                  </button>
                </div>
                {selectorOptions.length > 0 && lastSelectedTarget.current === 'scope' && (
                  <div className="mt-2.5 bg-gray-50 border border-gray-200 rounded-lg p-2 shadow-inner">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Generated Options</p>
                    <div className="flex flex-col gap-1.5">
                      {selectorOptions.map((opt, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            setTempHighlightScope(opt.selector);
                            broadcastHover(opt.selector);
                          }}
                          onMouseEnter={() => broadcastHover(opt.selector)}
                          className={`text-xs p-2.5 rounded-md border cursor-pointer flex justify-between items-center transition-all ${
                            tempHighlightScope === opt.selector 
                            ? 'border-blue-400 bg-blue-50 text-blue-900 shadow-sm ring-1 ring-blue-400' 
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span className="font-mono truncate mr-3" title={opt.selector}>{opt.selector}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded flex-shrink-0 font-medium whitespace-nowrap ${
                            opt.stability === 'best' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            opt.stability === 'good' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                            'bg-orange-100 text-orange-700 border border-orange-200'
                          }`}>
                            {opt.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
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
          <div className="flex gap-3">
            {editingIndex !== null && (
              <button
                onClick={resetForm}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm shadow-sm active:scale-[0.98]"
              >
                Cancel
              </button>
            )}
            <button
              onClick={saveAutomation}
              className={`flex-[2] text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm shadow-sm active:scale-[0.98] ${
                editingIndex !== null ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {editingIndex !== null ? 'Update Automation' : 'Add Automation'}
            </button>
          </div>
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
                <div className="flex gap-2 self-end mt-1">
                  <button
                    onClick={() => editAutomation(idx)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-md hover:bg-blue-50 transition-colors opacity-80 group-hover:opacity-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeAutomation(idx)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-md hover:bg-red-50 transition-colors opacity-80 group-hover:opacity-100"
                  >
                    Remove
                  </button>
                </div>
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
