/**
 * HUD UI Component for Flowscript Recording
 * Provides the user interface overlay (Glows, Summaries, and Recording Dashboard)
 */

const STYLE_ID = 'flowscript-hud-styles';

export function injectHudStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .flowscript-match-glow {
      box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.4), 0 0 15px 5px rgba(168, 85, 247, 0.6) !important;
      outline: 2px solid rgba(168, 85, 247, 0.8) !important;
      transition: box-shadow 0.4s ease, outline 0.4s ease !important;
      z-index: 10001 !important;
    }

    .flowscript-hud-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1e1b4b; /* Deep Indigo */
      color: #f8fafc;
      padding: 16px 24px;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
      z-index: 2147483647; /* Maximum possible z-index */
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid rgba(168, 85, 247, 0.4);
      backdrop-filter: blur(8px);
      animation: flowscript-toast-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }

    .flowscript-hud-icon {
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #a855f7, #6366f1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .flowscript-hud-count {
      color: #a855f7;
      font-weight: 700;
      font-size: 16px;
    }

    @keyframes flowscript-toast-in {
      from { transform: translateY(40px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }

    @keyframes flowscript-toast-out {
      from { transform: translateY(0) scale(1); opacity: 1; }
      to { transform: translateY(20px) scale(0.95); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export class FlowscriptHUD {
  private container: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private isPaused: boolean = false;
  private isNativeMode: boolean = false;
  private stepCount: number = 0;

  private onPauseToggle?: (isPaused: boolean) => void;
  private onStop?: () => void;
  private onNativeModeToggle?: (enabled: boolean) => void;

  constructor(options?: {
    isNativeMode?: boolean;
    onPauseToggle?: (isPaused: boolean) => void;
    onStop?: () => void;
    onNativeModeToggle?: (enabled: boolean) => void;
  }) {
    this.isNativeMode = options?.isNativeMode || false;
    this.onPauseToggle = options?.onPauseToggle;
    this.onStop = options?.onStop;
    this.onNativeModeToggle = options?.onNativeModeToggle;
    
    this.createHUD();
    this.updateCursor();
  }

  private createHUD() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'flowscript-hud-container';
    this.shadow = this.container.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
      }
      .hud-card {
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 12px 16px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 280px;
        color: white;
        user-select: none;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
        box-shadow: 0 0 8px #ef4444;
      }
      .status-dot.paused {
        background: #f59e0b;
        box-shadow: 0 0 8px #f59e0b;
      }
      .info {
        flex: 1;
      }
      .label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 2px;
      }
      .status {
        font-size: 13px;
        font-weight: 600;
      }
      .controls {
        display: flex;
        gap: 8px;
      }
      button {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 8px;
        color: white;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      button:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      button.stop {
        background: #ef4444;
      }
      button.stop:hover {
        background: #dc2626;
      }
      .pulse {
        animation: pulse 1.5s infinite;
      }
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
      .toggle-container {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.7);
        padding-left: 12px;
        border-left: 1px solid rgba(255, 255, 255, 0.1);
      }
      .switch {
        position: relative;
        display: inline-block;
        width: 32px;
        height: 18px;
      }
      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.1);
        transition: .4s;
        border-radius: 18px;
      }
      .slider:before {
        position: absolute;
        content: "";
        height: 12px;
        width: 12px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
      }
      input:checked + .slider {
        background-color: #6366f1;
      }
      input:checked + .slider:before {
        transform: translateX(14px);
      }
    `;

    const content = document.createElement('div');
    content.className = 'hud-card';
    content.innerHTML = `
      <div class="status-dot pulse"></div>
      <div class="info">
        <div class="label">Flowscript Recorder</div>
        <div class="status" id="hud-status">Recording Step #1...</div>
      </div>
      <div class="controls">
        <button id="pause-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          Pause
        </button>
        <button id="stop-btn" class="stop">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
          Stop
        </button>
        <div class="toggle-container">
          <span>Native</span>
          <label class="switch">
            <input type="checkbox" id="native-toggle" ${this.isNativeMode ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;

    this.shadow.appendChild(style);
    this.shadow.appendChild(content);
    document.body.appendChild(this.container);

    this.shadow.getElementById('pause-btn')?.addEventListener('click', () => this.togglePause());
    this.shadow.getElementById('stop-btn')?.addEventListener('click', () => this.stopRecording());
    this.shadow.getElementById('native-toggle')?.addEventListener('change', (e) => {
      this.toggleNativeMode((e.target as HTMLInputElement).checked);
    });
  }

  private toggleNativeMode(enabled: boolean) {
    this.isNativeMode = enabled;
    this.updateCursor();

    // @ts-ignore
    browser.runtime.sendMessage({
      type: 'HUD_CONTROL',
      action: 'toggleNativeMode',
      value: enabled
    }).catch(() => { });

    if (this.onNativeModeToggle) {
      this.onNativeModeToggle(enabled);
    }
  }

  private updateCursor() {
    document.body.style.cursor = this.isNativeMode ? 'crosshair' : '';
  }

  private togglePause() {
    this.isPaused = !this.isPaused;
    const btn = this.shadow?.getElementById('pause-btn');
    const dot = this.shadow?.querySelector('.status-dot');
    const status = this.shadow?.getElementById('hud-status');

    if (btn) {
      btn.innerHTML = this.isPaused
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Resume'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause';
    }

    if (dot) {
      dot.classList.toggle('paused', this.isPaused);
      dot.classList.toggle('pulse', !this.isPaused);
    }

    if (status) {
      status.textContent = this.isPaused ? 'Recording Paused' : `Recording Step #${this.stepCount + 1}...`;
    }

    // @ts-ignore
    browser.runtime.sendMessage({
      type: 'HUD_CONTROL',
      action: this.isPaused ? 'pause' : 'resume'
    }).catch(() => { });

    if (this.onPauseToggle) {
      this.onPauseToggle(this.isPaused);
    }
  }

  private stopRecording() {
    // @ts-ignore
    browser.runtime.sendMessage({
      type: 'HUD_CONTROL',
      action: 'stop'
    }).catch(() => { });
    this.destroy();
    
    if (this.onStop) {
      this.onStop();
    }
  }

  public updateStatus(stepCount: number, isPaused: boolean) {
    this.stepCount = stepCount;
    this.isPaused = isPaused;
    const status = this.shadow?.getElementById('hud-status');
    if (status) {
      status.textContent = isPaused ? 'Recording Paused' : `Recording Step #${stepCount + 1}...`;
    }

    const dot = this.shadow?.querySelector('.status-dot');
    if (dot) {
      dot.classList.toggle('paused', isPaused);
      dot.classList.toggle('pulse', !isPaused);
    }
  }

  public destroy() {
    if (this.container) {
      this.isNativeMode = false;
      this.updateCursor();
      this.container.remove();
      this.container = null;
      this.shadow = null;
    }
  }
}
