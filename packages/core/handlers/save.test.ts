import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSaveDataAction } from './save';
import { AutomationEnvironment } from '../environment';

describe('handleSaveDataAction', () => {
    const mockSendMessage = vi.fn();
    const mockEnv: AutomationEnvironment = {
        sendMessage: mockSendMessage,
        location: {
            href: 'https://example.com',
            assign: vi.fn(),
            reload: vi.fn(),
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should send SAVE_SCRAPED_DATA message with correct data', async () => {
        mockSendMessage.mockResolvedValue({ success: true });

        const config = {};
        const inputs = { data: { foo: 'bar' } };
        const context = { workflowId: 'wf-123', env: mockEnv };

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
        const context = { workflowId: 'wf-123', env: mockEnv };

        await expect(handleSaveDataAction(config, inputs, context)).rejects.toThrow('Failed to save data: DB Error');
    });

    it('should return error if no data provided', async () => {
        const config = {};
        const inputs = { data: null };
        const context = { workflowId: 'wf-123', env: mockEnv };

        const result = await handleSaveDataAction(config, inputs, context);

        expect(result.success).toBe(false);
        expect(result.error).toBe('No data to save');
        expect(mockSendMessage).not.toHaveBeenCalled();
    });
});
