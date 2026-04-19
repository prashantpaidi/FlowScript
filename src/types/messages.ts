export interface DEBUGGER_ATTACH {
    type: 'DEBUGGER_ATTACH';
    target?: { tabId: number };
}

export interface DEBUGGER_DETACH {
    type: 'DEBUGGER_DETACH';
    target?: { tabId: number };
}

export interface NATIVE_CLICK {
    type: 'NATIVE_CLICK';
    target?: { tabId: number };
    x: number;
    y: number;
    button?: 'left' | 'middle' | 'right';
    clickCount?: number;
    delayMs?: number;
}

export interface NATIVE_TYPE {
    type: 'NATIVE_TYPE';
    target?: { tabId: number };
    x?: number;
    y?: number;
    text: string;
    delayMs?: number;
}

export interface NATIVE_KEYPRESS {
    type: 'NATIVE_KEYPRESS';
    target?: { tabId: number };
    keys: string[];
    delayMs?: number;
}

export interface SAVE_SCRAPED_DATA {
    type: 'SAVE_SCRAPED_DATA';
    workflowId: string;
    datasetName?: string;
    data: any;
    url: string;
    target?: { tabId: number };
}
