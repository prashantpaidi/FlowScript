import { WorkflowNode, WorkflowEdge } from '@flowscript/schema';
import { nodeRegistry, INodeRegistry, NodeExecutionResult } from './registry';
import { AutomationEnvironment, WorkflowState, ExecutionContext, ExecutionController } from './environment';
import { VariableResolver } from './utils/variableResolver';
import { detectBrowser, detectPlatform } from './utils/platform';
import { getNextNodeId, IInputCollector, FlowchartInputCollector } from './collector';
import { IDebuggerManager, CDPDebuggerManager } from './debugger';

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

      let stepCount = 0;
      const maxSteps = (env as any).maxSteps || 1000;

      while (currentNodeId) {
        if (controller?.isAborted() || env.isAborted?.()) {
          throw new Error('Workflow execution stopped by user');
        }

        stepCount++;
        if (stepCount > maxSteps) {
          throw new Error(`Workflow execution exceeded maximum step limit of ${maxSteps} steps.`);
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
    return detectBrowser();
  }

  private detectPlatform(): string {
    return detectPlatform();
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
