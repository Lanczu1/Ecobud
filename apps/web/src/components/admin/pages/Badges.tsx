import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Award, Plus, Search, X, Edit3, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useModalScrollLock } from '../../../hooks/useModalScrollLock';
import './Badges.css';
import { BadgeArtworkPicker } from './BadgeArtworkPicker';
import { adminGet, adminPost, adminPut, adminPatch, adminDelete, adminPostForm } from '../../../utils/adminApi';
import { useAdminLiveRefresh } from '../../../hooks/useAdminLiveRefresh';

type Badge = { id: string; name: string; description: string; iconUrl: string; requiredPoints: number; accentColor: string | null; active: boolean; awardType: string; targetCount: number; bonusPoints: number; lesson?: { title: string } | null; challenge?: { title: string } | null; event?: { title: string } | null; swapListing?: { title: string } | null; _count: { users: number } };
type BadgeForm = { name: string; description: string; iconUrl: string; requiredPoints: number; accentColor: string; awardType: string; targetCount: number; bonusPoints: number };
const blank: BadgeForm = { name: '', description: '', iconUrl: '', requiredPoints: 100, accentColor: '#16A34A', awardType: 'points', targetCount: 5, bonusPoints: 0 };
const rules: Record<string, string> = { points: 'Total points', lessons_completed: 'Different lessons completed', challenges_completed: 'Different verified challenges completed', events_completed: 'Different verified events completed', swaps_completed: 'Successful swaps completed' };
const editableRule = (badge: Badge | null) => !badge || badge.awardType in rules;
const special = (badge: Badge) => badge.name === 'Giveaway Master';
const requirement = (badge: Badge) => badge.awardType !== 'points' && badge.awardType in rules ? `${badge.targetCount} ${rules[badge.awardType].toLowerCase()}${badge.bonusPoints ? ` · +${badge.bonusPoints} bonus points` : ''}` : badge.name === 'Giveaway Master' ? '10 hosted giveaways' : badge.awardType === 'lesson' ? `Lesson: ${badge.lesson?.title || 'Content removed'}` : badge.awardType === 'challenge' ? `Challenge: ${badge.challenge?.title || 'Content removed'}` : badge.awardType === 'event' ? `Eco Event: ${badge.event?.title || 'Content removed'}` : badge.awardType === 'exchange' ? `Give and Get: ${badge.swapListing?.title || 'Listing removed'}` : `${badge.requiredPoints.toLocaleString()} points`;
const inputStyle = 'w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-colors disabled:opacity-60';

