import {
  DEBUGGER_ATTACH,
  DEBUGGER_DETACH,
  NATIVE_CLICK,
  NATIVE_TYPE,
  NATIVE_KEYPRESS,
  SAVE_SCRAPED_DATA,
  EVALUATE_JS,
  RECORDING_STARTED,
  RECORDING_STOPPED,
  USER_INTERACTION_EVENT,
  HUD_CONTROL,
  RECORDING_STATUS_UPDATE,
  REMOTE_HTTP_REQUEST,
  GET_LOCAL_SECRETS
} from '../../src/types/messages';
import { db } from '@flowscript/db';

declare const chrome: any;
declare const browser: any;
declare const defineBackground: any;

type MessageType =
  | DEBUGGER_ATTACH
  | DEBUGGER_DETACH
  | NATIVE_CLICK
  | NATIVE_TYPE
  | NATIVE_KEYPRESS
  | SAVE_SCRAPED_DATA
  | EVALUATE_JS
  | RECORDING_STARTED
  | RECORDING_STOPPED
  | USER_INTERACTION_EVENT
  | HUD_CONTROL
  | RECORDING_STATUS_UPDATE
  | REMOTE_HTTP_REQUEST
  | GET_LOCAL_SECRETS;

let activeRecordingTabId: number | null = null;
let isNativeMode = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleNativeClick(target: { tabId: number }, x: number, y: number) {
  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
  });
  await sleep(10);
  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await sleep(10);
  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
}

async function handleNativeType(
  target: { tabId: number },
  x: number | undefined,
  y: number | undefined,
  text: string,
  delayMs: number
) {
  if (typeof x === 'number' && typeof y === 'number') {
    await handleNativeClick(target, x, y);
    await sleep(50);
  }

  for (const char of text) {
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      text: char,
    });
    await sleep(delayMs);
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      text: char,
    });
    await sleep(delayMs);
  }
}

const KEY_MAP: Record<string, string> = {
  'ctrl': 'Control',
  'control': 'Control',
  'alt': 'Alt',
  'shift': 'Shift',
  'meta': 'Meta',
  'command': 'Meta',
  'enter': 'Enter',
  'backspace': 'Backspace',
  'tab': 'Tab',
  'escape': 'Escape',
  'space': ' ',
  ' ': ' ',
  'arrowup': 'ArrowUp',
  'arrowdown': 'ArrowDown',
  'arrowleft': 'ArrowLeft',
  'arrowright': 'ArrowRight',
  'up': 'ArrowUp',
  'down': 'ArrowDown',
  'left': 'ArrowLeft',
  'right': 'ArrowRight',
  'delete': 'Delete',
  'home': 'Home',
  'end': 'End',
  'pageup': 'PageUp',
  'pagedown': 'PageDown',
  'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4', 'f5': 'F5', 'f6': 'F6',
  'f7': 'F7', 'f8': 'F8', 'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
};

const MODIFIER_BIT_MAP: Record<string, number> = {
  'Control': 2,
  'Alt': 1,
  'Shift': 8,
  'Meta': 4,
};

