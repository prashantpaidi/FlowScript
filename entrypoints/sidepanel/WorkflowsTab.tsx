import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Code Editor Imports
import _Editor from 'react-simple-code-editor';
// @ts-ignore — handle CJS/ESM interop: the default export may be double-wrapped
const Editor: React.ComponentType<any> = (_Editor as any).default ?? _Editor;
// @ts-ignore
import prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';

import { Workflow, WorkflowNode, WorkflowEdge } from '../../nodes/types';
import { dehydrateWorkflow, validateManifest } from '../../src/shared/schema';
import { exportWorkflow, importWorkflow } from '../../src/shared/fileUtils';
import { TriggerNode } from './components/nodes/TriggerNode';
import { ActionNode } from './components/nodes/ActionNode';
import { ScrapeNode } from './components/nodes/ScrapeNode';
import { SaveDataNode } from './components/nodes/SaveDataNode';
import { ConditionalNode } from './components/nodes/ConditionalNode';
import { OutputNode } from './components/nodes/OutputNode';
import { NodePalette } from './components/NodePalette';

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  scrapeNode: ScrapeNode,
  conditionalNode: ConditionalNode,
  saveDataNode: SaveDataNode,
  outputNode: OutputNode,
};

interface FlowCanvasProps {
  workflowId: string;
  workflows: Workflow[];
  onBack: () => void;
  onSelect: (id: string) => void;
}

