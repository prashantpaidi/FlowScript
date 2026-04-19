import React, { useState } from 'react';
import { browser } from 'wxt/browser';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Search, Trash2, Plus } from 'lucide-react';

interface ScrapeField {
    name: string;
    selector: string;
    type: 'text' | 'attribute';
    attrName?: string;
}

interface ScrapeNodeData {
    [key: string]: any;
    mode?: 'single' | 'list';
    selector?: string;
    key?: string;
    itemSelector?: string;
    fields?: ScrapeField[];
    onUpdate?: (newData: any) => void;
    onRemove?: () => void;
}

export function ScrapeNode({ data }: NodeProps<Node<ScrapeNodeData>>) {
    const [isPicking, setIsPicking] = useState(false);
    const [isPickingItem, setIsPickingItem] = useState(false);
    const [pickingFieldIndex, setPickingFieldIndex] = useState<number | null>(null);

    const mode = data.mode || 'list';

    const addField = () => {
        const fields = [...(data.fields || [])];
        fields.push({ name: `field_${fields.length + 1}`, selector: '', type: 'text' });
        data.onUpdate?.({ fields });
    };

    const updateField = (index: number, updates: Partial<ScrapeField>) => {
        const fields = [...(data.fields || [])];
        fields[index] = { ...fields[index], ...updates };
        data.onUpdate?.({ fields });
    };

    const removeField = (index: number) => {
        const fields = (data.fields || []).filter((_, i) => i !== index);
        data.onUpdate?.({ fields });
    };

    const startPicker = async (target: 'selector' | 'item' | 'field', index?: number) => {
        try {
            if (target === 'selector') setIsPicking(true);
            else if (target === 'item') setIsPickingItem(true);
            else setPickingFieldIndex(index ?? null);

            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            const pickerMode = (target === 'item') ? 'list' : 'single';
            const response = await browser.tabs.sendMessage(tab.id, { 
                type: 'START_PICKING',
                mode: pickerMode
            });
            if (response?.selectors && response.selectors.length > 0) {
                const bestSelector = response.selectors[0].value;
                if (target === 'selector') data.onUpdate?.({ selector: bestSelector });
                else if (target === 'item') data.onUpdate?.({ itemSelector: bestSelector });
                else if (target === 'field' && index !== undefined) updateField(index, { selector: bestSelector });
            }
        } catch (e) {
            console.error('Picker failed:', e);
        } finally {
            setIsPicking(false);
            setIsPickingItem(false);
            setPickingFieldIndex(null);
        }
    };

    return (
        <div className="bg-white border-2 border-purple-400 rounded-xl shadow-xl min-w-[280px] overflow-hidden group/node">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-3 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                        <Search size={16} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 leading-none">Capture</span>
                        <span className="font-bold text-sm tracking-tight">Scrape Action</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        className="bg-white/10 hover:bg-white/20 text-[10px] font-bold border-none rounded px-2 py-1 outline-none cursor-pointer transition-colors backdrop-blur-sm"
                        value={mode}
                        onChange={(e) => data.onUpdate?.({ mode: e.target.value })}
                    >
                        <option value="single" className="text-gray-900">Single</option>
                        <option value="list" className="text-gray-900">List</option>
                    </select>
                    <button onClick={() => data.onRemove?.()} className="p-1 hover:bg-white/20 rounded-md transition-colors">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 bg-white dark:bg-slate-900">
                {mode === 'single' ? (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selector</label>
                                <button
                                    onClick={() => startPicker('selector')}
                                    className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${isPicking ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
                                >
                                    {isPicking ? '⏳ Picking...' : '🎯 Pick'}
                                </button>
                            </div>
                            <input
                                type="text"
                                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-purple-500/20 font-mono"
                                placeholder="#price-id"
                                value={data.selector || ''}
                                onChange={(e) => data.onUpdate?.({ selector: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Key</label>
                            <input
                                type="text"
                                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-purple-500/20"
                                placeholder="e.g. price"
                                value={data.key || ''}
                                onChange={(e) => data.onUpdate?.({ key: e.target.value })}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Item Container */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Item Container</label>
                                <button
                                    onClick={() => startPicker('item')}
                                    className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${isPickingItem ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
                                >
                                    {isPickingItem ? '⏳ Picking...' : '🎯 Select Wrapper'}
                                </button>
                            </div>
                            <input
                                type="text"
                                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-purple-500/20 font-mono"
                                placeholder="div.product-card"
                                value={data.itemSelector || ''}
                                onChange={(e) => data.onUpdate?.({ itemSelector: e.target.value })}
                            />
                        </div>

                        {/* Field List */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Fields to Extract</label>
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                {(data.fields || []).map((field, idx) => (
                                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3 group/field relative">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                className="flex-1 text-[11px] font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-700 dark:text-slate-200"
                                                placeholder="Field Name"
                                                value={field.name}
                                                onChange={(e) => updateField(idx, { name: e.target.value })}
                                            />
                                            <button
                                                onClick={() => removeField(idx)}
                                                className="opacity-0 group-hover/field:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-white transition-opacity"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    className="w-full text-[10px] p-2 bg-white dark:bg-slate-900 border-none rounded-lg focus:ring-2 focus:ring-purple-500/20 font-mono pr-8"
                                                    placeholder=".title"
                                                    value={field.selector}
                                                    onChange={(e) => updateField(idx, { selector: e.target.value })}
                                                />
                                                <button
                                                    onClick={() => startPicker('field', idx)}
                                                    className={`absolute right-2 top-1/2 -translate-y-1/2 ${pickingFieldIndex === idx ? 'text-amber-500 animate-spin' : 'text-slate-300 hover:text-purple-500'}`}
                                                >
                                                    <Search size={10} />
                                                </button>
                                            </div>
                                            <select
                                                className="text-[10px] bg-white dark:bg-slate-900 border-none rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-purple-500/20 font-bold text-slate-500"
                                                value={field.type}
                                                onChange={(e) => updateField(idx, { type: e.target.value as any, attrName: e.target.value === 'attribute' ? 'src' : undefined })}
                                            >
                                                <option value="text">Text</option>
                                                <option value="attribute">Attr</option>
                                            </select>
                                        </div>
                                        {field.type === 'attribute' && (
                                            <input
                                                type="text"
                                                className="w-full text-[10px] p-2 bg-white dark:bg-slate-900 border-none rounded-lg focus:ring-2 focus:ring-purple-500/20 font-mono"
                                                placeholder="Attribute (e.g. href)"
                                                value={field.attrName || ''}
                                                onChange={(e) => updateField(idx, { attrName: e.target.value })}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={addField}
                                className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:border-purple-200 hover:text-purple-500 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={14} />
                                Add Data Point
                            </button>
                        </div>
                    </>
                )}
            </div>

            <Handle type="target" position={Position.Left} id="trigger-in" style={{ background: '#9333ea', width: 10, height: 10 }} />
            <Handle type="source" position={Position.Right} id="trigger-out" style={{ background: '#9333ea', width: 10, height: 10 }} />
        </div>
    );
}
