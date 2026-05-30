import { WorkflowEdge } from '@flowscript/schema';

/**
 * Gets the next node ID in the flowchart based on the current node ID and defined handles.
 */
export function getNextNodeId(currentNodeId: string, edges: WorkflowEdge[], handleName?: string): string | undefined {
  if (handleName) {
    const edge = edges.find(e => e.source === currentNodeId && e.sourceHandle === handleName);
    if (edge) return edge.target;
    // If a specific control/branch handle is specified, do not fallback to generic next/default/any.
    if (handleName !== 'next' && handleName !== 'default') {
      return undefined;
    }
  }
  
  // Try 'next' handle first
  const nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === 'next');
  if (nextEdge) return nextEdge.target;

  // Try 'default' handle next
  const defaultEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === 'default');
  if (defaultEdge) return defaultEdge.target;

  // Fallback: any outgoing edge from this node
  const anyEdge = edges.find(e => e.source === currentNodeId);
  return anyEdge?.target;
}

/**
 * Extracts a specific value from a source node's outputs object.
 * Looks for common keys like value, result, data, scraped, conditionResult, etc.
 */
export function extractOutputValue(sourceOutput: any): any {
  if (sourceOutput === null || sourceOutput === undefined) return sourceOutput;
  if (typeof sourceOutput !== 'object') return sourceOutput;
  
  if (Array.isArray(sourceOutput)) return sourceOutput;
  
  const keys = ['value', 'result', 'data', 'scraped', 'conditionResult'];
  for (const key of keys) {
    if (key in sourceOutput) {
      return sourceOutput[key];
    }
  }
  
  const allKeys = Object.keys(sourceOutput);
  if (allKeys.length === 1) {
    return sourceOutput[allKeys[0]];
  }
  
  return sourceOutput;
}

export interface IInputCollector {
  collectInputs(
    currentNodeId: string, 
    edges: WorkflowEdge[], 
    nodeOutputs: Record<string, Record<string, any>>
  ): Record<string, any>;
}

export class FlowchartInputCollector implements IInputCollector {
  collectInputs(
    currentNodeId: string, 
    edges: WorkflowEdge[], 
    nodeOutputs: Record<string, Record<string, any>>
  ): Record<string, any> {
    const incomingEdges = edges.filter(e => e.target === currentNodeId);
    const inputs: Record<string, any> = {};
    for (const edge of incomingEdges) {
      const sourceOutput = nodeOutputs[edge.source];
      if (sourceOutput) {
        const isControlHandle = ['next', 'default', 'true', 'false', 'row', 'loop', 'body', 'exit', 'trigger-out'].includes(edge.sourceHandle || '');
        if (edge.sourceHandle && !isControlHandle) {
          const targetKey = edge.targetHandle || edge.sourceHandle;
          inputs[targetKey] = sourceOutput[edge.sourceHandle];
        } else {
          if (edge.targetHandle) {
            inputs[edge.targetHandle] = extractOutputValue(sourceOutput);
          } else {
            Object.assign(inputs, sourceOutput);
          }
        }
      }
    }
    return inputs;
  }
}
