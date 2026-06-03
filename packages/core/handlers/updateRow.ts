import { ExecutionContext } from '../environment';
import { coerceValue } from '@flowscript/schema';

/**
 * Node handler for updating column values of the active row in a parent table loop.
 * Resolves specified values, coerces against table schema, and updates Dexie via background.
 */
export async function handleUpdateRowAction(
  config: Record<string, any>,
  _inputs: Record<string, any>,
  context: ExecutionContext
) {
  const { env } = context;
  const parentTableNodeId = config.parentTableNodeId;
  const mapping = config.mapping || {};

  if (!parentTableNodeId) {
    throw new Error('[Update Row] Parent table loop node selection is required');
  }

  // 1. Identify the parent loop state and retrieve active row ID
  const parentLoop = context.loopStates?.[parentTableNodeId];
  if (!parentLoop) {
    throw new Error(`[Update Row] Active parent loop not found for node ID "${parentTableNodeId}"`);
  }

  const tableId = parentLoop.tableId;
  const currentRowId = parentLoop.currentRowId;

  if (currentRowId === undefined || currentRowId === null) {
    throw new Error('[Update Row] No active row found in parent table loop');
  }

  // 2. Fetch the target table schema from the background
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
    env.onLog?.(`[Update Row] Failed to load table schema: ${err}`, { isError: true });
  }

  // 3. Coerce updated values based on schema columns
  const coercedData: Record<string, any> = {};
  if (schema && schema.columns) {
    for (const col of schema.columns) {
      // Only process columns explicitly specified in the update mapping
      if (!(col.name in mapping)) continue;

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
    // If no schema, fallback to raw mapping values
    Object.assign(coercedData, mapping);
  }

  // 4. Update the active row via background script
  const response = await env.sendMessage({
    type: 'UPDATE_TABLE_ROW',
    rowId: currentRowId,
    data: coercedData
  });

  if (!response || !response.success) {
    throw new Error(`Failed to update table row #${currentRowId}: ${response?.error || 'Unknown error'}`);
  }

  env.onLog?.(`Successfully updated row #${currentRowId} in table "${schema?.name || tableId}"`);

  return {
    data: { success: true, rowId: currentRowId, updated: coercedData },
    nextNodeId: context.getNextNodeId ? context.getNextNodeId() : undefined
  };
}
