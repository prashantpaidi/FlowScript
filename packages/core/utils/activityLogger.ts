// Centralized ActivityLogger for Flowscript execution logs.
// Accepts a WXT storage instance during initialization to avoid compile-time import/alias issues.

interface LogEntry {
  timestamp: number;
  message: string;
}

export class ActivityLogger {
  private static store: any = null;

  /**
   * Initializes the ActivityLogger with the environment's storage provider.
   */
  static initialize(storageInstance: any) {
    this.store = storageInstance;
  }

  static async logActivity(message: string) {
    console.log(message);
    if (!this.store) return;
    
    try {
      const currentLogs = await this.store.getItem('local:logs').catch((err: any) => {
        console.error('Failed to get logs:', err);
        return null;
      }) || [];
      const newLogs = [{ timestamp: Date.now(), message }, ...currentLogs].slice(0, 50);
      await this.store.setItem('local:logs', newLogs).catch((err: any) => {
        console.error('Failed to set logs:', err);
      });
    } catch (e) {
      console.error('[ActivityLogger] Error logging activity:', e);
    }
  }

  static async appendLog(
    runId: string,
    workflowId: string,
    workflowName: string,
    message: string,
    options?: { isError?: boolean; iterationIndex?: number; iterationTotal?: number }
  ) {
    console.log(`[Flowscript Log] [Run: ${runId}] ${message}`);
    if (!this.store) return;

    try {
      const runs = await this.store.getItem('local:workflowRunLogs').catch((err: any) => {
        console.error('Failed to get workflowRunLogs in appendLog:', err);
        return null;
      }) || [];
      let run = runs.find((r: any) => r.id === runId);
      if (!run) {
        run = {
          id: runId,
          workflowId: workflowId,
          workflowName: workflowName,
          timestamp: Date.now(),
          status: 'running',
          iterations: []
        };
        runs.unshift(run);
      }

      const { isError, iterationIndex, iterationTotal } = options || {};
      const logEntry = { timestamp: Date.now(), message, isError };

      if (iterationIndex !== undefined && iterationTotal !== undefined) {
        const iterName = `Row ${iterationIndex + 1} of ${iterationTotal}`;
        let iter = run.iterations.find((it: any) => it.name === iterName);
        if (!iter) {
          iter = { name: iterName, status: 'running', logs: [] };
          run.iterations.push(iter);
        }
        iter.logs.push(logEntry);
        if (isError) {
          iter.status = 'failure';
          run.status = 'failure';
        }
      } else {
        let iter = run.iterations.find((it: any) => it.name === 'General');
        if (!iter) {
          iter = { name: 'General', status: 'running', logs: [] };
          run.iterations.push(iter);
        }
        iter.logs.push(logEntry);
        if (isError) {
          iter.status = 'failure';
          run.status = 'failure';
        }
      }

      await this.store.setItem('local:workflowRunLogs', runs.slice(0, 20)).catch((err: any) => {
        console.error('Failed to set workflowRunLogs in appendLog:', err);
      });
    } catch (e) {
      console.error('[ActivityLogger] Error appending log:', e);
    }
  }

  static async updateState(
    workflowId: string,
    runId: string,
    status: string,
    currentNodeId?: string,
    loopProgress?: { nodeId: string; index: number; total: number }
  ) {
    if (!this.store) return;

    try {
      const storedState = {
        workflowId,
        runId,
        status,
        currentNodeId,
        loopProgress
      };
      await this.store.setItem('local:executionState', storedState).catch((err: any) => {
        console.error('Failed to set executionState in updateState:', err);
      });

      // Update status in run logs too
      const runs = await this.store.getItem('local:workflowRunLogs').catch((err: any) => {
        console.error('Failed to get workflowRunLogs in updateState:', err);
        return null;
      }) || [];
      const run = runs.find((r: any) => r.id === runId);
      if (run) {
        run.status = status;
        if (status === 'completed') {
          run.iterations.forEach((iter: any) => {
            if (iter.status === 'running') iter.status = 'success';
          });
        } else if (status === 'failed' || status === 'stopped') {
          run.iterations.forEach((iter: any) => {
            if (iter.status === 'running') iter.status = 'failure';
          });
        }
        await this.store.setItem('local:workflowRunLogs', runs).catch((err: any) => {
          console.error('Failed to update workflowRunLogs in updateState:', err);
        });
      }
    } catch (e) {
      console.error('[ActivityLogger] Error updating execution state:', e);
    }
  }
}
