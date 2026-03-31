/**
 * Waits for an element matching the selector to appear and stabilize.
 * "Stable" means no DOM mutations have occurred in the entire document for `idleMs`.
 * This ensures that SPA frameworks (React/Vue) have finished rendering.
 * 
 * @param selector CSS selector to match
 * @param idleMs How long the DOM must be idle to be considered stable (default 300ms)
 * @param timeoutMs Maximum time to wait in total before rejecting
 */
export async function waitForStable(selector: string, idleMs = 300, timeoutMs = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    let timeoutId: number | null = null;
    let observer: MutationObserver | null = null;
    let observerWaitType: 'appear' | 'stable' | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (observer) observer.disconnect();
    };

    // Overall timeout
    const maxTimeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for element ${selector} to become stable`));
    }, timeoutMs);

    const evaluate = () => {
      const el = document.querySelector(selector);
      if (el) {
        // If element is found, we wait for mutations to stop
        if (!observer || observerWaitType !== 'stable') {
          if (observer) observer.disconnect();
          observerWaitType = 'stable';
          observer = new MutationObserver(() => {
            // A mutation happened, reset the idle timer
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = window.setTimeout(onStable, idleMs);
          });
          
          // Observe the whole document body for layout shifts/updates
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });
          
          // Start the initial idle timer
          timeoutId = window.setTimeout(onStable, idleMs);
        }
      } else if (!observer || observerWaitType !== 'appear') {
        if (observer) observer.disconnect();
        observerWaitType = 'appear';
        // Element not found yet, wait for ANY mutation to try finding it again
        observer = new MutationObserver(() => {
          evaluate();
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    };

    const onStable = () => {
      const el = document.querySelector(selector);
      if (el) {
        cleanup();
        clearTimeout(maxTimeoutId);
        resolve(el);
      } else {
        // Element vanished before stabilizing, keep evaluating
        evaluate();
      }
    };

    // Initial check
    evaluate();
  });
}
