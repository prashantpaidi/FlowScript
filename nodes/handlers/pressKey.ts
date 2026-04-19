declare const browser: any;

export async function handlePressKey(config: Record<string, any>, inputs: Record<string, any>, _context?: any) {
    const keys = config.keys || inputs.keys || [];

    if (!keys || keys.length === 0) {
        throw new Error('Press Key node requires at least one key.');
    }

    console.log(`[Flowscript] Pressing keys: ${keys.join('+')}`);

    // Keys are almost always better handled natively to trigger browser/OS shortcuts
    const response = await browser.runtime.sendMessage({
        type: 'NATIVE_KEYPRESS',
        keys: keys
    });

    if (response && !response.success) {
        // Fallback or error
        throw new Error(`Native keypress failed: ${response.error}`);
    }

    return { success: true, keys };
}
