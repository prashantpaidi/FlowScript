import { Workflow, WorkflowEdge } from '@flowscript/schema';
import { LinearWorkflow, LinearNode } from '../types/linear';

function getNextNodeIdLocal(currentNodeId: string, edges: WorkflowEdge[], handleName?: string): string | undefined {
  if (handleName) {
    const edge = edges.find(e => e.source === currentNodeId && e.sourceHandle === handleName);
    if (edge) return edge.target;
    if (handleName !== 'next' && handleName !== 'default') {
      return undefined;
    }
  }
  const nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === 'next');
  if (nextEdge) return nextEdge.target;

  const defaultEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === 'default');
  if (defaultEdge) return defaultEdge.target;

  const anyEdge = edges.find(e => e.source === currentNodeId);
  return anyEdge?.target;
}

export function migrateWorkflowToLinear(workflow: Workflow): LinearWorkflow {
  const { id, name, nodes, edges, updatedAt } = workflow;

  // 1. Find the starting trigger node.
  let startNode = nodes.find(n => n.type === 'triggerNode');
  if (!startNode && nodes.length > 0) {
    startNode = nodes[0];
  }

  const visited = new Set<string>();

  function getSimplePath(startId: string | undefined): string[] {
    const path: string[] = [];
    let curr = startId;
    const pathVisited = new Set<string>();
    while (curr && !pathVisited.has(curr)) {
      pathVisited.add(curr);
      path.push(curr);
      curr = getNextNodeIdLocal(curr, edges);
    }
    return path;
  }

  function traverse(nodeId: string | undefined, stopNodes: Set<string>): LinearNode[] {
    if (!nodeId || stopNodes.has(nodeId) || visited.has(nodeId)) {
      return [];
    }

    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      return [];
    }

    visited.add(nodeId);

    const linearNode: LinearNode = {
      id: node.id,
      type: node.type,
      subtype: node.subtype,
      data: node.data,
    };

    if (node.type === 'conditionalNode' || node.subtype === 'elementExists' || node.subtype === 'jsExpression') {
      const trueTarget = getNextNodeIdLocal(nodeId, edges, 'true');
      const falseTarget = getNextNodeIdLocal(nodeId, edges, 'false');

      const pathTrue = getSimplePath(trueTarget);
      const pathFalse = getSimplePath(falseTarget);

      const setTrue = new Set(pathTrue);
      const mergeNodeId = pathFalse.find(id => setTrue.has(id));

      const branchStopNodes = new Set(stopNodes);
      if (mergeNodeId) {
        branchStopNodes.add(mergeNodeId);
      }

      linearNode.branchTrue = trueTarget ? traverse(trueTarget, branchStopNodes) : [];
      linearNode.branchFalse = falseTarget ? traverse(falseTarget, branchStopNodes) : [];

      if (mergeNodeId) {
        const remaining = traverse(mergeNodeId, stopNodes);
        return [linearNode, ...remaining];
      } else {
        return [linearNode];
      }
    } else {
      const nextId = getNextNodeIdLocal(nodeId, edges);
      const remaining = traverse(nextId, stopNodes);
      return [linearNode, ...remaining];
    }
  }

  const linearNodes = startNode ? traverse(startNode.id, new Set()) : [];

  return {
    id,
    name,
    linearNodes,
    updatedAt: updatedAt || Date.now(),
  };
}
