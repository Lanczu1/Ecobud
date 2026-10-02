import { useState } from 'react';
import type { DraftController } from '../../hooks/useLocalDrafts';
import type { LocalDraft } from '../../utils/localDraftStore';

export function LocalDraftPanel<T>({ controller, onResume, disabled = false }: {
  controller: DraftController<T>;
  onResume: (draft: LocalDraft<T>) => void;
  disabled?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  return (
    <section aria-label="Local drafts" aria-busy={!controller.ready} className="rounded-xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>Local drafts ({controller.drafts.length}/3)</strong>
        <span className="text-gray-500 dark:text-gray-400">Saved on this browser and device</span>
      </div>
      <p role="status" className="mt-2 text-gray-600 dark:text-gray-300">{controller.status || 'Changes are saved automatically while creating. Resume or delete a draft below.'}</p>
      {controller.error && <div className="mt-2 text-red-600 dark:text-red-400">
        <p role="alert">{controller.error}</p>
        <button type="button" onClick={controller.retry} className="mt-1 rounded-lg border border-red-200 px-3 py-1">Retry draft save</button>
      </div>}
      {controller.drafts.map(draft => (
        <div key={draft.id} className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{draftTitle(draft.data)}</p>
            <p className="text-xs text-gray-500">{new Date(draft.updatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          </div>
          <button type="button" disabled={disabled} onClick={() => onResume(draft)} className="rounded-lg px-3 py-2 font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-400">Resume</button>
          {confirmDelete === draft.id ? <>
            <button type="button" disabled={disabled} onClick={() => { void controller.remove(draft.id); setConfirmDelete(null); }} className="rounded-lg px-3 py-2 text-red-600">Confirm delete</button>
            <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg px-3 py-2">Cancel</button>
          </> : <button type="button" disabled={disabled} onClick={() => setConfirmDelete(draft.id)} className="rounded-lg px-3 py-2 text-red-600 disabled:opacity-50">Delete</button>}
        </div>
      ))}
    </section>
  );
}

function draftTitle(data: unknown): string {
  const value = data as { title?: string; form?: { title?: string } };
  return value.title?.trim() || value.form?.title?.trim() || 'Untitled draft';
}
