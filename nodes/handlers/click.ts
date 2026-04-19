import { waitForStable } from '../utils/dom';

declare const browser: any;

export async function handleClick(config: Record<string, any>, inputs: Record<string, any>, _context?: any) {
  const selector = config.selector || inputs.selector;
  if (!selector) {
    throw new Error('Click node requires a selector configuration.');
  }

  console.log(`[Flowscript] Waiting for stable element matching: ${selector}`);
  const el = await waitForStable(selector, config.idleMs || 300, config.timeoutMs || 10000);

  if (config.isNative) {
    const rect = el.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    console.log(`[Flowscript] Performing native click at (${x}, ${y})`);

    const response = await browser.runtime.sendMessage({
      type: 'NATIVE_CLICK',
      x,
      y
    });

    if (response && !response.success) {
      throw new Error(`Native click failed: ${response.error}`);
    }
  } else {
    if (el instanceof HTMLElement) {
      el.click();
    } else {
      // Dispatch a generic mouse event for non-HTMLElements (like SVGs)
      const rect = el.getBoundingClientRect();
      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      });
      el.dispatchEvent(event);
    }
  }

  console.log(`[Flowscript] Clicked element matching: ${selector}`);
  return { success: true, selector };
}
