import Dexie, { type EntityTable } from 'dexie';
import { TableSchema, TableRow } from '@flowscript/schema';

const db = new Dexie('FlowscriptDB') as Dexie & {
    globalTables: EntityTable<
        TableSchema,
        'id'
    >;
    tableRows: EntityTable<
        TableRow,
        'id'
    >;
};

// We define version 2 with the new stores. Omitting scrapedRecords will drop it in Dexie.
db.version(2).stores({
    globalTables: 'id, name, updatedAt',
    tableRows: '++id, tableId, timestamp'
});

export { db };

