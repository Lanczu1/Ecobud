import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Image as ImageIcon, Loader2, MapPin, RefreshCw, Search, Trash2 } from 'lucide-react';
import { adminGet, adminPost, API_HOST } from '../../../utils/adminApi';
import { AdminPagination } from '../AdminPagination';

interface PhotoRequest {
  id: string;
  status: 'pending' | 'approved';
  reason: string;
  eventTitle: string;
  requestedAt: string;
  reviewedAt?: string;
  photoUrl: string | null;
  user: { name: string; profile: { displayName: string | null; city: string | null } | null } | null;
}
interface RequestPage {
  items: PhotoRequest[];
  pagination: { page: number; totalPages: number; total: number };
}

export function EventPhotoDeleteRequests({ onPreview, onApproved }: {
  onPreview: (image: { url: string; title: string }) => void;
  onApproved: () => void;
}) {
  const [status, setStatus] = useState<'pending' | 'approved'>('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RequestPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({ pending: 0, approved: 0 });
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const otherStatus = status === 'pending' ? 'approved' : 'pending';
      const [response, other] = await Promise.all([
        adminGet<RequestPage>(`/admin/events/photo-delete-requests?status=${status}&page=${page}&pageSize=20`, { bypassCache: true }),
        adminGet<RequestPage>(`/admin/events/photo-delete-requests?status=${otherStatus}&page=1&pageSize=1`, { bypassCache: true }),
      ]);
      if (current === generation.current) {
        setCounts(status === 'pending'
          ? { pending: response.pagination.total, approved: other.pagination.total }
          : { pending: other.pagination.total, approved: response.pagination.total });
        if (page > response.pagination.totalPages) { setPage(response.pagination.totalPages); return; }
        setData(response);
      }
    } catch (err) {
      if (current === generation.current) setError(err instanceof Error ? err.message : 'Could not load photo delete requests.');
    } finally { if (current === generation.current) setLoading(false); }
  }, [page, status]);

  // Loads once per page/filter change; new requests show up through the Refresh button, not on a timer.
  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [load]);

  const approve = async (item: PhotoRequest) => {
    if (approving) return;
    setApproving(item.id);
    setError(null);
    setNotice(null);
    try {
      await adminPost(`/admin/events/photo-delete-requests/${encodeURIComponent(item.id)}/approve`, {});
      setNotice('Approved. The photo was removed; history details, attendance, and rewards were retained.');
      onApproved();
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not approve the request.'); }
    finally { setApproving(null); }
  };

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.items ?? []).filter(item => !query || [item.user?.profile?.displayName, item.user?.name, item.user?.profile?.city, item.eventTitle, item.reason].some(value => value?.toLowerCase().includes(query)));
  }, [data, search]);
  const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';

  return <section aria-label="Photo deletion requests" className="min-w-0 space-y-6 animate-reveal">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[
        { label: 'Pending Requests', value: counts.pending, Icon: Clock, color: 'text-orange-700 dark:text-orange-300', chip: 'bg-orange-50 dark:bg-orange-900/30' },
        { label: 'Approved Deletions', value: counts.approved, Icon: CheckCircle2, color: 'text-green-700 dark:text-green-300', chip: 'bg-green-50 dark:bg-green-900/30' },
      ].map(stat => <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.chip}`}><stat.Icon className={`h-6 w-6 ${stat.color}`} aria-hidden="true" /></div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-600 dark:text-gray-300">{stat.label}</p>
          <p className={`font-serif text-3xl font-bold leading-tight tabular-nums ${stat.color}`}>{loading && !data ? '...' : error ? 'Unavailable' : stat.value}</p>
        </div>
      </div>)}
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Trash2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
        <p className="text-sm text-emerald-800 dark:text-emerald-300"><strong>Photo deletion requests:</strong> Review the participant's reason before approving. History details, attendance, and rewards are retained.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-100/70 px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50 dark:bg-emerald-800/40 dark:text-emerald-200 ${focus}`}>
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh
      </button>
    </div>

    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input type="search" aria-label="Search photo requests on this page" placeholder="Search this page by participant, event, or reason..." value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pr-4 pl-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Request status filters">
          {(['pending', 'approved'] as const).map(filter => <button key={filter} type="button" aria-pressed={status === filter} onClick={() => { if (filter === status) return; setStatus(filter); setPage(1); setData(null); setNotice(null); }} className={`min-h-11 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${status === filter ? 'border-green-700 bg-green-700 text-white shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-green-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200'} ${focus}`}>{filter === 'pending' ? 'Pending' : 'Approved'}</button>)}
        </div>
      </div>
    </div>

    {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">{notice}</p>}
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"><p>{error}</p><button type="button" onClick={() => void load()} className={`min-h-11 rounded-lg border border-current px-4 ${focus}`}>Try again</button></div>}

    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {loading && !data ? <div role="status" className="p-12 text-center"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-green-700 dark:text-green-300" aria-hidden="true" /><p className="text-sm text-gray-600 dark:text-gray-300">Loading photo delete requests...</p></div>
        : filteredRequests.length === 0 ? <div className="p-12 text-center"><Trash2 className="mx-auto mb-3 h-12 w-12 text-gray-400 dark:text-gray-500" aria-hidden="true" /><p className="font-medium text-gray-700 dark:text-gray-200">{error ? 'Photo delete requests could not be loaded.' : search.trim() ? 'No requests match your search.' : status === 'pending' ? 'No pending photo delete requests.' : 'No approved photo deletions yet.'}</p><p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{search.trim() ? 'Search applies to the current page.' : 'Requests sent by participants from mobile will appear here.'}</p></div>
        : <div className="overflow-x-auto" role="region" aria-label="Photo deletion requests table" tabIndex={0}>
          <table className="w-full min-w-[1050px] text-left">
            <thead><tr className="border-b border-gray-100 bg-gray-50/70 text-xs font-semibold tracking-wider text-gray-600 uppercase dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
              {['Participant', 'Event Title', 'Photo Proof', 'Reason', 'Status', 'Requested Date', 'Action'].map(label => <th key={label} scope="col" className="px-5 py-3.5">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{filteredRequests.map(item => {
              const displayName = item.user?.profile?.displayName || item.user?.name || 'Former user';
              const city = item.user?.profile?.city;
              const photoUrl = item.photoUrl ? /^https?:\/\//i.test(item.photoUrl) ? item.photoUrl : `${API_HOST.replace(/\/$/, '')}/${item.photoUrl.replace(/^\//, '')}` : null;
              return <tr key={item.id} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                <td className="px-6 py-4"><div className="flex items-center gap-3">
                  <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-100 text-sm font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">{displayName.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0"><p className="max-w-44 break-words text-sm font-semibold text-gray-900 dark:text-white">{displayName}</p>{city && <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300"><MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />{city}</p>}</div>
                </div></td>
                <td className="px-5 py-4"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0 text-green-700 dark:text-green-300" aria-hidden="true" /><span className="max-w-52 break-words text-sm font-medium text-gray-800 dark:text-gray-200">{item.eventTitle}</span></div></td>
                <td className="px-5 py-4">{photoUrl ? <button type="button" onClick={() => onPreview({ url: photoUrl, title: `${displayName} - ${item.eventTitle}` })} aria-label={`View requested photo for ${displayName}, ${item.eventTitle}`} className={`group relative block h-11 w-14 overflow-hidden rounded-lg border border-gray-200 shadow-xs transition-all hover:ring-2 hover:ring-green-500 dark:border-gray-700 ${focus}`}>
                  <img src={photoUrl} alt={`Attendance photo for ${item.eventTitle}`} loading="lazy" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><ImageIcon className="h-4 w-4 text-white" aria-hidden="true" /></div>
                </button> : <span className="text-xs text-gray-600 italic dark:text-gray-300">Photo removed</span>}</td>
                <td className="px-5 py-4"><p className="min-w-44 max-w-72 break-words whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{item.reason}</p></td>
                <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold ${item.status === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{item.status === 'pending' ? <Clock className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}{item.status === 'pending' ? 'Pending Approval' : 'Approved'}</span></td>
                <td className="px-5 py-4"><span className="text-xs whitespace-nowrap text-gray-600 dark:text-gray-300">{new Date(item.requestedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>{item.reviewedAt && <p className="mt-1 text-xs whitespace-nowrap text-gray-600 dark:text-gray-300">Approved {new Date(item.reviewedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}</p>}</td>
                <td className="px-5 py-4">{item.status === 'pending' ? <button type="button" disabled={!!approving || loading} onClick={() => void approve(item)} aria-label={`Approve photo deletion requested by ${displayName} for ${item.eventTitle}`} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-semibold whitespace-nowrap text-green-800 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 ${focus}`}>{approving === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}{approving === item.id ? 'Approving...' : 'Approve'}</button> : <span className="text-xs text-gray-600 dark:text-gray-300">Photo deletion approved</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
      {data && !loading && <AdminPagination {...data.pagination} onPageChange={setPage} />}
    </div>
  </section>;
}
