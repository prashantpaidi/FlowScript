import React from 'react';
import {
  ArrowLeft,
  Trash2,
  Download,
  Layout,
  FileCode,
  Radio
} from 'lucide-react';
import { useWorkflowStore } from '../../../src/store/useWorkflowStore';

interface FlowEditorHeaderProps {
  workflowId: string;
  workflows: any[];
  onBack: () => void;
  onSelect: (id: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onToggleViewMode: (mode: 'canvas' | 'code') => void;
  isRecording: boolean;
  toggleRecording: () => void;
}

export function FlowEditorHeader({
  workflowId,
  workflows,
  onBack,
  onSelect,
  onDelete,
  onExport,
  onToggleViewMode,
  isRecording,
  toggleRecording,
}: FlowEditorHeaderProps) {
  const { workflowName, setWorkflowName, viewMode } = useWorkflowStore();

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4 z-10 shadow-sm flex-shrink-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          title="Back to List"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="h-6 w-px bg-gray-200"></div>
        <input
          type="text"
          className="text-sm font-bold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 w-full min-w-0"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          placeholder="Workflow Name"
        />
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
          <button
            onClick={() => onToggleViewMode('canvas')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all flex items-center gap-1.5 ${
              viewMode === 'canvas'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Layout size={12} />
            Canvas
          </button>
          <button
            onClick={() => onToggleViewMode('code')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all flex items-center gap-1.5 ${
              viewMode === 'code'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <FileCode size={12} />
            Code
          </button>
        </div>

        <select
          className="text-xs bg-gray-100 border border-gray-200 rounded px-2 py-1 outline-none text-gray-600 font-medium cursor-pointer hover:bg-gray-200 transition-colors"
          value={workflowId}
          onChange={(e) => onSelect(e.target.value)}
        >
          {workflows.map(wf => (
            <option key={wf.id} value={wf.id}>{wf.name}</option>
          ))}
        </select>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          title="Delete workflow"
        >
          <Trash2 size={16} />
        </button>
        <button
          onClick={onExport}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
          title="Export workflow"
        >
          <Download size={16} />
        </button>
        <div className="h-4 w-px bg-gray-200 mx-1"></div>
        <button
          onClick={() => toggleRecording()}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all shadow-sm border ${
            isRecording
              ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Radio size={14} className={isRecording ? 'text-red-500' : 'text-gray-400'} />
          {isRecording ? 'Recording...' : 'Record'}
        </button>
      </div>
    </div>
  );
}
