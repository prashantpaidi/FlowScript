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


// The function signature that all node handlers must implement
export type NodeHandler = (
  config: Record<string, any>, 
  inputs: Record<string, any>, 
  context: ExecutionContext
) => Promise<any>;

// The node registry maps node types to their handler functions
export const nodeRegistry: Record<string, NodeHandler> = {
  'click': handleClick as NodeHandler,
  'highlight': handleHighlight as NodeHandler,
  'hotkey': handleHotkey as NodeHandler,
  'type': handleType as NodeHandler,
  'pressKey': handlePressKey as NodeHandler,
  'scrape': handleScrapeAction as NodeHandler,
  'saveData': handleSaveDataAction as NodeHandler,
  'elementExists': handleCondition as NodeHandler,
  'jsExpression': handleCondition as NodeHandler,
  'wait': handleWait as NodeHandler,
  'transform': handleTransform as NodeHandler,
  'clipboard': handleClipboard as NodeHandler,
  'webhook': handleWebhook as NodeHandler,
  'dynamicForm': handleDynamicForm as NodeHandler,
  'staticTable': handleStaticTable as NodeHandler,
  // Aliases for backward compatibility or old nodes

  'single': handleScrapeAction as NodeHandler,
  'list': handleScrapeAction as NodeHandler,
  'default': handleSaveDataAction as NodeHandler,
};
