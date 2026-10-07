import { useCallback, useEffect, useRef, useState } from 'react';
import { adminDelete, adminGet, adminPatch, adminPut } from '../../../utils/adminApi';
import { adminHref, browserPushEnabled, browserPushSupported, disableBrowserPush, enableBrowserPush, fetchNotificationPage,
  notificationCategories, notificationRecordHref, type AdminNotification, type NotificationCategory, type NotificationPage, type NotificationPreferences } from '../../../services/adminNotifications';
import { useAdminNotifications } from '../AdminNotificationProvider';
import { ArrowLeftRight, Bell, BookOpen, Calendar, CheckCheck, ClipboardList, Flag, Gift, IdCard, Megaphone, RefreshCw, Settings, Trash2, TriangleAlert, Trophy, X, type LucideIcon } from 'lucide-react';

const field='min-h-11 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
const fieldLabel='space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300';
const button='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';
const primaryButton='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-gray-900';
const card='rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900';
const notice='rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300';
const statusTone: Record<string,string>={
  'Needs action':'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Resolved:'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Update:'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};
// Same icons as the sidebar sections each record opens, so a row reads as "this came from Events".
const recordIcons: Record<string,LucideIcon>={
  id_verification:IdCard,challenge_submission:Trophy,challenge:Trophy,event_submission:Calendar,event:Calendar,
  redemption:Gift,listing:ArrowLeftRight,listing_report:Flag,lesson:BookOpen,announcement:Megaphone,
  review_summary:ClipboardList,delivery_failure:TriangleAlert,worker_failure:TriangleAlert,
};
function RecordIcon({ recordType,unread=false }: { recordType: string; unread?: boolean }) {
  const Icon=recordIcons[recordType] ?? Bell;
  return <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${unread ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}><Icon className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>;
}
function StatusChip({ status }: { status: string }) {
  return <span className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold ${statusTone[status]}`}>{status}</span>;
}
const labels: Record<NotificationCategory,string>={ verification:'ID verification',challenge:'Challenges',event:'Events',swap:'Listings & reports',reward:'Rewards',learning:'Learning',announcement:'Announcements',system:'System alerts' };
function readRole() { try { return JSON.parse(localStorage.getItem('ecobud_admin_user') || '{}').role || ''; } catch { return ''; } }

export function Notifications() {
  const { refresh }=useAdminNotifications();
  const role=readRole();
  const [filter,setFilter]=useState('all'); const [category,setCategory]=useState('');
  const [page,setPage]=useState<NotificationPage | null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [busy,setBusy]=useState(false); const [selected,setSelected]=useState<AdminNotification | null>(null);
  const [detailError,setDetailError]=useState(''); const [detailLoading,setDetailLoading]=useState(false);
  const [prefs,setPrefs]=useState<NotificationPreferences | null>(null); const [prefsError,setPrefsError]=useState('');
  const [pushEnabled,setPushEnabled]=useState(false); const [settingsOpen,setSettingsOpen]=useState(false); const [saved,setSaved]=useState('');
  const request=useRef(0);
  const notificationId=new URLSearchParams(window.location.hash.split('?')[1] || '').get('notification');
  const load=useCallback(async (append=false, cursor?: NotificationPage['next']) => {
    const version=++request.current; setLoading(true); setError('');
    const q=new URLSearchParams({ filter }); if (category) q.set('category',category);
    if (append && cursor) { q.set('before',cursor.before); q.set('beforeId',cursor.beforeId); }
    try { const result=await fetchNotificationPage(q); if (version===request.current) setPage(current => ({ ...result, items: append && current ? [...current.items,...result.items.filter(item=>!current.items.some(old=>old.id===item.id))] : result.items })); }
    catch (e) { if (version===request.current) setError(e instanceof Error ? e.message : 'Could not load notifications.'); }
    finally { if (version===request.current) setLoading(false); }
  },[filter,category]);
  useEffect(() => { void load(); return () => { request.current++; }; },[load]);
  useEffect(() => {
    let cancelled=false;
    void adminGet<NotificationPreferences>('/admin/notifications/preferences',{ bypassCache:true }).then(value=>{ if (!cancelled) setPrefs(value); }).catch(e=>{ if (!cancelled) setPrefsError(e.message); });
    void browserPushEnabled().then(value=>{ if (!cancelled) setPushEnabled(value); });
    return () => { cancelled=true; };
  },[]);
  useEffect(() => {
    if (!notificationId) { setSelected(null); return; }
    let cancelled=false; setDetailLoading(true); setDetailError('');
    void adminGet<AdminNotification>(`/admin/notifications/${encodeURIComponent(notificationId)}`,{ bypassCache:true }).then(async value=>{
      if (cancelled) return; setSelected(value);
      await adminPatch(`/admin/notifications/${encodeURIComponent(value.id)}/read`,{});
      if (!cancelled) { setPage(current=>current ? { ...current,items:current.items.map(item=>item.id===value.id ? { ...item,isRead:true } : item) } : current); await refresh(); }
    }).catch(e=>{ if (!cancelled) setDetailError(e.message); }).finally(()=>{ if (!cancelled) setDetailLoading(false); });
    return () => { cancelled=true; };
  },[notificationId,refresh]);
  const markRead=async (id?:string) => {
    setBusy(true); setError('');
    try { await adminPatch(id ? `/admin/notifications/${encodeURIComponent(id)}/read` : '/admin/notifications/read-all',{}); await load(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update read status.'); }
    finally { setBusy(false); }
  };
  const [confirmClear,setConfirmClear]=useState(false);
  const remove=async (id?:string) => {
    setBusy(true); setError(''); setConfirmClear(false);
    try {
      await adminDelete(id ? `/admin/notifications/${encodeURIComponent(id)}` : '/admin/notifications');
      if (!id || id===notificationId) window.location.hash=adminHref('Notifications');
      await load(); await refresh();
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove notifications.'); }
    finally { setBusy(false); }
  };
  const savePreferences=async () => {
    if (!prefs) return; setBusy(true); setPrefsError(''); setSaved('');
    try { await adminPut('/admin/notifications/preferences',{ pushCategories:prefs.pushCategories,quietStart:prefs.quietStart,quietEnd:prefs.quietEnd }); setSaved('Notification preferences saved.'); }
    catch(e) { setPrefsError(e instanceof Error ? e.message : 'Could not save preferences.'); }
    finally { setBusy(false); }
  };
  const togglePush=async () => {
    if (!prefs) return; setBusy(true); setPrefsError(''); setSaved('');
    try { if (pushEnabled) { await disableBrowserPush(); setPushEnabled(false); } else if (prefs.publicKey) { await enableBrowserPush(prefs.publicKey); setPushEnabled(true); } }
    catch(e) { setPrefsError(e instanceof Error ? e.message : 'Could not update browser alerts.'); }
    finally { setBusy(false); }
  };
  const recordLink=selected ? notificationRecordHref(selected,role) : null;
  const hours=Array.from({ length:24 },(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>);
  return <div className="min-h-full space-y-6 bg-gray-50/50 p-4 sm:p-8">
    <div className="animate-reveal flex flex-wrap items-center justify-between gap-4 motion-reduce:animate-none">
      <div className="min-w-0">
        <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{role==='admin' ? 'Updates across all barangays.' : 'Updates for your assigned barangay.'} Reading a notification does not resolve its request.</p>
      </div>
      <button type="button" className={button} onClick={()=>setSettingsOpen(value=>!value)} aria-expanded={settingsOpen}><Settings aria-hidden="true" className="h-4 w-4" />Notification settings</button>
    </div>

    {settingsOpen && <section aria-label="Notification settings" className={`${card} animate-reveal p-5 motion-reduce:animate-none sm:p-6`}>
      <h2 className="font-bold text-gray-900 dark:text-white">Browser alerts</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Regular updates stay in your inbox. Browser alerts cover grouped review reminders and system failures. Quiet hours use Philippine time.</p>
      {!prefs && !prefsError && <p role="status" className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading notification settings…</p>}
      {!browserPushSupported() && <p className={`${notice} mt-4`}>Browser alerts are unavailable here. Use a supported browser over HTTPS.</p>}
      {prefs && !prefs.publicKey && <p className={`${notice} mt-4`}>Browser push is awaiting server setup. In-app notifications remain available.</p>}
      {prefs && <>
        <button type="button" disabled={busy || !browserPushSupported() || (!pushEnabled && !prefs.publicKey)} onClick={()=>void togglePush()} className={`${button} mt-4`}>{pushEnabled ? 'Disable alerts on this browser' : 'Enable alerts on this browser'}</button>
        <fieldset className="mt-5 border-t border-gray-100 pt-5 dark:border-gray-800">
          <legend className="float-left mb-3 w-full text-xs font-semibold text-gray-600 dark:text-gray-300">Browser alert categories</legend>
          <div className="clear-both grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">{notificationCategories.filter(value=>!['learning','announcement'].includes(value) && (role==='admin' || value!=='system')).map(value=><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-gray-800 dark:text-gray-200" key={value}><input type="checkbox" className="h-4 w-4 shrink-0 accent-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500" checked={prefs.pushCategories.includes(value)} onChange={e=>setPrefs({ ...prefs,pushCategories:e.target.checked ? [...prefs.pushCategories,value] : prefs.pushCategories.filter(c=>c!==value) })}/>{labels[value]}</label>)}</div>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
          <label className={`${fieldLabel} w-full sm:w-44`}>Quiet hours start<select className={`${field} block w-full`} value={prefs.quietStart ?? ''} onChange={e=>setPrefs({ ...prefs,quietStart:e.target.value==='' ? null : Number(e.target.value),quietEnd:e.target.value==='' ? null : (prefs.quietEnd ?? 7) })}><option value="">Off</option>{hours}</select></label>
          <label className={`${fieldLabel} w-full sm:w-44`}>End<select className={`${field} block w-full`} disabled={prefs.quietStart===null} value={prefs.quietEnd ?? ''} onChange={e=>setPrefs({ ...prefs,quietEnd:Number(e.target.value) })}><option value="">Off</option>{hours}</select></label>
          <button type="button" disabled={busy} onClick={()=>void savePreferences()} className={`${primaryButton} w-full sm:ml-auto sm:w-auto`}>Save preferences</button>
        </div>
      </>}
      {prefsError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{prefsError}</p>}
      {saved && <p role="status" className="mt-4 text-sm font-medium text-emerald-800 dark:text-emerald-300">{saved}</p>}
    </section>}

    {(selected || detailLoading || detailError) && <section aria-label="Notification details" className="animate-reveal rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm motion-reduce:animate-none sm:p-6 dark:border-emerald-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {selected && <RecordIcon recordType={selected.recordType} />}
        <div className="min-w-0 flex-1 basis-48">
          {detailLoading && <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Loading update…</p>}
          {selected && <><h2 className="text-lg font-bold text-gray-900 dark:text-white">{selected.title}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400"><StatusChip status={selected.actionRequired ? selected.resolvedAt ? 'Resolved' : 'Needs action' : 'Update'} /><span>{selected.barangays.join(', ') || 'All barangays'} · {new Date(selected.createdAt).toLocaleString()}</span></p></>}
        </div>
        <a className={`${button} shrink-0`} href={adminHref('Notifications')}><X aria-hidden="true" className="h-4 w-4" />Close details</a>
      </div>
      {detailError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{detailError}</p>}
      {selected && <>
        <p className="mt-4 max-w-3xl break-words text-sm leading-relaxed text-gray-800 dark:text-gray-200">{selected.message}</p>
        {selected.recordType==='id_verification' && role==='admin' && <p className={`${notice} mt-4`}>ID review is handled by the assigned barangay moderator. This update is for oversight; ID documents are not accessible here.</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          {recordLink && <a className={primaryButton} href={recordLink}>Open record</a>}
          <button type="button" disabled={busy} onClick={()=>void remove(selected.id)} className={button}><Trash2 aria-hidden="true" className="h-4 w-4" />Remove</button>
          {selected.recordType==='review_summary' && <button type="button" onClick={()=>{ setCategory(selected.category); setFilter('action'); }} className={button}>View pending requests</button>}
        </div>
        {selected.diagnostics?.length ? <div className="mt-5 overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800"><table className="w-full text-left text-sm"><caption className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Current delivery failures</caption><thead className="border-y border-gray-100 bg-gray-50 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400"><tr><th scope="col" className="px-4 py-2.5 font-semibold">Channel</th><th scope="col" className="px-4 py-2.5 font-semibold">Status</th><th scope="col" className="px-4 py-2.5 font-semibold">Count</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{selected.diagnostics.map(row=><tr key={`${row.channel}:${row.state}`}><td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{row.channel}</td><td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{row.state}</td><td className="px-4 py-2.5 tabular-nums text-gray-900 dark:text-gray-100">{row.count}</td></tr>)}</tbody></table></div> : null}
      </>}
    </section>}

    <div className={`${card} animate-reveal delay-60 flex flex-wrap items-end gap-3 p-4 motion-reduce:animate-none`}>
      <label className={`${fieldLabel} w-full sm:w-44`}>Show<select value={filter} onChange={e=>setFilter(e.target.value)} className={`${field} block w-full`}><option value="all">All</option><option value="unread">Unread</option><option value="action">Needs action</option></select></label>
      <label className={`${fieldLabel} w-full sm:w-56`}>Category<select value={category} onChange={e=>setCategory(e.target.value)} className={`${field} block w-full`}><option value="">All categories</option>{notificationCategories.map(value=><option value={value} key={value}>{labels[value]}</option>)}</select></label>
      <div className="flex w-full flex-wrap gap-3 sm:ml-auto sm:w-auto">
        <button type="button" className={`${button} flex-1 sm:flex-none`} disabled={busy || !page?.unreadCount} onClick={()=>void markRead()}><CheckCheck aria-hidden="true" className="h-4 w-4" />Mark all as read</button>
        <button type="button" className={`${button} flex-1 sm:flex-none`} disabled={loading} onClick={()=>void load()}><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</button>
        {confirmClear
          ? <span role="group" aria-label="Confirm clearing all notifications" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <button type="button" autoFocus disabled={busy} onClick={()=>void remove()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 sm:flex-none dark:focus-visible:ring-offset-gray-900">Clear all for me</button>
              <button type="button" className={`${button} flex-1 sm:flex-none`} onClick={()=>setConfirmClear(false)}>Cancel</button>
            </span>
          : <button type="button" className={`${button} flex-1 sm:flex-none`} disabled={busy || !page?.items.length} onClick={()=>setConfirmClear(true)}><Trash2 aria-hidden="true" className="h-4 w-4" />Clear all</button>}
      </div>
      {confirmClear && <p className="w-full text-xs text-gray-600 dark:text-gray-400">This empties your notification list. Requests still waiting for review stay on their own pages.</p>}
    </div>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error} <button type="button" onClick={()=>void load()} className="ml-2 rounded font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Retry</button></div>}
    {loading && <p role="status" className={`${page?.items.length ? '' : 'rounded-2xl border border-gray-200 p-8 text-center dark:border-gray-800'} text-sm text-gray-500 dark:text-gray-400`}>Loading notifications…</p>}
    {!loading && !error && page?.items.length===0 && <div className={`${card} p-10 text-center`}><Bell aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-gray-400" /><p className="text-sm text-gray-600 dark:text-gray-400">No notifications match this filter.</p></div>}
    {page?.items.length ? <ul className={`${card} animate-reveal delay-160 divide-y divide-gray-100 overflow-hidden motion-reduce:animate-none dark:divide-gray-800`}>{page.items.map(item=><li className={`flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4 sm:px-5 ${!item.isRead ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`} key={item.id}>
      <RecordIcon recordType={item.recordType} unread={!item.isRead} />
      <a className="group min-w-0 flex-1 basis-48 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500" href={adminHref('Notifications',{ notification:item.id })}>
        <p className={`break-words text-sm text-gray-900 group-hover:underline dark:text-white ${item.isRead ? 'font-medium' : 'font-bold'}`}>{!item.isRead && <span role="img" aria-label="Unread" className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-600 align-middle dark:bg-emerald-400" />}{item.title}</p>
        <p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-400">{item.message}</p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{labels[item.category]} · {item.barangays.join(', ') || 'All barangays'} · {new Date(item.createdAt).toLocaleString()}</p>
      </a>
      <div className="flex shrink-0 items-center gap-2">
        <StatusChip status={item.actionRequired ? item.resolvedAt ? 'Resolved' : 'Needs action' : 'Update'} />
        {!item.isRead && <button type="button" disabled={busy} onClick={()=>void markRead(item.id)} className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900/40">Mark as read</button>}
        <button type="button" disabled={busy} onClick={()=>void remove(item.id)} aria-label={`Remove notification: ${item.title}`} title="Remove" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
      </div>
    </li>)}</ul> : null}
    {page?.next && <div className="flex justify-center"><button type="button" disabled={loading} onClick={()=>void load(true,page.next)} className={button}>Load older notifications</button></div>}
  </div>;
}
