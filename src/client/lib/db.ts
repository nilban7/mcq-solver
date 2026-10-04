import Dexie, { type EntityTable } from 'dexie';
import { HistoryItem } from '../../shared/types.js';

export const db = new Dexie('McqSolverHistoryDB') as Dexie & {
  history: EntityTable<HistoryItem, 'id'>;
};

// Schema definition
db.version(1).stores({
  history: '++id, timestamp, aiAnswer, finalAnswer, confidence, verificationStatus'
});
