import { Workflow } from '@flowscript/schema';
import { executeWorkflow, setupHotkeyListener, getBestSelector, getAllSelectors, AutomationEnvironment } from '@flowscript/core';
import { isUrlMatch } from '@flowscript/utils';
import { observeSPAChanges } from './utils/spaObserver';

interface LogEntry {
  timestamp: number;
  message: string;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  async main() {
    console.log(`[Flowscript] Content Script loaded in ${window === window.top ? 'TOP' : 'IFRAME'}. URL: ${window.location.href}`);

    const env: AutomationEnvironment = {
      sendMessage: (msg) => browser.runtime.sendMessage(msg),
      location: {
        get href() { return window.location.href; },
        assign: (url) => window.location.assign(url),
        reload: () => window.location.reload(),
      }
    };

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
            // but actually, usually we want it to fire every time the user "visits" the page in the SPA.
            if (!isSpaNavigation && executedTriggerIds.has(triggerId)) return;

            if (isUrlAllowed(node.data)) {
              executedTriggerIds.add(triggerId);
              logActivity(`Page Load triggered workflow: ${workflow.name || workflow.id}`);
              try {
                await executeWorkflow(workflow.nodes, workflow.edges, node.id, workflow.id, { triggeredAt: Date.now() }, env);
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

    // --- HUD Logic ---
    class FlowscriptHUD {
      private container: HTMLDivElement | null = null;
      private shadow: ShadowRoot | null = null;
      private isPaused: boolean = false;
      private isNativeMode: boolean = false;
      private stepCount: number = 0;

      constructor(isNativeMode: boolean = false) {
        this.isNativeMode = isNativeMode;
        this.createHUD();
        this.updateCursor();
      }

      private createHUD() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'flowscript-hud-container';
        this.shadow = this.container.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = `
          :host {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2147483647;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }
          .hud-card {
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 12px 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 16px;
            min-width: 280px;
            color: white;
            user-select: none;
            animation: slideIn 0.3s ease-out;
          }
          @keyframes slideIn {
            from { transform: translateX(100px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ef4444;
            box-shadow: 0 0 8px #ef4444;
          }
          .status-dot.paused {
            background: #f59e0b;
            box-shadow: 0 0 8px #f59e0b;
          }
          .info {
            flex: 1;
          }
          .label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 2px;
          }
          .status {
            font-size: 13px;
            font-weight: 600;
          }
          .controls {
            display: flex;
            gap: 8px;
          }
          button {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 8px;
            color: white;
            padding: 6px 10px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          button:hover {
            background: rgba(255, 255, 255, 0.2);
          }
          button.stop {
            background: #ef4444;
          }
          button.stop:hover {
            background: #dc2626;
          }
          .pulse {
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
          }
          .toggle-container {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.7);
            padding-left: 12px;
            border-left: 1px solid rgba(255, 255, 255, 0.1);
          }
          .switch {
            position: relative;
            display: inline-block;
            width: 32px;
            height: 18px;
          }
          .switch input {
            opacity: 0;
            width: 0;
            height: 0;
          }
          .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255, 255, 255, 0.1);
            transition: .4s;
            border-radius: 18px;
          }
          .slider:before {
            position: absolute;
            content: "";
            height: 12px;
            width: 12px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
          }
          input:checked + .slider {
            background-color: #6366f1;
          }
          input:checked + .slider:before {
            transform: translateX(14px);
          }
        `;

        const content = document.createElement('div');
        content.className = 'hud-card';
        content.innerHTML = `
          <div class="status-dot pulse"></div>
          <div class="info">
            <div class="label">Flowscript Recorder</div>
            <div class="status" id="hud-status">Recording Step #1...</div>
          </div>
          <div class="controls">
            <button id="pause-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              Pause
            </button>
            <button id="stop-btn" class="stop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
              Stop
            </button>
            <div class="toggle-container">
              <span>Native</span>
              <label class="switch">
                <input type="checkbox" id="native-toggle" ${this.isNativeMode ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
          </div>
        `;

        this.shadow.appendChild(style);
        this.shadow.appendChild(content);
        document.body.appendChild(this.container);

        this.shadow.getElementById('pause-btn')?.addEventListener('click', () => this.togglePause());
        this.shadow.getElementById('stop-btn')?.addEventListener('click', () => this.stopRecording());
        this.shadow.getElementById('native-toggle')?.addEventListener('change', (e) => {
          this.toggleNativeMode((e.target as HTMLInputElement).checked);
        });
      }

      private toggleNativeMode(enabled: boolean) {
        this.isNativeMode = enabled;
        this.updateCursor();

        browser.runtime.sendMessage({
          type: 'HUD_CONTROL',
          action: 'toggleNativeMode',
          value: enabled
        }).catch(() => { });
      }

      private updateCursor() {
        document.body.style.cursor = this.isNativeMode ? 'crosshair' : '';
      }

      private togglePause() {
        this.isPaused = !this.isPaused;
        const btn = this.shadow?.getElementById('pause-btn');
        const dot = this.shadow?.querySelector('.status-dot');
        const status = this.shadow?.getElementById('hud-status');

        if (btn) {
          btn.innerHTML = this.isPaused
            ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Resume'
            : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause';
        }

        if (dot) {
          dot.classList.toggle('paused', this.isPaused);
          dot.classList.toggle('pulse', !this.isPaused);
        }

        if (status) {
          status.textContent = this.isPaused ? 'Recording Paused' : `Recording Step #${this.stepCount + 1}...`;
        }

        browser.runtime.sendMessage({
          type: 'HUD_CONTROL',
          action: this.isPaused ? 'pause' : 'resume'
        }).catch(() => { });

        // Local state sync
        isRecordingPaused = this.isPaused;
      }

      private stopRecording() {
        browser.runtime.sendMessage({
          type: 'HUD_CONTROL',
          action: 'stop'
        }).catch(() => { });
        this.destroy();
      }

      public updateStatus(stepCount: number, isPaused: boolean) {
        this.stepCount = stepCount;
        this.isPaused = isPaused;
        const status = this.shadow?.getElementById('hud-status');
        if (status) {
          status.textContent = isPaused ? 'Recording Paused' : `Recording Step #${stepCount + 1}...`;
        }

        const dot = this.shadow?.querySelector('.status-dot');
        if (dot) {
          dot.classList.toggle('paused', isPaused);
          dot.classList.toggle('pulse', !isPaused);
        }
      }

      public destroy() {
        if (this.container) {
          this.isNativeMode = false;
          this.updateCursor();
          this.container.remove();
          this.container = null;
          this.shadow = null;
        }
      }
    }

    // --- Recording Logic ---
    let isRecording = false;
    let isRecordingPaused = false;
    let hud: FlowscriptHUD | null = null;
    let pendingInput: { selector: string, value: string, timestamp: number } | null = null;

    function finalizePendingInput() {
      if (pendingInput && pendingInput.value.trim() !== '') {
        console.log('[Flowscript] Finalized input:', pendingInput.selector, pendingInput.value);
        browser.runtime.sendMessage({
          type: 'USER_INTERACTION_EVENT',
          eventType: 'type',
          selector: pendingInput.selector,
          value: pendingInput.value,
          timestamp: pendingInput.timestamp
        }).catch(() => { });
      }
      pendingInput = null;
    }

    function handleRecordingClick(e: MouseEvent) {
      if (!isRecording || isRecordingPaused) return;

      const target = e.target as HTMLElement;
      if (!target) return;

      // Ignore clicks on our own HUD (though Shadow DOM should handle most of it)
      if (target.closest('#flowscript-hud-container')) return;

      finalizePendingInput();

      const selector = getBestSelector(target);
      console.log('[Flowscript] Captured click:', selector);

      browser.runtime.sendMessage({
        type: 'USER_INTERACTION_EVENT',
        eventType: 'click',
        selector,
        timestamp: Date.now(),
        coordinates: {
          pageX: Math.round(e.pageX),
          pageY: Math.round(e.pageY),
          clientX: Math.round(e.clientX),
          clientY: Math.round(e.clientY)
        }
      }).catch(() => { });
    }

    function handleRecordingInput(e: Event) {
      if (!isRecording || isRecordingPaused) return;
      const target = e.target as HTMLElement;
      if (!target || !target.tagName) return;

      const selector = getBestSelector(target);
      const value = (target as any).value !== undefined ? (target as any).value : target.innerText;

      pendingInput = {
        selector,
        value: value || '',
        timestamp: Date.now()
      };
    }

    function handleRecordingKeyDown(e: KeyboardEvent) {
      if (!isRecording || isRecordingPaused) return;

      const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
      if (isModifier) return;

      if (e.key === 'Enter') {
        finalizePendingInput();
      }

      const target = e.target as HTMLElement;

      // --- Optimization: Decide if we should record this as a pressKey node ---
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      // Only skip recording keypress if it's a regular character in an input field
      // We consider "regular" as: key length 1 (printable) AND no control/alt/meta modifiers
      const isRegularChar = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

      if (isInput && isRegularChar) {
        // Skip pressKey node for regular typing in inputs (will be handled by 'type' event)
        return;
      }
      // -----------------------------------------------------------------------

      // Capture modifiers bitmask for CDP
      let modifiers = 0;
      if (e.altKey) modifiers |= 1;
      if (e.ctrlKey) modifiers |= 2;
      if (e.metaKey) modifiers |= 4;
      if (e.shiftKey) modifiers |= 8;

      const selector = target ? getBestSelector(target) : 'body';

      console.log('[Flowscript] Captured keypress:', e.key, e.code, modifiers);

      browser.runtime.sendMessage({
        type: 'USER_INTERACTION_EVENT',
        eventType: 'keypress',
        selector,
        timestamp: Date.now(),
        keyData: {
          key: e.key,
          code: e.code,
          modifiers,
          windowsVirtualKeyCode: e.keyCode
        }
      }).catch(() => { });
    }

    function startRecording(isNativeMode: boolean = false) {
      if (isRecording) return;
      isRecording = true;
      isRecordingPaused = false;
      document.addEventListener('click', handleRecordingClick, true);
      document.addEventListener('input', handleRecordingInput, true);
      document.addEventListener('keydown', handleRecordingKeyDown, true);
      document.addEventListener('blur', finalizePendingInput, true);

      if (!hud) {
        hud = new FlowscriptHUD(isNativeMode);
      }
      console.log('[Flowscript] Recording started, Native Mode:', isNativeMode);
    }

    function stopRecording() {
      if (!isRecording) return;
      finalizePendingInput();
      isRecording = false;
      isRecordingPaused = false;
      document.removeEventListener('click', handleRecordingClick, true);
      document.removeEventListener('input', handleRecordingInput, true);
      document.removeEventListener('keydown', handleRecordingKeyDown, true);
      document.removeEventListener('blur', finalizePendingInput, true);

      if (hud) {
        hud.destroy();
        hud = null;
      }
      console.log('[Flowscript] Recording stopped');
    }

    // Handle messages from sidepanel or broadcast triggers
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TRIGGER_WORKFLOW') {
        const workflow = workflows.find(w => w.id === message.workflowId);
        if (!workflow) return;

        const triggerNode = workflow.nodes.find(n => n.id === message.triggerNodeId);
        if (!triggerNode) return;

        if (isUrlAllowed(triggerNode.data)) {
          logActivity(`Triggered workflow ${workflow.name || workflow.id} via broadcast!`);
          try {
            executeWorkflow(workflow.nodes, workflow.edges, message.triggerNodeId, workflow.id, { triggeredAt: Date.now() }, env)
              .then(() => logActivity(`Workflow ${workflow.name || workflow.id} executed successfully.`))
              .catch((e: any) => logActivity(`Workflow ${workflow.name || workflow.id} failed: ${e.message}`));
          } catch (e: any) {
            logActivity(`Workflow ${workflow.name || workflow.id} failed to start: ${e.message}`);
          }
        }
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
        if (hud) {
          hud.updateStatus(message.stepCount, message.isPaused);
          isRecordingPaused = message.isPaused;
        }
        sendResponse({ success: true });
        return true;
      }
      return false;
    });
  },
});
