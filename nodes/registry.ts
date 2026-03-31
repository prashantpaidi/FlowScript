import { WorkflowNode } from './types';
import { handleClick } from './handlers/click';
import { handleHighlight } from './handlers/highlight';
import { handleHotkey } from './handlers/hotkey';

// The function signature that all node handlers must implement
export type NodeHandler = (config: Record<string, any>, inputs: Record<string, any>) => Promise<any>;

// The node registry maps node types to their handler functions
export const nodeRegistry: Record<string, NodeHandler> = {
  'click': handleClick,
  'highlight': handleHighlight,
  'hotkey': handleHotkey,
};
