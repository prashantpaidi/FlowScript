export interface AutomationEnvironment {
  sendMessage(message: any): Promise<any>;
  location: {
    href: string;
    assign(url: string): void;
    reload(): void;
  };
  debugger?: {
    sendCommand(method: string, params?: any): Promise<any>;
  };
}

export interface ExecutionContext {
  workflowId: string;
  env: AutomationEnvironment;
}
