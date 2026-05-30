import { ExecutionContext } from '../environment';

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
    let fetchedGlobal = false;
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
      }
    }
    if (!fetchedGlobal) {
      rows = config.rows || [];
    }

    state = {
      index: 0,
      total: rows.length,
      rows
    };
    context.loopStates[nodeId] = state;
  } else {
    // Increment index when loop cycles back
    state.index++;
  }

  const alias = config.alias || `Node_${nodeId.slice(0, 4)}`;

  if (state.index < state.total) {
    const currentRow = state.rows[state.index];
    
    // Inject current row fields, index, and total into variables
    const rowContext = { ...currentRow, $index: state.index, $total: state.total };
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
