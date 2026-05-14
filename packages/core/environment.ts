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
}

export interface WorkflowContext {
  nodes: Record<string, Record<string, any>>;
  trigger: Record<string, any>;
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
