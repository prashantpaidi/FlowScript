import { describe, it, expect, vi } from 'vitest';
import { handleScrapeAction } from './scrape';

// Minimal manual DOM mock for Bun
(globalThis as any).document = {
    body: { innerHTML: '' },
    querySelector: (s: string) => {
        if (s === '#test') return { innerText: 'Hello World', textContent: 'Hello World' };
        if (s === '.html-test') return { innerHTML: '<span>Inner</span>' };
        if (s === '.list li') return { innerText: 'Item 1' };
        return null;
    },
    querySelectorAll: (s: string) => {
        if (s === '.list li') return [{ innerText: 'Item 1' }, { innerText: 'Item 2' }];
        return [];
    }
};
(globalThis as any).HTMLElement = class { };
(globalThis as any).Node = { ELEMENT_NODE: 1 };
(globalThis as any).MutationObserver = class {
    observe() { }
    disconnect() { }
};
(globalThis as any).CSS = { escape: (s: string) => s };
(globalThis as any).window = globalThis;

describe('handleScrapeAction', () => {
    const mockContext = { workflowId: 'test', env: {} as any };

    it('should scrape text from a single element', async () => {
        const config = { selector: '#test', mode: 'single', extractType: 'text', timeoutMs: 100, idleMs: 10 };
        const result = await handleScrapeAction(config, {}, mockContext);
        expect(result.data).toEqual({ scraped: 'Hello World' });
    });

    it('should scrape a list of elements', async () => {
        const config = { itemSelector: '.list li', mode: 'list', extractType: 'text', timeoutMs: 100, idleMs: 10 };
        const result = await handleScrapeAction(config, {}, mockContext);
        expect(result.data).toEqual(['Item 1', 'Item 2']);
    });

    it('should throw if element not found in single mode', async () => {
        const config = { selector: '#non-existent', mode: 'single', timeoutMs: 100 };
        await expect(handleScrapeAction(config, {}, mockContext)).rejects.toThrow('Timeout waiting for element #non-existent to become stable');
    });

    it('should return empty list if no elements found in list mode', async () => {
        const config = { itemSelector: '.non-existent', mode: 'list', timeoutMs: 100 };
        await expect(handleScrapeAction(config, {}, mockContext)).rejects.toThrow('Timeout waiting for element .non-existent to become stable');
    });
});
