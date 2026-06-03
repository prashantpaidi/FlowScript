import React, { useCallback, useEffect, useState } from 'react';

import { 
  Plus, 
  Waves, 
  Hammer,
  Upload,
  Trash2
} from 'lucide-react';

import { Workflow, dehydrateWorkflow, validateManifest } from '@flowscript/schema';
import { exportWorkflow, importWorkflow } from '@flowscript/utils';
import { ReactFlowProvider } from '@xyflow/react';
import { 
  WorkflowContext
} from '@flowscript/ui';
import { automationBridge } from '../../src/services/AutomationBridge';
import { storageService } from '../../src/services/StorageService';

import { useWorkflowStore } from '../../src/store/useWorkflowStore';
import { useWorkflowRecording } from '../../src/hooks/useWorkflowRecording';
import { FlowEditorHeader } from './components/FlowEditorHeader';
import { LinearEditor } from './components/LinearEditor';
import { ManifestEditor } from './components/ManifestEditor';
import { FlowErrorBoundary } from './components/FlowErrorBoundary';
import { flattenLinearNodes, deriveEdgesFromNodes } from '../../src/utils/deriveEdges';
import { migrateWorkflowToLinear } from '../../src/utils/migrateWorkflow';

function FlowEditor({ workflowId, workflows, onBack, onSelect }: {
  workflowId: string;
  workflows: any[];
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const {
    setActiveWorkflow,
    viewMode,
    linearNodes,
    workflowName,
    description,
    updateNodeData,
    removeNode,
    setExecutionState,
    applyManifest,
    setViewMode
  } = useWorkflowStore();

  const [jsonCode, setJsonCode] = useState('');
  const { isRecording, toggleRecording } = useWorkflowRecording();

  useEffect(() => {
    const wf = workflows.find(w => w.id === workflowId);
    if (wf) {
      setActiveWorkflow(wf);
    }
  }, [workflowId, workflows, setActiveWorkflow]);

  useEffect(() => {
    const unwatch = storageService.watch('local:executionState', (newValue) => {
      setExecutionState(newValue);
    });
    return () => unwatch();
  }, [setExecutionState]);

  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (viewMode === 'code') {
      try {
        const flatNodes = flattenLinearNodes(linearNodes);
        const derivedEdges = deriveEdgesFromNodes(linearNodes);

        const manifest = dehydrateWorkflow({
          id: workflowId,
          name: workflowName,
          description,
          nodes: flatNodes.map(n => ({
            ...n,
            subtype: n.data.subtype || (n.data as any).subtype
          })),
          edges: derivedEdges,
        });

        const codeManifest = {
          ...manifest,
          nodes: manifest.nodes.map(({ visual, ...nodeRest }: any) => nodeRest)
        };

        setJsonCode(JSON.stringify(codeManifest, null, 2));
      } catch (err) {
        console.error('Failed to dehydrate workflow for code view:', err);
      }
    }
  }, [viewMode, workflowId, workflowName, linearNodes]);

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    const newWorkflows = workflows.filter(w => w.id !== workflowId);
    storageService.setItem('local:workflows', newWorkflows)
      .then(() => onBack())
      .catch((err) => console.error('Failed to delete workflow:', err));
  };

  const handleToggleViewMode = useCallback((mode: 'editor' | 'code') => {
    if (mode === viewMode) return;

    if (mode === 'editor') {
      try {
        const parsed = JSON.parse(jsonCode);
        const validated = validateManifest(parsed);
        if (validated.id !== workflowId) {
          setValidationError('Cannot apply manifest: workflow ID mismatch');
          return;
        }

        applyManifest(validated);
        setValidationError(null);
        setViewMode('editor');
      } catch (err: any) {
        setValidationError('Repair JSON before switching: ' + (err.errors?.[0]?.message || err.message));
      }
    } else {
      setViewMode('code');
    }
  }, [viewMode, jsonCode, workflowId, applyManifest, setViewMode]);

  const handleExport = () => {
    try {
      let manifest;
      if (viewMode === 'code') {
        manifest = validateManifest(JSON.parse(jsonCode));
      } else {
        const storedWorkflow = workflows.find(w => w.id === workflowId);
        const flatNodes = flattenLinearNodes(linearNodes);
        const derivedEdges = deriveEdgesFromNodes(linearNodes);
        manifest = dehydrateWorkflow({
          id: workflowId,
          name: workflowName,
          description,
          updatedAt: storedWorkflow?.updatedAt,
          nodes: flatNodes.map(n => ({
            ...n,
            subtype: n.data.subtype || (n.data as any).subtype
          })),
          edges: derivedEdges,
        });
      }
      exportWorkflow(manifest);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <WorkflowContext.Provider value={{ updateNodeData, removeNode, automationBridge, storageService }}>
      <div className="flex flex-col h-full w-full bg-gray-50 overflow-hidden">
        <FlowEditorHeader
          workflowId={workflowId}
          workflows={workflows}
          onBack={onBack}
          onSelect={onSelect}
          onDelete={handleDelete}
          onExport={handleExport}
          onToggleViewMode={handleToggleViewMode}
          isRecording={isRecording}
          toggleRecording={toggleRecording}
        />
        <div className="flex flex-1 overflow-hidden relative">
          {viewMode === 'editor' ? (
            <FlowErrorBoundary>
              <LinearEditor workflowId={workflowId} />
            </FlowErrorBoundary>
          ) : (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <ManifestEditor
                jsonCode={jsonCode}
                onValueChange={setJsonCode}
              />
              {validationError && (
                <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 backdrop-blur text-red-100 p-3 rounded-lg border border-red-500/50 text-xs shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 z-50">
                  <span className="text-lg">⚠️</span>
                  {validationError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </WorkflowContext.Provider>
  );
}

function WorkflowList({ workflows, onSelect }: { workflows: any[], onSelect: (id: string) => void }) {
  const createWorkflow = () => {
    const id = crypto.randomUUID();
    const newWf = {
      id,
      name: `Workflow ${workflows.length + 1}`,
      linearNodes: [],
      updatedAt: Date.now(),
    };
    storageService.setItem('local:workflows', [...workflows, newWf])
      .then(() => onSelect(id))
      .catch((err) => console.error('Failed to create workflow:', err));
  };

  const deleteWorkflow = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    storageService.setItem('local:workflows', workflows.filter(w => w.id !== id))
      .catch((err) => console.error('Failed to delete workflow from list:', err));
  };

  const handleImport = async () => {
    try {
      const manifest = await importWorkflow();
      const validated = validateManifest(manifest);
      const migrated = migrateWorkflowToLinear(validated as any);

      const newWf = {
        id: crypto.randomUUID(),
        name: `${validated.name} (Imported)`,
        description: validated.description,
        linearNodes: migrated.linearNodes,
        updatedAt: Date.now(),
      };
      await storageService.setItem('local:workflows', [...workflows, newWf]);
      onSelect(newWf.id);
    } catch (err: any) {
      if (err?.reason !== 'NoFileSelected' && err.message !== 'No file selected') {
        alert(`Import Failed: ${err.message}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">My Workflows</h2>
          <p className="text-xs text-gray-500">Create and manage your automation flows</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <Upload size={14} className="text-gray-400" /> Import
          </button>
          <button
            onClick={createWorkflow}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Plus size={14} /> New Workflow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1">
        {workflows.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-gray-50 rounded-full">
                <Hammer size={32} className="text-gray-300" />
              </div>
            </div>
            <p className="text-gray-500 text-sm italic">No workflows yet. Start by creating one!</p>
          </div>
        ) : (
          workflows.map((wf) => {
            const nodeCount = wf.linearNodes ? flattenLinearNodes(wf.linearNodes).length : (wf.nodes ? wf.nodes.length : 0);
            return (
              <div
                key={wf.id}
                onClick={() => onSelect(wf.id)}
                className="group bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <Waves size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{wf.name}</h3>
                    <p className="text-[10px] text-gray-400 font-medium tracking-tight">
                      Last active: {new Date(wf.updatedAt).toLocaleString()} • {nodeCount} nodes
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => deleteWorkflow(e, wf.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all hover:scale-110"
                  title="Delete workflow"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function WorkflowsTab() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);

  useEffect(() => {
    storageService.getItem<any[]>('local:workflows')
      .then((res) => setWorkflows(res || []))
      .catch((err) => console.error('Failed to get workflows:', err));
    const unwatch = storageService.watch<any[]>('local:workflows', (newVal) => {
      if (newVal) setWorkflows(newVal);
    });
    return () => unwatch();
  }, []);

  if (selectedWorkflowId) {
    return (
      <ReactFlowProvider>
        <FlowEditor
          workflowId={selectedWorkflowId}
          workflows={workflows}
          onBack={() => setSelectedWorkflowId(null)}
          onSelect={setSelectedWorkflowId}
        />
      </ReactFlowProvider>
    );
  }

  return <WorkflowList workflows={workflows} onSelect={setSelectedWorkflowId} />;
}
