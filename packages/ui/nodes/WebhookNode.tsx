import React, { useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Globe, Trash2, Plus, Wand2, Settings2, Code, Database, ChevronDown } from 'lucide-react';
import { VariablePicker } from '../components/VariablePicker';

interface HeaderPair {
    key: string;
    value: string;
}

interface WebhookNodeData {
    method?: string;
    url?: string;
    headers?: HeaderPair[];
    bodyMode?: 'auto' | 'custom';
    body?: string;
    alias?: string;
    onUpdate?: (newData: any) => void;
    onRemove?: () => void;
}

export function WebhookNode({ id, data }: NodeProps<Node<WebhookNodeData>>) {
    const method = data.method || 'POST';
    const bodyMode = data.bodyMode || 'auto';
    const headers = data.headers || [];

    const addHeader = () => {
        const newHeaders = [...headers, { key: '', value: '' }];
        data.onUpdate?.({ headers: newHeaders });
    };

    const updateHeader = (index: number, updates: Partial<HeaderPair>) => {
        const newHeaders = [...headers];
        newHeaders[index] = { ...newHeaders[index], ...updates };
        data.onUpdate?.({ headers: newHeaders });
    };

    const removeHeader = (index: number) => {
        const newHeaders = headers.filter((_, i) => i !== index);
        data.onUpdate?.({ headers: newHeaders });
    };

    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    return (
        <div className="bg-white border-2 border-emerald-400 rounded-xl shadow-xl min-w-[300px] overflow-hidden group/node">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-3 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                        <Globe size={16} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 leading-none">Network</span>
                        <span className="font-bold text-sm tracking-tight">Webhook / API</span>
                    </div>
                </div>
                <div className="flex-1 px-4">
                    <input
                        type="text"
                        className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/30 text-[10px] text-white placeholder-emerald-200 border-none rounded px-2 py-1 outline-none transition-colors font-medium"
                        placeholder="Node Alias (e.g. API)"
                        value={data.alias || ''}
                        onChange={(e) => data.onUpdate?.({ alias: e.target.value })}
                    />
                </div>
                <button onClick={() => data.onRemove?.()} className="p-1 hover:bg-white/20 rounded-md transition-colors text-white/80 hover:text-white">
                    <Trash2 size={12} />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 bg-white dark:bg-slate-900">
                {/* Method & URL */}
                <div className="flex gap-2">
                    <div className="relative">
                        <select
                            className="appearance-none bg-slate-50 dark:bg-slate-800 text-[11px] font-bold border-none rounded-lg pl-3 pr-8 py-2.5 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500/20 text-slate-700 dark:text-slate-200"
                            value={method}
                            onChange={(e) => data.onUpdate?.({ method: e.target.value })}
                        >
                            {methods.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Target URL</label>
                            <VariablePicker
                                currentNodeId={id}
                                onSelect={(v) => data.onUpdate?.({ url: (data.url || '') + v })}
                            />
                        </div>
                        <input
                            type="text"
                            className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono"
                            placeholder="https://api.example.com/v1/..."
                            value={data.url || ''}
                            onChange={(e) => data.onUpdate?.({ url: e.target.value })}
                        />
                    </div>
                </div>

                {/* Headers */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Headers</label>
                        <button
                            onClick={addHeader}
                            className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                            <Plus size={10} /> Add Header
                        </button>
                    </div>
                    
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                        {headers.length === 0 ? (
                            <div className="text-[10px] text-slate-400 italic py-2 text-center border border-dashed border-slate-100 rounded-lg">
                                No custom headers
                            </div>
                        ) : (
                            headers.map((header, idx) => (
                                <div key={idx} className="flex gap-1.5 items-center group/header">
                                    <input
                                        type="text"
                                        className="flex-1 text-[10px] p-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-medium"
                                        placeholder="Key"
                                        value={header.key}
                                        onChange={(e) => updateHeader(idx, { key: e.target.value })}
                                    />
                                    <div className="flex-[1.5] relative">
                                        <input
                                            type="text"
                                            className="w-full text-[10px] p-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-emerald-500/20 pr-7"
                                            placeholder="Value"
                                            value={header.value}
                                            onChange={(e) => updateHeader(idx, { value: e.target.value })}
                                        />
                                        <div className="absolute right-1 top-1/2 -translate-y-1/2 scale-75">
                                            <VariablePicker
                                                currentNodeId={id}
                                                onSelect={(v) => updateHeader(idx, { value: (header.value || '') + v })}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeHeader(idx)}
                                        className="opacity-0 group-hover/header:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Body Mode */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Request Body</label>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                            <button
                                onClick={() => data.onUpdate?.({ bodyMode: 'auto' })}
                                className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${bodyMode === 'auto' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Auto
                            </button>
                            <button
                                onClick={() => data.onUpdate?.({ bodyMode: 'custom' })}
                                className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${bodyMode === 'custom' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Custom
                            </button>
                        </div>
                    </div>

                    {bodyMode === 'auto' ? (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                            <Database size={12} className="text-emerald-500" />
                            <span className="text-[10px] text-slate-500">Passing all upstream data automatically.</span>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[9px] text-slate-400 flex items-center gap-1"><Code size={10} /> JSON Body</span>
                                <VariablePicker
                                    currentNodeId={id}
                                    onSelect={(v) => data.onUpdate?.({ body: (data.body || '') + v })}
                                />
                            </div>
                            <textarea
                                className="w-full text-[10px] p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono min-h-[80px] resize-none"
                                placeholder='{ "key": "value" }'
                                value={data.body || ''}
                                onChange={(e) => data.onUpdate?.({ body: e.target.value })}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Ports */}
            <Handle type="target" position={Position.Left} id="trigger-in" style={{ background: '#10b981', width: 10, height: 10 }} />
            <Handle type="source" position={Position.Right} id="trigger-out" style={{ background: '#10b981', width: 10, height: 10 }} />
        </div>
    );
}
