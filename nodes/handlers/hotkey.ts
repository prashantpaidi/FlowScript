export function matchesHotkey(e: KeyboardEvent, hotkey: string) {
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

export function setupHotkeyListener(
  onMatch: (triggerId: string, workflowId: string) => void,
  workflows: any[]
): () => void {
  const handler = (e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    for (const workflow of workflows) {
      for (const node of workflow.nodes) {
        if (node.type === 'triggerNode' && node.subtype === 'hotkey') {
          const expectedKey = node.data?.key;
          if (expectedKey && matchesHotkey(e, expectedKey)) {
            e.preventDefault();
            onMatch(node.id, workflow.id);
          }
        }
      }
    }
  };

  window.addEventListener('keydown', handler);

  // Return a cleanup function
  return () => {
    window.removeEventListener('keydown', handler);
  };
}

export async function handleHotkey(config: Record<string, any>, inputs: Record<string, any>, _context?: any) {
  // If the executor ever visits the trigger node (e.g. debugging or downstream links),
  // we just return its static configuration.
  return { triggered: true };
}
