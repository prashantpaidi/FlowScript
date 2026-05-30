import { WorkflowNode, WorkflowEdge } from '@flowscript/schema';
import { nodeRegistry, INodeRegistry, NodeExecutionResult } from './registry';
import { AutomationEnvironment, WorkflowState, ExecutionContext, ExecutionController } from './environment';
import { VariableResolver } from './utils/variableResolver';

/**
 * Gets the next node ID in the flowchart based on the current node ID and defined handles.
 */
export function getNextNodeId(currentNodeId: string, edges: WorkflowEdge[], handleName?: string): string | undefined {
  if (handleName) {
    const edge = edges.find(e => e.source === currentNodeId && e.sourceHandle === handleName);
    if (edge) return edge.target;
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

export interface IDebuggerManager {
  attachIfNeeded(nodes: WorkflowNode[], registry: INodeRegistry): Promise<boolean>;
  detachIfNeeded(): Promise<void>;
}

export class CDPDebuggerManager implements IDebuggerManager {
  private attached = false;

  constructor(private env: AutomationEnvironment) {}

  async attachIfNeeded(nodes: WorkflowNode[], registry: INodeRegistry): Promise<boolean> {
    const hasNativeNode = nodes.some(node => {
      const handler = registry.getHandler(node.subtype);
      if (handler && typeof handler === 'object' && handler.requiresDebugger) {
        return handler.requiresDebugger(node);
      }
      return (
        node.data?.isNative || 
        node.subtype === 'pressKey' || 
        node.type === 'conditionalNode' ||
        (node.subtype === 'dynamicForm' && (node.data?.globalNative || (node.data?.mappings || []).some((m: any) => m.isNative)))
      );
    });

    if (hasNativeNode) {
      console.log('[Flowscript] Native nodes detected, attaching debugger...');
      try {
        const response = await this.env.sendMessage({ type: 'DEBUGGER_ATTACH' });
        if (response && !response.success) {
          throw new Error(`Failed to attach debugger: ${response.error}`);
        }
        this.attached = true;
        // Small grace period for debugger to settle
        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        console.error('[Flowscript] Debugger attachment failed:', err);
        throw new Error(`Debugger attachment failed: ${err.message}`);
      }
    }
    return this.attached;
  }

  async detachIfNeeded(): Promise<void> {
    if (this.attached) {
      console.log('[Flowscript] Detaching debugger...');
      await this.env.sendMessage({ type: 'DEBUGGER_DETACH' }).catch((err: any) => {
        console.error('[Flowscript] Failed to detach debugger:', err);
      });
      this.attached = false;
    }
  }
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
        const isControlHandle = ['next', 'default', 'true', 'false', 'row', 'loop', 'body', 'exit'].includes(edge.sourceHandle || '');
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

export class WorkflowExecutor {
  constructor(
    private registry: INodeRegistry,
    private debuggerManager: IDebuggerManager,
    private inputCollector: IInputCollector
  ) {}

  async execute(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    startNodeId: string,
    workflowId: string,
    initialOutputs: Record<string, any> = {},
    env: AutomationEnvironment,
    controller?: ExecutionController
  ): Promise<Record<string, Record<string, any>>> {
    const nodeOutputs: Record<string, Record<string, any>> = {
      [startNodeId]: initialOutputs
    };

    // Pre-flight attachment of debugger
    await this.debuggerManager.attachIfNeeded(nodes, this.registry);

    // Fetch secrets
    const secretsResponse = await env.sendMessage({ type: 'GET_LOCAL_SECRETS' }).catch(() => ({ secrets: {} }));

    // Initialize state
    const workflowState: WorkflowState = {
      nodes: {
        [startNodeId]: initialOutputs
      },
      trigger: initialOutputs,
      secrets: secretsResponse?.secrets || {},
      env: {
        url: env.url || '',
        browser: this.detectBrowser(),
        platform: this.detectPlatform()
      }
    };

    const loopStates: Record<string, any> = {};

    try {
      if (env.onStateChange) {
        env.onStateChange({
          workflowId,
          status: 'running',
          currentNodeId: startNodeId
        });
      }
      env.onLog?.('Starting workflow execution');

      let currentNodeId: string | undefined = startNodeId;
      const startNode = nodes.find(n => n.id === startNodeId);

      if (startNode && (startNode.type === 'triggerNode' || startNode.subtype === 'mock_trigger')) {
        currentNodeId = getNextNodeId(startNodeId, edges);
      }

      while (currentNodeId) {
        if (controller?.isAborted() || env.isAborted?.()) {
          throw new Error('Workflow execution stopped by user');
        }

        const nodeId = currentNodeId;
        const currentNode = nodes.find(n => n.id === nodeId);
        if (!currentNode) break;

        if (currentNode.type === 'triggerNode') {
          currentNodeId = getNextNodeId(nodeId, edges);
          continue;
        }

        const inputs = this.inputCollector.collectInputs(nodeId, edges, nodeOutputs);

        const handler = this.registry.getHandler(currentNode.subtype);
        if (!handler) {
          throw new Error(`Handler missing for node subtype: ${currentNode.subtype}`);
        }

        // Synchronize latest node outputs to the workflowState context
        this.syncWorkflowState(workflowState, nodeOutputs, nodes, loopStates);

        const resolvedData = VariableResolver.resolveDeep(currentNode.data || {}, workflowState);
        const alias = currentNode.alias || currentNode.data?.alias || `Node_${nodeId.slice(0, 4)}`;

        if (env.onStateChange) {
          env.onStateChange({
            workflowId,
            status: 'running',
            currentNodeId: nodeId
          });
        }

        env.onLog?.(`Executing node: ${currentNode.subtype} (${alias})`);

        // Construct ExecutionContext
        const context: ExecutionContext = {
          workflowId,
          env,
          state: workflowState,
          currentNodeId: nodeId,
          edges,
          nodes,
          loopStates,
          getNextNodeId: (handleName?: string) => getNextNodeId(nodeId, edges, handleName)
        };

        try {
          let result: NodeExecutionResult;
          if (typeof handler === 'function') {
            result = await handler(resolvedData, inputs, context);
          } else {
            result = await handler.execute(resolvedData, inputs, context);
          }

          // Record output data
          nodeOutputs[nodeId] = result.data || {};
          workflowState.nodes[nodeId] = result.data || {};
          if (alias) {
            workflowState.nodes[alias] = result.data || {};
          }

          env.onLog?.(`Node ${currentNode.subtype} executed successfully.`);

          currentNodeId = result.nextNodeId;

          const outgoingEdges = edges.filter(e => e.source === nodeId);
          if (outgoingEdges.length === 0 || currentNode.type === 'terminalNode') {
            break;
          }
        } catch (err: any) {
          env.onLog?.(`Node ${currentNode.subtype} failed: ${err.message}`, {
            isError: true
          });
          throw err;
        }
      }

      if (env.onStateChange) {
        env.onStateChange({
          workflowId,
          status: 'completed'
        });
      }
      env.onLog?.('Workflow completed successfully.');
    } catch (err: any) {
      const isStopped = err.message === 'Workflow execution stopped by user' || controller?.isAborted() || env.isAborted?.();
      if (env.onStateChange) {
        env.onStateChange({
          workflowId,
          status: isStopped ? 'stopped' : 'failed'
        });
      }
      env.onLog?.(isStopped ? 'Workflow execution stopped.' : `Workflow failed: ${err.message}`, {
        isError: !isStopped
      });
      throw err;
    } finally {
      await this.debuggerManager.detachIfNeeded();
    }

    return nodeOutputs;
  }

  private syncWorkflowState(
    workflowState: WorkflowState,
    nodeOutputs: Record<string, Record<string, any>>,
    nodes: WorkflowNode[],
    loopStates: Record<string, any>
  ) {
    for (const [nid, outputs] of Object.entries(nodeOutputs)) {
      const nodeObj = nodes.find(n => n.id === nid);
      const alias = nodeObj?.alias || nodeObj?.data?.alias;
      
      if (nodeObj?.subtype === 'staticTable' && loopStates[nid]) {
        continue;
      }

      workflowState.nodes[nid] = outputs;
      if (alias) {
        workflowState.nodes[alias] = outputs;
      }
    }
  }

  private detectBrowser(): string {
    if (typeof navigator !== 'undefined' && (navigator as any).userAgentData) {
      return (navigator as any).userAgentData.brands[0].brand;
    }
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Unknown';
    }
    return 'Unknown';
  }

  private detectPlatform(): string {
    return typeof navigator !== 'undefined' ? navigator.platform : 'unknown';
  }
}

/**
 * Executes a workflow sequentially starting from a specific trigger node.
 */
export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  startNodeId: string,
  workflowId: string,
  initialOutputs: Record<string, any> = {},
  env: AutomationEnvironment,
  controller?: ExecutionController
): Promise<Record<string, Record<string, any>>> {
  const debuggerManager = new CDPDebuggerManager(env);
  const inputCollector = new FlowchartInputCollector();
  const executor = new WorkflowExecutor(nodeRegistry, debuggerManager, inputCollector);
  return executor.execute(nodes, edges, startNodeId, workflowId, initialOutputs, env, controller);
}
