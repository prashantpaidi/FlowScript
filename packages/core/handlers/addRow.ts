import { ExecutionContext } from '../environment';
import { coerceValue } from '@flowscript/schema';

/**
 * Node handler for adding a new row to a global table.
 * Resolves each value mapping, coerces the types, and stores it in Dexie via background message.
 */
export async function handleAddRowAction(
  config: Record<string, any>,
  _inputs: Record<string, any>,
  context: ExecutionContext
) {
  const { env } = context;
  const tableId = config.tableId;
  const mapping = config.mapping || {};

  if (!tableId) {
    throw new Error('[Add Row] Target Table ID is required');
  }

  // 1. Fetch the target table schema from the background
  let schema: any = null;
  try {
    const res = await env.sendMessage({
      type: 'GET_GLOBAL_TABLE',
      tableId
    });
    if (res && res.success) {
      schema = res.schema;
    }
  } catch (err) {
    env.onLog?.(`[Add Row] Failed to load table schema: ${err}`, { isError: true });
  }

  // 2. Coerce the resolved values based on schema columns
  const coercedData: Record<string, any> = {};
  if (schema && schema.columns) {
    for (const col of schema.columns) {
      const resolvedValue = mapping[col.name];
      const result = coerceValue(resolvedValue, col.type, col.options);
      if (result.success) {
        coercedData[col.name] = result.value;
      } else {
        let fallback = null;
        if (col.type === 'boolean') fallback = false;
        else if (col.type === 'multiselect') fallback = [];

        coercedData[col.name] = fallback;
        env.onLog?.(`[Warning] Field '${col.name}' received '${resolvedValue}'; coerced to ${JSON.stringify(fallback)} for column type '${col.type}'`, { isError: false });
      }
    }
  } else {
    // If no schema loaded, fallback to raw mapping values
    Object.assign(coercedData, mapping);
  }

  // 3. Save the new row via background script
  const response = await env.sendMessage({
    type: 'ADD_TABLE_ROW',
    tableId,
    data: coercedData
  });

  if (!response || !response.success) {
    throw new Error(`Failed to add table row: ${response?.error || 'Unknown error'}`);
  }

  env.onLog?.(`Successfully added row to table "${schema?.name || tableId}"`);

  return {
    data: { success: true, row: coercedData },
    nextNodeId: context.getNextNodeId ? context.getNextNodeId() : undefined
  };
}