function BadgeImage({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? <img src={url} alt={name} className="h-14 w-14 object-contain" onError={() => setFailed(true)} /> : <Award aria-label="Badge image unavailable" className="h-14 w-14 text-green-600" />;
}

export function Badges() {
  const [items, setItems] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Badge | null>(null);
  const [form, setForm] = useState<BadgeForm>(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState('');
  const [preparingArtwork, setPreparingArtwork] = useState(false);
  useEffect(() => {
    if (!artworkFile) { setArtworkPreview(''); return; }
    const url = URL.createObjectURL(artworkFile);
    setArtworkPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [artworkFile]);
  const dialog = useRef<HTMLDivElement>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [deletingBadge, setDeletingBadge] = useState<Badge | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [deleteClosing, setDeleteClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useModalScrollLock(isOpen || !!deletingBadge);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = editorTrigger.current;
    const panel = dialog.current;
    panel?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')?.focus();
    return () => { previousFocus?.focus(); };
  }, [isOpen]);
  function closeModal(target: 'editor' | 'delete') {
    if (target === 'editor' && preparingArtwork) return;
    if (closeTimer.current) return;
    if (target === 'editor') setIsClosing(true);
    else setDeleteClosing(true);
    closeTimer.current = setTimeout(() => {
      if (target === 'editor') setIsOpen(false);
      else deleteDialog.current?.close();
      closeTimer.current = null;
    }, 280);
  }
  function requestDelete(badge: Badge) {
    setDeletingBadge(badge); setDeleteError(''); setDeleteClosing(false);
    deleteDialog.current?.showModal();
  }
  async function load(silent = false) {
    if (!silent) { setLoading(true); setError(''); }
    try {
      const next = (await adminGet<{ items: Badge[] }>('/admin/badges', { bypassCache: true })).items;
      setItems(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    }
    catch (e) { if (!silent) setError(e instanceof Error ? e.message : 'Unable to load badges.'); }
    finally { if (!silent) setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useAdminLiveRefresh(() => void load(true));
  function open(badge: Badge | null) {
    editorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsClosing(false);
    setArtworkFile(null); setArtworkPreview(''); setPreparingArtwork(false);
    setEditing(badge); setFormError('');
    setForm(badge ? { name: badge.name, description: badge.description, iconUrl: badge.iconUrl, requiredPoints: badge.requiredPoints, accentColor: badge.accentColor || '#16A34A', awardType: badge.awardType, targetCount: badge.targetCount ?? 1, bonusPoints: badge.bonusPoints ?? 0 } : { ...blank });
    setIsOpen(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (preparingArtwork) return;
    if (!artworkFile && !form.iconUrl) { setFormError('Upload a badge image or choose a built-in icon.'); return; }
    setSaving(true); setFormError('');
    try {
      let iconUrl = form.iconUrl;
      if (artworkFile) {
        const data = new FormData(); data.append('image', artworkFile);
        iconUrl = (await adminPostForm<{ url: string }>('/admin/badges/upload', data)).url;
        setForm(current => ({ ...current, iconUrl })); setArtworkFile(null);
      }
      const payload = { ...form, iconUrl };
      if (editing) await adminPut(`/admin/badges/${editing.id}`, payload);
      else await adminPost('/admin/badges', payload);
      closeModal('editor'); setNotice(editing ? 'Badge updated.' : 'Badge created.'); await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Unable to save badge.'); }
    finally { setSaving(false); }
  }
  async function remove(badge: Badge) {
    setSaving(true); setDeleteError('');
    try { await adminDelete(`/admin/badges/${badge.id}`); closeModal('delete'); setNotice('Badge deleted.'); await load(); }
    catch (e) { setDeleteError(e instanceof Error ? e.message : 'Unable to delete badge.'); }
    finally { setSaving(false); }
  }
  const filtered = items.filter(b => `${b.name} ${b.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="min-h-full bg-gray-50/50 p-4 sm:p-8 space-y-6 dark:bg-gray-950 dark:text-white">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">Badges</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage the rewards residents earn for their eco activities.</p></div>
      <button onClick={() => open(null)} disabled={saving} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"><Plus size={18} />Create badge</button>
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-300">Activity badges sync with their content and unlock after completion. Turn off a reward to stop future awards while preserving earned badges.</p>
    {notice && <p role="status" className="text-sm text-green-700 dark:text-green-300">{notice}</p>}
    {error && <div role="alert" className="text-sm text-red-600">{error} <button className="underline" onClick={() => void load()}>Retry</button></div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="relative block w-full sm:max-w-sm"><Search aria-hidden="true" size={18} className="absolute left-3 top-3 text-gray-400" /><input aria-label="Search badges" placeholder="Search badges" value={search} onChange={e => setSearch(e.target.value)} className={`${inputStyle} pl-10`} /></label><span className="text-sm text-gray-500">{items.length} badges · {items.reduce((n, b) => n + b._count.users, 0)} earned awards</span></div>
    {loading ? <p role="status" className="py-12 text-center text-gray-500">Loading badges…</p> : !error && filtered.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:bg-gray-900 dark:border-gray-700"><Award className="mx-auto mb-3 text-green-600" size={32} /><p>{search ? 'No badges match your search.' : 'No badges yet. Create your first point badge.'}</p></div> : <div className="space-y-3">{filtered.map(badge => <article key={badge.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:bg-gray-900 dark:border-gray-700">
      <div className="rounded-xl border-l-4 bg-gray-50 p-3 dark:bg-gray-800" style={{ borderLeftColor: badge.accentColor || '#16A34A' }}><BadgeImage url={badge.iconUrl} name={badge.name} /></div>
      <div className="min-w-0 flex-1 basis-48"><h3 className="font-semibold break-words">{badge.name}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-words">{badge.description}</p><p className="mt-2 text-sm font-medium text-green-700 dark:text-green-300">{requirement(badge)}{special(badge) && ' · System milestone'}</p></div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{badge._count.users.toLocaleString()} earned</div>
      <button disabled={saving} onClick={async () => { setSaving(true); setError(''); try { await adminPatch(`/admin/badges/${badge.id}/active`, { active: !badge.active }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update badge status.'); } finally { setSaving(false); } }} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${badge.active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:text-gray-300'}`} title={badge.active ? 'Turn off future badge awards' : 'Enable future badge awards'}>{badge.active ? 'Active' : 'Inactive'}</button>
      <div className="flex gap-2"><button disabled={saving} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-40" onClick={() => open(badge)}><Edit3 className="w-3 h-3" />Edit</button><button aria-label={`Delete ${badge.name}`} disabled={saving || special(badge) || badge._count.users > 0} title={special(badge) ? 'System milestone' : badge._count.users ? 'Earned badges are preserved' : 'Delete Badge'} className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60" onClick={() => requestDelete(badge)}><Trash2 className="w-3 h-3" /></button></div>
    </article>)}</div>}
    {isOpen && createPortal(
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs" onClick={() => { if (!saving) closeModal('editor'); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="badge-modal-title" tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); if (!saving) closeModal('editor'); }
        if (e.key === 'Tab') {
          const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'));
          const first = controls[0]; const last = controls[controls.length - 1];
          if (!first) { e.preventDefault(); e.currentTarget.focus(); }
          else if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }} className={`relative z-10 bg-white dark:bg-[#0f1713] text-gray-900 dark:text-white rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-xl flex flex-col overflow-hidden ${isClosing ? 'animate-modal-exit' : 'animate-modal'}`} style={{ maxHeight: 'calc(100vh - 100px)' }}>
      <div className="shrink-0 flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
        <h2 id="badge-modal-title" className="text-lg font-serif font-bold text-gray-900 dark:text-white">{editing ? 'Edit Badge' : 'Create Badge'}</h2>
        <button type="button" aria-label="Close badge form" disabled={saving} onClick={() => closeModal('editor')} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
      </div>
      <form id="badge-form" onSubmit={save} className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><BadgeImage url={artworkPreview || form.iconUrl} name={form.name || 'Badge preview'} /><div className="min-w-0"><p className="font-semibold break-words">{form.name || 'Badge preview'}</p><p className="text-sm text-gray-500">{editableRule(editing) ? form.awardType === 'points' ? `${form.requiredPoints || 0} points` : `${form.targetCount} ${rules[form.awardType]?.toLowerCase()} · +${form.bonusPoints} bonus points` : requirement(editing!)}</p></div><span className="ml-auto h-5 w-5 shrink-0 rounded" style={{ background: form.accentColor }} /></div>
        <label className="block text-sm">Name<input autoFocus required maxLength={80} disabled={saving || !!editing && special(editing)} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={`${inputStyle} mt-1`} /></label>
        <label className="block text-sm">Description<textarea required maxLength={500} disabled={saving} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputStyle} mt-1`} /></label>
        <BadgeArtworkPicker hasImage={!!artworkFile || !!form.iconUrl} disabled={saving || isClosing} color={form.accentColor} onBusyChange={setPreparingArtwork} onChange={file => { setArtworkFile(file); setForm(current => ({ ...current, iconUrl: '' })); setFormError(''); }} />
        {editableRule(editing) && <div className="space-y-4">
          <label className="block text-sm">Requirement type<select disabled={saving} value={form.awardType} onChange={e => setForm({ ...form, awardType: e.target.value })} className={`${inputStyle} mt-1`}>{Object.entries(rules).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {form.awardType !== 'points' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">Target count<input required type="number" min={1} max={1000000} step={1} disabled={saving} value={form.targetCount} onChange={e => setForm({ ...form, targetCount: Number(e.target.value) })} className={`${inputStyle} mt-1`} /></label>
            <label className="block text-sm">One-time bonus points<input required type="number" min={0} max={1000000} step={1} disabled={saving} value={form.bonusPoints} onChange={e => setForm({ ...form, bonusPoints: Number(e.target.value) })} className={`${inputStyle} mt-1`} /></label>
          </div>}
          <p className="text-xs text-gray-500">Requirements are counted automatically. Descriptions do not define the unlock rule. Existing earned badges are preserved.</p>
        </div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{editableRule(editing) && form.awardType === 'points' ? <label className="block min-w-0 text-sm">Required points<input required type="number" min={1} max={2147483647} step={1} disabled={saving} value={form.requiredPoints} onChange={e => setForm({ ...form, requiredPoints: Number(e.target.value) })} className={`${inputStyle} mt-1`} /></label> : <div className="text-sm text-gray-600 dark:text-gray-300"><p className="font-medium mb-2">Unlock requirement</p><p className="break-words">{editableRule(editing) ? `${form.targetCount} ${rules[form.awardType]?.toLowerCase()}` : requirement(editing!)}</p></div>}<label className="block text-sm">Accent color<input type="color" disabled={saving} value={form.accentColor} onChange={e => setForm({ ...form, accentColor: e.target.value })} className="mt-1 block h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-1" /></label></div>
        {editing && special(editing) && <p className="text-sm text-gray-500">Name and unlock rule are managed by the system.</p>}
        {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
      </form>
      <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f1713] flex flex-wrap items-center justify-end gap-3">
        <button type="button" disabled={saving} onClick={() => closeModal('editor')} className="px-6 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
        <button form="badge-form" disabled={saving || preparingArtwork || isClosing} type="submit" className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl transition-all disabled:opacity-60 shadow-sm">{saving ? 'Saving…' : preparingArtwork ? 'Preparing image…' : 'Save Badge'}</button>
      </div>
      </div>
      </div>, document.body)}
    <dialog ref={deleteDialog} aria-labelledby="badge-delete-title" onClose={() => setDeletingBadge(null)} onCancel={e => { e.preventDefault(); if (!saving) closeModal('delete'); }} onClick={e => { if (e.target === e.currentTarget && !saving) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeModal('delete'); } }} className={`badge-editor-modal badge-delete-modal ${deleteClosing ? 'badge-modal-closing' : ''} bg-white dark:bg-[#0f1713] text-gray-900 dark:text-white rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800`}>
      <div className="badge-editor-layout">
        <div className="shrink-0 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"><Trash2 className="w-4 h-4" /></div><div><h3 id="badge-delete-title" className="text-base font-bold">Delete Badge</h3><p className="text-xs text-gray-500 dark:text-gray-400">Permanent badge removal</p></div></div>
          <button type="button" aria-label="Close delete confirmation" disabled={saving} onClick={() => closeModal('delete')} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"><X className="w-4 h-4" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto p-6 space-y-3"><p className="text-sm text-gray-700 dark:text-gray-300">Are you sure you want to permanently delete <strong className="text-gray-900 dark:text-white break-words">"{deletingBadge?.name}"</strong>?</p><div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1"><p className="font-semibold flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" />Warning:</p><p>This badge will be removed from the catalog. This action cannot be undone.</p></div>{deleteError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>}</div>
        <div className="shrink-0 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2.5"><button autoFocus type="button" disabled={saving} onClick={() => closeModal('delete')} className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50">Cancel</button><button type="button" disabled={saving || !deletingBadge} onClick={() => deletingBadge && void remove(deletingBadge)} className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-98 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}{saving ? 'Deleting...' : 'Delete Badge'}</button></div>
      </div>
    </dialog>
  </div>;
}
