import { describe, it, expect } from 'vitest';
import { TableDataSchema, NodeSchema } from '@flowscript/schema';
import { handleStaticTable } from './staticTable';
import { ExecutionContext } from '../environment';

describe('staticTable Handler and Schema', () => {
  describe('Schema Validation', () => {
    it('should validate a correct table structure', () => {
      const validData = {
        columns: ['name', 'age'],
        rows: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        alias: 'myTable',
      };

      const result = TableDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail validation if alias is missing or empty', () => {
      const invalidData = {
        columns: ['name'],
        rows: [{ name: 'Alice' }],
        alias: '',
      };

      const result = TableDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Alias is required');
      }
    });

    it('should fail validation if row keys do not match columns', () => {
      const invalidData = {
        columns: ['name'],
        rows: [{ name: 'Alice', age: 30 }],
        alias: 'myTable',
      };

      const result = TableDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('not defined in columns');
      }
    });

    it('should fail node validation if staticTable node data is invalid', () => {
      const invalidNode = {
        id: 'node-1',
        type: 'actionNode',
        subtype: 'staticTable',
        data: {
          columns: ['name'],
          rows: [{ age: 30 }], // age not in columns
          alias: 'myTable',
        },
      };

      const result = NodeSchema.safeParse(invalidNode);
      expect(result.success).toBe(false);
    });
  });

  describe('Handler Execution', () => {
    it('should return the first row context on first execution and progress through iterations', async () => {
      const config = {
        columns: ['name', 'age'],
        rows: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        alias: 'myTable',
      };

      const mockContext = {
        currentNodeId: 'node-1',
        loopStates: {},
        state: {
          nodes: {},
          trigger: {},
          secrets: {},
          env: { url: '', browser: '', platform: '' }
        },
        getNextNodeId: (handle: string) => {
          if (handle === 'row' || handle === 'loop') return 'body-node';
          if (handle === 'exit') return 'exit-node';
          return undefined;
        }
      } as any;

      // Iteration 1
      const result1 = await handleStaticTable(config, {}, mockContext);
      expect(result1.data).toEqual({
        name: 'Alice',
        age: 30,
        $index: 0,
        $total: 2,
      });
      expect(result1.nextNodeId).toBe('body-node');
      expect(mockContext.state.nodes['node-1']).toEqual({
        name: 'Alice',
        age: 30,
        $index: 0,
        $total: 2,
      });
      expect(mockContext.state.nodes['myTable']).toEqual({
        name: 'Alice',
        age: 30,
        $index: 0,
        $total: 2,
      });

      // Iteration 2
      const result2 = await handleStaticTable(config, {}, mockContext);
      expect(result2.data).toEqual({
        name: 'Bob',
        age: 25,
        $index: 1,
        $total: 2,
      });
      expect(result2.nextNodeId).toBe('body-node');

      // Iteration 3 (Loop complete)
      const result3 = await handleStaticTable(config, {}, mockContext);
      expect(result3.data).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]);
      expect(result3.nextNodeId).toBe('exit-node');
      expect(mockContext.loopStates['node-1']).toBeUndefined(); // Cleaned up
    });

    it('should return empty array if no rows exist', async () => {
      const config = {
        columns: ['name'],
        rows: [],
        alias: 'myTable',
      };

      const mockContext = {
        currentNodeId: 'node-1',
        loopStates: {},
        state: {
          nodes: {},
          trigger: {},
          secrets: {},
          env: { url: '', browser: '', platform: '' }
        }
      } as any;
      const result = await handleStaticTable(config, {}, mockContext);
      expect(result.data).toEqual([]);
    });

    it('should resolve rows dynamically from chrome.storage.local when globalSyncEnabled is true', async () => {
      const mockGlobalTables = [
        {
          id: 'global-1',
          name: 'My Global Table',
          columns: ['name', 'age'],
          rows: [
            { name: 'Charlie', age: 35 },
          ],
        }
      ];

      // Stub global chrome storage
      const originalChrome = (globalThis as any).chrome;
      (globalThis as any).chrome = {
        storage: {
          local: {
            get: async (key: string) => {
              if (key === 'local:globalTables') {
                return { 'local:globalTables': mockGlobalTables };
              }
              return {};
            }
          }
        }
      };

      const config = {
        columns: ['name', 'age'],
        rows: [{ name: 'Alice', age: 30 }],
        alias: 'myTable',
        globalSyncEnabled: true,
        globalTableId: 'global-1',
      };

      try {
        const mockContext = {
          currentNodeId: 'node-1',
          loopStates: {},
          state: {
            nodes: {},
            trigger: {},
            secrets: {},
            env: { url: '', browser: '', platform: '' }
          }
        } as any;
        const result = await handleStaticTable(config, {}, mockContext);
        expect(result.data).toEqual({
          name: 'Charlie',
          age: 35,
          $index: 0,
          $total: 1,
        });
      } finally {
        (globalThis as any).chrome = originalChrome;
      }
    });
  });
});
