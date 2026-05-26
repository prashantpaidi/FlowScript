import { browser } from 'wxt/browser';

/**
 * AutomationBridge encapsulates all browser.runtime and browser.tabs calls.
 * It provides a mock mode for development in a standard browser tab.
 */
class AutomationBridge {
  private isMock: boolean;

  constructor() {
    // Detect if we are running as an extension or in a standard tab
    this.isMock = typeof browser === 'undefined' || !browser.runtime?.id;
    if (this.isMock) {
      console.warn('[AutomationBridge] Running in Mock Mode. API calls will be logged to console.');
    }
  }

  async sendMessage(message: any): Promise<any> {
    if (this.isMock) {
      console.log('[AutomationBridge] [Mock] sendMessage:', message);
      return Promise.resolve({ mockResponse: true });
    }
    try {
      return await browser.runtime.sendMessage(message);
    } catch (error) {
      console.error('[AutomationBridge] sendMessage failed:', error);
      throw error;
    }
  }

  async queryTabs(queryInfo: any): Promise<any[]> {
    if (this.isMock) {
      console.log('[AutomationBridge] [Mock] queryTabs:', queryInfo);
      return [{ id: 123, url: 'http://localhost/mock', active: true }];
    }
    return await browser.tabs.query(queryInfo);
  }

  async sendTabMessage(tabId: number, message: any): Promise<any> {
    if (this.isMock) {
      console.log(`[AutomationBridge] [Mock] sendTabMessage to tab ${tabId}:`, message);
      return Promise.resolve({ mockResponse: true });
    }
    try {
      return await browser.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error(`[AutomationBridge] sendTabMessage to tab ${tabId} failed:`, error);
      throw error;
    }
  }

  // Domain specific methods

  async startRecording(tabId: number) {
    return this.sendMessage({
      type: 'RECORDING_STARTED',
      target: { tabId }
    });
  }

  async stopRecording() {
    return this.sendMessage({ type: 'RECORDING_STOPPED' });
  }

  async stopWorkflow(workflowId: string, tabId?: number) {
    if (tabId) {
      return this.sendTabMessage(tabId, {
        type: 'STOP_WORKFLOW',
        workflowId
      });
    }
    const [tab] = await this.queryTabs({ active: true, currentWindow: true });
    if (tab?.id) {
      return this.sendTabMessage(tab.id, {
        type: 'STOP_WORKFLOW',
        workflowId
      });
    }
  }

  async startPicking(mode: 'single' | 'list' = 'single') {
    const [tab] = await this.queryTabs({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('No active tab found.');
    }
    return this.sendTabMessage(tab.id, {
      type: 'START_PICKING',
      mode
    });
  }

  async updateRecordingStatus(stepCount: number, isPaused: boolean) {
    return this.sendMessage({
      type: 'RECORDING_STATUS_UPDATE',
      stepCount,
      isPaused
    });
  }

  onMessage(callback: (message: any) => void) {
    if (this.isMock) {
      console.log('[AutomationBridge] [Mock] onMessage listener registered');
      return () => {};
    }
    const listener = (message: any) => callback(message);
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }
}

export const automationBridge = new AutomationBridge();
