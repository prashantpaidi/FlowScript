import { describe, it, expect, beforeEach } from 'vitest';
import { executeWorkflow } from './executor';
import { nodeRegistry } from './registry';
import { WorkflowNode, WorkflowEdge } from './types';

describe('DAG Executor', () => {
  beforeEach(() => {
    // Register mock handlers
    nodeRegistry['add'] = async (config, inputs) => {
      const a = Number(inputs.a || 0);
      const b = Number(inputs.b || 0);
      return { result: a + b };
    };

    nodeRegistry['multiply'] = async (config, inputs) => {
      const a = Number(inputs.a || 1);
      const b = Number(inputs.b || 1);
      return { result: a * b };
    };

    nodeRegistry['constant'] = async (config, inputs) => {
      return { value: config.value };
    };
  });

  it('should execute a linear workflow correctly', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'trigger', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'action', subtype: 'constant', data: { value: 5 }, position: { x: 0, y: 0 } },
      { id: '3', type: 'action', subtype: 'multiply', data: {}, position: { x: 0, y: 0 } },
    ];
    
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: '1', target: '2', sourceHandle: 'val', targetHandle: 'ignored' },
      { id: 'e2', source: '2', target: '3', sourceHandle: 'value', targetHandle: 'a' },
      { id: 'e3', source: '1', target: '3', sourceHandle: 'multiplier', targetHandle: 'b' }
    ];

    const results = await executeWorkflow(nodes, edges, '1', { val: 2, multiplier: 3 });
    
    // Node 2 outputs { value: 5 }
    expect(results['2']).toEqual({ value: 5 });
    
    // Node 3 inputs: a from 2 (5), b from 1 (3)
    // Node 3 outputs { result: 15 }
    expect(results['3']).toEqual({ result: 15 });
  });

  it('should detect and throw on cycles', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'trigger', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'action', subtype: 'add', data: {}, position: { x: 0, y: 0 } },
      { id: '3', type: 'action', subtype: 'multiply', data: {}, position: { x: 0, y: 0 } },
    ];
    
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' },
      { id: 'e3', source: '3', target: '2' }, // Cycle
    ];

    await expect(executeWorkflow(nodes, edges, '1')).rejects.toThrow('Cycle detected in workflow graph');
  });

  it('should throw on missing handler', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'trigger', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'action', subtype: 'unknown', data: {}, position: { x: 0, y: 0 } },
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: '1', target: '2' }];

    await expect(executeWorkflow(nodes, edges, '1')).rejects.toThrow('Handler missing for node subtype: unknown');
  });

  it('should ignore unreachable nodes', async () => {
    const nodes: WorkflowNode[] = [
      { id: '1', type: 'trigger', subtype: 'mock_trigger', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'action', subtype: 'constant', data: { value: 10 }, position: { x: 0, y: 0 } },
      { id: 'unreachable', type: 'action', subtype: 'add', data: {}, position: { x: 0, y: 0 } }
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: '1', target: '2' }];

    const results = await executeWorkflow(nodes, edges, '1');
    expect(results['2']).toBeDefined();
    expect(results['unreachable']).toBeUndefined();
  });
});
