import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteDraft, draftScope, listDrafts, putDraft, DRAFT_LIMIT } from '../utils/localDraftStore';
import type { DraftSection, LocalDraft } from '../utils/localDraftStore';

const files = new WeakMap<File, number>();
let fileSequence = 0;
function signature(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if (item instanceof File) {
      if (!files.has(item)) files.set(item, ++fileSequence);
      return { file: files.get(item), name: item.name, size: item.size, modified: item.lastModified };
    }
    return item;
  });
}

export function useLocalDrafts<T>(section: DraftSection) {
  const [scope] = useState(() => { try { return draftScope(section); } catch { return ''; } });
  const [drafts, setDrafts] = useState<LocalDraft<T>[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [restored, setRestored] = useState<T | null>(null);
  const active = useRef<string | null>(null);
  const latestData = useRef<T | null>(null);
  const lastSignature = useRef<string | undefined>(undefined);
  const queue = useRef(Promise.resolve());

  const refresh = useCallback(async () => {
    try {
      if (!scope) throw new Error('Sign in to save local drafts.');
      setDrafts(await listDrafts<T>(scope));
      setReady(true);
    } catch { setError('Draft storage is unavailable. Your changes cannot be saved in this browser.'); }
  }, [scope]);

  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    window.addEventListener('ecobud-drafts-changed', update);
    window.addEventListener('focus', update);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ecobud-drafts') : null;
    if (channel) channel.onmessage = update;
    return () => {
      window.removeEventListener('ecobud-drafts-changed', update);
      window.removeEventListener('focus', update);
      channel?.close();
    };
  }, [refresh]);

  const notify = useCallback(() => {
    window.dispatchEvent(new Event('ecobud-drafts-changed'));
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('ecobud-drafts');
      channel.postMessage(scope);
      channel.close();
    }
  }, [scope]);

  const start = useCallback((record?: LocalDraft<T>) => {
    if (!ready) { setError('Draft storage is not ready. Please retry.'); return false; }
    if (!record && drafts.length >= DRAFT_LIMIT) {
      setError('All 3 draft slots are full. Resume or delete a draft first.');
      return false;
    }
    active.current = record?.id || crypto.randomUUID();
    latestData.current = record?.data ?? null;
    lastSignature.current = record ? signature(record.data) : undefined;
    setRestored(record?.data ?? null);
    setError('');
    setStatus(record ? 'Draft restored from this browser.' : 'Changes will be saved in this browser.');
    return true;
  }, [ready, drafts]);

  const save = useCallback((data: T) => {
    const id = active.current;
    if (!id) return;
    latestData.current = data;
    const next = signature(data);
    if (lastSignature.current === undefined) {
      const fields = data as { title?: string; form?: { title?: string } };
      if (!fields.title && !fields.form?.title) { lastSignature.current = next; return; }
    }
    if (lastSignature.current === next) return;
    lastSignature.current = next;
    setStatus('Saving draft…');
    queue.current = queue.current.then(async () => {
      try {
        await putDraft({ id, scope, updatedAt: Date.now(), data });
        setError('');
        if (active.current === id && lastSignature.current === next) setStatus('Draft saved in this browser.');
        notify();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Draft could not be saved. Browser storage may be full.');
        setStatus('Draft not saved.');
      }
    });
  }, [scope, notify]);

  const retry = useCallback(() => {
    if (!ready) { void refresh(); return; }
    if (latestData.current && active.current) {
      lastSignature.current = '';
      save(latestData.current);
    }
  }, [ready, refresh, save]);

  const remove = useCallback(async (id: string) => {
    try {
      await queue.current;
      await deleteDraft(scope, id);
      setError('');
      notify();
    } catch { setError('Could not delete the local draft. Please retry.'); }
  }, [scope, notify]);

  const complete = useCallback(async () => {
    const id = active.current;
    active.current = null;
    if (id) await remove(id);
    setStatus('');
  }, [remove]);

  return { drafts, ready, error, status, restored, start, save, retry, remove, complete };
}

export type DraftController<T> = ReturnType<typeof useLocalDrafts<T>>;

export function useDraftAutosave<T>(controller: DraftController<T> | undefined, data: T, enabled = true) {
  useEffect(() => { if (enabled) controller?.save(data); });
}
