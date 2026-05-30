import { WorkflowNode } from '@flowscript/schema';
import { INodeRegistry } from './registry';
import { AutomationEnvironment } from './environment';

export interface IDebuggerManager {
  attachIfNeeded(nodes: WorkflowNode[], registry: INodeRegistry): Promise<boolean>;
  detachIfNeeded(): Promise<void>;
}

export class CDPDebuggerManager implements IDebuggerManager {
  private attached = false;

  constructor(private env: AutomationEnvironment) {}

  async attachIfNeeded(nodes: WorkflowNode[], registry: INodeRegistry): Promise<boolean> {
    const hasNativeNode = nodes.some(node => {
      const handler = registry.getHandler(node.subtype);
      if (handler && typeof handler === 'object' && handler.requiresDebugger) {
        return handler.requiresDebugger(node);
      }
      return (
        node.data?.isNative || 
        node.subtype === 'pressKey' || 
        node.type === 'conditionalNode' ||
        (node.subtype === 'dynamicForm' && (node.data?.globalNative || (node.data?.mappings || []).some((m: any) => m.isNative)))
      );
    });

    if (hasNativeNode) {
      console.log('[Flowscript] Native nodes detected, attaching debugger...');
      try {
        const response = await this.env.sendMessage({ type: 'DEBUGGER_ATTACH' });
        if (response && !response.success) {
          throw new Error(`Failed to attach debugger: ${response.error}`);
        }
        this.attached = true;
        // Small grace period for debugger to settle
        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        console.error('[Flowscript] Debugger attachment failed:', err);
        throw new Error(`Debugger attachment failed: ${err.message}`);
      }
    }
    return this.attached;
  }

  async detachIfNeeded(): Promise<void> {
    if (this.attached) {
      console.log('[Flowscript] Detaching debugger...');
      await this.env.sendMessage({ type: 'DEBUGGER_DETACH' }).catch((err: any) => {
        console.error('[Flowscript] Failed to detach debugger:', err);
      });
      this.attached = false;
    }
  }
}
