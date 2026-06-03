import { describe, it, expect } from 'vitest';
import { Workflow, WorkflowNode, WorkflowEdge } from '@flowscript/schema';
import { migrateWorkflowToLinear } from './migrateWorkflow';
import { deriveEdgesFromNodes, flattenLinearNodes } from './deriveEdges';
import { LinearNode } from '../types/linear';

describe('Linear Editor Utilities', () => {
  describe('migrateWorkflowToLinear', () => {
    it('should migrate a simple flat sequential workflow', () => {
      const mockWorkflow: Workflow = {
        id: 'wf-1',
        name: 'Flat flow',
        nodes: [
          { id: 'trigger', type: 'triggerNode', subtype: 'hotkey', data: {}, position: { x: 0, y: 0 } },
          { id: 'action-1', type: 'actionNode', subtype: 'click', data: {}, position: { x: 0, y: 0 } },
          { id: 'action-2', type: 'actionNode', subtype: 'type', data: {}, position: { x: 0, y: 0 } },
        ],
        edges: [
          { id: 'e1', source: 'trigger', target: 'action-1', sourceHandle: 'trigger' },
          { id: 'e2', source: 'action-1', target: 'action-2', sourceHandle: 'next' },
        ],
        updatedAt: 12345,
      };

      const result = migrateWorkflowToLinear(mockWorkflow);
      expect(result.id).toBe('wf-1');
      expect(result.name).toBe('Flat flow');
      expect(result.linearNodes).toHaveLength(3);
      expect(result.linearNodes[0].id).toBe('trigger');
      expect(result.linearNodes[1].id).toBe('action-1');
      expect(result.linearNodes[2].id).toBe('action-2');
    });

    it('should ignore orphaned nodes not reachable from trigger', () => {
      const mockWorkflow: Workflow = {
        id: 'wf-2',
        name: 'Orphaned flow',
        nodes: [
          { id: 'trigger', type: 'triggerNode', subtype: 'hotkey', data: {}, position: { x: 0, y: 0 } },
          { id: 'action-1', type: 'actionNode', subtype: 'click', data: {}, position: { x: 0, y: 0 } },
          { id: 'orphan', type: 'actionNode', subtype: 'wait', data: {}, position: { x: 0, y: 0 } },
        ],
        edges: [
          { id: 'e1', source: 'trigger', target: 'action-1', sourceHandle: 'trigger' },
        ],
        updatedAt: 12345,
      };

      const result = migrateWorkflowToLinear(mockWorkflow);
      expect(result.linearNodes).toHaveLength(2);
      expect(result.linearNodes.map(n => n.id)).not.toContain('orphan');
    });

    it('should migrate conditional node with branches that merge back', () => {
      const mockWorkflow: Workflow = {
        id: 'wf-3',
        name: 'Conditional flow',
        nodes: [
          { id: 'trigger', type: 'triggerNode', subtype: 'hotkey', data: {}, position: { x: 0, y: 0 } },
          { id: 'cond', type: 'conditionalNode', subtype: 'elementExists', data: {}, position: { x: 0, y: 0 } },
          { id: 'true-act', type: 'actionNode', subtype: 'click', data: {}, position: { x: 0, y: 0 } },
          { id: 'false-act', type: 'actionNode', subtype: 'wait', data: {}, position: { x: 0, y: 0 } },
          { id: 'merge', type: 'actionNode', subtype: 'saveData', data: {}, position: { x: 0, y: 0 } },
        ],
        edges: [
          { id: 'e1', source: 'trigger', target: 'cond', sourceHandle: 'trigger' },
          { id: 'e-true', source: 'cond', target: 'true-act', sourceHandle: 'true' },
          { id: 'e-false', source: 'cond', target: 'false-act', sourceHandle: 'false' },
          { id: 'e-m1', source: 'true-act', target: 'merge', sourceHandle: 'next' },
          { id: 'e-m2', source: 'false-act', target: 'merge', sourceHandle: 'next' },
        ],
        updatedAt: 12345,
      };

      const result = migrateWorkflowToLinear(mockWorkflow);
      expect(result.linearNodes).toHaveLength(3); // trigger, cond, merge
      expect(result.linearNodes[0].id).toBe('trigger');
      
      const condNode = result.linearNodes[1];
      expect(condNode.id).toBe('cond');
      expect(condNode.branchTrue).toHaveLength(1);
      expect(condNode.branchTrue![0].id).toBe('true-act');
      expect(condNode.branchFalse).toHaveLength(1);
      expect(condNode.branchFalse![0].id).toBe('false-act');

      expect(result.linearNodes[2].id).toBe('merge');
    });
  });

  describe('deriveEdgesFromNodes', () => {
    it('should derive linear edges from sequential nodes', () => {
      const nodes: LinearNode[] = [
        { id: 'trigger', type: 'triggerNode', subtype: 'hotkey', data: {} },
        { id: 'act-1', type: 'actionNode', subtype: 'click', data: {} },
        { id: 'act-2', type: 'actionNode', subtype: 'type', data: {} },
      ];

      const edges = deriveEdgesFromNodes(nodes);
      expect(edges).toHaveLength(2);
      expect(edges[0]).toEqual({
        id: 'e-trigger-act-1',
        source: 'trigger',
        target: 'act-1',
        sourceHandle: 'trigger',
      });
      expect(edges[1]).toEqual({
        id: 'e-act-1-act-2',
        source: 'act-1',
        target: 'act-2',
        sourceHandle: 'next',
      });
    });

    it('should derive branch and merge edges for conditional nodes with unequal branch lengths', () => {
      const nodes: LinearNode[] = [
        { id: 'trigger', type: 'triggerNode', subtype: 'hotkey', data: {} },
        { 
          id: 'cond', 
          type: 'conditionalNode', 
          subtype: 'elementExists', 
          data: {},
          branchTrue: [
            { id: 'true-1', type: 'actionNode', subtype: 'click', data: {} },
            { id: 'true-2', type: 'actionNode', subtype: 'type', data: {} },
          ],
          branchFalse: [
            { id: 'false-1', type: 'actionNode', subtype: 'wait', data: {} },
          ]
        },
        { id: 'merge', type: 'actionNode', subtype: 'saveData', data: {} },
      ];

      const edges = deriveEdgesFromNodes(nodes);
      
      // Expected connections:
      // trigger -> cond
      // cond -true-> true-1
      // true-1 -> true-2
      // true-2 -> merge (continuation)
      // cond -false-> false-1
      // false-1 -> merge (continuation)
      expect(edges).toContainEqual({ id: 'e-trigger-cond', source: 'trigger', target: 'cond', sourceHandle: 'trigger' });
      expect(edges).toContainEqual({ id: 'e-cond-true-1-true', source: 'cond', target: 'true-1', sourceHandle: 'true' });
      expect(edges).toContainEqual({ id: 'e-true-1-true-2', source: 'true-1', target: 'true-2', sourceHandle: 'next' });
      expect(edges).toContainEqual({ id: 'e-true-2-merge', source: 'true-2', target: 'merge', sourceHandle: 'next' });
      expect(edges).toContainEqual({ id: 'e-cond-false-1-false', source: 'cond', target: 'false-1', sourceHandle: 'false' });
      expect(edges).toContainEqual({ id: 'e-false-1-merge', source: 'false-1', target: 'merge', sourceHandle: 'next' });
    });

    it('should derive direct merge connections if conditional branches are empty', () => {
      const nodes: LinearNode[] = [
        { 
          id: 'cond', 
          type: 'conditionalNode', 
          subtype: 'elementExists', 
          data: {},
          branchTrue: [],
          branchFalse: []
        },
        { id: 'merge', type: 'actionNode', subtype: 'saveData', data: {} },
      ];

      const edges = deriveEdgesFromNodes(nodes);
      expect(edges).toContainEqual({ id: 'e-cond-merge-true', source: 'cond', target: 'merge', sourceHandle: 'true' });
      expect(edges).toContainEqual({ id: 'e-cond-merge-false', source: 'cond', target: 'merge', sourceHandle: 'false' });
    });
  });

  describe('flattenLinearNodes', () => {
    it('should recursively flatten linear nodes in correct order', () => {
      const nodes: LinearNode[] = [
        { id: '1', type: 'triggerNode', subtype: 'hotkey', data: {} },
        { 
          id: '2', 
          type: 'conditionalNode', 
          subtype: 'elementExists', 
          data: {},
          branchTrue: [
            { id: '2t-1', type: 'actionNode', subtype: 'click', data: {} },
          ],
          branchFalse: [
            { id: '2f-1', type: 'actionNode', subtype: 'wait', data: {} },
          ]
        },
        { id: '3', type: 'actionNode', subtype: 'saveData', data: {} },
      ];

      const flat = flattenLinearNodes(nodes);
      expect(flat).toHaveLength(5);
      expect(flat.map(n => n.id)).toEqual(['1', '2', '2t-1', '2f-1', '3']);
      expect(flat.every(n => n.position.x === 0 && n.position.y === 0)).toBe(true);
    });
  });
});
