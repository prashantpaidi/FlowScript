import { describe, it, expect, beforeEach } from 'vitest';
import { executeWorkflow } from './executor';
import { nodeRegistry } from './registry';
import { WorkflowNode, WorkflowEdge } from '@flowscript/schema';
import { AutomationEnvironment, ExecutionController } from './environment';

describe('Flowchart Executor', () => {
  const mockEnv: AutomationEnvironment = {
    sendMessage: async () => ({ success: true }),
    url: 'https://example.com',
    location: {
      href: 'https://example.com',
      assign: () => {},
      reload: () => {},
    }
  };

  beforeEach(() => {
    // Register mock handlers
    nodeRegistry.register('add', async (config, inputs, context) => {
      const a = Number(inputs.a || 0);
      const b = Number(inputs.b || 0);
      return {
        data: { result: a + b },
        nextNodeId: context.getNextNodeId()
      };
    });

    nodeRegistry.register('multiply', async (config, inputs, context) => {
      const a = Number(inputs.a || 1);
      const b = Number(inputs.b || 1);
      return {
        data: { result: a * b },
        nextNodeId: context.getNextNodeId()
      };
    });

    nodeRegistry.register('constant', async (config, inputs, context) => {
      return {
        data: { value: config.value },
        nextNodeId: context.getNextNodeId()
      };
    });

    nodeRegistry.register('check_value', async (config, inputs, context) => {
      const val = Number(inputs.val || 0);
      const conditionResult = val > 10;
      return {
        data: { conditionResult },
        nextNodeId: context.getNextNodeId(conditionResult ? 'true' : 'false')
      };
    });

    nodeRegistry.register('left_branch', async (config, inputs, context) => {
      return {
        data: { msg: 'left executed' },
        nextNodeId: context.getNextNodeId()
      };
    });

    nodeRegistry.register('right_branch', async (config, inputs, context) => {
      return {
        data: { msg: 'right executed' },
        nextNodeId: context.getNextNodeId()
      };
    });

    nodeRegistry.register('join', async (config, inputs, context) => {
      const leftVal = inputs.leftVal || '';
      const rightVal = inputs.rightVal || '';
      return {
        data: { combined: `${leftVal}|${rightVal}` },
        nextNodeId: context.getNextNodeId()
      };
    });

    // A mock Loop/Iterator Node
    nodeRegistry.register('loop_node', async (config, inputs, context) => {
      const nodeId = context.currentNodeId;
      if (!context.loopStates) {
        context.loopStates = {};
      }

      let state = context.loopStates[nodeId];
      if (!state) {
        state = { index: 0, max: config.max || 3 };
        context.loopStates[nodeId] = state;
      } else {
        state.index++;
      }

      // Expose current index in variables
      context.state.nodes[nodeId] = { index: state.index };

      if (state.index < state.max) {
        return {
          data: { index: state.index },
          nextNodeId: context.getNextNodeId('loop')
        };
      } else {
        delete context.loopStates[nodeId];
        return {
          data: { index: state.index, done: true },
          nextNodeId: context.getNextNodeId('exit')
        };
      }
    });
  });

  it('should execute a linear flowchart sequence correctly', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'actionNode', subtype: 'constant', data: { value: 5 }, position: { x: 0, y: 0 } },
      { id: '3', type: 'actionNode', subtype: 'multiply', data: {}, position: { x: 0, y: 0 } },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: '1', target: '2', sourceHandle: 'next' },
      { id: 'e2', source: '2', target: '3', sourceHandle: 'next', targetHandle: 'a' },
      { id: 'e3', source: '1', target: '3', sourceHandle: 'multiplier', targetHandle: 'b' } // trigger-out direct input
    ];

    const results = await executeWorkflow(nodes, edges, '1', 'test-workflow', { multiplier: 3 }, mockEnv);

    // Node 2 outputs { value: 5 }
    expect(results['2']).toEqual({ value: 5 });

    // Node 3 inputs: a from 2 (5), b from 1 (3)
    // Node 3 outputs { result: 15 }
    expect(results['3']).toEqual({ result: 15 });
  });

  it('should support conditional branching', async () => {
    const nodes: WorkflowNode[] = [
      { id: 'trigger', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: 'cond', type: 'conditionalNode', subtype: 'check_value', data: {}, position: { x: 0, y: 0 } },
      { id: 'left', type: 'actionNode', subtype: 'left_branch', data: {}, position: { x: 0, y: 0 } },
      { id: 'right', type: 'actionNode', subtype: 'right_branch', data: {}, position: { x: 0, y: 0 } },
      { id: 'joinNode', type: 'actionNode', subtype: 'join', data: {}, position: { x: 0, y: 0 } }
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'trigger', target: 'cond', sourceHandle: 'next', targetHandle: 'val' },
      { id: 'e2', source: 'cond', target: 'left', sourceHandle: 'true' },
      { id: 'e3', source: 'cond', target: 'right', sourceHandle: 'false' },
      { id: 'e4', source: 'left', target: 'joinNode', sourceHandle: 'next', targetHandle: 'leftVal' },
      { id: 'e5', source: 'right', target: 'joinNode', sourceHandle: 'next', targetHandle: 'rightVal' }
    ];

    // Case A: Input val is 15 (> 10, so conditionResult: true).
    // True path is active (left executes). False path is skipped.
    const resultsA = await executeWorkflow(nodes, edges, 'trigger', 'test-workflow', { val: 15 }, mockEnv);
    expect(resultsA['left']).toEqual({ msg: 'left executed' });
    expect(resultsA['right']).toBeUndefined(); // skipped
    expect(resultsA['joinNode']).toEqual({ combined: 'left executed|' });

    // Case B: Input val is 5 (< 10, so conditionResult: false).
    // False path is active (right executes). True path is skipped.
    const resultsB = await executeWorkflow(nodes, edges, 'trigger', 'test-workflow', { val: 5 }, mockEnv);
    expect(resultsB['right']).toEqual({ msg: 'right executed' });
    expect(resultsB['left']).toBeUndefined(); // skipped
    expect(resultsB['joinNode']).toEqual({ combined: '|right executed' });
  });

  it('should support cycles and run a "While Loop" structure pointing back to earlier node', async () => {
    let bodyExecutions = 0;
    nodeRegistry.register('body_action', async (config, inputs, context) => {
      bodyExecutions++;
      return {
        data: { executed: true },
        nextNodeId: context.getNextNodeId()
      };
    });

    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'actionNode', subtype: 'loop_node', data: { max: 3 }, position: { x: 0, y: 0 } },
      { id: '3', type: 'actionNode', subtype: 'body_action', data: {}, position: { x: 0, y: 0 } },
      { id: '4', type: 'actionNode', subtype: 'constant', data: { value: 'done' }, position: { x: 0, y: 0 } }
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: '1', target: '2', sourceHandle: 'next' },
      { id: 'e2', source: '2', target: '3', sourceHandle: 'loop' },
      { id: 'e3', source: '3', target: '2', sourceHandle: 'next' }, // points back to loop node (cycle!)
      { id: 'e4', source: '2', target: '4', sourceHandle: 'exit' }
    ];

    const results = await executeWorkflow(nodes, edges, '1', 'loop-workflow', {}, mockEnv);

    // Body action should be executed exactly 3 times
    expect(bodyExecutions).toBe(3);

    // Exit node should be executed once at the end
    expect(results['4']).toEqual({ value: 'done' });
  });

  it('should abort execution mid-execution using ExecutionController', async () => {
    const controller = new ExecutionController();
    
    nodeRegistry.register('abort_trigger', async (config, inputs, context) => {
      controller.abort();
      return {
        data: { msg: 'aborted' },
        nextNodeId: context.getNextNodeId()
      };
    });

    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'actionNode', subtype: 'abort_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '3', type: 'actionNode', subtype: 'constant', data: { value: 100 }, position: { x: 0, y: 0 } }
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: '1', target: '2', sourceHandle: 'next' },
      { id: 'e2', source: '2', target: '3', sourceHandle: 'next' }
    ];

    await expect(executeWorkflow(nodes, edges, '1', 'abort-workflow', {}, mockEnv, controller))
      .rejects.toThrow('Workflow execution stopped by user');

    expect(nodeRegistry.getHandler('constant')).toBeDefined();
  });
});
