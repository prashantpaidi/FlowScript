import { getBestSelector, getAllSelectors } from '@flowscript/core';
import { FlowscriptHUD } from '../components/RecorderHUD';

export let isRecording = false;
export let isRecordingPaused = false;
export let hud: FlowscriptHUD | null = null;
let pendingInput: { selector: string, value: string, timestamp: number } | null = null;

function finalizePendingInput() {
  if (pendingInput && pendingInput.value.trim() !== '') {
    console.log('[Flowscript] Finalized input:', pendingInput.selector, pendingInput.value);
    // @ts-ignore
    browser.runtime.sendMessage({
      type: 'USER_INTERACTION_EVENT',
      eventType: 'type',
      selector: pendingInput.selector,
      value: pendingInput.value,
      timestamp: pendingInput.timestamp
    }).catch(() => { });
  }
  pendingInput = null;
}

function handleRecordingClick(e: MouseEvent) {
  if (!isRecording || isRecordingPaused) return;

  const target = e.target as HTMLElement;
  if (!target) return;

  // Ignore clicks on our own HUD (though Shadow DOM should handle most of it)
  if (target.closest('#flowscript-hud-container')) return;

  finalizePendingInput();

  const selector = getBestSelector(target);
  console.log('[Flowscript] Captured click:', selector);

  // @ts-ignore
  browser.runtime.sendMessage({
    type: 'USER_INTERACTION_EVENT',
    eventType: 'click',
    selector,
    timestamp: Date.now(),
    coordinates: {
      pageX: Math.round(e.pageX),
      pageY: Math.round(e.pageY),
      clientX: Math.round(e.clientX),
      clientY: Math.round(e.clientY)
    }
  }).catch(() => { });
}

function handleRecordingInput(e: Event) {
  if (!isRecording || isRecordingPaused) return;
  const target = e.target as HTMLElement;
  if (!target || !target.tagName) return;

  const selector = getBestSelector(target);
  const value = (target as any).value !== undefined ? (target as any).value : target.innerText;

  pendingInput = {
    selector,
    value: value || '',
    timestamp: Date.now()
  };
}

function handleRecordingKeyDown(e: KeyboardEvent) {
  if (!isRecording || isRecordingPaused) return;

  const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
  if (isModifier) return;

  if (e.key === 'Enter') {
    finalizePendingInput();
  }

  const target = e.target as HTMLElement;

  // --- Optimization: Decide if we should record this as a pressKey node ---
  const isInput = target && (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );

  // Only skip recording keypress if it's a regular character in an input field
  // We consider "regular" as: key length 1 (printable) AND no control/alt/meta modifiers
  const isRegularChar = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

  if (isInput && isRegularChar) {
    // Skip pressKey node for regular typing in inputs (will be handled by 'type' event)
    return;
  }
  // -----------------------------------------------------------------------

  // Capture modifiers bitmask for CDP
  let modifiers = 0;
  if (e.altKey) modifiers |= 1;
  if (e.ctrlKey) modifiers |= 2;
  if (e.metaKey) modifiers |= 4;
  if (e.shiftKey) modifiers |= 8;

  const selector = target ? getBestSelector(target) : 'body';

  console.log('[Flowscript] Captured keypress:', e.key, e.code, modifiers);

  // @ts-ignore
  browser.runtime.sendMessage({
    type: 'USER_INTERACTION_EVENT',
    eventType: 'keypress',
    selector,
    timestamp: Date.now(),
    keyData: {
      key: e.key,
      code: e.code,
      modifiers,
      windowsVirtualKeyCode: e.keyCode
    }
  }).catch(() => { });
}

export function startRecording(isNativeMode: boolean = false) {
  if (isRecording) return;
  isRecording = true;
  isRecordingPaused = false;
  document.addEventListener('click', handleRecordingClick, true);
  document.addEventListener('input', handleRecordingInput, true);
  document.addEventListener('keydown', handleRecordingKeyDown, true);
  document.addEventListener('blur', finalizePendingInput, true);

  if (!hud) {
    hud = new FlowscriptHUD({
      isNativeMode,
      onPauseToggle: (paused) => {
        isRecordingPaused = paused;
      },
      onStop: () => {
        stopRecording();
      },
      onNativeModeToggle: () => {
        // Native cursor handled inside HUD class
      }
    });
  }
  console.log('[Flowscript] Recording started, Native Mode:', isNativeMode);
}

export function stopRecording() {
  if (!isRecording) return;
  finalizePendingInput();
  isRecording = false;
  isRecordingPaused = false;
  document.removeEventListener('click', handleRecordingClick, true);
  document.removeEventListener('input', handleRecordingInput, true);
  document.removeEventListener('keydown', handleRecordingKeyDown, true);
  document.removeEventListener('blur', finalizePendingInput, true);

  if (hud) {
    hud.destroy();
    hud = null;
  }
  console.log('[Flowscript] Recording stopped');
}

export function updateRecordingStatus(stepCount: number, isPaused: boolean) {
  if (hud) {
    hud.updateStatus(stepCount, isPaused);
    isRecordingPaused = isPaused;
  }
}

// --- Element Picker Logic ---
let pickerOverlay: HTMLDivElement | null = null;
let hoveredElement: HTMLElement | null = null;
let activeStopPicking: (() => void) | null = null;

function createPickerOverlay() {
  if (pickerOverlay) return;

  pickerOverlay = document.createElement('div');
  pickerOverlay.id = 'flowscript-picker-overlay';
  Object.assign(pickerOverlay.style, {
    position: 'fixed',
    zIndex: '2147483647',
    pointerEvents: 'none',
    border: '2px solid #818cf8',
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderRadius: '4px',
    transition: 'all 0.1s ease-out',
    display: 'none',
  });
  document.body.appendChild(pickerOverlay);
}

export function startPicking(mode: 'single' | 'list', sendResponse: (response: any) => void) {
  if (activeStopPicking) {
    activeStopPicking();
  }

  hoveredElement = null;
  createPickerOverlay();
  document.body.style.cursor = 'crosshair';

  const onMouseMove = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target || target === pickerOverlay) return;

    hoveredElement = target;
    const rect = target.getBoundingClientRect();

    if (pickerOverlay) {
      Object.assign(pickerOverlay.style, {
        display: 'block',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }
  };

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as Element;
    const elementToPick = hoveredElement || target;

    if (elementToPick) {
      const selectors = getAllSelectors(elementToPick, mode === 'list');
      console.log('[Flowscript] Picked element:', elementToPick, 'Selectors:', selectors);
      sendResponse({ selectors });
      stopPicking();
    }
  };

  const stopPicking = () => {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.body.style.cursor = '';
    if (pickerOverlay) {
      pickerOverlay.remove();
      pickerOverlay = null;
    }
    hoveredElement = null;
    activeStopPicking = null;
  };

  activeStopPicking = stopPicking;

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
}
