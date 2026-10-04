import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown, ChevronRight, Eye, EyeOff, MapPin, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { adminGet, clearAdminApiCache } from '../../../utils/adminApi';
import { adminRealtimeService } from '../../../services/adminRealtimeService';
import { AdminPagination } from '../AdminPagination';
import { useModalScrollLock } from '../../../hooks/useModalScrollLock';
import './UserActivityTransactions.css';

type Entry = {
  id: string; reference: string; userId: string; userName: string; email: string; barangay: string;
  source: string; category: string; title: string; status: string; points: number; coins: number;
  timestamp: string; details: Record<string, unknown>;
  currentBalance: { points: number; coins: number; knowledgePoints: number };
};
type Feed = {
  items: Entry[]; barangays: string[]; categories: string[]; statuses: string[]; users: number; syncedAt: string;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
const label = (text: string) => text.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
const date = (text: string) => new Date(text).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const amount = (value: number) => value ? `${value > 0 ? '+' : ''}${value.toLocaleString()}` : '—';
const detailValue = (key: string, value: unknown): string => {
  if (value == null) return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key.endsWith('At') && typeof value === 'string' && Number.isFinite(Date.parse(value))) return `${date(value)} (Philippine Time)`;
  if (key === 'currency') return value === 'eco_coins' ? 'EcoCoins' : value === 'exp' ? 'Eco Points' : String(value);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};
const fieldClass = 'min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