async function handleNativeKeyPress(target: { tabId: number }, keys: string[], keyData?: any) {
  if (keyData) {
    console.log(`[Flowscript] Dispatching precise native keypress: ${keyData.key} (${keyData.code})`);
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: keyData.key,
      code: keyData.code,
      modifiers: keyData.modifiers,
      windowsVirtualKeyCode: keyData.windowsVirtualKeyCode,
      text: keyData.key.length === 1 ? keyData.key : (keyData.key === 'Enter' ? '\r' : undefined),
    });
    await sleep(50);
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: keyData.key,
      code: keyData.code,
      modifiers: keyData.modifiers,
      windowsVirtualKeyCode: keyData.windowsVirtualKeyCode,
    });
    return;
  }

  let currentModifiers = 0;
  const pressedKeys: string[] = [];

  for (const rawKey of keys) {
    const keyName = KEY_MAP[rawKey.toLowerCase()] || rawKey;
    const modifierBit = MODIFIER_BIT_MAP[keyName];

    if (modifierBit) {
      currentModifiers |= modifierBit;
    }

    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: keyName,
      modifiers: currentModifiers,
      // For some keys, we need to provide text to trigger the action
      text: keyName === 'Enter' ? '\r' : (keyName.length === 1 ? keyName : undefined),
      unmodifiedText: keyName.length === 1 ? keyName : undefined,
    });
    
    pressedKeys.push(keyName);
    await sleep(10);
  }

  await sleep(50);

  // Release in reverse order
  for (let i = pressedKeys.length - 1; i >= 0; i--) {
    const keyName = pressedKeys[i];
    const modifierBit = MODIFIER_BIT_MAP[keyName];
    
    if (modifierBit) {
      currentModifiers &= ~modifierBit;
    }

    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: keyName,
      modifiers: currentModifiers,
    });
    await sleep(10);
  }
}

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: any) => console.error(error));

  chrome.runtime.onMessage.addListener((message: MessageType, sender: any, sendResponse: any) => {
    if (!message || typeof message.type !== 'string') return;

    // Auto-fill target with sender's tabId if not provided
    if (!message.target && sender?.tab?.id) {
      message.target = { tabId: sender.tab.id };
    }

    // Messages that MUST have a target (debugger actions)
    const needsTarget = [
      'DEBUGGER_ATTACH',
      'DEBUGGER_DETACH',
      'NATIVE_CLICK',
      'NATIVE_TYPE',
      'NATIVE_KEYPRESS',
      'EVALUATE_JS'
    ];

    if (needsTarget.includes(message.type) && !message.target) {
      sendResponse({ success: false, error: `Message type ${message.type} requires a target tabId` });
      return true;
    }

    switch (message.type) {
      case 'DEBUGGER_ATTACH':
        if (message.target) {
          chrome.debugger.attach(message.target, '1.3', () => {
            if (chrome.runtime.lastError) {
              const errMsg = chrome.runtime.lastError.message || '';
              if (errMsg.includes('already attached') || errMsg.includes('Another debugger is already attached')) {
                sendResponse({ success: true });
              } else {
                sendResponse({ success: false, error: errMsg });
              }
            } else {
              sendResponse({ success: true });
            }
          });
        }
        return true;

      case 'DEBUGGER_DETACH':
        if (message.target) {
          chrome.debugger.detach(message.target, () => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true });
            }
          });
        }
        return true;

      case 'NATIVE_CLICK':
        if (message.target) {
          handleNativeClick(message.target, message.x, message.y)
            .then(() => sendResponse({ success: true }))
            .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        }
        return true;

      case 'NATIVE_TYPE':
        if (message.target) {
          handleNativeType(message.target, message.x, message.y, message.text, message.delayMs || 50)
            .then(() => sendResponse({ success: true }))
            .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        }
        return true;

      case 'NATIVE_KEYPRESS':
        (async () => {
          try {
            if (message.target) {
              if (typeof message.x === 'number' && typeof message.y === 'number') {
                await handleNativeClick(message.target, message.x, message.y);
                await sleep(50);
              }
              await handleNativeKeyPress(message.target, message.keys, message.keyData);
              sendResponse({ success: true });
            }
          } catch (err: any) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return true;
      case 'EVALUATE_JS':
        if (message.target) {
          chrome.debugger.sendCommand(message.target, 'Runtime.evaluate', {
            expression: message.expression,
            returnByValue: true
          })
            .then((res: any) => {
              if (res.exceptionDetails) {
                sendResponse({ success: false, error: res.exceptionDetails.text });
              } else {
                sendResponse({ success: true, result: res.result });
              }
            })
            .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        }
        return true;
      case 'SAVE_SCRAPED_DATA':
        db.scrapedRecords.add({
          workflowId: message.workflowId,
          datasetName: message.datasetName || 'Default Dataset',
          tabId: message.target?.tabId || sender?.tab?.id,
          url: message.url,
          data: message.data,
          timestamp: Date.now()
        })
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case 'RECORDING_STARTED':
        activeRecordingTabId = message.target?.tabId || sender?.tab?.id || null;
        console.log('Recording started on tab:', activeRecordingTabId);
        // Notify the tab to start capturing events
        if (activeRecordingTabId) {
          browser.tabs.sendMessage(activeRecordingTabId, { 
            type: 'RECORDING_STARTED',
            isNativeMode 
          }).catch(() => {});
        }
        sendResponse({ success: true });
        return true;

      case 'RECORDING_STOPPED':
        console.log('Recording stopped');
        if (activeRecordingTabId) {
          browser.tabs.sendMessage(activeRecordingTabId, { type: 'RECORDING_STOPPED' }).catch(() => {});
        }
        activeRecordingTabId = null;
        isNativeMode = false;
        sendResponse({ success: true });
        return true;

      case 'USER_INTERACTION_EVENT':
        // Relay this to the sidepanel
        console.log('Relaying interaction event:', message);
        browser.runtime.sendMessage(message).catch(() => {});
        sendResponse({ success: true });
        return true;

      case 'HUD_CONTROL':
        // Relay HUD actions (pause/resume/stop) to the sidepanel
        console.log('Relaying HUD control:', message.action);
        if (message.action === 'toggleNativeMode') {
          isNativeMode = !!message.value;
          console.log('Native Mode updated to:', isNativeMode);
        }
        browser.runtime.sendMessage(message).catch(() => {});
        sendResponse({ success: true });
        return true;

      case 'RECORDING_STATUS_UPDATE':
        // Relay status updates to the content script
        if (activeRecordingTabId) {
          browser.tabs.sendMessage(activeRecordingTabId, message).catch(() => {});
        }
        sendResponse({ success: true });
        return true;
      case 'REMOTE_HTTP_REQUEST':
        const method = message.method.toUpperCase();
        
        // Security: Redact sensitive query parameters from the URL in logs
        let logUrl = message.url;
        try {
          const urlObj = new URL(message.url);
          const sensitiveKeys = ['key', 'token', 'api_key', 'apikey', 'secret', 'auth', 'password', 'access_token'];
          let hasSensitive = false;
          urlObj.searchParams.forEach((_, key) => {
            if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
              urlObj.searchParams.set(key, 'REDACTED');
              hasSensitive = true;
            }
          });
          logUrl = urlObj.toString();
        } catch (e) {
          // If URL parsing fails, just use the original URL but warn
          logUrl = '[Invalid URL]';
        }

        console.log(`[Flowscript] Handling remote HTTP request [${method}]:`, logUrl);

        // Implementation of Timeouts and AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        // Header Normalization
        const normalizedHeaders: Record<string, string> = {};
        if (message.headers) {
          Object.entries(message.headers).forEach(([key, value]) => {
            normalizedHeaders[key.toLowerCase()] = value;
          });
        }

        fetch(message.url, {
          method,
          headers: normalizedHeaders,
          body: method !== 'GET' && method !== 'HEAD' ? (typeof message.body === 'string' ? message.body : JSON.stringify(message.body)) : undefined,
          signal: controller.signal
        })
          .then(async (response) => {
            clearTimeout(timeoutId);
            const responseType = message.responseType || 'json';
            const text = await response.text();
            
            let data: any = text;
            if (responseType === 'json') {
              try {
                data = JSON.parse(text);
              } catch (e) {
                console.warn('[Flowscript] Failed to parse response as JSON, falling back to text');
              }
            }

            sendResponse({
              success: response.ok,
              status: response.status,
              statusText: response.statusText,
              data
            });
          })
          .catch((err: Error) => {
            clearTimeout(timeoutId);
            const isTimeout = err.name === 'AbortError';
            console.error(`[Flowscript] Remote HTTP request failed ${isTimeout ? '(Timeout)' : ''}:`, err);
            sendResponse({ 
              success: false, 
              error: isTimeout ? 'Request timed out after 30s' : err.message 
            });
          });
        return true;

      case 'GET_LOCAL_SECRETS':
        browser.storage.local.get('local:secrets')
          .then((result: any) => {
            sendResponse({ success: true, secrets: result['local:secrets'] || {} });
          })
          .catch((err: Error) => {
            console.error('[Flowscript] Failed to fetch secrets:', err);
            sendResponse({ success: false, error: err.message });
          });
        return true;
    }
  });

  browser.tabs.onUpdated.addListener((tabId: number, changeInfo: any, tab: any) => {
    if (tabId === activeRecordingTabId) {
      if (changeInfo.status === 'complete') {
        console.log('Tab refreshed, re-triggering recording for tab:', tabId);
        browser.tabs.sendMessage(tabId, { 
          type: 'RECORDING_STARTED',
          isNativeMode 
        }).catch(() => {});
      }
      
      if (changeInfo.url) {
        console.log('Navigation detected in recording tab:', changeInfo.url);
        browser.runtime.sendMessage({
          type: 'NAVIGATION_EVENT',
          url: changeInfo.url,
          timestamp: Date.now()
        }).catch(() => {});
      }
    }
  });
});
