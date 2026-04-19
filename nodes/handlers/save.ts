declare const browser: any;

/**
 * Node handler for saving scraped data.
 * Sends the data to the background script to be persisted in IndexedDB.
 * 
 * @param config Node configuration
 * @param inputs Dynamic inputs (data)
 * @param context Execution context (workflowId)
 */
export async function handleSaveDataAction(config: Record<string, any>, inputs: Record<string, any>, context: { workflowId: string }) {
    // Check multiple possible input keys for robustness
    const data = inputs.data ?? inputs['trigger-in'];

    if (data === undefined || data === null) {
        console.warn('[Flowscript] SaveData node: No data to save. Inputs received:', inputs);
        return { success: false, error: 'No data to save' };
    }

    const workflowId = context.workflowId;
    const url = window.location.href;

    console.log(`[Flowscript] Saving data for workflow ${workflowId}:`, data);

    const response = await browser.runtime.sendMessage({
        type: 'SAVE_SCRAPED_DATA',
        workflowId,
        datasetName: config.datasetName,
        url,
        data
    });

    if (!response || response.success !== true) {
        throw new Error(`Failed to save data: ${response?.error || 'Unknown error or no response from background'}`);
    }

    return { success: true };
}
