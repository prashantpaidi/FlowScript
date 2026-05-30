import { ExecutionContext } from '../environment';

export async function handlePressKey(config: Record<string, any>, inputs: Record<string, any>, context: ExecutionContext) {
    const { env } = context;
    const keys = config.keys || inputs.keys || [];

    if (!keys || keys.length === 0) {
        throw new Error('Press Key node requires at least one key.');
    }

    console.log(`[Flowscript] Pressing keys: ${keys.join('+')}`);

    // Keys are almost always better handled natively to trigger browser/OS shortcuts
    const response = await env.sendMessage({
        type: 'NATIVE_KEYPRESS',
        keys: keys,
        keyData: config.keyData
    });

    if (response && !response.success) {
        // Fallback or error
        throw new Error(`Native keypress failed: ${response.error}`);
    }

    return {
        data: { success: true, keys },
        nextNodeId: context.getNextNodeId ? context.getNextNodeId() : undefined
    };
}