function FlowCanvas({ workflowId, workflows, onBack, onSelect }: FlowCanvasProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [workflowName, setWorkflowName] = useState('');
  const [viewMode, setViewMode] = useState<'canvas' | 'code'>('canvas');
  const [jsonCode, setJsonCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Use a ref to track workflows list without triggering effects
  const workflowsRef = React.useRef(workflows);
  useEffect(() => {
    workflowsRef.current = workflows;
  }, [workflows]);

  // Node removal helper
  const removeNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Load selected workflow
  useEffect(() => {
    const wf = workflows.find(w => w.id === workflowId);
    if (wf) {
      setWorkflowName(wf.name);

      const rfNodes: Node[] = wf.nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          ...n.data,
          subtype: n.subtype,
          onUpdate: (newData: any) => updateNodeData(n.id, newData),
          onRemove: () => removeNode(n.id)
        },
      }));

      const rfEdges: Edge[] = wf.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));

      setNodes(rfNodes);
      setEdges(rfEdges);

      setTimeout(() => fitView({ padding: 0.2 }), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]); // Only reload when workflow selection changes

  // Update storage whenever graph or name changes (Canvas Mode)
  useEffect(() => {
    if (!workflowId || viewMode !== 'canvas') return;

    const timer = setTimeout(() => {
      const currentWorkflows = workflowsRef.current;
      const updatedWorkflows = currentWorkflows.map(wf => {
        if (wf.id === workflowId) {
          return {
            ...wf,
            name: workflowName,
            nodes: nodes.map(n => ({
              id: n.id,
              type: n.type || 'actionNode',
              subtype: n.data.subtype,
              position: n.position,
              data: (({ onUpdate, onRemove, ...rest }) => rest)(n.data),
            })),
            edges: edges.map(e => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
            })),
            updatedAt: Date.now(),
          };
        }
        return wf;
      });

      storage.setItem('local:workflows', updatedWorkflows);
    }, 400);

    return () => clearTimeout(timer);
  }, [nodes, edges, workflowName, workflowId, viewMode]);

  // Update storage whenever JSON changes (Code Mode)
  useEffect(() => {
    if (!workflowId || viewMode !== 'code') return;

    const timer = setTimeout(() => {
      const activeId = workflowId;
      try {
        const parsed = JSON.parse(jsonCode);
        const validated = validateManifest(parsed);

        // Prevent stale jsonCode from overwriting a different workflow
        if (validated.id !== activeId) return;

        const currentWorkflows = workflowsRef.current;
        const updatedWorkflows = currentWorkflows.map(wf => {
          if (wf.id === workflowId) {
            return {
              ...wf,
              name: validated.name,
              nodes: validated.nodes.map(n => ({
                id: n.id,
                type: n.type,
                subtype: n.subtype,
                position: n.visual.position,
                data: n.data,
              })),
              edges: validated.edges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle,
              })),
              updatedAt: Date.now(),
            };
          }
          return wf;
        });

        storage.setItem('local:workflows', updatedWorkflows);
        setWorkflowName(validated.name);
        setValidationError(null);
      } catch (err: any) {
        setValidationError('Invalid schema: ' + (err.errors?.[0]?.message || err.message));
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [jsonCode, viewMode, workflowId]);

  const toggleViewMode = useCallback((mode: 'canvas' | 'code') => {
    // Early return if already in the requested mode
    if (mode === viewMode) return;

    if (mode === 'code') {
      try {
        const manifest = dehydrateWorkflow({
          id: workflowId,
          name: workflowName,
          nodes: nodes.map(n => ({
            ...n,
            subtype: n.data.subtype // Ensure subtype is passed for dehydration
          })),
          edges,
        });
        setJsonCode(JSON.stringify(manifest, null, 2));
        setValidationError(null);
        setViewMode('code');
      } catch (err: any) {
        setValidationError(err.message || String(err));
      }
    } else {
      try {
        const parsed = JSON.parse(jsonCode);
        const validated = validateManifest(parsed);

        // Verify that the manifest ID matches the current workflow ID
        if (validated.id !== workflowId) {
          setValidationError('Cannot apply manifest: workflow ID mismatch');
          return;
        }

        const rfNodes: Node[] = validated.nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: n.visual.position,
          measured: n.visual.measured,
          data: {
            ...n.data,
            subtype: n.subtype,
            onUpdate: (newData: any) => updateNodeData(n.id, newData),
            onRemove: () => removeNode(n.id)
          },
        }));

        const rfEdges: Edge[] = validated.edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);
        setWorkflowName(validated.name);
        setValidationError(null);
        setViewMode('canvas');
      } catch (err: any) {
        setValidationError('Repair JSON before switching: ' + (err.errors?.[0]?.message || err.message));
      }
    }
  }, [workflowId, workflowName, nodes, edges, jsonCode, viewMode, updateNodeData, removeNode, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNodeId = crypto.randomUUID();
      let subtype = '';
      if (type === 'triggerNode') subtype = 'hotkey';
      else if (type === 'actionNode') subtype = 'click';
      else if (type === 'scrapeNode') subtype = 'scrape';
      else if (type === 'conditionalNode') subtype = 'elementExists';
      else if (type === 'saveDataNode') subtype = 'saveData';

      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: {
          subtype,
          onUpdate: (newData: any) => updateNodeData(newNodeId, newData),
          onRemove: () => removeNode(newNodeId)
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, updateNodeData, removeNode]
  );

  const deleteCurrentWorkflow = () => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    const newWorkflows = workflows.filter(w => w.id !== workflowId);
    storage.setItem('local:workflows', newWorkflows).then(() => onBack());
  };

  const handleExport = () => {
    try {
      let manifest;

      if (viewMode === 'code') {
        // Export from code editor
        const parsed = JSON.parse(jsonCode);
        const validated = validateManifest(parsed);
        manifest = validated;
      } else {
        // Export from canvas state
        const storedWorkflow = workflows.find(w => w.id === workflowId);
        manifest = dehydrateWorkflow({
          id: workflowId,
          name: workflowName,
          updatedAt: storedWorkflow?.updatedAt,
          nodes: nodes.map(n => ({
            ...n,
            subtype: n.data.subtype
          })),
          edges,
        });
      }

      exportWorkflow(manifest);
    } catch (err: any) {
      setValidationError('Export failed: ' + (err.errors?.[0]?.message || err.message));
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50 overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4 z-10 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Back to List"
          >
            ←
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
          {/* Segmented Control (Toggle) */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              onClick={() => toggleViewMode('canvas')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all ${
                viewMode === 'canvas'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Canvas
            </button>
            <button
              onClick={() => toggleViewMode('code')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all ${
                viewMode === 'code'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
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
            onClick={deleteCurrentWorkflow}
            className="p-1 px-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
            title="Delete workflow"
          >
            🗑️
          </button>
          <button
            onClick={handleExport}
            className="p-1 px-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
            title="Export workflow"
          >
            📤
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {viewMode === 'canvas' ? (
          <>
            <NodePalette />
            <div className="flex-1 h-full relative">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
              >
                <Background color="#cbd5e1" gap={20} />
                <Controls />
                <MiniMap zoomable pannable />
                <Panel position="top-right" className="bg-white/80 backdrop-blur p-1 px-2 rounded-md shadow-sm border border-gray-200 pointer-events-none">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Workflow Builder</div>
                </Panel>
              </ReactFlow>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden font-mono text-sm relative">
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              <Editor
                value={jsonCode}
                onValueChange={(code: string) => setJsonCode(code)}
                highlight={(code: string) => prism.highlight(code, prism.languages.json, 'json')}
                padding={10}
                style={{
                  fontFamily: '"Fira code", "Fira Mono", monospace',
                  fontSize: 12,
                  backgroundColor: 'transparent',
                  color: '#e2e8f0',
                  minHeight: '100%',
                }}
                textareaClassName="outline-none"
              />
            </div>
            {validationError && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 backdrop-blur text-red-100 p-3 rounded-lg border border-red-500/50 text-xs shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="text-lg">⚠️</span>
                {validationError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowList({ workflows, onSelect }: { workflows: Workflow[], onSelect: (id: string) => void }) {
  const createWorkflow = () => {
    const id = crypto.randomUUID();
    const newWf: Workflow = {
      id,
      name: `Workflow ${workflows.length + 1}`,
      nodes: [],
      edges: [],
      updatedAt: Date.now(),
    };
    storage.setItem('local:workflows', [...workflows, newWf]).then(() => onSelect(id));
  };

  const deleteWorkflow = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    storage.setItem('local:workflows', workflows.filter(w => w.id !== id));
  };

  const handleImport = async () => {
    try {
      const manifest = await importWorkflow();
      const newWf: Workflow = {
        id: crypto.randomUUID(),
        name: `${manifest.name} (Imported)`,
        nodes: manifest.nodes.map(n => ({
          id: n.id,
          type: n.type,
          subtype: n.subtype,
          position: n.visual.position,
          data: n.data,
          measured: n.visual.measured || undefined,
        })),
        edges: manifest.edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || undefined,
          targetHandle: e.targetHandle || undefined,
        })),
        updatedAt: Date.now(),
      };
      await storage.setItem('local:workflows', [...workflows, newWf]);
      onSelect(newWf.id);
    } catch (err: any) {
      if (err?.reason !== 'NoFileSelected' && err.message !== 'No file selected') {
        alert(`Import Failed: ${err.message}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">My Workflows</h2>
          <p className="text-xs text-gray-500">Create and manage your automation flows</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <span>📥</span> Import
          </button>
          <button
            onClick={createWorkflow}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <span>+</span> New Workflow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1">
        {workflows.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">🛠️</div>
            <p className="text-gray-500 text-sm italic">No workflows yet. Start by creating one!</p>
          </div>
        ) : (
          workflows.map((wf) => (
            <div
              key={wf.id}
              onClick={() => onSelect(wf.id)}
              className="group bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-xl group-hover:bg-blue-100 transition-colors">
                  🌊
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{wf.name}</h3>
                  <p className="text-[10px] text-gray-400 font-medium tracking-tight">
                    Last active: {new Date(wf.updatedAt).toLocaleString()} • {wf.nodes.length} nodes
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => deleteWorkflow(e, wf.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all hover:scale-110"
                title="Delete workflow"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function WorkflowsTab() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  useEffect(() => {
    storage.getItem<Workflow[]>('local:workflows').then((res) => setWorkflows(res || []));
    const unwatch = storage.watch<Workflow[]>('local:workflows', (newVal) => {
      if (newVal) setWorkflows(newVal);
    });
    return () => unwatch();
  }, []);

  if (selectedWorkflowId) {
    return (
      <ReactFlowProvider>
        <FlowCanvas
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