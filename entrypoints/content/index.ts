// import { storage } from 'wxt/storage';

interface Trigger {
  type: 'hotkey' | 'pageload';
  key?: string;
}

interface Action {
  type: 'click' | 'highlight';
  selector?: string;
  scope?: string;
  regex?: string;
  color?: string;
}

interface Automation {
  trigger: Trigger;
  action: Action;
  urlRegex?: string;
}

interface LogEntry {
  timestamp: number;
  message: string;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    console.log('Flowscript Content Script loaded.');

    async function logActivity(message: string) {
      console.log(message);
      try {
        const currentLogs = await storage.getItem<LogEntry[]>('local:logs') || [];
        const newLogs = [{ timestamp: Date.now(), message }, ...currentLogs].slice(0, 50);
        await storage.setItem('local:logs', newLogs);
      } catch (error) {
        console.debug('Could not write log to storage (context potentially invalidated):', error);
      }
    }

    let automations: Automation[] = [];
    const activeHighlightObservers = new WeakMap<Element, MutationObserver>();
    const activeGlobalObservers = new Map<string, MutationObserver>();

    // Load initial automations
    const initial = await storage.getItem<Automation[]>('local:automations');
    if (initial) {
      automations = initial;
    }

    // Watch for changes
    async function waitForElement(selector: string, timeout = 5000): Promise<NodeListOf<Element>> {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) return elements;
      } catch (e) {
        return [] as unknown as NodeListOf<Element>;
      }

      return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          try {
            const els = document.querySelectorAll(selector);
            if (els.length > 0) {
              observer.disconnect();
              clearTimeout(timer);
              resolve(els);
            }
          } catch (e) {
            observer.disconnect();
            clearTimeout(timer);
            resolve([] as unknown as NodeListOf<Element>);
          }
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });

        const timer = setTimeout(() => {
          observer.disconnect();
          try {
            resolve(document.querySelectorAll(selector));
          } catch (e) {
            resolve([] as unknown as NodeListOf<Element>);
          }
        }, timeout);
      });
    }

    async function executeAction(action: Action) {
      if (action.type === 'click' && action.selector) {
        const els = await waitForElement(action.selector);
        const el = els[0] as HTMLElement;
        if (el) {
          logActivity(`Clicking element matching selector: ${action.selector}`);
          el.click();
        } else {
          logActivity(`Action failed: Element not found for selector: ${action.selector}`);
        }
      } else if (action.type === 'highlight' && action.scope && action.regex) {
        let regexObj: RegExp;
        try {
          regexObj = new RegExp(action.regex, 'gi');
        } catch (e) {
          logActivity(`Action failed: Invalid regex ${action.regex}`);
          return;
        }

        regexObj.lastIndex = 0;
        if (regexObj.test('')) {
          void logActivity(`Action failed: Regex matches empty string`);
          return;
        }

        const applyHighlight = (el: Element) => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
          const textNodes: Text[] = [];
          let node;
          while ((node = walker.nextNode())) {
            if (node.nodeValue?.trim() && 
                node.parentElement?.tagName !== 'MARK' && 
                node.parentElement?.tagName !== 'SCRIPT' && 
                node.parentElement?.tagName !== 'STYLE' &&
                !node.parentElement?.classList.contains('flowscript-highlight')) {
              textNodes.push(node as Text);
            }
          }
          
          let count = 0;
          textNodes.forEach(textNode => {
            const originalText = textNode.nodeValue || '';
            regexObj.lastIndex = 0;
            if (regexObj.test(originalText)) {
              const fragment = document.createDocumentFragment();
              let lastIndex = 0;
              regexObj.lastIndex = 0;
              let match;
              
              while ((match = regexObj.exec(originalText)) !== null) {
                if (match.index > lastIndex) {
                  fragment.appendChild(document.createTextNode(originalText.slice(lastIndex, match.index)));
                }
                const mark = document.createElement('mark');
                mark.className = 'flowscript-highlight';
                mark.style.backgroundColor = action.color || 'yellow';
                mark.style.color = 'black';
                mark.textContent = match[0];
                fragment.appendChild(mark);
                lastIndex = regexObj.lastIndex;
                count++;
              }
              
              if (lastIndex < originalText.length) {
                fragment.appendChild(document.createTextNode(originalText.slice(lastIndex)));
              }
              
              textNode.parentNode?.replaceChild(fragment, textNode);
            }
          });
          return count;
        };

        const observerKey = JSON.stringify(action);
        if (activeGlobalObservers.has(observerKey)) {
          // Live watcher already exists for this action. Catch up if SPA routing happened.
          const els = document.querySelectorAll(action.scope);
          let total = 0;
          els.forEach(el => total += applyHighlight(el));
          if (total > 0) logActivity(`Highlighted ${total} matches in scope ${action.scope}`);
          return;
        }

        let highlightDebounceTimer: ReturnType<typeof setTimeout> | null = null;
        let totalHighlightedAllTime = 0;

        const doHighlight = () => {
          const els = document.querySelectorAll(action.scope!);
          let newlyHighlighted = 0;
          els.forEach(el => newlyHighlighted += applyHighlight(el));
          
          if (newlyHighlighted > 0) {
            totalHighlightedAllTime += newlyHighlighted;
            logActivity(`Found ${newlyHighlighted} new matches in scope ${action.scope} via dynamic update (Total: ${totalHighlightedAllTime})`);
          }
        };

        // Initial pass
        let initialCount = 0;
        document.querySelectorAll(action.scope).forEach(el => initialCount += applyHighlight(el));
        if (initialCount > 0) {
          totalHighlightedAllTime += initialCount;
          logActivity(`Highlighted ${initialCount} matches in scope ${action.scope}`);
        } else {
          logActivity(`No immediate matches found for highlight regex in ${action.scope}. Watching for updates...`);
        }

        // Setup global live watcher for this action
        const observer = new MutationObserver(() => {
          if (highlightDebounceTimer) clearTimeout(highlightDebounceTimer);
          highlightDebounceTimer = setTimeout(doHighlight, 500); // Wait for React batch renders
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        activeGlobalObservers.set(observerKey, observer);
      }
    }

    async function runPageloadAutomations() {
      for (const auto of automations) {
        if (auto.trigger.type !== 'pageload') continue;
        
        if (auto.urlRegex) {
          try {
            const regex = new RegExp(auto.urlRegex);
            if (!regex.test(window.location.href)) continue;
          } catch (e) {
            logActivity(`Invalid regex in automation: ${auto.urlRegex}`);
            continue;
          }
        }
        
        logActivity(`Triggered automation! Pageload`);
        await executeAction(auto.action);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runPageloadAutomations);
    } else {
      runPageloadAutomations();
    }

    // Observe SPA URL changes
    let lastUrl = location.href;
    let urlChangeTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleUrlChange = () => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        if (urlChangeTimeout) clearTimeout(urlChangeTimeout);
        urlChangeTimeout = setTimeout(() => {
          runPageloadAutomations();
        }, 500); // Wait for SPA to unmount old page components
      }
    };

    new MutationObserver(handleUrlChange).observe(document, { subtree: true, childList: true });
    window.addEventListener('popstate', handleUrlChange);

    storage.watch<Automation[]>('local:automations', (newVal) => {
      automations = newVal || [];
      console.log('Automations updated:', automations);
    });

    // --- DOM INSPECTOR LOGIC ---
    interface SelectorOption {
      selector: string;
      label: string;
      stability: 'best' | 'good' | 'fragile';
    }

    function buildNthChildSelector(el: Element): string {
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase();
        const index = Array.from(current.parentElement?.children ?? []).indexOf(current) + 1;
        parts.unshift(`${tag}:nth-child(${index})`);
        current = current.parentElement;
      }
      return parts.join(' > ');
    }

    function generateSelectorOptions(el: Element): SelectorOption[] {
      const options: SelectorOption[] = [];
      const tag = el.tagName.toLowerCase();

      // 1. ID
      if (el.id) {
        try {
          if (document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
            options.push({
              selector: `#${CSS.escape(el.id)}`,
              label: 'by ID',
              stability: 'best',
            });
          }
        } catch(e) {}
      }

      // 2. data attributes
      for (const attr of ['data-testid', 'data-cy', 'data-id', 'aria-label']) {
        const val = el.getAttribute(attr);
        if (val) {
          options.push({
            selector: `${tag}[${CSS.escape(attr)}="${CSS.escape(val)}"]`,
            label: `by ${attr}`,
            stability: 'best',
          });
        }
      }

      // 3. Unique class combo
      if (el.classList.length > 0) {
        const classes = Array.from(el.classList)
          .filter(c => /^[a-z_-]/i.test(c))
          .map(c => `.${CSS.escape(c)}`)
          .join('');
        if (classes) {
          try {
            if (document.querySelectorAll(`${tag}${classes}`).length === 1) {
              options.push({
                selector: `${tag}${classes}`,
                label: 'by class',
                stability: 'good',
              });
            }
          } catch(e) {}
        }
      }

      // 4. nth-child fallback — always included
      const nthSelector = buildNthChildSelector(el);
      options.push({
        selector: nthSelector,
        label: 'by position',
        stability: 'fragile',
      });

      return options;
    }

    let isInspectorActive = false;
    let highlightOverlay: HTMLDivElement | null = null;
    let inspectorToolbar: HTMLDivElement | null = null;
    let activeHoverOverlays: HTMLDivElement[] = [];

    function clearHoverOverlays() {
      activeHoverOverlays.forEach(overlay => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      });
      activeHoverOverlays = [];
    }

    function createHoverOverlays(selector: string) {
      clearHoverOverlays();
      if (!selector) return;
      try {
        const elements = document.querySelectorAll(selector);
        const maxElements = Math.min(elements.length, 50);
        for (let i = 0; i < maxElements; i++) {
          const el = elements[i] as HTMLElement;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue; // Skip hidden elements

          const overlay = document.createElement('div');
          overlay.style.position = 'absolute';
          overlay.style.pointerEvents = 'none';
          overlay.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'; // Emerald 500
          overlay.style.border = '2px dashed rgba(16, 185, 129, 0.8)';
          overlay.style.zIndex = '2147483645'; // Just under inspector
          overlay.style.transition = 'all 0.1s ease';
          overlay.style.top = `${rect.top + window.scrollY}px`;
          overlay.style.left = `${rect.left + window.scrollX}px`;
          overlay.style.width = `${rect.width}px`;
          overlay.style.height = `${rect.height}px`;
          document.body.appendChild(overlay);
          activeHoverOverlays.push(overlay);
        }
      } catch (e) {}
    }

    // Update hover overlays on scroll or resize to keep them attached (throttle simply for performance)
    window.addEventListener('scroll', () => {
      if (activeHoverOverlays.length > 0) {
         // Instead of repositioning all of them, just hide them or let them be.
         // A more complex implementation could resync positions. For now, clear them on scroll to avoid detached highlights.
         clearHoverOverlays();
      }
    }, { passive: true });
    window.addEventListener('resize', clearHoverOverlays, { passive: true });

    function cleanupInspector() {
      isInspectorActive = false;
      document.removeEventListener('mousemove', onInspectorMouseMove, true);
      document.removeEventListener('click', onInspectorClick, true);
      document.removeEventListener('keydown', onInspectorKeyDown, true);
      
      if (highlightOverlay && highlightOverlay.parentNode) {
        highlightOverlay.parentNode.removeChild(highlightOverlay);
      }
      highlightOverlay = null;

      if (inspectorToolbar && inspectorToolbar.parentNode) {
        inspectorToolbar.parentNode.removeChild(inspectorToolbar);
      }
      inspectorToolbar = null;
    }

    function onInspectorMouseMove(e: MouseEvent) {
      if (!isInspectorActive || !highlightOverlay) return;
      
      const target = e.target as HTMLElement;
      if (target === highlightOverlay || target === inspectorToolbar || inspectorToolbar?.contains(target)) return;

      const rect = target.getBoundingClientRect();
      
      highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
      highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
      highlightOverlay.style.width = `${rect.width}px`;
      highlightOverlay.style.height = `${rect.height}px`;
    }

    function onInspectorClick(e: MouseEvent) {
      if (!isInspectorActive) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      if (target === highlightOverlay || target === inspectorToolbar || inspectorToolbar?.contains(target)) return;

      const options = generateSelectorOptions(target);
      logActivity(`Element selected. Generated ${options.length} options.`);
      
      browser.runtime.sendMessage({ action: 'element-selected', options });
      cleanupInspector();
    }

    function onInspectorKeyDown(e: KeyboardEvent) {
      if (!isInspectorActive) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        logActivity('DOM Inspector cancelled.');
        browser.runtime.sendMessage({ action: 'dom-inspector-cancelled' });
        cleanupInspector();
      }
    }

    browser.runtime.onMessage.addListener((message) => {
      if (message.action === 'start-dom-inspector') {
        if (isInspectorActive) return;
        isInspectorActive = true;
        logActivity('DOM Inspector started.');

        highlightOverlay = document.createElement('div');
        highlightOverlay.style.position = 'absolute';
        highlightOverlay.style.pointerEvents = 'none';
        highlightOverlay.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        highlightOverlay.style.border = '2px solid rgba(59, 130, 246, 0.8)';
        highlightOverlay.style.zIndex = '2147483646'; // Max z-index minus one
        highlightOverlay.style.transition = 'all 0.05s ease';
        document.body.appendChild(highlightOverlay);

        inspectorToolbar = document.createElement('div');
        inspectorToolbar.style.position = 'fixed';
        inspectorToolbar.style.top = '16px';
        inspectorToolbar.style.left = '50%';
        inspectorToolbar.style.transform = 'translateX(-50%)';
        inspectorToolbar.style.backgroundColor = '#1e293b';
        inspectorToolbar.style.color = '#f8fafc';
        inspectorToolbar.style.padding = '8px 16px';
        inspectorToolbar.style.borderRadius = '8px';
        inspectorToolbar.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)';
        inspectorToolbar.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        inspectorToolbar.style.fontSize = '14px';
        inspectorToolbar.style.fontWeight = '500';
        inspectorToolbar.style.zIndex = '2147483647'; // Max z-index
        inspectorToolbar.innerText = 'Pick an element (Press Esc to cancel)';
        document.body.appendChild(inspectorToolbar);

        document.addEventListener('mousemove', onInspectorMouseMove, true);
        document.addEventListener('click', onInspectorClick, true);
        document.addEventListener('keydown', onInspectorKeyDown, true);
      } else if (message.action === 'hover-element') {
        createHoverOverlays(message.selector);
      } else if (message.action === 'clear-hover') {
        clearHoverOverlays();
      }
    });
    // ---------------------------

    // Helper to evaluate hotkey
    function matchesHotkey(e: KeyboardEvent, hotkey: string) {
      if (!hotkey) return false;
      const parts = hotkey.toLowerCase().split('+').map(p => p.trim());
      const needsCtrl = parts.includes('ctrl') || parts.includes('control');
      const needsAlt = parts.includes('alt');
      const needsShift = parts.includes('shift');
      const needsMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('windows');

      const keyMatch = parts.find(p => !['ctrl', 'control', 'alt', 'shift', 'meta', 'cmd', 'windows'].includes(p));

      if (!!e.ctrlKey !== needsCtrl) return false;
      if (!!e.altKey !== needsAlt) return false;
      if (!!e.shiftKey !== needsShift) return false;
      if (!!e.metaKey !== needsMeta) return false;

      if (keyMatch) {
        const eventKey = e.key === ' ' ? 'space' : e.key.toLowerCase();
        if (eventKey !== keyMatch) return false;
      }

      return true;
    }

    // Listen to keydown
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      for (const auto of automations) {
        if (auto.urlRegex) {
          try {
            const regex = new RegExp(auto.urlRegex);
            if (!regex.test(window.location.href)) {
              continue; // Skip because URL doesn't match
            }
          } catch (e) {
            logActivity(`Invalid regex in automation: ${auto.urlRegex}`);
            continue;
          }
        }

        if (auto.trigger.type === 'hotkey' && auto.trigger.key) {
          if (matchesHotkey(e, auto.trigger.key)) {
            e.preventDefault();
            logActivity(`Triggered automation! Hotkey: ${auto.trigger.key}`);
            void executeAction(auto.action);
          }
        }
      }
    });
  },
});
