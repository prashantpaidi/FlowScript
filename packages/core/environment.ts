import { WorkflowNode, WorkflowEdge } from '@flowscript/schema';

export interface AutomationEnvironment {
  sendMessage(message: any): Promise<any>;
  url: string;
  location: {
    href: string;
    assign(url: string): void;
    reload(): void;
  };
  debugger?: {
    sendCommand(method: string, params?: any): Promise<any>;
  };
  onLog?: (message: string, options?: { isError?: boolean; iterationIndex?: number; iterationTotal?: number }) => void;
  onStateChange?: (state: {
    workflowId: string;
    status: 'running' | 'stopping' | 'stopped' | 'completed' | 'failed';
    currentNodeId?: string;
    loopProgress?: { nodeId: string; index: number; total: number };
  }) => void;
  isAborted?: () => boolean;
  getGlobalTable?: (globalTableId: string) => Promise<any[] | undefined>;
  onVisualFeedback?: (feedback: {
    type: 'glow' | 'summary';
    element?: any;
    success?: number;
    total?: number;
  }) => void;
}

export interface WorkflowState {
  nodes: Record<string, Record<string, any>>;
  trigger: Record<string, any>;
  secrets?: Record<string, any>;
  env: {
    url: string;
    browser: string;
    platform: string;
  };
}

/**
 * @deprecated Use WorkflowState
 */
export type WorkflowContext = WorkflowState;

export interface ExecutionContext {
  workflowId: string;
  env: AutomationEnvironment;
  state: WorkflowState;
  currentNodeId: string;
  edges: WorkflowEdge[];
  nodes: WorkflowNode[];
  loopStates?: Record<string, any>;
  getNextNodeId(handleName?: string): string | undefined;
}

export class ExecutionController {
  private aborted = false;
  private onAbortCallbacks: (() => void)[] = [];

  abort() {
    this.aborted = true;
    this.onAbortCallbacks.forEach(cb => cb());
  }

  isAborted() {
    return this.aborted;
  }

  onAbort(cb: () => void) {
    this.onAbortCallbacks.push(cb);
  }
}
