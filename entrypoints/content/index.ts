import { Workflow } from '../../nodes/types';
import { executeWorkflow } from '../../nodes/executor';
import { setupHotkeyListener } from '../../nodes/handlers/hotkey';
import { getRobustSelector, getAllSelectors } from '../../nodes/utils/selector';
import { isUrlMatch } from '../../src/utils/urlMatcher';
import { observeSPAChanges } from './utils/spaObserver';

interface LogEntry {
  timestamp: number;
  message: string;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    console.log('Flowscript Content Script loaded.');

    async function logActivity(message: string) {
      console.log(message);
      const currentLogs = await storage.getItem<LogEntry[]>('local:logs') || [];
      const newLogs = [{ timestamp: Date.now(), message }, ...currentLogs].slice(0, 50);
      await storage.setItem('local:logs', newLogs);
    }

    let workflows: Workflow[] = [];
    let cleanupCurrentListeners: (() => void)[] = [];
    const executedTriggerIds = new Set<string>();

    function isUrlAllowed(data: any): boolean {
      const urlScope = data?.urlScope;
      const urlRegex = data?.urlRegex; // Legacy support
      
      const pattern = urlScope?.pattern ?? urlRegex;
      const matchIframes = urlScope?.matchIframes ?? false;

      // Iframe safety: If in an iframe and matchIframes is false, do not allow
      if (window !== window.top && !matchIframes) {
        return false;
      }

      return isUrlMatch(window.location.href, pattern);
    }

    function setupListeners() {
      // Clean up previous listeners
      for (const cleanup of cleanupCurrentListeners) {
        cleanup();
      }
      cleanupCurrentListeners = [];

      // Setup hotkeys
      const hotkeyCleanup = setupHotkeyListener(async (triggerNodeId, workflowId) => {
        const workflow = workflows.find(w => w.id === workflowId);
        if (!workflow) return;

        const triggerNode = workflow.nodes.find(n => n.id === triggerNodeId);
        if (!triggerNode) return;

        if (!isUrlAllowed(triggerNode.data)) {
          return; // Skip because URL or Iframes Scope don't match
        }

        logActivity(`Triggered workflow ${workflow.name || workflow.id}!`);

        try {
          await executeWorkflow(workflow.nodes, workflow.edges, triggerNodeId, workflow.id, { triggeredAt: Date.now() });
          logActivity(`Workflow ${workflow.name || workflow.id} executed successfully.`);
        } catch (e: any) {
          logActivity(`Workflow ${workflow.name || workflow.id} failed: ${e.message}`);
        }
      }, workflows);

      cleanupCurrentListeners.push(hotkeyCleanup);

      // Trigger page load workflows
      evaluatePageLoadTriggers();
    }

    function evaluatePageLoadTriggers(isSpaNavigation = false) {
      if (isSpaNavigation) {
        console.log('SPA navigation detected, re-evaluating page load triggers...');
      }

      workflows.forEach(workflow => {
        workflow.nodes.forEach(async node => {
          if (node.type === 'triggerNode' && node.subtype === 'pageload') {
            const triggerId = `${workflow.id}-${node.id}`;
            
            // For SPA navigation, we allow re-triggering if the URL matches.
            // We only skip if it was already executed ON THIS SPECIFIC URL in this session
            // but actually, usually we want it to fire every time the user "visits" the page in the SPA.
            if (!isSpaNavigation && executedTriggerIds.has(triggerId)) return;

            if (isUrlAllowed(node.data)) {
              executedTriggerIds.add(triggerId);
              logActivity(`Page Load triggered workflow: ${workflow.name || workflow.id}`);
              try {
                await executeWorkflow(workflow.nodes, workflow.edges, node.id, workflow.id, { triggeredAt: Date.now() });
                logActivity(`Workflow ${workflow.name || workflow.id} executed successfully.`);
              } catch (e: any) {
                logActivity(`Workflow ${workflow.name || workflow.id} failed: ${e.message}`);
              }
            }
          }
        });
      });
    }

    // Initialize SPA Observer
    const cleanupSPA = observeSPAChanges(() => {
      // Re-evaluate page load triggers on SPA navigation
      evaluatePageLoadTriggers(true);
    });

    cleanupCurrentListeners.push(cleanupSPA);

    // Load initial workflows
    const initial = await storage.getItem<Workflow[]>('local:workflows');
    if (initial) {
      workflows = initial;
      setupListeners();
    }

    // Watch for changes
    storage.watch<Workflow[]>('local:workflows', (newVal) => {
      workflows = newVal || [];
      console.log('Workflows updated:', workflows);
      setupListeners();
    });

    // --- Element Picker Logic ---
    let pickerOverlay: HTMLDivElement | null = null;
    let hoveredElement: HTMLElement | null = null;

    function createPickerOverlay() {
      if (pickerOverlay) return;

      pickerOverlay = document.createElement('div');
      pickerOverlay.id = 'flowscript-picker-overlay';
      Object.assign(pickerOverlay.style, {
        position: 'fixed',
        zIndex: '2147483647',
        pointerEvents: 'none',
        border: '2px solid #818cf8',
        backgroundColor: 'rgba(129, 140, 248, 0.2)',
        borderRadius: '4px',
        transition: 'all 0.1s ease-out',
        display: 'none',
      });
      document.body.appendChild(pickerOverlay);
    }

    function startPicking(mode: 'single' | 'list', sendResponse: (response: any) => void) {
      createPickerOverlay();
      document.body.style.cursor = 'crosshair';

      const onMouseMove = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target || target === pickerOverlay) return;

        hoveredElement = target;
        const rect = target.getBoundingClientRect();

        if (pickerOverlay) {
          Object.assign(pickerOverlay.style, {
            display: 'block',
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          });
        }
      };

      const onClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as Element;
        const elementToPick = hoveredElement || target;

        if (elementToPick) {
          const selectors = getAllSelectors(elementToPick, mode === 'list');
          console.log('[Flowscript] Picked element:', elementToPick, 'Selectors:', selectors);
          sendResponse({ selectors });
          stopPicking();
        }
      };

      const stopPicking = () => {
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('click', onClick, true);
        document.body.style.cursor = '';
        if (pickerOverlay) {
          pickerOverlay.remove();
          pickerOverlay = null;
        }
      };

      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('click', onClick, true);
    }

    // Handle messages from sidepanel
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'START_PICKING') {
        startPicking(message.mode || 'single', sendResponse);
        return true; // Keep message channel open for async response
      }
      return false;
    });
  },
});