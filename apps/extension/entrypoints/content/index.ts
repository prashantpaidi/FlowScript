import { Workflow } from '@flowscript/schema';
import { executeWorkflow, setupHotkeyListener, AutomationEnvironment, ActivityLogger, ExecutionController, applyMatchGlow, showExecutionSummary } from '@flowscript/core';
import { isUrlMatch } from '@flowscript/utils';
import { observeSPAChanges } from './utils/spaObserver';
import { startRecording, stopRecording, startPicking, updateRecordingStatus } from './utils/recorder';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  async main() {
    console.log(`[Flowscript] Content Script loaded in ${window === window.top ? 'TOP' : 'IFRAME'}. URL: ${window.location.href}`);

    ActivityLogger.initialize(storage);

    const activeStopRequests = new Set<string>();
    const activeControllers = new Map<string, Set<ExecutionController>>();

    function addActiveController(workflowId: string, controller: ExecutionController) {
      let controllers = activeControllers.get(workflowId);
      if (!controllers) {
        controllers = new Set();
        activeControllers.set(workflowId, controllers);
      }
      controllers.add(controller);
    }

    function removeActiveController(workflowId: string, controller: ExecutionController) {
      const controllers = activeControllers.get(workflowId);
      if (controllers) {
        controllers.delete(controller);
        if (controllers.size === 0) {
          activeControllers.delete(workflowId);
          activeStopRequests.delete(workflowId);
        }
      }
    }

    async function logActivity(message: string) {
      await ActivityLogger.logActivity(message);
    }

    async function appendLog(runId: string, workflow: Workflow, message: string, options?: { isError?: boolean, iterationIndex?: number, iterationTotal?: number }) {
      await ActivityLogger.appendLog(runId, workflow.id, workflow.name || workflow.id, message, options);
    }

    function createExecutionEnvironment(workflow: Workflow, runId: string): AutomationEnvironment {
      return {
        sendMessage: (msg) => browser.runtime.sendMessage(msg),
        url: window.location.href,
        location: {
          get href() { return window.location.href; },
          assign: (url) => window.location.assign(url),
          reload: () => window.location.reload(),
        },
        onLog: (message, options) => {
          appendLog(runId, workflow, message, options);
          logActivity(`[${workflow.name || workflow.id}] ${message}`);
        },
        onStateChange: async (state) => {
          await ActivityLogger.updateState(workflow.id, runId, state.status, state.currentNodeId, state.loopProgress);
        },
        isAborted: () => {
          return activeStopRequests.has(workflow.id) || Array.from(activeControllers.get(workflow.id) || []).some(c => c.isAborted());
        },
        getGlobalTable: async (globalTableId) => {
          const res = await storage.getItem('local:globalTables').catch(() => null) as any[] | null;
          const matchedTable = (res || []).find((t: any) => t.id === globalTableId);
          return matchedTable?.rows;
        },
        onVisualFeedback: (feedback) => {
          if (feedback.type === 'glow' && feedback.element) {
            applyMatchGlow(feedback.element);
          } else if (feedback.type === 'summary' && feedback.success !== undefined && feedback.total !== undefined) {
            showExecutionSummary(feedback.success, feedback.total);
          }
        }
      };
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
        console.warn(`[Flowscript] Blocking execution in iframe: matchIframes is false for ${pattern}`);
        return false;
      }

      const matched = isUrlMatch(window.location.href, pattern);
      if (matched) {
        console.log(`[Flowscript] URL Match Success: ${window.location.href} matches ${pattern}`);
      }
      return matched;
    }

    function setupListeners() {
      // Clean up previous listeners
      for (const cleanup of cleanupCurrentListeners) {
        cleanup();
      }
      cleanupCurrentListeners = [];

      // Setup hotkeys
      const hotkeyCleanup = setupHotkeyListener(async (triggerNodeId, workflowId) => {
        console.log(`[Flowscript] Hotkey matched! Requesting broadcast for workflow ${workflowId}`);
        browser.runtime.sendMessage({
          type: 'TRIGGER_WORKFLOW',
          workflowId,
          triggerNodeId
        }).catch(() => { });
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
            if (!isSpaNavigation && executedTriggerIds.has(triggerId)) return;

            if (isUrlAllowed(node.data)) {
              executedTriggerIds.add(triggerId);
              logActivity(`Page Load triggered workflow: ${workflow.name || workflow.id}`);
              
              const runId = crypto.randomUUID();
              const runEnv = createExecutionEnvironment(workflow, runId);

              // Set initial execution state
              await storage.setItem('local:executionState', {
                workflowId: workflow.id,
                runId,
                status: 'running'
              }).catch((err) => {
                console.error('Failed to set initial executionState in SPA evaluation:', err);
              });

              // Add a starting log entry in the grouped logs
              const initialRun = {
                id: runId,
                workflowId: workflow.id,
                workflowName: workflow.name || workflow.id,
                timestamp: Date.now(),
                status: 'running',
                iterations: [
                  {
                    name: 'General',
                    status: 'running',
                    logs: [{ timestamp: Date.now(), message: 'Workflow execution started' }]
                  }
                ]
              };
              const runs = await storage.getItem<any[]>('local:workflowRunLogs').catch((err) => {
                console.error('Failed to get workflowRunLogs in SPA evaluation:', err);
                return null;
              }) || [];
              await storage.setItem('local:workflowRunLogs', [initialRun, ...runs].slice(0, 20)).catch((err) => {
                console.error('Failed to set initial workflowRunLogs in SPA evaluation:', err);
              });

              const controller = new ExecutionController();
              addActiveController(workflow.id, controller);
              try {
                await executeWorkflow(workflow.nodes, workflow.edges, node.id, workflow.id, { triggeredAt: Date.now() }, runEnv, controller);
              } catch (e: any) {
                console.error('[Flowscript] Execution error:', e);
              } finally {
                removeActiveController(workflow.id, controller);
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
    const initial = await storage.getItem<Workflow[]>('local:workflows').catch((err) => {
      console.error('Failed to load initial workflows:', err);
      return null;
    });
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

    storage.watch<any>('local:executionState', (state) => {
      if (state && state.workflowId) {
        if (['completed', 'failed', 'stopped', 'running', 'success', 'failure'].includes(state.status)) {
          activeStopRequests.delete(state.workflowId);
        }
      }
    });

    // Handle messages from sidepanel or broadcast triggers
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TRIGGER_WORKFLOW') {
        const workflow = workflows.find(w => w.id === message.workflowId);
        if (!workflow) return;

        const triggerNode = workflow.nodes.find(n => n.id === message.triggerNodeId);
        if (!triggerNode) return;

        if (isUrlAllowed(triggerNode.data)) {
          logActivity(`Triggered workflow ${workflow.name || workflow.id} via broadcast!`);
          
          const runId = crypto.randomUUID();
          const runEnv = createExecutionEnvironment(workflow, runId);

          storage.setItem('local:executionState', {
            workflowId: workflow.id,
            runId,
            status: 'running'
          }).then(async () => {
            const initialRun = {
              id: runId,
              workflowId: workflow.id,
              workflowName: workflow.name || workflow.id,
              timestamp: Date.now(),
              status: 'running',
              iterations: [
                {
                  name: 'General',
                  status: 'running',
                  logs: [{ timestamp: Date.now(), message: 'Workflow execution started' }]
                }
              ]
            };
            const runs = await storage.getItem<any[]>('local:workflowRunLogs').catch((err) => {
              console.error('Failed to get workflowRunLogs in TRIGGER_WORKFLOW:', err);
              return null;
            }) || [];
            await storage.setItem('local:workflowRunLogs', [initialRun, ...runs].slice(0, 20)).catch((err) => {
              console.error('Failed to set initial workflowRunLogs in TRIGGER_WORKFLOW:', err);
            });

            const controller = new ExecutionController();
            addActiveController(workflow.id, controller);
            try {
              await executeWorkflow(workflow.nodes, workflow.edges, message.triggerNodeId, workflow.id, { triggeredAt: Date.now() }, runEnv, controller);
            } catch (e: any) {
              console.error('[Flowscript] Execution error:', e);
            } finally {
              removeActiveController(workflow.id, controller);
            }
          }).catch((err) => {
            console.error('Failed to set executionState in TRIGGER_WORKFLOW:', err);
          });
        }
        sendResponse({ success: true });
        return true;
      }
      if (message.type === 'STOP_WORKFLOW') {
        activeStopRequests.add(message.workflowId);
        const controllers = activeControllers.get(message.workflowId);
        if (controllers) {
          controllers.forEach(c => c.abort());
        }
        storage.getItem<any>('local:executionState').then((state) => {
          if (state && state.workflowId === message.workflowId) {
            storage.setItem('local:executionState', {
              ...state,
              status: 'stopping'
            }).catch((err) => {
              console.error('Failed to set executionState in STOP_WORKFLOW:', err);
            });
          }
        }).catch((err) => {
          console.error('Failed to get executionState in STOP_WORKFLOW:', err);
        });
        sendResponse({ success: true });
        return true;
      }
      if (message.type === 'START_PICKING') {
        startPicking(message.mode || 'single', sendResponse);
        return true; // Keep message channel open for async response
      }
      if (message.type === 'RECORDING_STARTED') {
        startRecording(message.isNativeMode);
        sendResponse({ success: true });
        return true;
      }
      if (message.type === 'RECORDING_STOPPED') {
        stopRecording();
        sendResponse({ success: true });
        return true;
      }
      if (message.type === 'RECORDING_STATUS_UPDATE') {
        updateRecordingStatus(message.stepCount, message.isPaused);
        sendResponse({ success: true });
        return true;
      }
      return false;
    });
  },
});
