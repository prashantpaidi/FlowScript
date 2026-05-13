import Dexie, { type EntityTable } from 'dexie';

interface ScrapedRecord {
    id?: number;
    workflowId: string;
    datasetName: string;
    tabId?: number;
    url: string;
    data: any;
    timestamp: number;
}

const db = new Dexie('FlowscriptDB') as Dexie & {
    scrapedRecords: EntityTable<
        ScrapedRecord,
        'id'
    >;
};

db.version(1).stores({
    scrapedRecords: '++id, workflowId, datasetName, timestamp'
});

export type { ScrapedRecord };
export { db };
