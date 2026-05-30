import { waitForStable } from '../utils/dom';
import { ExecutionContext } from '../environment';
import { isMacPlatform } from '../utils/platform';

export async function handleType(config: Record<string, any>, inputs: Record<string, any>, context: ExecutionContext) {
    const { env } = context;
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
            const isMac = isMacPlatform();
            await env.sendMessage({
                type: 'NATIVE_KEYPRESS',
                x,
                y,
                keys: [isMac ? 'meta' : 'control', 'a']
            });
            await env.sendMessage({
                type: 'NATIVE_KEYPRESS',
                keys: ['backspace']
            });
        } else if (mode === 'append') {
            await env.sendMessage({
                type: 'NATIVE_KEYPRESS',
                x,
                y,
                keys: ['end']
            });
        } else if (mode === 'prepend') {
            await env.sendMessage({
                type: 'NATIVE_KEYPRESS',
                x,
                y,
                keys: ['home']
            });
        }

        const response = await env.sendMessage({
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
                        try {
                            const regex = new RegExp(regexPattern, 'g');
                            el.value = el.value.replace(regex, text);
                        } catch (e) {
                            console.error(`[Flowscript] Invalid regex pattern: ${regexPattern}`);
                            // Fallback to no-op or simple replace if regex fails
                            throw new Error(`Invalid regex pattern: ${regexPattern}`);
                        }
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
            (el as HTMLElement).focus();
            if (mode === 'overwrite' && (el as HTMLElement).isContentEditable) {
                (el as HTMLElement).innerHTML = '';
            }
            const selection = window.getSelection();
            if (selection) {
                let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange();
                
                if ((el as HTMLElement).isContentEditable) {
                    range = document.createRange();
                    if (mode === 'prepend') {
                        range.selectNodeContents(el);
                        range.collapse(true);
                    } else if (mode === 'append' || mode === 'overwrite') {
                        range.selectNodeContents(el);
                        range.collapse(false);
                    } else {
                        const existingRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
                        if (existingRange && el.contains(existingRange.commonAncestorContainer)) {
                            range = existingRange;
                        } else {
                            range.selectNodeContents(el);
                            range.collapse(false);
                        }
                    }
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                if (el.contains(range.commonAncestorContainer)) {
                    range.deleteContents();
                    const textNode = document.createTextNode(text);
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    if (mode === 'prepend') {
                        (el as HTMLElement).innerText = text + (el as HTMLElement).innerText;
                    } else {
                        (el as HTMLElement).innerText += text;
                    }
                }
            } else {
                if (mode === 'prepend') {
                    (el as HTMLElement).innerText = text + (el as HTMLElement).innerText;
                } else {
                    (el as HTMLElement).innerText += text;
                }
            }
        }
    }

    console.log(`[Flowscript] Typed text into element (selector: ${selector || 'none'})`);
    return {
        data: { success: true, selector, text },
        nextNodeId: context.getNextNodeId ? context.getNextNodeId() : undefined
    };
}
