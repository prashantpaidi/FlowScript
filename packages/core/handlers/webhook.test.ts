import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWebhook } from './webhook';
import { AutomationEnvironment, ExecutionContext } from '../environment';

describe('handleWebhook', () => {
    const mockSendMessage = vi.fn();
    const mockEnv: AutomationEnvironment = {
        sendMessage: mockSendMessage,
        url: 'https://example.com',
        location: {
            href: 'https://example.com',
            assign: vi.fn(),
            reload: vi.fn(),
        }
    };

    const context: ExecutionContext = {
        workflowId: 'wf-123',
        env: mockEnv
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should send REMOTE_HTTP_REQUEST with resolved config', async () => {
        mockSendMessage.mockResolvedValue({
            success: true,
            status: 200,
            data: { success: true }
        });

        const config = {
            method: 'POST',
            url: 'https://api.example.com/data',
            headers: '{"Authorization": "Bearer secret-token"}',
            body: '{"foo": "bar"}'
        };

        const result = await handleWebhook(config, {}, context);

        expect(mockSendMessage).toHaveBeenCalledWith({
            type: 'REMOTE_HTTP_REQUEST',
            method: 'POST',
            url: 'https://api.example.com/data',
            headers: {
                'Authorization': 'Bearer secret-token',
                'Content-Type': 'application/json'
            },
            body: { foo: 'bar' }
        });
        expect(result.data).toEqual({ success: true });
        expect(result.status).toBe(200);
    });

    it('should throw if URL is missing', async () => {
        const config = { method: 'GET' };
        await expect(handleWebhook(config, {}, context)).rejects.toThrow('[Webhook] URL is required');
    });

    it('should handle failed requests', async () => {
        mockSendMessage.mockResolvedValue({
            success: false,
            status: 401,
            error: 'Unauthorized'
        });

        const config = {
            method: 'GET',
            url: 'https://api.example.com/protected'
        };

        await expect(handleWebhook(config, {}, context)).rejects.toThrow('Webhook request failed: Unauthorized');
    });
});
