import { describe, it, expect, beforeEach } from 'vitest';
import { executeWorkflow } from './executor';
import { nodeRegistry } from './registry';
import { WorkflowNode, WorkflowEdge } from '@flowscript/schema';
import { AutomationEnvironment } from './environment';

describe('DAG Executor', () => {
  const mockEnv: AutomationEnvironment = {
    sendMessage: async () => ({ success: true }),
    location: {
      href: 'https://example.com',
      assign: () => {},
      reload: () => {},
    }
  };

  beforeEach(() => {
    // Register mock handlers
    nodeRegistry['add'] = async (config, inputs, context) => {
      const a = Number(inputs.a || 0);
      const b = Number(inputs.b || 0);
      return { result: a + b };
    };

    nodeRegistry['multiply'] = async (config, inputs, context) => {
      const a = Number(inputs.a || 1);
      const b = Number(inputs.b || 1);
      return { result: a * b };
    };

    nodeRegistry['constant'] = async (config, inputs, context) => {
      return { value: config.value };
    };
  });

  it('should execute a linear workflow correctly', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'actionNode', subtype: 'constant', data: { value: 5 }, position: { x: 0, y: 0 } },
      { id: '3', type: 'actionNode', subtype: 'multiply', data: {}, position: { x: 0, y: 0 } },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: '1', target: '2', sourceHandle: 'val', targetHandle: 'ignored' },
      { id: 'e2', source: '2', target: '3', sourceHandle: 'value', targetHandle: 'a' },
      { id: 'e3', source: '1', target: '3', sourceHandle: 'multiplier', targetHandle: 'b' }
    ];

    const results = await executeWorkflow(nodes, edges, '1', 'test-workflow', { val: 2, multiplier: 3 }, mockEnv);

    // Node 2 outputs { value: 5 }
    expect(results['2']).toEqual({ value: 5 });

    // Node 3 inputs: a from 2 (5), b from 1 (3)
    // Node 3 outputs { result: 15 }
    expect(results['3']).toEqual({ result: 15 });
  });

  it('should detect and throw on cycles', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'actionNode', subtype: 'add', data: {}, position: { x: 0, y: 0 } },
      { id: '3', type: 'actionNode', subtype: 'multiply', data: {}, position: { x: 0, y: 0 } },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' },
      { id: 'e3', source: '3', target: '2' }, // Cycle
    ];

    await expect(executeWorkflow(nodes, edges, '1', 'test-workflow', {}, mockEnv)).rejects.toThrow('Cycle detected in workflow graph');
  });

  it('should throw on missing handler', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'actionNode', subtype: 'unknown', data: {}, position: { x: 0, y: 0 } },
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: '1', target: '2' }];

    await expect(executeWorkflow(nodes, edges, '1', 'test-workflow', {}, mockEnv)).rejects.toThrow('Handler missing for node subtype: unknown');
  });

  it('should ignore unreachable nodes', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'actionNode', subtype: 'constant', data: { value: 10 }, position: { x: 0, y: 0 } },
      { id: 'unreachable', type: 'actionNode', subtype: 'add', data: {}, position: { x: 0, y: 0 } }
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: '1', target: '2' }];

    const results = await executeWorkflow(nodes, edges, '1', 'test-workflow', {}, mockEnv);
    expect(results['2']).toBeDefined();
    expect(results['unreachable']).toBeUndefined();
  });

  it('should execute staticTable node and return row array', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { 
        id: '2', 
        type: 'actionNode', 
        subtype: 'staticTable', 
        data: { 
          columns: ['item', 'price'], 
          rows: [
            { item: 'apple', price: 1.2 },
            { item: 'banana', price: 0.8 }
          ],
          alias: 'groceries'
        }, 
        position: { x: 0, y: 0 } 
      },
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: '1', target: '2' }];

    const results = await executeWorkflow(nodes, edges, '1', 'test-workflow', {}, mockEnv);
    expect(results['2']).toEqual([
      { item: 'apple', price: 1.2 },
      { item: 'banana', price: 0.8 }
    ]);
  });

  it('should execute downstream nodes of staticTable in a loop', async () => {
    const executedRows: any[] = [];
    nodeRegistry['mock_log'] = async (config, inputs, context) => {
      executedRows.push({
        item: config.item,
        price: config.price,
        index: config.index,
        total: config.total
      });
      return { logged: true };
    };

    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { 
        id: '2', 
        type: 'actionNode', 
        subtype: 'staticTable', 
        data: { 
          columns: ['item', 'price'], 
          rows: [
            { item: 'apple', price: 1.2 },
            { item: 'banana', price: 0.8 }
          ],
          alias: 'groceries'
        }, 
        position: { x: 0, y: 0 } 
      },
      {
        id: '3',
        type: 'actionNode',
        subtype: 'mock_log',
        data: {
          item: '{{$node.groceries.item}}',
          price: '{{$node.groceries.price}}',
          index: '{{$node.groceries.$index}}',
          total: '{{$node.groceries.$total}}'
        },
        position: { x: 0, y: 0 }
      }
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' }
    ];

    const results = await executeWorkflow(nodes, edges, '1', 'test-workflow', {}, mockEnv);

    expect(results['2']).toEqual([
      { item: 'apple', price: 1.2 },
      { item: 'banana', price: 0.8 }
    ]);

    expect(executedRows).toEqual([
      { item: 'apple', price: '1.2', index: '0', total: '2' },
      { item: 'banana', price: '0.8', index: '1', total: '2' }
    ]);
  });

  it('should abort execution when env.isAborted returns true', async () => {
    let callCount = 0;
    const testEnv: AutomationEnvironment = {
      sendMessage: async () => ({ success: true }),
      location: mockEnv.location,
      isAborted: () => {
        callCount++;
        return callCount > 1; // Abort after first node check
      }
    };

    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'actionNode', subtype: 'constant', data: { value: 10 }, position: { x: 0, y: 0 } },
      { id: '3', type: 'actionNode', subtype: 'constant', data: { value: 20 }, position: { x: 0, y: 0 } }
    ];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' }
    ];

    await expect(executeWorkflow(nodes, edges, '1', 'test-workflow', {}, testEnv)).rejects.toThrow('Workflow execution stopped by user');
  });

  it('should trigger onStateChange and onLog callbacks', async () => {
    const states: any[] = [];
    const logs: any[] = [];
    const testEnv: AutomationEnvironment = {
      sendMessage: async () => ({ success: true }),
      location: mockEnv.location,
      onStateChange: (state) => {
        states.push(state);
      },
      onLog: (msg, opts) => {
        logs.push({ msg, opts });
      }
    };

    const nodes: WorkflowNode[] = [
      { id: '1', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'actionNode', subtype: 'constant', data: { value: 42 }, position: { x: 0, y: 0 } }
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: '1', target: '2' }];

    await executeWorkflow(nodes, edges, '1', 'test-workflow', {}, testEnv);

    expect(states).toContainEqual({
      workflowId: 'test-workflow',
      status: 'running',
      currentNodeId: '2',
      loopProgress: undefined
    });
    expect(states).toContainEqual({
      workflowId: 'test-workflow',
      status: 'completed'
    });
    expect(logs.some(l => l.msg.includes('Executing node: constant'))).toBe(true);
  });

  it('should support conditional branching and join node execution', async () => {
    nodeRegistry['check_value'] = async (config, inputs, context) => {
      return { conditionResult: Number(inputs.val || 0) > 10 };
    };
    nodeRegistry['left_branch'] = async (config, inputs, context) => {
      return { msg: 'left executed' };
    };
    nodeRegistry['right_branch'] = async (config, inputs, context) => {
      return { msg: 'right executed' };
    };
    nodeRegistry['join'] = async (config, inputs, context) => {
      return { combined: (inputs.leftVal || '') + '|' + (inputs.rightVal || '') };
    };

    const nodes: WorkflowNode[] = [
      { id: 'trigger', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: 'cond', type: 'conditionalNode', subtype: 'check_value', data: {}, position: { x: 0, y: 0 } },
      { id: 'left', type: 'actionNode', subtype: 'left_branch', data: {}, position: { x: 0, y: 0 } },
      { id: 'right', type: 'actionNode', subtype: 'right_branch', data: {}, position: { x: 0, y: 0 } },
      { id: 'joinNode', type: 'actionNode', subtype: 'join', data: {}, position: { x: 0, y: 0 } }
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'trigger', target: 'cond', sourceHandle: 'val', targetHandle: 'val' },
      { id: 'e2', source: 'cond', target: 'left', sourceHandle: 'true' },
      { id: 'e3', source: 'cond', target: 'right', sourceHandle: 'false' },
      { id: 'e4', source: 'left', target: 'joinNode', sourceHandle: 'msg', targetHandle: 'leftVal' },
      { id: 'e5', source: 'right', target: 'joinNode', sourceHandle: 'msg', targetHandle: 'rightVal' }
    ];

    // Case A: Input val is 15 (> 10, so conditionResult: true).
    // True path is active (left executes). False path is dead (right does NOT execute).
    // The join node (joinNode) should still execute because one of its incoming paths is active (left).
    const resultsA = await executeWorkflow(nodes, edges, 'trigger', 'test-workflow', { val: 15 }, mockEnv);
    expect(resultsA['left']).toEqual({ msg: 'left executed' });
    expect(resultsA['right']).toBeUndefined(); // skipped
    expect(resultsA['joinNode']).toEqual({ combined: 'left executed|' });

    // Case B: Input val is 5 (< 10, so conditionResult: false).
    // False path is active (right executes). True path is dead (left does NOT execute).
    // The join node should execute because one of its incoming paths is active (right).
    const resultsB = await executeWorkflow(nodes, edges, 'trigger', 'test-workflow', { val: 5 }, mockEnv);
    expect(resultsB['right']).toEqual({ msg: 'right executed' });
    expect(resultsB['left']).toBeUndefined(); // skipped
    expect(resultsB['joinNode']).toEqual({ combined: '|right executed' });
  });

  it('should execute non-loop dependencies before starting the loop', async () => {
    const executionOrder: string[] = [];

    nodeRegistry['track'] = async (config, inputs, context) => {
      executionOrder.push(config.id);
      return { val: (inputs.inVal || 0) + 1 };
    };

    nodeRegistry['staticTable'] = async (config, inputs, context) => {
      executionOrder.push('table');
      return [
        { row: 1 },
        { row: 2 }
      ];
    };

    // Graph structure:
    // 'trigger' -> 'table' (loop node)
    // 'trigger' -> 'outside_node' (non-loop node, calculates some value)
    // 'table' -> 'inside_node' (inside the loop)
    // 'outside_node' -> 'inside_node' (inside_node depends on outside_node's value)
    // Because inside_node depends on outside_node, outside_node must execute before table starts.
    const nodes: WorkflowNode[] = [
      { id: 'trigger', type: 'triggerNode', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: 'outside_node', type: 'actionNode', subtype: 'track', data: { id: 'outside_node' }, position: { x: 0, y: 0 } },
      { id: 'table', type: 'actionNode', subtype: 'staticTable', data: { alias: 'table' }, position: { x: 0, y: 0 } },
      { id: 'inside_node', type: 'actionNode', subtype: 'track', data: { id: 'inside_node' }, position: { x: 0, y: 0 } }
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'trigger', target: 'table' },
      { id: 'e2', source: 'trigger', target: 'outside_node' },
      { id: 'e3', source: 'table', target: 'inside_node' },
      { id: 'e4', source: 'outside_node', target: 'inside_node', sourceHandle: 'val', targetHandle: 'inVal' }
    ];

    await executeWorkflow(nodes, edges, 'trigger', 'test-workflow', {}, mockEnv);

    // outside_node must execute BEFORE table
    const outsideIdx = executionOrder.indexOf('outside_node');
    const tableIdx = executionOrder.indexOf('table');
    const insideIdx = executionOrder.indexOf('inside_node');

    expect(outsideIdx).toBeGreaterThan(-1);
    expect(tableIdx).toBeGreaterThan(-1);
    expect(insideIdx).toBeGreaterThan(-1);

    expect(outsideIdx).toBeLessThan(tableIdx);
  });
});
