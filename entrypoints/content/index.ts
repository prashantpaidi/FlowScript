import { Workflow } from '../../nodes/types';
import { executeWorkflow } from '../../nodes/executor';
import { setupHotkeyListener } from '../../nodes/handlers/hotkey';
import { getRobustSelector, getAllSelectors } from '../../nodes/utils/selector';

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
        if (triggerNode && triggerNode.data?.urlRegex) {
          try {
            const regex = new RegExp(triggerNode.data.urlRegex);
            if (!regex.test(window.location.href)) {
              return; // Skip because URL doesn't match
            }
          } catch (e) {
            logActivity(`Invalid regex in trigger ${triggerNodeId}: ${triggerNode.data.urlRegex}`);
            return;
          }
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
      workflows.forEach(workflow => {
        workflow.nodes.forEach(async node => {
          if (node.type === 'triggerNode' && node.subtype === 'pageload') {
            const triggerId = `${workflow.id}-${node.id}`;
            if (executedTriggerIds.has(triggerId)) return;

            const urlRegex = node.data?.urlRegex;
            let shouldTrigger = false;

            if (urlRegex && urlRegex.trim() !== '') {
              try {
                const regex = new RegExp(urlRegex);
                if (regex.test(window.location.href)) {
                  shouldTrigger = true;
                }
              } catch (e) {
                logActivity(`Invalid regex in trigger ${node.id}: ${urlRegex}`);
              }
            } else {
              // If no regex or empty, it's a universal trigger
              shouldTrigger = true;
            }

            if (shouldTrigger) {
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
