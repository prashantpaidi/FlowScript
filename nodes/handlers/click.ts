import { waitForStable } from '../utils/dom';

export async function handleClick(config: Record<string, any>, inputs: Record<string, any>) {
  const selector = config.selector || inputs.selector;
  if (!selector) {
    throw new Error('Click node requires a selector configuration.');
  }

  console.log(`[Flowscript] Waiting for stable element matching: ${selector}`);
  const el = await waitForStable(selector, config.idleMs || 300, config.timeoutMs || 10000);
  
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

  console.log(`[Flowscript] Clicked element matching: ${selector}`);
  return { success: true, selector };
}
