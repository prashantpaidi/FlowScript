import { waitForStable } from '../utils/dom';

declare const browser: any;

export async function handleType(config: Record<string, any>, inputs: Record<string, any>, _context?: any) {
    const selector = config.selector || inputs.selector;
    const text = config.text || inputs.text || '';

    const mode = config.typeMode || 'overwrite';
    const regexPattern = config.regexPattern;

    if (config.isNative) {
        let x: number | undefined;
        let y: number | undefined;

        if (selector) {
            console.log(`[Flowscript] Waiting for stable element matching: ${selector}`);
            const el = await waitForStable(selector, config.idleMs || 300, config.timeoutMs || 10000);
            const rect = el.getBoundingClientRect();
            x = Math.round(rect.left + rect.width / 2);
            y = Math.round(rect.top + rect.height / 2);
            console.log(`[Flowscript] Performing native typing at (${x}, ${y}) with mode: ${mode}`);
        } else {
            console.log(`[Flowscript] Performing native typing at current focus (no selector) with mode: ${mode}`);
        }

        // For Native Overwrite, we need to clear the field first
        if (mode === 'overwrite') {
            await browser.runtime.sendMessage({
                type: 'NATIVE_KEYPRESS',
                x,
                y,
                keys: ['control', 'a']
            });
            await browser.runtime.sendMessage({
                type: 'NATIVE_KEYPRESS',
                keys: ['backspace']
            });
        } else if (mode === 'append') {
            await browser.runtime.sendMessage({
                type: 'NATIVE_KEYPRESS',
                x,
                y,
                keys: ['end']
            });
        } else if (mode === 'prepend') {
            await browser.runtime.sendMessage({
                type: 'NATIVE_KEYPRESS',
                x,
                y,
                keys: ['home']
            });
        }

        const response = await browser.runtime.sendMessage({
            type: 'NATIVE_TYPE',
            x: mode === 'overwrite' || mode === 'append' || mode === 'prepend' ? undefined : x, // Don't click again if we already did keypresses
            y: mode === 'overwrite' || mode === 'append' || mode === 'prepend' ? undefined : y,
            text,
            delayMs: config.delayMs || 50
        });

        if (response && !response.success) {
            throw new Error(`Native type failed: ${response.error}`);
        }
    } else {
        if (!selector) {
            throw new Error('Non-native Type node requires a selector configuration.');
        }

        console.log(`[Flowscript] Waiting for stable element matching: ${selector}`);
        const el = await waitForStable(selector, config.idleMs || 300, config.timeoutMs || 10000);

        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.focus();
            
            switch (mode) {
                case 'append':
                    el.value = el.value + text;
                    break;
                case 'prepend':
                    el.value = text + el.value;
                    break;
                case 'insert':
                    el.setRangeText(text);
                    // Move cursor to end of inserted text
                    el.selectionStart = el.selectionEnd = el.selectionStart + text.length;
                    break;
                case 'replace':
                    if (regexPattern) {
                        const regex = new RegExp(regexPattern, 'g');
                        el.value = el.value.replace(regex, text);
                    } else {
                        el.value = text;
                    }
                    break;
                case 'overwrite':
                default:
                    el.value = text;
                    break;
            }

            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            // Fallback for contenteditable or other focusable elements
            (el as HTMLElement).focus();
            if (mode === 'overwrite') {
                document.execCommand('selectAll', false);
                document.execCommand('delete', false);
            }
            document.execCommand('insertText', false, text);
        }
    }

    console.log(`[Flowscript] Typed text into element (selector: ${selector || 'none'})`);
    return { success: true, selector, text };
}
