import { ExecutionContext } from './environment';
import { handleClick } from './handlers/click';
import { handleHighlight } from './handlers/highlight';
import { handleHotkey } from './handlers/hotkey';
import { handleType } from './handlers/typing';
import { handlePressKey } from './handlers/pressKey';
import { handleScrapeAction } from './handlers/scrape';
import { handleSaveDataAction } from './handlers/save';
import { handleCondition } from './handlers/condition';
import { handleWait } from './handlers/wait';
import { handleTransform } from './handlers/transform';
import { handleClipboard } from './handlers/clipboard';
import { handleWebhook } from './handlers/webhook';
import { handleDynamicForm } from './handlers/dynamicForm';
import { handleStaticTable } from './handlers/staticTable';
import { handleAddRowAction } from './handlers/addRow';
import { handleUpdateRowAction } from './handlers/updateRow';
import { WorkflowNode } from '@flowscript/schema';


export interface NodeExecutionResult {
  data: any;
  nextNodeId?: string;
}

export type NodeHandlerFn = (
  config: Record<string, any>, 
  inputs: Record<string, any>, 
  context: ExecutionContext
) => Promise<NodeExecutionResult>;

export interface NodeHandlerObject {
  execute: NodeHandlerFn;
  requiresDebugger?(node: WorkflowNode): boolean;
}

export type NodeHandler = NodeHandlerFn | NodeHandlerObject;

export interface INodeRegistry {
  getHandler(subtype: string): NodeHandler | undefined;
  register(subtype: string, handler: NodeHandler): void;
}

export class DefaultNodeRegistry implements INodeRegistry {
  private handlers = new Map<string, NodeHandler>();

  register(subtype: string, handler: NodeHandler): void {
    this.handlers.set(subtype, handler);
  }

  getHandler(subtype: string): NodeHandler | undefined {
    return this.handlers.get(subtype);
  }
}

export const nodeRegistry = new DefaultNodeRegistry();

// Register standard handlers
nodeRegistry.register('click', {
  execute: handleClick as NodeHandlerFn,
  requiresDebugger: (node) => !!node.data?.isNative
});
nodeRegistry.register('highlight', handleHighlight as NodeHandlerFn);
nodeRegistry.register('hotkey', handleHotkey as NodeHandlerFn);
nodeRegistry.register('type', {
  execute: handleType as NodeHandlerFn,
  requiresDebugger: (node) => !!node.data?.isNative
});
nodeRegistry.register('pressKey', {
  execute: handlePressKey as NodeHandlerFn,
  requiresDebugger: () => true
});
nodeRegistry.register('scrape', handleScrapeAction as NodeHandlerFn);
nodeRegistry.register('addRow', handleAddRowAction as NodeHandlerFn);
nodeRegistry.register('saveData', handleAddRowAction as NodeHandlerFn);
nodeRegistry.register('updateRow', handleUpdateRowAction as NodeHandlerFn);
nodeRegistry.register('elementExists', {
  execute: handleCondition as NodeHandlerFn,
  requiresDebugger: () => true
});
nodeRegistry.register('jsExpression', {
  execute: handleCondition as NodeHandlerFn,
  requiresDebugger: () => true
});
nodeRegistry.register('wait', handleWait as NodeHandlerFn);
nodeRegistry.register('transform', handleTransform as NodeHandlerFn);
nodeRegistry.register('clipboard', handleClipboard as NodeHandlerFn);
nodeRegistry.register('webhook', handleWebhook as NodeHandlerFn);
nodeRegistry.register('dynamicForm', {
  execute: handleDynamicForm as NodeHandlerFn,
  requiresDebugger: (node) => !!(node.data?.globalNative || (node.data?.mappings || []).some((m: any) => m.isNative))
});
nodeRegistry.register('staticTable', handleStaticTable as NodeHandlerFn);
nodeRegistry.register('loop', handleStaticTable as NodeHandlerFn);

// Aliases
nodeRegistry.register('single', handleScrapeAction as NodeHandlerFn);
nodeRegistry.register('list', handleScrapeAction as NodeHandlerFn);
nodeRegistry.register('default', handleAddRowAction as NodeHandlerFn);

