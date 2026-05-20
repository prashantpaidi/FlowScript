/**
 * HUD Utilities for Flowscript
 * Provides visual feedback layer (Glows, Summaries, Toasts)
 */

const STYLE_ID = 'flowscript-hud-styles';

/**
 * Injects the CSS required for HUD elements into the document head.
 */
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

/**
 * Applies a temporary purple glow to an element.
 */
export function applyMatchGlow(el: HTMLElement, duration = 4000) {
  injectHudStyles();
  el.classList.add('flowscript-match-glow');
  
  setTimeout(() => {
    el.classList.remove('flowscript-match-glow');
  }, duration);
}

/**
 * Shows an execution summary toast in the bottom corner.
 */
export function showExecutionSummary(mapped: number, total: number) {
  injectHudStyles();

  // Remove existing toast if present
  const existing = document.querySelector('.flowscript-hud-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'flowscript-hud-toast';
  
  const icon = `<div class="flowscript-hud-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;
  
  toast.innerHTML = `
    ${icon}
    <div>
      <span class="flowscript-hud-count">${mapped}</span> / ${total} fields mapped successfully
    </div>
  `;

  toast.onclick = () => {
    toast.style.animation = 'flowscript-toast-out 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  };

  document.body.appendChild(toast);

  // Auto-remove after 6 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'flowscript-toast-out 0.5s forwards';
      setTimeout(() => toast.remove(), 500);
    }
  }, 6000);
}
