import { WorkflowNode, WorkflowEdge } from '@flowscript/schema';
import { LinearNode } from '../types/linear';

// Derives a simple linear chain of edges from ordered nodes.
// ConditionalNodes get 'true' and 'false' sourceHandles pointing to
// the next node in the true-branch list and false-branch list respectively.
// All other nodes get a single 'next' edge to the immediately following node.
export function deriveEdgesFromNodes(nodes: LinearNode[]): WorkflowEdge[] {
  const edges: WorkflowEdge[] = [];

  function helper(list: LinearNode[], nextNodeId: string | null) {
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      const isLast = i === list.length - 1;
      const nextInListId = isLast ? nextNodeId : list[i + 1].id;

      if (node.type === 'conditionalNode' || node.subtype === 'elementExists' || node.subtype === 'jsExpression') {
        const branchTrue = node.branchTrue || [];
        const branchFalse = node.branchFalse || [];

        if (branchTrue.length > 0) {
          edges.push({
            id: `e-${node.id}-${branchTrue[0].id}`,
            source: node.id,
            target: branchTrue[0].id,
            sourceHandle: 'true',
          });
          helper(branchTrue, nextInListId);
        } else if (nextInListId) {
          edges.push({
            id: `e-${node.id}-${nextInListId}`,
            source: node.id,
            target: nextInListId,
            sourceHandle: 'true',
          });
        }

        if (branchFalse.length > 0) {
          edges.push({
            id: `e-${node.id}-${branchFalse[0].id}`,
            source: node.id,
            target: branchFalse[0].id,
            sourceHandle: 'false',
          });
          helper(branchFalse, nextInListId);
        } else if (nextInListId) {
          edges.push({
            id: `e-${node.id}-${nextInListId}`,
            source: node.id,
            target: nextInListId,
            sourceHandle: 'false',
          });
        }
      } else {
        if (nextInListId) {
          const sourceHandle = node.type === 'triggerNode' ? 'trigger' : 'next';
          edges.push({
            id: `e-${node.id}-${nextInListId}`,
            source: node.id,
            target: nextInListId,
            sourceHandle,
          });
        }
      }
    }
  }

  helper(nodes, null);
  return edges;
}

// Recursively flattens the tree including branch children into a flat array for the executor.
export function flattenLinearNodes(nodes: LinearNode[]): WorkflowNode[] {
  const result: WorkflowNode[] = [];

  function traverse(list: LinearNode[]) {
    for (const node of list) {
      result.push({
        id: node.id,
        type: node.type,
        subtype: node.subtype,
        data: node.data,
        position: { x: 0, y: 0 },
      });

      if (node.branchTrue) {
        traverse(node.branchTrue);
      }
      if (node.branchFalse) {
        traverse(node.branchFalse);
      }
    }
  }

  traverse(nodes);
  return result;
}
