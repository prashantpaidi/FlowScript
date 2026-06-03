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
    keyData?: {
        key: string;
        code: string;
        modifiers: number;
        windowsVirtualKeyCode: number;
    };
    x?: number;
    y?: number;
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

export interface EVALUATE_JS {
    type: 'EVALUATE_JS';
    target?: { tabId: number };
    expression: string;
}

export interface RECORDING_STARTED {
    type: 'RECORDING_STARTED';
    workflowId?: string;
    isNativeMode?: boolean;
    target?: { tabId: number };
}

export interface RECORDING_STOPPED {
    type: 'RECORDING_STOPPED';
    target?: { tabId: number };
}

export interface USER_INTERACTION_EVENT {
    type: 'USER_INTERACTION_EVENT';
    eventType: 'click' | 'type' | 'keypress';
    selector: string;
    value?: string;
    timestamp: number;
    coordinates?: {
        pageX: number;
        pageY: number;
        clientX: number;
        clientY: number;
    };
    keyData?: {
        key: string;
        code: string;
        modifiers: number;
        windowsVirtualKeyCode: number;
    };
    target?: { tabId: number };
}

export interface NAVIGATION_EVENT {
    type: 'NAVIGATION_EVENT';
    url: string;
    timestamp: number;
    target?: { tabId: number };
}

export interface RECORDING_STATUS_UPDATE {
    type: 'RECORDING_STATUS_UPDATE';
    stepCount: number;
    isPaused: boolean;
    workflowName?: string;
    target?: { tabId: number };
}

export interface HUD_CONTROL {
    type: 'HUD_CONTROL';
    action: 'pause' | 'resume' | 'stop' | 'toggleNativeMode';
    value?: boolean;
    target?: { tabId: number };
}

export interface REMOTE_HTTP_REQUEST {
    type: 'REMOTE_HTTP_REQUEST';
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
    responseType?: 'json' | 'text';
    target?: { tabId: number };
}

export interface GET_LOCAL_SECRETS {
    type: 'GET_LOCAL_SECRETS';
    target?: { tabId: number };
}

export interface TRIGGER_WORKFLOW {
    type: 'TRIGGER_WORKFLOW';
    workflowId: string;
    triggerNodeId: string;
    target?: { tabId: number };
}

export interface GET_GLOBAL_TABLE {
    type: 'GET_GLOBAL_TABLE';
    tableId: string;
    target?: { tabId: number };
}

export interface ADD_TABLE_ROW {
    type: 'ADD_TABLE_ROW';
    tableId: string;
    data: Record<string, any>;
    target?: { tabId: number };
}

export interface UPDATE_TABLE_ROW {
    type: 'UPDATE_TABLE_ROW';
    rowId: number;
    data: Record<string, any>;
    target?: { tabId: number };
}

