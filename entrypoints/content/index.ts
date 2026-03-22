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
      const currentLogs = await storage.getItem<LogEntry[]>('local:logs') || [];
      const newLogs = [{ timestamp: Date.now(), message }, ...currentLogs].slice(0, 50);
      await storage.setItem('local:logs', newLogs);
    }

    let automations: Automation[] = [];

    // Load initial automations
    const initial = await storage.getItem<Automation[]>('local:automations');
    if (initial) {
      automations = initial;
    }

    // Watch for changes
    function executeAction(action: Action) {
      if (action.type === 'click' && action.selector) {
        let el: HTMLElement | null = null;
        try {
          el = document.querySelector(action.selector) as HTMLElement;
        } catch {
          void logActivity(`Action failed: Invalid selector: ${action.selector}`);
          return;
        }
        if (el) {
          logActivity(`Clicking element matching selector: ${action.selector}`);
          el.click();
        } else {
          logActivity(`Action failed: Element not found for selector: ${action.selector}`);
        }
      } else if (action.type === 'highlight' && action.scope && action.regex) {
        let scopeElements: NodeListOf<Element>;
        try {
          scopeElements = document.querySelectorAll(action.scope);
        } catch {
          void logActivity(`Action failed: Invalid scope selector: ${action.scope}`);
          return;
        }
        if (scopeElements.length === 0) {
          logActivity(`Action failed: Element not found for scope: ${action.scope}`);
          return;
        }

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

        let totalHighlighted = 0;
        scopeElements.forEach(el => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
          const textNodes: Text[] = [];
          let node;
          while ((node = walker.nextNode())) {
            if (node.nodeValue?.trim() && node.parentElement?.tagName !== 'MARK' && node.parentElement?.tagName !== 'SCRIPT' && node.parentElement?.tagName !== 'STYLE') {
              textNodes.push(node as Text);
            }
          }
          
          textNodes.forEach(textNode => {
            const originalText = textNode.nodeValue || '';
            if (regexObj.test(originalText)) {
              const fragment = document.createDocumentFragment();
              let lastIndex = 0;
              regexObj.lastIndex = 0;
              let match;
              
              regexObj.lastIndex = 0;
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
                totalHighlighted++;
              }
              
              if (lastIndex < originalText.length) {
                fragment.appendChild(document.createTextNode(originalText.slice(lastIndex)));
              }
              
              textNode.parentNode?.replaceChild(fragment, textNode);
            }
          });
        });

        logActivity(totalHighlighted > 0 ? `Highlighted ${totalHighlighted} matches in scope ${action.scope}` : `No matches found for highlight regex in ${action.scope}`);
      }
    }

    function runPageloadAutomations() {
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
        executeAction(auto.action);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runPageloadAutomations);
    } else {
      runPageloadAutomations();
    }
    storage.watch<Automation[]>('local:automations', (newVal) => {
      automations = newVal || [];
      console.log('Automations updated:', automations);
    });

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
            executeAction(auto.action);
          }
        }
      }
    });
  },
});
