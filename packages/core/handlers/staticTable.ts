import { ExecutionContext } from '../environment';
import { coerceValue } from '@flowscript/schema';

function matchFilter(row: Record<string, any>, filter: any): boolean {
  if (!filter) return true;

  // 1. If filter is a simple string expression (e.g. "[Contacted] == false")
  if (typeof filter === 'string' && filter.trim().length > 0) {
    let evaluatedExpr = filter;
    for (const [colName, val] of Object.entries(row)) {
      const placeholder = `[${colName}]`;
      if (evaluatedExpr.includes(placeholder)) {
        evaluatedExpr = evaluatedExpr.replaceAll(placeholder, JSON.stringify(val));
      }
    }
    try {
      // Safe evaluation of simple comparison expression
      return new Function(`return (${evaluatedExpr})`)();
    } catch (e) {
      console.warn(`[staticTable] Filter evaluation failed for "${filter}":`, e);
      return true; // Fallback to including row
    }
  }

  // 2. If filter is structured, e.g. { column: string, operator: string, value: any }
  if (typeof filter === 'object' && filter.column && filter.operator) {
    const cellValue = row[filter.column];
    const filterValue = filter.value;
    switch (filter.operator) {
      case 'equals': return cellValue == filterValue;
      case 'notEquals': return cellValue != filterValue;
      case 'contains': return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
      case 'gt': return Number(cellValue) > Number(filterValue);
      case 'lt': return Number(cellValue) < Number(filterValue);
      case 'true': return cellValue === true || String(cellValue).toLowerCase() === 'true';
      case 'false': return cellValue === false || String(cellValue).toLowerCase() === 'false' || cellValue === null || cellValue === undefined;
      default: return true;
    }
  }

  return true;
}

/**
 * Node handler for staticTable (acts as a flowchart Loop / Iterator).
 * Maintains internal state within context.loopStates to iterate over rows,
 * returning the body nextNodeId while loop is active, and exit nextNodeId when done.
 */
export async function handleStaticTable(
  config: Record<string, any>,
  _inputs: Record<string, any>,
  context: ExecutionContext
) {
  const nodeId = context.currentNodeId;
  if (!context.loopStates) {
    context.loopStates = {};
  }

  let state = context.loopStates[nodeId];
  if (!state) {
    // Initial loop setup
    let rows: any[] = [];
    let schema: any = null;
    let fetchedGlobal = false;

    let fetchedSchema = false;

    if (config.globalSyncEnabled && config.globalTableId) {
      if (context.env?.getGlobalTable) {
        try {
          const matchedRows = await context.env.getGlobalTable(config.globalTableId);
          if (matchedRows) {
            rows = matchedRows;
            fetchedGlobal = true;
          }
        } catch (err) {
          context.env.onLog?.(`[handleStaticTable] Failed to fetch global table data: ${err}`, { isError: true });
        }
      } else if (context.env?.sendMessage) {
        try {
          const res = await context.env.sendMessage({
            type: 'GET_GLOBAL_TABLE',
            tableId: config.globalTableId
          });
          if (res && res.success) {
            schema = res.schema;
            rows = res.rows || [];
            fetchedGlobal = true;
            if (res.schema) {
              fetchedSchema = true;
            }
          }
        } catch (err) {
          context.env.onLog?.(`[handleStaticTable] Failed to fetch global table data: ${err}`, { isError: true });
        }
      }
    }

    if (!fetchedGlobal) {
      rows = config.rows || [];
    }

    // Default/fallback schema for legacy config/local table (only if global was fetched but schema is missing)
    if (!schema && fetchedGlobal) {
      schema = {
        id: config.globalTableId || 'local',
        name: config.alias || 'Local Table',
        columns: (config.columns || []).map((colName: string) => ({
          name: colName,
          type: 'text'
        }))
      };
    }

    // Apply loop filter if specified
    let filteredRows = rows;
    if (config.filter) {
      filteredRows = rows.filter((row: any) => {
        const rowValues = row.data || row;
        return matchFilter(rowValues, config.filter);
      });
    }

    state = {
      index: 0,
      total: filteredRows.length,
      rows: filteredRows,
      schema,
      fetchedSchema,
      tableId: config.globalTableId || 'local',
      currentRowId: filteredRows[0]?.id
    };
    context.loopStates[nodeId] = state;
  } else {
    // Increment index when loop cycles back
    state.index++;
    if (state.index < state.total) {
      state.currentRowId = state.rows[state.index]?.id;
    }
  }

  const alias = config.alias || `Node_${nodeId.slice(0, 4)}`;

  if (state.index < state.total) {
    const rawRow = state.rows[state.index];
    const rawData = rawRow.data || rawRow;
    const coercedData: Record<string, any> = {};
    if (rawRow.id !== undefined) coercedData._rowId = rawRow.id;
    if (rawRow.timestamp !== undefined) coercedData._timestamp = rawRow.timestamp;

    // Coerce each column based on current schema definition if schema was fetched
    if (state.schema && state.fetchedSchema) {
      const columnsList = state.schema.columns || [];
      for (const col of columnsList) {
        const rawValue = rawData[col.name];
        const result = coerceValue(rawValue, col.type, col.options);
        if (result.success) {
          coercedData[col.name] = result.value;
        } else {
          let fallback = null;
          if (col.type === 'boolean') fallback = false;
          else if (col.type === 'multiselect') fallback = [];

          coercedData[col.name] = fallback;
          context.env.onLog?.(`[Warning] Column '${col.name}' has invalid type in row #${state.index + 1}. Using fallback ${JSON.stringify(fallback)}.`, { isError: false });
        }
      }
    } else {
      Object.assign(coercedData, rawData);
    }

    // Expose current row variables under the table's alias
    const rowContext = { ...coercedData, $index: state.index, $total: state.total };
    if (context.state && context.state.nodes) {
      context.state.nodes[nodeId] = rowContext;
      context.state.nodes[alias] = rowContext;
    }

    context.env?.onLog?.(`Processing row ${state.index + 1} of ${state.total}`, {
      iterationIndex: state.index,
      iterationTotal: state.total
    });

    if (context.env?.onStateChange) {
      context.env?.onStateChange({
        workflowId: context.workflowId,
        status: 'running',
        currentNodeId: nodeId,
        loopProgress: {
          nodeId,
          index: state.index,
          total: state.total
        }
      });
    }

    // Direct flowchart pointer to the loop body edge
    const nextNodeId = context.getNextNodeId ? (context.getNextNodeId('row') || context.getNextNodeId('loop') || context.getNextNodeId('body')) : undefined;
    return {
      data: rowContext,
      nextNodeId
    };
  } else {
    // Loop execution is complete, clean up loop state
    if (context.loopStates) {
      delete context.loopStates[nodeId];
    }

    // Direct flowchart pointer to the exit/default edge
    const nextNodeId = context.getNextNodeId ? (context.getNextNodeId('exit') || context.getNextNodeId('next') || context.getNextNodeId('default')) : undefined;
    return {
      data: state.rows,
      nextNodeId
    };
  }
}

