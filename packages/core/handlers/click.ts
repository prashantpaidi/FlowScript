import { waitForStable } from '../utils/dom';
import { ExecutionContext } from '../environment';

export async function handleClick(config: Record<string, any>, inputs: Record<string, any>, context: ExecutionContext) {
  const { env } = context;
  const selector = config.selector || inputs.selector;
  if (!selector) {
    throw new Error('Click node requires a selector configuration.');
  }

  console.log(`[Flowscript] Waiting for stable element matching: ${selector}`);
  const el = await waitForStable(selector, config.idleMs || 300, config.timeoutMs || 10000);

  if (config.isNative) {
    let x: number, y: number;
    if (config.coordinates) {
      x = Math.round(config.coordinates.pageX - window.scrollX);
      y = Math.round(config.coordinates.pageY - window.scrollY);
    } else {
      const rect = el.getBoundingClientRect();
      x = Math.round(rect.left + rect.width / 2);
      y = Math.round(rect.top + rect.height / 2);
    }

    console.log(`[Flowscript] Performing native click at (${x}, ${y})`);

    const response = await env.sendMessage({
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
      let clientX: number, clientY: number;
      if (config.coordinates) {
        clientX = config.coordinates.pageX - window.scrollX;
        clientY = config.coordinates.pageY - window.scrollY;
      } else {
        const rect = el.getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
      }

      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX,
        clientY
      });
      el.dispatchEvent(event);
    }
  }

  console.log(`[Flowscript] Clicked element matching: ${selector}`);
  return {
    data: { success: true, selector },
    nextNodeId: context.getNextNodeId ? context.getNextNodeId() : undefined
  };
}
