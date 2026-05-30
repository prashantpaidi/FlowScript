import { describe, it, expect, vi } from 'vitest';
import { handleCondition } from './condition';
import { AutomationEnvironment, ExecutionContext } from '../environment';

describe('handleCondition', () => {
  const mockSendMessage = vi.fn();
  const mockEnv: AutomationEnvironment = {
    sendMessage: mockSendMessage,
    url: 'https://example.com',
    location: {
      href: 'https://example.com',
      assign: vi.fn(),
      reload: vi.fn(),
    }
  };

  it('should test elementExists with context-based subtype resolution', async () => {
    mockSendMessage.mockResolvedValue({
      result: { value: true }
    });

    const context: any = {
      currentNodeId: 'node-1',
      nodes: [
        { id: 'node-1', type: 'conditionalNode', subtype: 'elementExists', data: {} }
      ],
      env: mockEnv,
      getNextNodeId: (handle: string) => `next-${handle}`
    };

    const result = await handleCondition({ selector: '.my-button' }, {}, context);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'EVALUATE_JS',
      expression: '!!document.querySelector(".my-button")'
    });
    expect(result.data.conditionResult).toBe(true);
    expect(result.nextNodeId).toBe('next-true');
  });

  it('should test jsExpression correctly', async () => {
    mockSendMessage.mockResolvedValue({
      result: { value: false }
    });

    const context: any = {
      currentNodeId: 'node-2',
      nodes: [
        { id: 'node-2', type: 'conditionalNode', subtype: 'jsExpression', data: {} }
      ],
      env: mockEnv,
      getNextNodeId: (handle: string) => `next-${handle}`
    };

    const result = await handleCondition({ expr: 'inputs.val > 10' }, { val: 5 }, context);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'EVALUATE_JS',
      expression: '(function(inputs) { return inputs.val > 10; })({"val":5})'
    });
    expect(result.data.conditionResult).toBe(false);
    expect(result.nextNodeId).toBe('next-false');
  });

  it('should throw if elementExists check is missing selector', async () => {
    const context: any = {
      currentNodeId: 'node-3',
      nodes: [
        { id: 'node-3', type: 'conditionalNode', subtype: 'elementExists', data: {} }
      ],
      env: mockEnv
    };

    await expect(handleCondition({}, {}, context)).rejects.toThrow('[Condition] Element Exists check requires a selector');
  });

  it('should throw if jsExpression check is missing expression', async () => {
    const context: any = {
      currentNodeId: 'node-4',
      nodes: [
        { id: 'node-4', type: 'conditionalNode', subtype: 'jsExpression', data: {} }
      ],
      env: mockEnv
    };

    await expect(handleCondition({}, {}, context)).rejects.toThrow('[Condition] JS Expression check requires an expression');
  });
});
