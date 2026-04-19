import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type {
  CreateOfflineMutationInput,
  OfflineMutationQueue,
  OfflineMutationRecord,
  OfflineMutationType,
} from './offlineMutationQueue.types';

interface OfflineMutationRow {
  id: string;
  user_id: string;
  type: OfflineMutationType;
  payload: string;
  dedupe_key: string | null;
  synced: number;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const DATABASE_NAME = 'ecobud-offline.db';
const TABLE_NAME = 'offline_mutations';

let databasePromise: Promise<SQLiteDatabase> | null = null;
let initialized = false;

const createLocalId = () =>
  `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME);
  }

  const database = await databasePromise;

  if (!initialized) {
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        dedupe_key TEXT,
        synced INTEGER NOT NULL DEFAULT 0 CHECK (synced IN (0, 1)),
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_offline_mutations_user_synced_created
        ON ${TABLE_NAME} (user_id, synced, created_at);
      CREATE INDEX IF NOT EXISTS idx_offline_mutations_dedupe
        ON ${TABLE_NAME} (user_id, dedupe_key, synced);
    `);

    initialized = true;
  }

  return database;
};

const mapRow = (row: OfflineMutationRow): OfflineMutationRecord => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  payload: JSON.parse(row.payload),
  dedupeKey: row.dedupe_key,
  synced: row.synced === 1 ? 1 : 0,
  retryCount: row.retry_count,
  lastError: row.last_error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const offlineMutationQueue: OfflineMutationQueue = {
  async initialize() {
    await getDatabase();
  },

  async enqueue<TType extends OfflineMutationType>(
    input: CreateOfflineMutationInput<TType>,
  ): Promise<OfflineMutationRecord<TType>> {
    const database = await getDatabase();
    const now = new Date().toISOString();
    const id = createLocalId();

    if (input.dedupeKey) {
      await database.runAsync(
        `DELETE FROM ${TABLE_NAME} WHERE user_id = ? AND dedupe_key = ? AND synced = 0`,
        input.userId,
        input.dedupeKey,
      );
    }

    await database.runAsync(
      `INSERT INTO ${TABLE_NAME} (
        id, user_id, type, payload, dedupe_key, synced, retry_count, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?, ?)`,
      id,
      input.userId,
      input.type,
      JSON.stringify(input.payload),
      input.dedupeKey ?? null,
      now,
      now,
    );

    return {
      id,
      userId: input.userId,
      type: input.type,
      payload: input.payload,
      dedupeKey: input.dedupeKey ?? null,
      synced: 0,
      retryCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
  },

  async listPending(userId: string) {
    const database = await getDatabase();
    const rows = await database.getAllAsync<OfflineMutationRow>(
      `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? AND synced = 0 ORDER BY created_at ASC`,
      userId,
    );

    return rows.map(mapRow);
  },

  async markSynced(id: string) {
    const database = await getDatabase();
    const now = new Date().toISOString();

    await database.runAsync(
      `UPDATE ${TABLE_NAME}
       SET synced = 1, last_error = NULL, updated_at = ?
       WHERE id = ?`,
      now,
      id,
    );
  },

  async markFailed(id: string, errorMessage: string) {
    const database = await getDatabase();
    const now = new Date().toISOString();

    await database.runAsync(
      `UPDATE ${TABLE_NAME}
       SET retry_count = retry_count + 1, last_error = ?, updated_at = ?
       WHERE id = ?`,
      errorMessage,
      now,
      id,
    );
  },

  async getPendingCount(userId: string) {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE user_id = ? AND synced = 0`,
      userId,
    );

    return Number(row?.count ?? 0);
  },
};
