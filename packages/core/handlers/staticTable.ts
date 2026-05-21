import { ExecutionContext } from '../environment';

/**
 * Node handler for staticTable.
 * If global sync is enabled, it attempts to fetch the latest rows from chrome.storage.local.
 * Otherwise, it falls back to the configured static rows.
 */
export async function handleStaticTable(
  config: Record<string, any>,
  _inputs: Record<string, any>,
  _context: ExecutionContext
) {
  if (config.globalSyncEnabled && config.globalTableId) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const res = (await chrome.storage.local.get('local:globalTables')) as Record<string, any>;
        const globalTables = (res['local:globalTables'] || []) as any[];
        const matchedTable = globalTables.find((t: any) => t.id === config.globalTableId);
        if (matchedTable && matchedTable.rows) {
          return matchedTable.rows;
        }
      } catch (err) {
        console.warn('[handleStaticTable] Failed to fetch global table data:', err);
      }
    }
  }
  return config.rows || [];
}
