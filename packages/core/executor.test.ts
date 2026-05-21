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
});
