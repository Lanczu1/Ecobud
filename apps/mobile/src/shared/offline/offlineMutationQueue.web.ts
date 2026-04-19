import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CreateOfflineMutationInput,
  OfflineMutationQueue,
  OfflineMutationRecord,
  OfflineMutationType,
} from './offlineMutationQueue.types';

const STORAGE_KEY = 'ecobud.mobile.offline-mutations';

const createLocalId = () =>
  `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const readRecords = async (): Promise<OfflineMutationRecord[]> => {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    return JSON.parse(rawValue) as OfflineMutationRecord[];
  } catch {
    return [];
  }
};

const writeRecords = async (records: OfflineMutationRecord[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const offlineMutationQueue: OfflineMutationQueue = {
  async initialize() {
    await readRecords();
  },

  async enqueue<TType extends OfflineMutationType>(
    input: CreateOfflineMutationInput<TType>,
  ): Promise<OfflineMutationRecord<TType>> {
    const now = new Date().toISOString();
    const nextRecord: OfflineMutationRecord<TType> = {
      id: createLocalId(),
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

    const records = await readRecords();
    const nextRecords = records
      .filter(
        (record) =>
          !(
            record.userId === input.userId &&
            record.synced === 0 &&
            record.dedupeKey &&
            record.dedupeKey === (input.dedupeKey ?? null)
          ),
      )
      .concat(nextRecord as OfflineMutationRecord);

    await writeRecords(nextRecords);
    return nextRecord;
  },

  async listPending(userId: string) {
    const records = await readRecords();

    return records
      .filter((record) => record.userId === userId && record.synced === 0)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  },

  async markSynced(id: string) {
    const now = new Date().toISOString();
    const records = await readRecords();

    await writeRecords(
      records.map((record) =>
        record.id === id
          ? { ...record, synced: 1, lastError: null, updatedAt: now }
          : record,
      ),
    );
  },

  async markFailed(id: string, errorMessage: string) {
    const now = new Date().toISOString();
    const records = await readRecords();

    await writeRecords(
      records.map((record) =>
        record.id === id
          ? {
              ...record,
              retryCount: record.retryCount + 1,
              lastError: errorMessage,
              updatedAt: now,
            }
          : record,
      ),
    );
  },

  async getPendingCount(userId: string) {
    const records = await readRecords();
    return records.filter((record) => record.userId === userId && record.synced === 0).length;
  },
};
