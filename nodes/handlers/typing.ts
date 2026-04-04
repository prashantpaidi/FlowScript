import { waitForStable } from '../utils/dom';

declare const browser: any;

export async function handleType(config: Record<string, any>, inputs: Record<string, any>) {
    const selector = config.selector || inputs.selector;
    const text = config.text || inputs.text || '';

    if (!selector) {
        throw new Error('Type node requires a selector configuration.');
    }

    console.log(`[Flowscript] Waiting for stable element matching: ${selector}`);
    const el = await waitForStable(selector, config.idleMs || 300, config.timeoutMs || 10000);

    if (config.isNative) {
        const rect = el.getBoundingClientRect();
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);

        console.log(`[Flowscript] Performing native typing at (${x}, ${y})`);

        const response = await browser.runtime.sendMessage({
            type: 'NATIVE_TYPE',
            x,
            y,
            text,
            delayMs: config.delayMs || 50
        });

        if (response && !response.success) {
            throw new Error(`Native type failed: ${response.error}`);
        }
    } else {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.focus();
            el.value = text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            // Fallback for contenteditable or other focusable elements
            (el as HTMLElement).focus();
            document.execCommand('insertText', false, text);
        }
    }

    console.log(`[Flowscript] Typed text into element matching: ${selector}`);
    return { success: true, selector, text };
}
