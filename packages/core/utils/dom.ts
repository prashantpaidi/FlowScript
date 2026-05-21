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
    let timeoutId: any = null;
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
            timeoutId = setTimeout(onStable, idleMs);
          });
          
          // Observe the whole document body for layout shifts/updates
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });
          
          // Start the initial idle timer
          timeoutId = setTimeout(onStable, idleMs);
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

/**
 * Semantic DOM Discovery: Finds the best human-readable label for an input element.
 * Follows a "Waterfall" utility approach and "The Climb" for custom UI patterns.
 */
export function findLabelForInput(el: HTMLElement): string | null {
  if (!el) return null;

  // 1. Direct Attributes (ARIA, Placeholder, Title)
  const directText = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title');
  if (directText?.trim()) return directText.trim();

  // 2. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const root = el.getRootNode() as Document | ShadowRoot;
    const ids = labelledBy.split(/\s+/);
    const combinedText = ids
      .map(id => root.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    if (combinedText) return combinedText;
  }

  // 3. Explicit Label (label[for="id"])
  if (el.id) {
    const root = el.getRootNode() as Document | ShadowRoot;
    const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(el.id) : el.id.replace(/(["\\])/g, '\\$1');
    const label = root.querySelector(`label[for="${escapedId}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  // 4. Implicit Label (closest label)
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

  // 5. "The Climb": Check parent div siblings for text nodes
  // Pierces Shadow DOM boundaries
  let current: Element | null = el;
  let depth = 0;
  const maxDepth = 5;

  while (current && depth < maxDepth) {
    // Check previous siblings for text-heavy elements
    let sibling = current.previousElementSibling;
    while (sibling) {
      const text = sibling.textContent?.trim();
      if (text) return text;
      sibling = sibling.previousElementSibling;
    }

    // Traverse up, piercing Shadow DOM
    let parentEl: Element | null = current.parentElement;
    if (!parentEl) {
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        parentEl = root.host;
      }
    }

    if (!parentEl || parentEl === document.body || parentEl === document.documentElement) break;
    current = parentEl;
    depth++;
  }

  return null;
}
