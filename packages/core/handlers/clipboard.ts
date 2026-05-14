import { ExecutionContext } from '../environment';
import { resolveVariables } from '../utils/variables';

/**
 * Node handler for Clipboard operations.
 * Copies text to the system clipboard.
 */
export async function handleClipboard(config: Record<string, any>, inputs: Record<string, any>, context: ExecutionContext) {
    let text = config.text || '';
    
    // 1. Template replacement
    if (text.includes('{{') && context.variables) {
        // Create a temporary resolution context that includes direct inputs
        const resolutionContext = {
            ...context.variables,
            trigger: { ...context.variables.trigger, ...inputs }
        };
        text = resolveVariables(text, resolutionContext);
    }

    // 2. Smart fallback: if text is still empty, try to pick the first available input
    if (!text && inputs) {
        const inputValues = Object.values(inputs).filter(v => v !== undefined && v !== null);
        if (inputValues.length > 0) {
            text = String(inputValues[0]);
        }
    }
    
    if (!text) {
        console.warn('[Flowscript] Clipboard action called with no text and no valid inputs.');
    }

    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.log('[Flowscript] Navigator clipboard failed, trying fallback...', err);
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (!successful) throw new Error('execCommand copy was unsuccessful');
        } catch (fallbackErr) {
            console.error('[Flowscript] Clipboard fallback failed:', fallbackErr);
            throw new Error('Could not copy to clipboard.');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    console.log(`[Flowscript] Copied to clipboard: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    return { 
        success: true, 
        text,
        'trigger-out': { text } 
    };
}
