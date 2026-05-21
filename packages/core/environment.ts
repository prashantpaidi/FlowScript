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
}

export interface WorkflowContext {
  nodes: Record<string, Record<string, any>>;
  trigger: Record<string, any>;
  secrets?: Record<string, any>;
  env: {
    url: string;
    browser: string;
    platform: string;
  };
}

export interface ExecutionContext {
  workflowId: string;
  env: AutomationEnvironment;
  variables?: WorkflowContext;
}
