// Centralized ActivityLogger for Flowscript execution logs.
// Accepts a WXT storage instance during initialization to avoid compile-time import/alias issues.

export interface StorageEngine {
  getItem(key: string): Promise<any>;
  setItem(key: string, value: any): Promise<any>;
}

interface LogEntry {
  timestamp: number;
  message: string;
}

export class ActivityLogger {
  private static store: StorageEngine | null = null;
  private static writeQueue: Promise<any> = Promise.resolve();

  private static queueWrite(fn: () => Promise<void>): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await fn();
      } catch (err) {
        console.error('[ActivityLogger] Queue write failed:', err);
      }
    });
    return this.writeQueue;
  }

  /**
   * Initializes the ActivityLogger with the environment's storage provider.
   */
  static initialize(storageInstance: StorageEngine) {
    this.store = storageInstance;
  }

  static async logActivity(message: string) {
    console.log(message);
    if (!this.store) return;
    
    await this.queueWrite(async () => {
      const currentLogs = await this.store.getItem('local:logs').catch((err: any) => {
        console.error('Failed to get logs:', err);
        return null;
      }) || [];
      const newLogs = [{ timestamp: Date.now(), message }, ...currentLogs].slice(0, 50);
      await this.store.setItem('local:logs', newLogs).catch((err: any) => {
        console.error('Failed to set logs:', err);
      });
    });
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

    await this.queueWrite(async () => {
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
    });
  }

  static async updateState(
    workflowId: string,
    runId: string,
    status: string,
    currentNodeId?: string,
    loopProgress?: { nodeId: string; index: number; total: number }
  ) {
    if (!this.store) return;

    let mappedStatus = status;
    if (status === 'completed') mappedStatus = 'success';
    if (status === 'failed') mappedStatus = 'failure';

    await this.queueWrite(async () => {
      const current = await this.store.getItem('local:executionState').catch(() => null);
      const isFinished = ['success', 'failure', 'stopped'].includes(mappedStatus);
      const isCurrentRun = !current || current.runId === runId;

      if (!isFinished || isCurrentRun) {
        const storedState = {
          workflowId,
          runId,
          status: mappedStatus,
          currentNodeId,
          loopProgress
        };
        await this.store.setItem('local:executionState', storedState).catch((err: any) => {
          console.error('Failed to set executionState in updateState:', err);
        });
      }

      // Update status in run logs too
      const runs = await this.store.getItem('local:workflowRunLogs').catch((err: any) => {
        console.error('Failed to get workflowRunLogs in updateState:', err);
        return null;
      }) || [];
      const run = runs.find((r: any) => r.id === runId);
      if (run) {
        run.status = mappedStatus;
        if (mappedStatus === 'success') {
          run.iterations.forEach((iter: any) => {
            if (iter.status === 'running') iter.status = 'success';
          });
        } else if (mappedStatus === 'failure' || mappedStatus === 'stopped') {
          run.iterations.forEach((iter: any) => {
            if (iter.status === 'running') iter.status = 'failure';
          });
        }
        await this.store.setItem('local:workflowRunLogs', runs).catch((err: any) => {
          console.error('Failed to update workflowRunLogs in updateState:', err);
        });
      }
    });
  }
}
