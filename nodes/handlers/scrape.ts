import { waitForStable } from '../utils/dom';

/**
 * Node handler for DOM scraping.
 * Extracts text content or HTML from elements matching a selector.
 * Supports single element vs list of elements.
 * 
 * @param config Node configuration (selector, mode, type)
 * @param inputs Dynamic inputs (selector fallback)
 * @returns { data: string | string[] }
 */
export async function handleScrapeAction(config: Record<string, any>, inputs: Record<string, any>, _context?: any) {
    const mode = config.mode || (config.itemSelector ? 'list' : 'single');
    const idleMs = config.idleMs || 300;
    const timeoutMs = config.timeoutMs || 10000;

    if (mode === 'single') {
        const selector = config.selector || inputs.selector;
        const key = config.key || config.dataKey || 'scraped';

        if (!selector) throw new Error('Single-mode scrape requires a selector.');

        await waitForStable(selector, idleMs, timeoutMs);
        const element = document.querySelector(selector);
        const value = element ? ((element as HTMLElement).innerText || element.textContent || '').trim() : null;

        const output = { [key]: value };
        console.log(`[Flowscript] Scrape finished (single). Result:`, output);
        return { data: output, 'trigger-out': output };
    }

    // List mode
    const itemSelector = config.itemSelector || inputs.itemSelector;
    const fields = config.fields || [];

    if (!itemSelector) throw new Error('List-mode scrape requires an item selector.');

    await waitForStable(itemSelector, idleMs, timeoutMs);
    const elements = Array.from(document.querySelectorAll(itemSelector));

    if (fields.length === 0) {
        const data = elements.map(el => (el as HTMLElement).innerText || el.textContent || '').map(s => s.trim());
        return { data };
    }

    const results = elements.map(el => {
        const itemData: Record<string, any> = {};
        for (const field of fields) {
            const subEl = field.selector ? el.querySelector(field.selector) : el;
            if (!subEl) {
                itemData[field.name] = null;
                continue;
            }

            if (field.type === 'attribute' && (field.attrName || field.attribute)) {
                itemData[field.name] = subEl.getAttribute(field.attrName || field.attribute);
            } else {
                itemData[field.name] = ((subEl as HTMLElement).innerText || subEl.textContent || '').trim();
            }
        }
        return itemData;
    });

    console.log(`[Flowscript] Scrape finished. Found ${results.length} items:`, results);

    const output = results;
    return {
        data: output,
        'trigger-out': output // Pass through trigger port
    };
}
