import {
  DEBUGGER_ATTACH,
  DEBUGGER_DETACH,
  NATIVE_CLICK,
  NATIVE_TYPE,
  NATIVE_KEYPRESS,
  SAVE_SCRAPED_DATA
} from '../../src/types/messages';
import { db } from '../../src/db/database';

declare const chrome: any;
declare const browser: any;
declare const defineBackground: any;

type MessageType =
  | DEBUGGER_ATTACH
  | DEBUGGER_DETACH
  | NATIVE_CLICK
  | NATIVE_TYPE
  | NATIVE_KEYPRESS
  | SAVE_SCRAPED_DATA;

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

async function handleNativeKeyPress(target: { tabId: number }, keys: string[]) {
  for (const key of keys) {
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: key,
    });
    await sleep(10);
  }

  await sleep(50);

  for (let i = keys.length - 1; i >= 0; i--) {
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: keys[i],
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

    if (!message.target) {
      sendResponse({ success: false, error: 'No target tabId provided' });
      return true;
    }

    switch (message.type) {
      case 'DEBUGGER_ATTACH':
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
        return true;

      case 'DEBUGGER_DETACH':
        chrome.debugger.detach(message.target, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true });
          }
        });
        return true;

      case 'NATIVE_CLICK':
        handleNativeClick(message.target, message.x, message.y)
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case 'NATIVE_TYPE':
        handleNativeType(message.target, message.x, message.y, message.text, message.delayMs || 50)
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case 'NATIVE_KEYPRESS':
        handleNativeKeyPress(message.target, message.keys)
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
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
    }
  });
});