export function UserActivityTransactions() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [choices, setChoices] = useState<Pick<Feed, 'barangays' | 'categories' | 'statuses'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ barangay: 'all', category: 'all', status: 'all', currency: 'all', source: 'all', from: '', to: '', userId: '' });
  const [page, setPage] = useState(1);
  const [pageMotion, setPageMotion] = useState({ revision: 0, direction: 'forward' });
  const pageNavigation = useRef(false);
  const displayedPage = useRef<number | null>(null);
  const records = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [expandedUsers, setExpandedUsers] = useState(new Set<string>());
  const [selected, setSelected] = useState<Entry | null>(null);
  const refresh = useRef<() => void>(() => {});
  const dialog = useRef<HTMLDialogElement>(null);
  useModalScrollLock(!!selected);
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50', search });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value === 'Unassigned Barangay' ? 'unassigned' : value);
    return params.toString();
  }, [filters, search, page]);
  useEffect(() => {
    const isPageNavigation = pageNavigation.current;
    const requestedPage = Number(new URLSearchParams(query).get('page'));
    pageNavigation.current = false;
    let alive = true, busy = false, queued = false;
    const load = async (): Promise<void> => {
      if (!alive) return;
      if (busy) { queued = true; return; }
      busy = true;
      if (isPageNavigation && displayedPage.current !== requestedPage) setLoading(true);
      try {
        const next = await adminGet<Feed>(`/admin/user-activity?${query}`, { bypassCache: true });
        if (alive) {
          if (isPageNavigation && displayedPage.current !== null && displayedPage.current !== next.pagination.page) {
            const direction = next.pagination.page > displayedPage.current ? 'forward' : 'backward';
            setPageMotion(previous => ({ revision: previous.revision + 1, direction }));
          }
          displayedPage.current = next.pagination.page;
          setFeed(next);
          setChoices({ barangays: next.barangays, categories: next.categories, statuses: next.statuses });
          setSelected(previous => previous ? next.items.find(item => item.id === previous.id) ?? previous : null);
          setError('');
        }
      } catch (failure) {
        if (alive) setError(failure instanceof Error ? failure.message : 'Could not load user activity.');
      } finally {
        clearAdminApiCache('/admin/user-activity');
        busy = false;
        if (alive) { setLoading(false); if (queued) { queued = false; void load(); } }
      }
    };
    setLoading(true);
    if (!isPageNavigation) setFeed(null);
    refresh.current = () => void load();
    void load();
    let disconnect: (() => void) | undefined;
    void adminRealtimeService.connect({ onUsersRefresh: () => void load() }).then(stop => { if (alive) disconnect = stop; else stop(); });
    return () => { alive = false; disconnect?.(); };
  }, [query]);

  useLayoutEffect(() => {
    if (!pageMotion.revision) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    records.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [pageMotion]);

  const changePage = (nextPage: number) => {
    if (loading || nextPage === feed?.pagination.page) return;
    if (nextPage === page) { refresh.current(); return; }
    pageNavigation.current = true;
    setPage(nextPage);
  };

  const change = useCallback((key: keyof typeof filters, value: string) => {
    setFilters(previous => ({ ...previous, [key]: value })); setPage(1);
  }, []);
  const groups = useMemo(() => {
    const barangays = new Map<string, Map<string, Entry[]>>();
    for (const item of feed?.items ?? []) {
      if (!barangays.has(item.barangay)) barangays.set(item.barangay, new Map());
      const users = barangays.get(item.barangay)!;
      if (!users.has(item.userId)) users.set(item.userId, []);
      users.get(item.userId)!.push(item);
    }
    return [...barangays].sort(([a], [b]) => a.localeCompare(b));
  }, [feed]);
  const toggle = (key: string) => setCollapsed(previous => {
    const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next;
  });
  const toggleUser = (userId: string) => setExpandedUsers(previous => {
    const next = new Set(previous);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    return next;
  });
  const showAllTransactions = () => {
    setCollapsed(new Set());
    setExpandedUsers(new Set(feed?.items.map(item => item.userId) ?? []));
  };
  const extraFilterCount = ['status', 'currency', 'source', 'from', 'to'].filter(key => {
    const value = filters[key as keyof typeof filters];
    return value && value !== 'all';
  }).length;
  const reset = () => { setFilters({ barangay: 'all', category: 'all', status: 'all', currency: 'all', source: 'all', from: '', to: '', userId: '' }); setSearchInput(''); setSearch(''); setPage(1); };

  return <div className="relative p-8 space-y-6 bg-gray-50/50 min-h-full">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div><h1 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">User Activity &amp; Transactions</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose a resident to show their transactions. History stays hidden until you open it.</p></div>
      </div>
      <button type="button" onClick={() => refresh.current()} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"><RefreshCw className="h-4 w-4" />Refresh</button>
    </div>
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto]">
        <label className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300 sm:col-span-2 xl:col-span-1">Search residents or transactions
          <span className="relative block"><Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input maxLength={120} value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Name, email, activity or reference ID" className={`${fieldClass} w-full pl-9`} /></span>
        </label>
        <label className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Barangay<select value={filters.barangay} onChange={event => change('barangay', event.target.value)} className={`${fieldClass} block w-full`}><option value="all">All Barangays</option>{choices?.barangays.map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Activity type<select value={filters.category} onChange={event => change('category', event.target.value)} className={`${fieldClass} block w-full`}><option value="all">All activity</option>{choices?.categories.filter(value => value !== 'all').map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <button type="button" onClick={reset} className={`${fieldClass} self-end hover:bg-gray-100 dark:hover:bg-gray-700`}>Clear filters</button>
      </div>
      <details className="group border-t border-gray-100 pt-3 dark:border-gray-800">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg text-xs font-semibold text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-gray-300"><SlidersHorizontal aria-hidden="true" className="h-4 w-4" />More filters{extraFilterCount > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{extraFilterCount} active</span>}<ChevronDown aria-hidden="true" className="h-4 w-4 group-open:rotate-180" /></summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Status<select value={filters.status} onChange={event => change('status', event.target.value)} className={`${fieldClass} block w-full`}><option value="all">All statuses</option>{[...new Set([...(choices?.statuses ?? []), ...(filters.status === 'all' ? [] : [filters.status])])].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Currency<select value={filters.currency} onChange={event => change('currency', event.target.value)} className={`${fieldClass} block w-full`}><option value="all">All records</option><option value="points">Eco Points</option><option value="coins">EcoCoins</option></select></label>
        <label className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Record source<select value={filters.source} onChange={event => change('source', event.target.value)} className={`${fieldClass} block w-full`}><option value="all">All sources</option><option>Activity ledger</option><option>Reward transaction</option></select></label>
        <label className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">From<input type="date" value={filters.from} max={filters.to || undefined} onChange={event => change('from', event.target.value)} className={`${fieldClass} block w-full`} /></label>
        <label className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Through<input type="date" value={filters.to} min={filters.from || undefined} onChange={event => change('to', event.target.value)} className={`${fieldClass} block w-full`} /></label>
        </div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <span>{feed ? `${feed.pagination.total.toLocaleString()} records · ${feed.users.toLocaleString()} ${feed.users === 1 ? 'resident' : 'residents'}` : 'Loading records'}{filters.userId && ' · Selected resident'}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!feed?.items.length} onClick={showAllTransactions} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"><Eye className="h-3.5 w-3.5" />Show all transactions</button>
          <button type="button" disabled={!expandedUsers.size} onClick={() => setExpandedUsers(new Set())} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"><EyeOff className="h-3.5 w-3.5" />Hide all transactions</button>
        </div>
      </div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}{feed && ' Showing the last successful refresh.'}<button type="button" onClick={() => refresh.current()} className="ml-3 font-semibold underline">Retry</button></div>}
    {loading && !feed && <div role="status" className="rounded-2xl border border-gray-200 p-8 text-center text-gray-500 dark:border-gray-800">Loading user history…</div>}
    <div className="relative" aria-busy={loading}>
    {loading && feed && <div role="status" className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center"><span className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">Loading page {page}…</span></div>}
    <div ref={records} key={pageMotion.revision} data-direction={pageMotion.revision ? pageMotion.direction : undefined} inert={loading} className={`activity-page-records space-y-6 ${loading && feed ? 'activity-page-loading' : ''}`}>
    {feed && !feed.items.length && <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900"><Activity className="mx-auto mb-3 h-8 w-8 text-gray-400" /><h2 className="font-semibold text-gray-900 dark:text-white">No matching activity</h2><p className="mt-1 text-sm text-gray-500">Try another barangay, date range or search.</p></div>}
    {groups.map(([barangay, users]) => {
      const groupKey = `barangay:${barangay}`;
      return <section key={barangay} className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <button type="button" aria-expanded={!collapsed.has(groupKey)} onClick={() => toggle(groupKey)} className="flex w-full items-center justify-between gap-4 border-b border-gray-200/80 bg-linear-to-r from-emerald-50 via-green-50/50 to-white px-6 py-4.5 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:border-gray-800 dark:from-emerald-950/40 dark:via-gray-900 dark:to-gray-900">
          <span className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white"><MapPin className="h-5 w-5" /></span><span><span className="block font-bold text-gray-900 dark:text-white">{barangay === 'Unassigned Barangay' ? barangay : `Barangay ${barangay}`}</span><span className="text-xs text-gray-500 dark:text-gray-400">{users.size} {users.size === 1 ? 'resident' : 'residents'} on this page</span></span></span>
          {collapsed.has(groupKey) ? <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" /> : <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />}
        </button>
        {!collapsed.has(groupKey) && <div className="space-y-5 bg-gray-50/50 p-5 sm:p-6 dark:bg-gray-950/60">{[...users].map(([userId, entries]) => {
          const user = entries[0], isExpanded = expandedUsers.has(userId);
          return <section key={userId} className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <button type="button" aria-label={`${isExpanded ? 'Hide' : 'Show'} transactions for ${user.userName}`} aria-expanded={isExpanded} onClick={() => toggleUser(userId)} className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 bg-linear-to-r from-gray-50/90 to-white px-5 py-3.5 text-left hover:from-emerald-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:from-gray-800/80 dark:to-gray-900 dark:hover:from-emerald-950/30">
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-tr from-green-600 to-emerald-400 text-xs font-bold text-white shadow-xs">{user.userName.charAt(0).toUpperCase()}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{user.userName}</span><span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</span></span>
              </span>
              <span className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">{entries.length} {entries.length === 1 ? 'record' : 'records'} on this page</span>
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${isExpanded ? 'text-gray-500 dark:text-gray-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  <span>{isExpanded ? 'Hide transactions' : 'Show transactions'}</span>
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
              </span>
            </button>
            {isExpanded && <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-emerald-50/30 px-4 py-3 text-xs text-gray-500 sm:px-5 dark:border-gray-800 dark:bg-emerald-950/10 dark:text-gray-400"><span>Current balance: <strong className="font-semibold text-gray-800 dark:text-gray-200">{user.currentBalance.points.toLocaleString()} Eco Points</strong> · <strong className="font-semibold text-gray-800 dark:text-gray-200">{user.currentBalance.coins.toLocaleString()} EcoCoins</strong></span><button type="button" onClick={() => change('userId', userId)} className="font-semibold text-emerald-700 underline dark:text-emerald-400">Filter to this resident</button></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-y border-gray-100 bg-gray-50 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400"><tr>{['Activity / reference', 'Status', 'Eco Points', 'EcoCoins', 'Date (Philippine Time)', 'Details'].map(title => <th key={title} scope="col" className="px-4 py-3 font-semibold">{title}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{entries.map(entry => <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="max-w-80 px-4 py-3"><p className="break-words font-medium text-gray-900 dark:text-gray-100">{entry.title}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.source}</p><p className="mt-1 break-all text-xs text-gray-400">{entry.reference}</p></td>
                <td className="px-4 py-3"><span className={`rounded-lg px-2 py-1 text-xs font-semibold ${['pending', 'final_review', 'approved_collection'].includes(entry.status) ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' : ['rejected', 'cancelled', 'suspended'].includes(entry.status) ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>{label(entry.status)}</span></td>
                <td className={`whitespace-nowrap px-4 py-3 tabular-nums ${entry.points > 0 ? 'font-semibold text-emerald-700 dark:text-emerald-400' : entry.points < 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-400'}`}>{amount(entry.points)}</td><td className={`whitespace-nowrap px-4 py-3 tabular-nums ${entry.coins > 0 ? 'font-semibold text-emerald-700 dark:text-emerald-400' : entry.coins < 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-400'}`}>{amount(entry.coins)}</td><td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{date(entry.timestamp)}</td>
                <td className="px-4 py-3"><button type="button" onClick={() => setSelected(entry)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">View</button></td>
              </tr>)}</tbody></table></div>
            </>}
          </section>;
        })}</div>}
      </section>;
    })}
    </div>
    </div>
    {feed && <><fieldset disabled={loading} aria-label="Activity pagination" className="min-w-0"><AdminPagination {...feed.pagination} onPageChange={changePage} /></fieldset><p className="text-xs text-gray-500 dark:text-gray-400">Activity and reward ledger entries can describe the same claim. Amounts are shown per source and are not combined. Barangays follow each resident’s current profile.</p><p className="text-xs text-gray-500 dark:text-gray-400">Auto-refreshes every 30 seconds while this page is visible. Last synced: {date(feed.syncedAt)}.</p></>}
    {selected && <dialog ref={dialog} aria-labelledby="activity-details-title" onCancel={() => setSelected(null)} onClose={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }} className="m-auto w-[calc(100%_-_2rem)] max-w-xl rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      <div className="max-h-[85vh] overflow-y-auto p-6" onClick={event => event.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-3"><h2 id="activity-details-title" className="text-lg font-bold">{selected.title}</h2><button type="button" autoFocus aria-label="Close transaction details" onClick={() => setSelected(null)} className="rounded-lg p-1 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button></div>
      <dl className="space-y-3 text-sm">{Object.entries({ Resident: selected.userName, Barangay: selected.barangay, Source: selected.source, Reference: selected.reference, Status: label(selected.status), Date: `${date(selected.timestamp)} (Philippine Time)`, 'Eco Points': amount(selected.points), EcoCoins: amount(selected.coins), ...Object.fromEntries(Object.entries(selected.details).map(([key, value]) => [label(key.replace(/([a-z])([A-Z])/g, '$1 $2')), detailValue(key, value)])) }).map(([key, value]) => <div key={key} className="grid grid-cols-[7rem_1fr] gap-3"><dt className="text-gray-500 dark:text-gray-400">{key}</dt><dd className="break-words [overflow-wrap:anywhere]">{String(value)}</dd></div>)}</dl>
      </div>
    </dialog>}
  </div>;
}
