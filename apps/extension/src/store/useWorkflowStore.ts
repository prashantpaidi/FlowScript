import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  type Node,
  type Edge,
  type Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange
} from '@xyflow/react';
import { Workflow } from '@flowscript/schema';
import { storageService } from '../services/StorageService';

interface WorkflowState {
  activeWorkflowId: string | null;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
  executionStatus: 'idle' | 'running' | 'stopping' | 'error';
  executionState: any | null;
  viewMode: 'canvas' | 'code';

  // Actions
  setActiveWorkflow: (workflow: Workflow | null) => void;
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setWorkflowName: (name: string) => void;
  setViewMode: (mode: 'canvas' | 'code') => void;
  setExecutionState: (state: any) => void;

  // Node management
  updateNodeData: (nodeId: string, newData: any) => void;
  removeNode: (nodeId: string) => void;
  addNode: (node: Node) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  subscribeWithSelector((set, get) => ({
    activeWorkflowId: null,
    workflowName: '',
    nodes: [],
    edges: [],
    executionStatus: 'idle',
    executionState: null,
    viewMode: 'canvas',

    setActiveWorkflow: (workflow) => {
      if (!workflow) {
        set({
          activeWorkflowId: null,
          workflowName: '',
          nodes: [],
          edges: [],
        });
        return;
      }

      const rfNodes: Node[] = workflow.nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          ...n.data,
          subtype: n.subtype,
        },
      }));

      const rfEdges: Edge[] = workflow.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));

      set({
        activeWorkflowId: workflow.id,
        workflowName: workflow.name,
        nodes: rfNodes,
        edges: rfEdges,
      });
    },

    setNodes: (nodes) => {
      set((state) => ({
        nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes,
      }));
    },

    setEdges: (edges) => {
      set((state) => ({
        edges: typeof edges === 'function' ? edges(state.edges) : edges,
      }));
    },

    onNodesChange: (changes) => {
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
      }));
    },

    onEdgesChange: (changes) => {
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      }));
    },

    onConnect: (connection) => {
      set((state) => ({
        edges: addEdge(connection, state.edges),
      }));
    },

    setWorkflowName: (name) => set({ workflowName: name }),
    setViewMode: (viewMode) => set({ viewMode }),
    setExecutionState: (executionState) => set({
        executionState,
        executionStatus: executionState?.status || 'idle'
    }),

    updateNodeData: (nodeId, newData) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...newData } };
          }
          return node;
        }),
      }));
    },

    removeNode: (nodeId) => {
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      }));
    },

    addNode: (node) => {
      set((state) => ({
        nodes: [...state.nodes, node],
      }));
    },
  }))
);

// Persistence logic: Listen to changes and save to storage
useWorkflowStore.subscribe(
  (state) => ({
    activeWorkflowId: state.activeWorkflowId,
    workflowName: state.workflowName,
    nodes: state.nodes,
    edges: state.edges,
    viewMode: state.viewMode,
  }),
  async (current) => {
    if (!current.activeWorkflowId || current.viewMode !== 'canvas') return;

    const workflows = await storageService.getItem<Workflow[]>('local:workflows') || [];
    const updatedWorkflows = workflows.map(wf => {
      if (wf.id === current.activeWorkflowId) {
        return {
          ...wf,
          name: current.workflowName,
          nodes: current.nodes.map(n => ({
            id: n.id,
            type: n.type || 'actionNode',
            subtype: n.data.subtype,
            position: n.position,
            data: (({ onUpdate, onRemove, ...rest }) => rest)(n.data),
          })),
          edges: current.edges.map(e => ({
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

    await storageService.setItem('local:workflows', updatedWorkflows);
  },
  {
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    fireImmediately: false,
  }
);
