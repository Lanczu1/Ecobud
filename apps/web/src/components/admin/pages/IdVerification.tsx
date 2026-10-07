import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock, Eye,
  FileText, Filter, Layers, Loader2, Lock, MapPin, RefreshCw, Search,
  ShieldCheck, User, XCircle,
} from 'lucide-react';
import { useModalScrollLock } from '../../../hooks/useModalScrollLock';
import { adminGet, adminPatch, API_HOST } from '../../../utils/adminApi';
import { notificationTarget } from '../../../services/adminNotifications';
import { AdminPagination } from '../AdminPagination';

type Submission = {
  id: string; legalName: string; idType: string; barangay: string;
  status: 'pending' | 'approved' | 'rejected'; reason: string | null;
  submittedAt: string; reviewedAt: string | null;
  user: { name: string; email: string }; reviewer: { name: string } | null;
};
type Status = Submission['status'];
type ReviewPage = { items: Submission[]; total: number };
const statuses: Status[] = ['pending', 'approved', 'rejected'];
const statusLabels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
const statusStyles = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  approved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
};
const formatDate = (value: string) => new Date(value).toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

async function fetchDocument(id: string, signal: AbortSignal) {
  const response = await fetch(`${API_HOST}/api/id-verification/review/${encodeURIComponent(id)}/document`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('ecobud_admin_token') || ''}` },
    cache: 'no-store', signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || 'Could not load ID photo.');
  }
  return response.blob();
}

function DocumentThumbnail({ submission, onOpen }: { submission: Submission; onOpen: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!buttonRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void fetchDocument(submission.id, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [submission.id, visible]);
  return <button ref={buttonRef} type="button" onClick={onOpen} aria-label={`View ID photo for ${submission.legalName}`}
    className="relative w-14 h-11 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group/img cursor-pointer hover:ring-2 hover:ring-green-400 focus-visible:ring-2 focus-visible:ring-green-400 transition-all shadow-xs bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
    {url ? <img src={url} alt="Submitted ID thumbnail" className="w-full h-full object-cover" /> : <FileText className="w-5 h-5 text-gray-400" />}
    <span className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 group-focus-visible/img:opacity-100 transition-opacity"><Eye className="w-4 h-4" /></span>
  </button>;
}

export function IdVerification() {
  const [status, setStatus] = useState<Status>('pending');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<Status, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [resident, setResident] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Submission | null>(null);
  const [dialogMode, setDialogMode] = useState<'review' | 'reject'>('review');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reviewBusy = useRef(busy);
  useLayoutEffect(() => { reviewBusy.current = busy; });
  useModalScrollLock(Boolean(selected));
  const assignedBarangay = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('ecobud_admin_user') || 'null');
      return user?.city || user?.profile?.city || '';
    } catch { return ''; }
  }, []);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError('');
    try {
      const results = await Promise.all(statuses.map(value => adminGet<ReviewPage>(
        `/id-verification/review?status=${value}&page=${value === status ? page : 1}${notificationTarget('id_verification') ? `&recordId=${encodeURIComponent(notificationTarget('id_verification')!)}` : ''}`, { bypassCache: true },
      )));
      if (version !== requestVersion.current) return;
      const active = results[statuses.indexOf(status)];
      const focused=notificationTarget('id_verification') ? active.items[0] : null;
      setCounts(notificationTarget('id_verification') ? { pending:focused?.status==='pending' ? 1 : 0,approved:focused?.status==='approved' ? 1 : 0,rejected:focused?.status==='rejected' ? 1 : 0 } : { pending: results[0].total, approved: results[1].total, rejected: results[2].total });
      const lastPage = Math.max(1, Math.ceil(active.total / 20));
      if (page > lastPage) { setPage(lastPage); return; }
      setItems(active.items);
      if (notificationTarget('id_verification') && active.items[0]) setStatus(active.items[0].status);
    } catch (e) {
      if (version === requestVersion.current) { setItems([]); setError(e instanceof Error ? e.message : 'Could not load submissions.'); }
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [status, page]);
  useEffect(() => { void load(); return () => { requestVersion.current++; }; }, [load]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setPhoto(null); setPhotoError('');
    void fetchDocument(selected.id, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setPhoto(objectUrl);
    }).catch(e => { if (!controller.signal.aborted) setPhotoError(e instanceof Error ? e.message : 'Could not load ID photo.'); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [selected?.id]);
  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('textarea, button')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !reviewBusy.current) setSelected(null);
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)');
      if (!controls?.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('keydown', keyboard); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [selected?.id, dialogMode]);

  const openReview = (item: Submission) => {
    setReason(''); setReviewError(''); setDialogMode('review'); setSelected(item);
  };
  const review = async (decision: 'approved' | 'rejected') => {
    if (!selected || busy || (decision === 'approved' && !photo)) return;
    if (decision === 'rejected' && !reason.trim()) { setReviewError('Enter a reason so the user knows what to correct.'); return; }
    setBusy(true); setReviewError('');
    try {
      await adminPatch(`/id-verification/review/${selected.id}`, { status: decision, reason: reason.trim() });
      setSelected(null); await load();
    } catch (e) { setReviewError(e instanceof Error ? e.message : 'Could not save review.'); }
    finally { setBusy(false); }
  };
  const toggle = (key: string) => setCollapsed(previous => {
    const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next;
  });
  const residents = useMemo(() => Array.from(new Map(items.map(item => [item.user.email, item.user])).values()), [items]);
  const groups = useMemo(() => {
    const result = new Map<string, Map<string, Submission[]>>();
    for (const item of items) {
      if (resident && item.user.email !== resident) continue;
      const query = search.trim().toLowerCase();
      if (query && ![item.legalName, item.user.name, item.user.email, item.idType, item.reason || '', item.reviewer?.name || ''].some(value => value.toLowerCase().includes(query))) continue;
      if (!result.has(item.barangay)) result.set(item.barangay, new Map());
      const people = result.get(item.barangay)!;
      if (!people.has(item.user.email)) people.set(item.user.email, []);
      people.get(item.user.email)!.push(item);
    }
    return Array.from(result, ([barangay, people]) => ({ barangay, people: Array.from(people, ([email, submissions]) => ({ email, submissions })) }));
  }, [items, resident, search]);
  const total = counts[status];
  const stats = [
    { label: 'Pending Review', value: counts.pending, background: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', color: 'text-orange-600 dark:text-orange-400' },
    { label: 'Approved', value: counts.approved, background: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800', color: 'text-green-600 dark:text-green-400' },
    { label: 'Rejected', value: counts.rejected, background: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800', color: 'text-red-600 dark:text-red-400' },
    { label: 'Total Submissions', value: counts.pending + counts.approved + counts.rejected, background: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800', color: 'text-blue-600 dark:text-blue-400' },
  ];

  return <div className="relative p-4 sm:p-8 space-y-6 bg-gray-50/50 min-h-full">
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">ID Verification</h2>
        {assignedBarangay && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"><MapPin className="w-3.5 h-3.5" />{assignedBarangay} (Assigned Barangay)</span>}
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Review and manage resident ID submissions in your assigned barangay.</p>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(stat => <div key={stat.label} className={`rounded-2xl border p-5 shadow-sm animate-reveal ${stat.background}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
        <p className={`text-3xl font-serif font-bold mt-1 ${stat.color}`}>{loading ? <span className="inline-block w-10 h-8 rounded bg-current opacity-10 animate-pulse" aria-label="Loading count" /> : error ? '—' : stat.value.toLocaleString()}</p>
      </div>)}
    </div>
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 flex items-start justify-between gap-3 animate-reveal delay-160">
      <div className="flex items-start gap-3"><ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" /><p className="text-sm text-blue-700 dark:text-blue-300"><strong>ID Review:</strong> Compare the submitted name and photo with the ID before approving. Include a clear reason when rejecting so the resident knows what to correct.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="text-xs text-blue-700 dark:text-blue-300 hover:underline flex items-center gap-1 font-semibold shrink-0 bg-blue-100/70 dark:bg-blue-800/40 px-3 py-1.5 rounded-lg disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
    </div>
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 space-y-3 animate-reveal delay-160">
      <div className="flex flex-col xl:flex-row gap-3 items-stretch justify-between">
        <div className="relative flex-1 min-w-0"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input aria-label="Search submissions on this page" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this page by resident, ID type, or review notes…" className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:text-white transition-all" /></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800"><MapPin className="w-4 h-4 text-emerald-600" /><span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{assignedBarangay || 'Assigned Barangay'}</span><Lock className="w-3 h-3 text-emerald-500" /></div>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700"><User className="w-4 h-4 text-gray-400" /><select aria-label="Filter residents on this page" value={resident} onChange={event => setResident(event.target.value)} className="text-xs font-semibold bg-transparent text-gray-600 dark:text-gray-300 max-w-40 truncate"><option value="">All Residents on Page</option>{residents.map(person => <option key={person.email} value={person.email}>{person.name}</option>)}</select></div>
          <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-2">
            <button type="button" onClick={() => setCollapsed(new Set())} className="px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Expand All</button>
            <button type="button" onClick={() => setCollapsed(new Set(groups.flatMap(group => [`barangay:${group.barangay}`, ...group.people.map(person => `resident:${person.email}`)])))} className="px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Collapse All</button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800"><span className="flex items-center gap-1.5 text-xs text-gray-400 mr-1"><Filter className="w-3.5 h-3.5" />Filter Status:</span>{statuses.map(value => <button type="button" key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); setResident(''); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${status === value ? 'bg-green-600 text-white shadow-sm font-semibold' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{value === 'pending' ? <Clock className="w-3.5 h-3.5" /> : value === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{statusLabels[value]}{!loading && !error && <span className="opacity-70">({counts[value]})</span>}</button>)}</div>
    </div>
    {error && <div role="alert" className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
    {loading ? <div role="status" aria-label="Loading ID submissions" className="space-y-4">{[0, 1, 2].map(index => <div key={index} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 animate-pulse flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800" /><div className="space-y-2 flex-1"><div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-800" /><div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" /></div></div>)}</div> : !error && groups.length === 0 ? <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center shadow-sm"><Layers className="w-12 h-12 mx-auto text-gray-400 opacity-30 mb-4" /><h3 className="font-semibold text-gray-700 dark:text-gray-300">No ID Submissions</h3><p className="text-sm text-gray-500 mt-1">{search || resident ? 'No matches on this page. Adjust your search or resident filter.' : `There are no ${status} ID submissions in your barangay.`}</p></div> : <div className="space-y-5">
      {groups.map(group => {
        const groupKey = `barangay:${group.barangay}`;
        const submissions = group.people.flatMap(person => person.submissions);
        return <div key={group.barangay} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-sm overflow-hidden">
          <button type="button" onClick={() => toggle(groupKey)} aria-expanded={!collapsed.has(groupKey)} className="w-full text-left px-6 py-4.5 bg-linear-to-r from-emerald-50 via-green-50/50 to-white dark:from-emerald-950/40 dark:via-gray-900 dark:to-gray-900 border-b border-gray-200/80 dark:border-gray-800 flex items-center justify-between gap-3 hover:bg-emerald-100/40 dark:hover:bg-emerald-950/60 transition-colors">
            <span className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-white" /></span><span><span className="flex flex-wrap items-center gap-2"><span className="text-base font-bold text-gray-900 dark:text-white">{group.barangay}</span><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">{group.people.length} {group.people.length === 1 ? 'resident' : 'residents'}</span></span><span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'} on this page</span></span></span>
            <span className="flex items-center gap-3">{status === 'pending' && <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800"><Clock className="w-3.5 h-3.5" />{submissions.length} pending</span>}{collapsed.has(groupKey) ? <ChevronRight className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}</span>
          </button>
          {!collapsed.has(groupKey) && <div className="p-5 sm:p-6 space-y-5 bg-gray-50/50 dark:bg-gray-950/60">{group.people.map(person => {
            const first = person.submissions[0]; const personKey = `resident:${person.email}`;
            return <div key={person.email} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-xs overflow-hidden">
              <button type="button" onClick={() => toggle(personKey)} aria-expanded={!collapsed.has(personKey)} className="w-full text-left px-5 py-3.5 bg-linear-to-r from-gray-50/90 to-white dark:from-gray-800/80 dark:to-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors">
                <span className="flex items-center gap-3 min-w-0"><span className="w-9 h-9 rounded-full bg-linear-to-br from-green-600 to-emerald-400 flex items-center justify-center text-xs font-bold text-white shrink-0">{first.legalName.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('')}</span><span className="min-w-0"><span className="block text-sm font-bold text-gray-900 dark:text-white truncate">{first.legalName} <span className="font-normal text-gray-400 text-xs">@{first.user.name}</span></span><span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{person.email} · {person.submissions.length} {person.submissions.length === 1 ? 'submission' : 'submissions'}</span></span></span>
                {collapsed.has(personKey) ? <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>
              {!collapsed.has(personKey) && <div className="p-4 sm:p-5 bg-gray-50/30 dark:bg-gray-950/30"><div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300"><FileText className="w-4 h-4 text-green-600" />ID Submissions</div>
                <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-white dark:bg-gray-900">{['Submission', 'ID Photo', 'Status', 'Date Submitted', 'Review Action'].map(label => <th scope="col" key={label} className={`px-4 py-3 whitespace-nowrap ${label === 'Review Action' ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {person.submissions.map(item => <tr key={item.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-green-100/80 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800 whitespace-nowrap">{item.idType} ID</span><span className="block text-[11px] text-gray-500 mt-1">{item.legalName}</span></td>
                    <td className="px-4 py-3"><DocumentThumbnail submission={item} onOpen={() => openReview(item)} /></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold border ${statusStyles[item.status]}`}>{statusLabels[item.status]}</span>{item.reason && <p title={item.reason} className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 max-w-44 truncate">{item.reason}</p>}{item.reviewer && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1" title={item.reviewedAt ? formatDate(item.reviewedAt) : undefined}>By {item.reviewer.name}</p>}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(item.submittedAt)}</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => openReview(item)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${item.status === 'pending' ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs active:scale-95' : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}><Eye className="w-3.5 h-3.5" />{item.status === 'pending' ? 'Review ID' : 'View Review'}</button></td>
                  </tr>)}
                </tbody></table></div>
              </div></div>}
            </div>;
          })}</div>}
        </div>;
      })}
    </div>}
    {!loading && !error && <AdminPagination page={page} totalPages={Math.max(1, Math.ceil(total / 20))} total={total} onPageChange={next => { setPage(next); setResident(''); }} />}
    {selected && createPortal(<div className={`fixed inset-0 z-9999 flex items-center justify-center p-4 ${dialogMode === 'reject' ? 'bg-black/60 backdrop-blur-xs' : 'bg-black/85 backdrop-blur-sm'}`} onClick={() => { if (!busy) setSelected(null); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="id-review-title" onClick={event => event.stopPropagation()} className={dialogMode === 'reject' ? 'bg-white dark:bg-[#0f1713] w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-modal max-h-[90vh] overflow-y-auto' : 'w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-modal text-white'}>
        {dialogMode === 'reject' ? <>
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 flex items-center justify-center"><XCircle className="w-4 h-4" /></div><div><h3 id="id-review-title" className="text-sm font-bold text-gray-900 dark:text-white">Reject ID Submission</h3><p className="text-xs text-gray-500">{selected.idType} ID</p></div></div><button type="button" disabled={busy} aria-label="Close rejection dialog" onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 disabled:opacity-50"><XCircle className="w-5 h-5" /></button></div>
          <form onSubmit={event => { event.preventDefault(); void review('rejected'); }}>
            <div className="p-6 space-y-4"><div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 text-xs space-y-1"><p className="text-gray-500">Resident: <span className="font-semibold text-gray-800 dark:text-gray-200">{selected.legalName}</span></p><p className="text-gray-500">Barangay: <span className="text-gray-700 dark:text-gray-300">{selected.barangay}</span></p></div><div><label htmlFor="id-rejection-reason" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Reason for rejection <span className="text-red-500">*</span></label><textarea id="id-rejection-reason" required autoFocus value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} disabled={busy} placeholder="Explain what the resident needs to correct…" className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800/80 dark:text-white rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all resize-none placeholder:text-gray-400" /><p className="mt-1 text-[11px] text-gray-500">The resident receives this reason with their verification result.</p></div>{reviewError && <p role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">{reviewError}</p>}</div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5"><button type="button" disabled={busy} onClick={() => { setReviewError(''); setDialogMode('review'); }} className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl disabled:opacity-50">Cancel</button><button type="submit" disabled={busy || !reason.trim()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 text-xs font-semibold disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}Confirm Rejection</button></div>
          </form>
        </> : <>
          <div className="flex items-start justify-between gap-4 pb-3"><div><h3 id="id-review-title" className="text-sm font-semibold">{selected.legalName} · {selected.idType} ID</h3><p className="text-xs text-white/60 mt-1">{selected.barangay} · {formatDate(selected.submittedAt)}</p></div><button type="button" disabled={busy} aria-label="Close ID review" onClick={() => setSelected(null)} className="text-white/70 hover:text-white disabled:opacity-50"><XCircle className="w-7 h-7" /></button></div>
          <div className="rounded-2xl border border-white/15 shadow-2xl bg-black/50 overflow-hidden flex items-center justify-center min-h-48">{photo ? <img src={photo} alt={`Submitted ID document for ${selected.legalName}`} className="max-w-full max-h-[60vh] object-contain block" /> : photoError ? <p role="alert" className="p-6 text-sm text-red-300">{photoError}</p> : <p role="status" className="p-6 flex items-center gap-2 text-sm text-white/70"><Loader2 className="w-4 h-4 animate-spin" />Loading private ID photo…</p>}</div>
          <div className="mt-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex flex-wrap items-center justify-between gap-4"><div className="text-xs text-gray-500 dark:text-gray-400"><span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold border ${statusStyles[selected.status]}`}>{statusLabels[selected.status]}</span><p className="mt-2">Account: {selected.user.name} · {selected.user.email}</p>{selected.reason && <p className="mt-1 break-words">Reason: {selected.reason}</p>}{selected.reviewer && <p className="mt-1">Reviewed by {selected.reviewer.name}{selected.reviewedAt && ` · ${formatDate(selected.reviewedAt)}`}</p>}</div>{selected.status === 'pending' && <div className="flex items-center gap-2"><button type="button" disabled={busy || !photo} onClick={() => void review('approved')} className="inline-flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg px-3 py-2 text-xs font-semibold shadow-xs disabled:opacity-50">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}Approve ID</button><button type="button" disabled={busy} onClick={() => { setReviewError(''); setDialogMode('reject'); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 disabled:opacity-50"><XCircle className="w-3.5 h-3.5" />Reject ID</button></div>}{reviewError && <p role="alert" className="w-full text-xs text-red-700 dark:text-red-300">{reviewError}</p>}</div>
        </>}
      </div>
    </div>, document.body)}
  </div>;
}
