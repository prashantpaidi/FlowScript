import { WorkflowNode } from './types';
import { handleClick } from './handlers/click';
import { handleHighlight } from './handlers/highlight';
import { handleHotkey } from './handlers/hotkey';
import { handleType } from './handlers/typing';
import { handlePressKey } from './handlers/pressKey';
import { handleScrapeAction } from './handlers/scrape';
import { handleSaveDataAction } from './handlers/save';

// The function signature that all node handlers must implement
export type NodeHandler = (config: Record<string, any>, inputs: Record<string, any>, context: { workflowId: string }) => Promise<any>;

// The node registry maps node types to their handler functions
export const nodeRegistry: Record<string, NodeHandler> = {
  'click': handleClick,
  'highlight': handleHighlight,
  'hotkey': handleHotkey,
  'type': handleType,
  'pressKey': handlePressKey,
  'scrape': handleScrapeAction,
  'saveData': handleSaveDataAction,
  // Aliases for backward compatibility or old nodes
  'single': handleScrapeAction,
  'list': handleScrapeAction,
  'default': handleSaveDataAction,
};
