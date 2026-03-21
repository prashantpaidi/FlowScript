// import { storage } from 'wxt/storage';

interface Trigger {
  type: string;
  key: string;
}

interface Action {
  type: string;
  selector: string;
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
        if (e.key.toLowerCase() !== keyMatch) return false;
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

        if (auto.trigger.type === 'hotkey') {
          if (matchesHotkey(e, auto.trigger.key)) {
            e.preventDefault();
            logActivity(`Triggered automation! Hotkey: ${auto.trigger.key}`);

            if (auto.action.type === 'click') {
              const el = document.querySelector(auto.action.selector) as HTMLElement;
              if (el) {
                logActivity(`Clicking element matching selector: ${auto.action.selector}`);
                el.click();
              } else {
                logActivity(`Action failed: Element not found for selector: ${auto.action.selector}`);
              }
            }
          }
        }
      }
    });
  },
});
