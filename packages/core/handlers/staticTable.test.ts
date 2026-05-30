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
    it('should return the full array of rows', async () => {
      const config = {
        columns: ['name', 'age'],
        rows: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        alias: 'myTable',
      };

      const mockContext = {} as ExecutionContext;
      const result = await handleStaticTable(config, {}, mockContext);
      expect(result.data).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]);
    });

    it('should return empty array if no rows exist', async () => {
      const config = {
        columns: ['name'],
        rows: [],
        alias: 'myTable',
      };

      const mockContext = {} as ExecutionContext;
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
        const mockContext = {} as ExecutionContext;
        const result = await handleStaticTable(config, {}, mockContext);
        expect(result.data).toEqual([
          { name: 'Charlie', age: 35 }
        ]);
      } finally {
        (globalThis as any).chrome = originalChrome;
      }
    });
  });
});
