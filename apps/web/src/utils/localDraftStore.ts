export const DRAFT_LIMIT = 3;
export type DraftSection = 'announcements' | 'learning' | 'challenges' | 'events' | 'redeem';
export interface LocalDraft<T> {
  id: string;
  scope: string;
  updatedAt: number;
  data: T;
}

let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ecobud-local-drafts', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('drafts', { keyPath: 'id' });
        store.createIndex('scope', 'scope');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { database = undefined; reject(request.error); };
      request.onblocked = () => { database = undefined; reject(new Error('Close other EcoBud tabs and retry saving drafts.')); };
    });
  }
  return database;
}

export function draftScope(section: DraftSection) {
  const user = JSON.parse(localStorage.getItem('ecobud_admin_user') || 'null');
  if (!user?.id) throw new Error('Sign in to save local drafts.');
  return `${user.id}:${section}`;
}

export async function listDrafts<T>(scope: string): Promise<LocalDraft<T>[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readonly');
    const request = tx.objectStore('drafts').index('scope').getAll(scope);
    tx.oncomplete = () => resolve((request.result as LocalDraft<T>[]).sort((a, b) => b.updatedAt - a.updatedAt));
    tx.onabort = () => reject(tx.error);
  });
}

export async function putDraft<T>(draft: LocalDraft<T>) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');
    const request = store.index('scope').getAll(draft.scope);
    let limitReached = false;
    request.onsuccess = () => {
      const records = request.result as LocalDraft<T>[];
      if (!records.some(record => record.id === draft.id) && records.length >= DRAFT_LIMIT) {
        limitReached = true;
        tx.abort();
        return;
      }
      store.put(draft);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(limitReached ? new Error('All 3 draft slots are full. Resume or delete a draft first.') : tx.error);
  });
}

export async function deleteDraft(scope: string, id: string) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');
    const request = store.get(id);
    request.onsuccess = () => { if (request.result?.scope === scope) store.delete(id); };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}
