import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNodes, useEdges, type Node as FlowNode } from '@xyflow/react';
import { Wand2, Search, X, Zap, ChevronRight, Activity, Cpu, MousePointer2, Type, Database, Terminal, Clipboard, Lock } from 'lucide-react';
import { getUpstreamNodes } from '../utils/dagUtils';

interface VariablePickerProps {
  onSelect: (variable: string) => void;
  currentNodeId: string;
}

interface VarOption {
  label: string;
  value: string;
  description: string;
  type: 'system' | 'trigger' | 'node' | 'secret';
  nodeSubtype?: string;
}

export function VariablePicker({ onSelect, currentNodeId }: VariablePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const nodes = useNodes();
  const edges = useEdges();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [secrets, setSecrets] = useState<string[]>([]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      inputRef.current?.focus();

      // Fetch secrets from storage
      const storageKey = 'local:secrets';
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(storageKey).then(res => {
          const data = res[storageKey] || {};
          setSecrets(Object.keys(data));
        }).catch(err => console.warn('[VariablePicker] Failed to fetch secrets:', err));
      }
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const options = useMemo(() => {
    const opts: VarOption[] = [
      { label: 'Current Date', value: '$sys.date', description: 'Local date string', type: 'system' },
      { label: 'Current Time', value: '$sys.time', description: 'Local time string', type: 'system' },
      { label: 'Now (Timestamp)', value: '$sys.now', description: 'Epoch milliseconds', type: 'system' },
      { label: 'UUID', value: '$sys.uuid', description: 'Unique identifier', type: 'system' },
      { label: 'Current URL', value: '$sys.url', description: 'Active page URL', type: 'system' },
      { label: 'Browser', value: '$sys.browser', description: 'Browser name', type: 'system' },
      { label: 'Platform', value: '$sys.platform', description: 'OS platform', type: 'system' },
      { label: 'Trigger URL', value: '$trigger.url', description: 'Workflow start URL', type: 'trigger' },
    ];

    // Secrets
    secrets.forEach(key => {
      opts.push({
        label: `Secret: ${key}`,
        value: `$secrets.${key}`,
        description: 'Secure API Key / Token',
        type: 'secret'
      });
    });

    if (secrets.length === 0) {
      opts.push({
        label: 'Add Secret...',
        value: '$secrets.KEY_NAME',
        description: 'Use {{$secrets.KEY}}',
        type: 'secret'
      });
    }

    const upstream = getUpstreamNodes(nodes as any, edges as any, currentNodeId);
    upstream.forEach(node => {
      const alias = node.data?.alias || `Node_${node.id.slice(0, 4)}`;
      const subtype = (node.data?.subtype as string) || '';

      if (subtype === 'scrape') {
        opts.push({ 
          label: `${alias} Result`, 
          value: `$node.${alias}.data`, 
          description: 'Full scraped data object', 
          type: 'node',
          nodeSubtype: 'scrape'
        });
      }

      const outputKey = node.data?.key || node.data?.dataKey;
      if (outputKey) {
        opts.push({ 
          label: `${alias} ${outputKey}`, 
          value: `$node.${alias}.${outputKey}`, 
          description: `Value of '${outputKey}'`, 
          type: 'node',
          nodeSubtype: subtype
        });
      }
      
      if (subtype === 'transform' || subtype === 'jsExpression') {
        opts.push({
          label: `${alias} Output`,
          value: `$node.${alias}.result`,
          description: 'JS execution result',
          type: 'node',
          nodeSubtype: subtype
        });
      }

      if (subtype === 'staticTable') {
        const columns = (node.data?.columns as string[]) || [];
        columns.forEach(col => {
          opts.push({
            label: `${alias} ${col}`,
            value: `$node.${alias}.${col}`,
            description: `Table column: ${col}`,
            type: 'node',
            nodeSubtype: 'staticTable'
          });
        });
        opts.push({
          label: `${alias} Index`,
          value: `$node.${alias}.$index`,
          description: 'Current loop index',
          type: 'node',
          nodeSubtype: 'staticTable'
        });
        opts.push({
          label: `${alias} Total`,
          value: `$node.${alias}.$total`,
          description: 'Total rows in table',
          type: 'node',
          nodeSubtype: 'staticTable'
        });
      }
    });

    return opts.filter(opt => 
      opt.label.toLowerCase().includes(search.toLowerCase()) || 
      opt.value.toLowerCase().includes(search.toLowerCase())
    );
  }, [nodes, edges, currentNodeId, search]);

  const handleSelect = (val: string) => {
    onSelect(`{{${val}}}`);
    setIsOpen(false);
    setSearch('');
  };

  const getIcon = (opt: VarOption) => {
    if (opt.type === 'system') return <Cpu className="w-3 h-3 text-gray-400" />;
    if (opt.type === 'trigger') return <Zap className="w-3 h-3 text-amber-500" />;
    if (opt.type === 'secret') return <Lock className="w-3 h-3 text-emerald-500" />;
    
    switch (opt.nodeSubtype) {
      case 'click': return <MousePointer2 className="w-3 h-3 text-indigo-400" />;
      case 'type': return <Type className="w-3 h-3 text-indigo-400" />;
      case 'scrape': return <Database className="w-3 h-3 text-indigo-400" />;
      case 'transform': return <Terminal className="w-3 h-3 text-indigo-400" />;
      case 'clipboard': return <Clipboard className="w-3 h-3 text-indigo-400" />;
      case 'staticTable': return <Database className="w-3 h-3 text-pink-400" />;
      default: return <Activity className="w-3 h-3 text-indigo-400" />;
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 rounded transition-colors ${
          isOpen ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50'
        }`}
        title="Insert Variable"
      >
        <Wand2 className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Search className="w-3 h-3 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent text-[11px] outline-none placeholder-gray-400"
              placeholder="Search variables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          
          <div className="max-h-60 overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="p-4 text-center text-[10px] text-gray-400 italic">
                No variables found
              </div>
            ) : (
              options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(opt.value)}
                  className="w-full text-left p-2 hover:bg-indigo-50 rounded flex flex-col gap-0.5 group transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getIcon(opt)}
                      <span className="text-[11px] font-semibold text-gray-700">{opt.label}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-1.5 ml-5">
                    <code className="text-[9px] text-indigo-500 font-mono bg-indigo-50/50 px-1 rounded truncate">
                      {opt.value}
                    </code>
                    <span className="text-[9px] text-gray-400 truncate">{opt.description}</span>
                  </div>
                </button>
              ))
            )}
          </div>
          
          <div className="p-1.5 bg-gray-50 border-t border-gray-100 text-[9px] text-gray-400 text-center">
            Tip: Use <code className="bg-white px-1 border border-gray-200 rounded">{"{{"}</code> to manually insert
          </div>
        </div>
      )}
    </div>
  );
}
