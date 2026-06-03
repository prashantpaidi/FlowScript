import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useWorkflowStore } from '../../../src/store/useWorkflowStore';
import { LinearNode } from '../../../src/types/linear';

interface AddNodeButtonProps {
  afterId: string | null;
  branch?: 'true' | 'false';
}

const SUBTYPES = [
  { label: '⚡ Hotkey', subtype: 'hotkey' },
  { label: '🌐 Page Load', subtype: 'pageload' },
  { label: '🖱 Click', subtype: 'click' },
  { label: '⌨ Type', subtype: 'type' },
  { label: '⏱ Wait', subtype: 'wait' },
  { label: '🔍 Scrape', subtype: 'scrape' },
  { label: '📥 Add Row', subtype: 'addRow' },
  { label: '📝 Update Row', subtype: 'updateRow' },
  { label: '🔀 Conditional', subtype: 'elementExists' },
  { label: '🔗 Webhook', subtype: 'webhook' },
  { label: '🔄 Transform', subtype: 'transform' },
  { label: '📋 Clipboard', subtype: 'clipboard' },
  { label: '🔄 For Each Row', subtype: 'staticTable' },
  { label: '📝 Dynamic Form', subtype: 'dynamicForm' },
];

function inferTypeFromSubtype(subtype: string): string {
  if (subtype === 'hotkey' || subtype === 'pageload') {
    return 'triggerNode';
  }
  if (subtype === 'elementExists' || subtype === 'jsExpression') {
    return 'conditionalNode';
  }
  if (subtype === 'scrape') {
    return 'scrapeNode';
  }
  if (subtype === 'saveData' || subtype === 'addRow') {
    return 'addRowNode';
  }
  if (subtype === 'updateRow') {
    return 'updateRowNode';
  }
  if (subtype === 'transform') {
    return 'transformNode';
  }
  if (subtype === 'webhook') {
    return 'webhookNode';
  }
  if (subtype === 'dynamicForm') {
    return 'dynamicFormNode';
  }
  if (subtype === 'staticTable' || subtype === 'table') {
    return 'staticTableNode';
  }
  return 'actionNode';
}

export function AddNodeButton({ afterId, branch }: AddNodeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const { addNodeAfter } = useWorkflowStore();

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleSelect = (subtype: string) => {
    const type = inferTypeFromSubtype(subtype);
    const newNode: LinearNode = {
      id: crypto.randomUUID(),
      type,
      subtype,
      data: { subtype },
    };
    if (type === 'conditionalNode') {
      newNode.branchTrue = [];
      newNode.branchFalse = [];
    }
    addNodeAfter(afterId, newNode, branch);
    setIsOpen(false);
  };

  return (
    <div className="relative flex flex-col items-center z-20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 text-indigo-600 flex items-center justify-center shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
        title="Add Node"
      >
        <Plus size={16} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-9 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-48 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 z-30"
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1 border-b border-slate-100">
            Add Node
          </div>
          {SUBTYPES.map((item) => (
            <button
              key={item.subtype}
              onClick={() => handleSelect(item.subtype)}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors font-medium cursor-pointer flex items-center gap-2"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
