/**
 * Node handler for Clipboard operations.
 * Copies text to the system clipboard.
 * 
 * @param config Node configuration (text)
 * @param inputs Dynamic inputs (text fallback)
 * @returns { success: boolean, text: string }
 */
export async function handleClipboard(config: Record<string, any>, inputs: Record<string, any>, _context?: any) {
    let text = config.text || '';
    
    // 1. Template replacement: replace {{key}} with inputs[key]
    if (text.includes('{{')) {
        text = text.replace(/\{\{(.*?)\}\}/g, (match: string, key: string) => {
            const cleanKey = key.trim();
            const val = inputs[cleanKey];
            return val !== undefined ? String(val) : match;
        });
    }

    // 2. Smart fallback: if text is still empty, try to pick the first available input
    if (!text && inputs) {
        const inputValues = Object.values(inputs).filter(v => v !== undefined && v !== null);
        if (inputValues.length > 0) {
            // Use the first non-null input value (likely from a previous Scrape or Transform)
            text = String(inputValues[0]);
        }
    }
    
    if (!text) {
        console.warn('[Flowscript] Clipboard action called with no text and no valid inputs.');
    }

    try {
        // Try the modern Clipboard API
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.log('[Flowscript] Navigator clipboard failed, trying fallback...', err);
        
        // Fallback for content scripts where navigator.clipboard might be restricted
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Ensure it's not visible
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
            throw new Error('Could not copy to clipboard. Ensure the browser allows clipboard access.');
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
