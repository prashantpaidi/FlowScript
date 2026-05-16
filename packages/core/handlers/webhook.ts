import { ExecutionContext } from '../environment';

/**
 * Node handler for Webhook / API requests.
 * Runs in the content script but relays to the background script to bypass CORS.
 */
export async function handleWebhook(config: Record<string, any>, _inputs: Record<string, any>, context: ExecutionContext) {
    const { 
        method = 'POST', 
        url, 
        headers: rawHeaders, 
        body: rawBody, 
        responseType = 'json' 
    } = config;

    if (!url) {
        throw new Error('[Webhook] URL is required');
    }

    console.log(`[Flowscript] Executing webhook: ${method} ${url}`);

    // 1. Process Headers
    let headers: Record<string, string> = {};
    if (typeof rawHeaders === 'string' && rawHeaders.trim()) {
        try {
            headers = JSON.parse(rawHeaders);
        } catch (e) {
            console.error('[Webhook] Failed to parse headers JSON:', e);
            // Fallback: simple key-value pairs if it's not valid JSON? 
            // For now, we assume it's valid JSON if it's a string.
        }
    } else if (typeof rawHeaders === 'object' && rawHeaders !== null) {
        headers = { ...rawHeaders };
    }

    // Ensure Content-Type is set for POST/PUT if not provided
    const hasContentType = Object.keys(headers).some(h => h.toLowerCase() === 'content-type');
    if (!hasContentType && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        headers['Content-Type'] = 'application/json';
    }

    // 2. Process Body
    let body = rawBody;
    if (typeof rawBody === 'string' && rawBody.trim()) {
        // If it's a string and looks like JSON, try to parse it so the background proxy can handle it cleanly
        if (headers['Content-Type'] === 'application/json' || headers['content-type'] === 'application/json') {
            try {
                body = JSON.parse(rawBody);
            } catch (e) {
                // Not valid JSON, send as raw string
                body = rawBody;
            }
        }
    }

    // 3. Dispatch to Background Proxy
    try {
        const response = await context.env.sendMessage({
            type: 'REMOTE_HTTP_REQUEST',
            method: method.toUpperCase(),
            url,
            headers,
            body
        });

        if (!response || !response.success) {
            const errorMsg = response?.error || `HTTP ${response?.status || 'Unknown error'}`;
            console.error(`[Flowscript] Webhook failed: ${errorMsg}`);
            throw new Error(`Webhook request failed: ${errorMsg}`);
        }

        console.log(`[Flowscript] Webhook success (${response.status}):`, response.data);

        return {
            success: true,
            status: response.status,
            data: response.data,
            'trigger-out': response.data
        };
    } catch (err: any) {
        console.error('[Flowscript] Webhook error:', err);
        throw err;
    }
}
