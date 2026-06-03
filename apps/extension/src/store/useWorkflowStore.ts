import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { storageService } from '../services/StorageService';
import { LinearNode, LinearWorkflow } from '../types/linear';
import { migrateWorkflowToLinear } from '../utils/migrateWorkflow';

interface WorkflowState {
  activeWorkflowId: string | null;
  workflowName: string;
  linearNodes: LinearNode[];
  executionStatus: 'idle' | 'running' | 'stopping' | 'error';
  executionState: any | null;
  viewMode: 'editor' | 'code';

  // Actions
  setActiveWorkflow: (workflow: any | null) => void;
  setWorkflowName: (name: string) => void;
  setViewMode: (mode: 'editor' | 'code') => void;
  setExecutionState: (state: any) => void;
  applyManifest: (manifest: any) => void;

  // Linear node operations
  addNodeAfter: (afterId: string | null, node: LinearNode, branch?: 'true' | 'false') => void;
  updateNodeData: (nodeId: string, data: Partial<Record<string, any>>) => void;
  removeNode: (nodeId: string) => void;

  // For recorder compatibility
  appendNode: (node: LinearNode) => void;
}

// Immutable helper to update node data
function updateNodeInListImmutable(list: LinearNode[], nodeId: string, data: any): LinearNode[] {
  return list.map(node => {
    if (node.id === nodeId) {
      return {
        ...node,
        data: {
          ...node.data,
          ...data,
        }
      };
    }
    if (node.branchTrue || node.branchFalse) {
      const nextNode = { ...node };
      if (node.branchTrue) {
        nextNode.branchTrue = updateNodeInListImmutable(node.branchTrue, nodeId, data);
      }
      if (node.branchFalse) {
        nextNode.branchFalse = updateNodeInListImmutable(node.branchFalse, nodeId, data);
      }
      return nextNode;
    }
    return node;
  });
}

// Immutable helper to remove a node
function removeNodeFromListImmutable(list: LinearNode[], nodeId: string): LinearNode[] {
  return list
    .filter(node => node.id !== nodeId)
    .map(node => {
      if (node.branchTrue || node.branchFalse) {
        const nextNode = { ...node };
        if (node.branchTrue) {
          nextNode.branchTrue = removeNodeFromListImmutable(node.branchTrue, nodeId);
        }
        if (node.branchFalse) {
          nextNode.branchFalse = removeNodeFromListImmutable(node.branchFalse, nodeId);
        }
        return nextNode;
      }
      return node;
    });
}

// Immutable helper to add a node after another node
function addNodeToListImmutable(
  list: LinearNode[],
  afterId: string | null,
  newNode: LinearNode,
  branch?: 'true' | 'false'
): LinearNode[] {
  if (afterId === null) {
    return [newNode, ...list];
  }

  const index = list.findIndex(n => n.id === afterId);
  if (index !== -1) {
    const targetNode = list[index];
    const isCond = targetNode.type === 'conditionalNode' || 
                   targetNode.subtype === 'elementExists' || 
                   targetNode.subtype === 'jsExpression';

    if (branch === 'true' && isCond) {
      const updatedNode = {
        ...targetNode,
        branchTrue: [newNode, ...(targetNode.branchTrue || [])],
      };
      const newList = [...list];
      newList[index] = updatedNode;
      return newList;
    } else if (branch === 'false' && isCond) {
      const updatedNode = {
        ...targetNode,
        branchFalse: [newNode, ...(targetNode.branchFalse || [])],
      };
      const newList = [...list];
      newList[index] = updatedNode;
      return newList;
    } else {
      const newList = [...list];
      newList.splice(index + 1, 0, newNode);
      return newList;
    }
  }

  return list.map(node => {
    if (node.branchTrue || node.branchFalse) {
      const nextNode = { ...node };
      if (node.branchTrue) {
        nextNode.branchTrue = addNodeToListImmutable(node.branchTrue, afterId, newNode, branch);
      }
      if (node.branchFalse) {
        nextNode.branchFalse = addNodeToListImmutable(node.branchFalse, afterId, newNode, branch);
      }
      return nextNode;
    }
    return node;
  });
}

export const useWorkflowStore = create<WorkflowState>()(
  subscribeWithSelector((set, get) => ({
    activeWorkflowId: null,
    workflowName: '',
    linearNodes: [],
    executionStatus: 'idle',
    executionState: null,
    viewMode: 'editor',

    setActiveWorkflow: (workflow) => {
      if (!workflow) {
        set({
          activeWorkflowId: null,
          workflowName: '',
          linearNodes: [],
        });
        return;
      }

      let linearNodes: LinearNode[] = [];
      if ('linearNodes' in workflow && Array.isArray((workflow as any).linearNodes)) {
        linearNodes = (workflow as any).linearNodes;
      } else {
        const migrated = migrateWorkflowToLinear(workflow as any);
        linearNodes = migrated.linearNodes;
      }

      set({
        activeWorkflowId: workflow.id,
        workflowName: workflow.name,
        linearNodes,
      });
    },

    setWorkflowName: (name) => set({ workflowName: name }),
    setViewMode: (viewMode) => set({ viewMode }),
    setExecutionState: (executionState) => set({
      executionState,
      executionStatus: executionState?.status || 'idle'
    }),

    applyManifest: (manifest) => {
      const linearWf = migrateWorkflowToLinear({
        id: get().activeWorkflowId || manifest.id || crypto.randomUUID(),
        name: manifest.name,
        nodes: manifest.nodes,
        edges: manifest.edges,
        updatedAt: manifest.updatedAt || Date.now(),
      });
      set({
        workflowName: linearWf.name,
        linearNodes: linearWf.linearNodes,
      });
    },

    addNodeAfter: (afterId, node, branch) => {
      set((state) => ({
        linearNodes: addNodeToListImmutable(state.linearNodes, afterId, node, branch),
      }));
    },

    updateNodeData: (nodeId, data) => {
      set((state) => ({
        linearNodes: updateNodeInListImmutable(state.linearNodes, nodeId, data),
      }));
    },

    removeNode: (nodeId) => {
      set((state) => ({
        linearNodes: removeNodeFromListImmutable(state.linearNodes, nodeId),
      }));
    },

    appendNode: (node) => {
      set((state) => ({
        linearNodes: [...state.linearNodes, node],
      }));
    },
  }))
);

// Persistence logic
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

useWorkflowStore.subscribe(
  (state) => ({
    activeWorkflowId: state.activeWorkflowId,
    workflowName: state.workflowName,
    linearNodes: state.linearNodes,
    viewMode: state.viewMode,
  }),
  (current) => {
    if (!current.activeWorkflowId || current.viewMode !== 'editor') return;

    if (saveTimeout) clearTimeout(saveTimeout);

    saveTimeout = setTimeout(async () => {
      try {
        const workflows = await storageService.getItem<any[]>('local:workflows');
        if (!workflows || !Array.isArray(workflows)) {
          console.warn('[useWorkflowStore] Aborting persistence: workflows could not be read safely.');
          return;
        }

        const updatedWorkflows = workflows.map(wf => {
          if (wf.id === current.activeWorkflowId) {
            return {
              ...wf,
              name: current.workflowName,
              linearNodes: current.linearNodes,
              updatedAt: Date.now(),
            };
          }
          return wf;
        });

        await storageService.setItem('local:workflows', updatedWorkflows);
      } catch (err) {
        console.error('[useWorkflowStore] Persistence failed:', err);
      }
    }, 500);
  },
  {
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    fireImmediately: false,
  }
);
