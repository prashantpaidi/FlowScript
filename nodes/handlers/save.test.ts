import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSaveDataAction } from './save';

// Mock browser global
const mockSendMessage = vi.fn();
(globalThis as any).browser = {
    runtime: {
        sendMessage: mockSendMessage
    }
};

describe('handleSaveDataAction', () => {
    beforeEach(() => {
        (globalThis as any).window = globalThis;
        vi.clearAllMocks();
        // Manual mock for location
        Object.defineProperty(globalThis, 'location', {
            value: { href: 'https://example.com' },
            configurable: true,
            writable: true
        });
    });

    it('should send SAVE_SCRAPED_DATA message with correct data', async () => {
        mockSendMessage.mockResolvedValue({ success: true });

        const config = {};
        const inputs = { data: { foo: 'bar' } };
        const context = { workflowId: 'wf-123' };

        const result = await handleSaveDataAction(config, inputs, context);

        expect(mockSendMessage).toHaveBeenCalledWith({
            type: 'SAVE_SCRAPED_DATA',
            workflowId: 'wf-123',
            url: 'https://example.com',
            data: { foo: 'bar' }
        });
        expect(result.success).toBe(true);
    });

    it('should throw if background script returns error', async () => {
        mockSendMessage.mockResolvedValue({ success: false, error: 'DB Error' });

        const config = {};
        const inputs = { data: 'some data' };
        const context = { workflowId: 'wf-123' };

        await expect(handleSaveDataAction(config, inputs, context)).rejects.toThrow('Failed to save data: DB Error');
    });

    it('should return error if no data provided', async () => {
        const config = {};
        const inputs = { data: null };
        const context = { workflowId: 'wf-123' };

        const result = await handleSaveDataAction(config, inputs, context);

        expect(result.success).toBe(false);
        expect(result.error).toBe('No data to save');
        expect(mockSendMessage).not.toHaveBeenCalled();
    });
});
