import { useCallback, useEffect, useRef, useState } from 'react';
import { adminGet, adminPatch, adminPut } from '../../../utils/adminApi';
import { adminHref, browserPushEnabled, browserPushSupported, disableBrowserPush, enableBrowserPush, fetchNotificationPage,
  notificationCategories, notificationRecordHref, type AdminNotification, type NotificationCategory, type NotificationPage, type NotificationPreferences } from '../../../services/adminNotifications';
import { useAdminNotifications } from '../AdminNotificationProvider';

const control='rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
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
  return <div className="p-4 text-gray-900 sm:p-8 dark:text-gray-100">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Notifications</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{role==='admin' ? 'Updates across all barangays.' : 'Updates for your assigned barangay.'} Reading a notification does not resolve its request.</p></div><button type="button" className={control} onClick={()=>setSettingsOpen(value=>!value)} aria-expanded={settingsOpen}>Notification settings</button></div>
    {settingsOpen && <section aria-label="Notification settings" className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <h2 className="font-semibold">Browser alerts</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Regular updates stay in your inbox. Browser alerts cover grouped review reminders and system failures. Quiet hours use Philippine time.</p>
      {!prefs && !prefsError && <p role="status" className="mt-3 text-sm">Loading notification settings…</p>}
      {!browserPushSupported() && <p className="mt-3 text-sm">Browser alerts are unavailable here. Use a supported browser over HTTPS.</p>}
      {prefs && !prefs.publicKey && <p className="mt-3 text-sm">Browser push is awaiting server setup. In-app notifications remain available.</p>}
      {prefs && <><button type="button" disabled={busy || !browserPushSupported() || (!pushEnabled && !prefs.publicKey)} onClick={()=>void togglePush()} className={`${control} my-4 disabled:opacity-50`}>{pushEnabled ? 'Disable alerts on this browser' : 'Enable alerts on this browser'}</button>
        <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 text-sm font-medium">Browser alert categories</legend>{notificationCategories.filter(value=>!['learning','announcement'].includes(value) && (role==='admin' || value!=='system')).map(value=><label className="flex items-center gap-2 text-sm" key={value}><input type="checkbox" checked={prefs.pushCategories.includes(value)} onChange={e=>setPrefs({ ...prefs,pushCategories:e.target.checked ? [...prefs.pushCategories,value] : prefs.pushCategories.filter(c=>c!==value) })}/>{labels[value]}</label>)}</fieldset>
        <div className="my-4 flex flex-wrap items-end gap-3"><label className="text-sm">Quiet hours start<select className={`${control} ml-2`} value={prefs.quietStart ?? ''} onChange={e=>setPrefs({ ...prefs,quietStart:e.target.value==='' ? null : Number(e.target.value),quietEnd:e.target.value==='' ? null : (prefs.quietEnd ?? 7) })}><option value="">Off</option>{Array.from({ length:24 },(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}</select></label><label className="text-sm">End<select className={`${control} ml-2`} disabled={prefs.quietStart===null} value={prefs.quietEnd ?? ''} onChange={e=>setPrefs({ ...prefs,quietEnd:Number(e.target.value) })}><option value="">Off</option>{Array.from({ length:24 },(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}</select></label></div>
        <button type="button" disabled={busy} onClick={()=>void savePreferences()} className={`${control} disabled:opacity-50`}>Save preferences</button></>}
      {prefsError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{prefsError}</p>}{saved && <p role="status" className="mt-3 text-sm text-emerald-800 dark:text-emerald-300">{saved}</p>}
    </section>}
    {(selected || detailLoading || detailError) && <section aria-label="Notification details" className="mb-6 rounded-xl border border-emerald-200 bg-white p-5 dark:border-emerald-800 dark:bg-gray-900">
      <a className="text-sm text-emerald-800 underline dark:text-emerald-300" href={adminHref('Notifications')}>Close details</a>
      {detailLoading && <p role="status" className="mt-3 text-sm">Loading update…</p>}{detailError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{detailError}</p>}
      {selected && <><h2 className="mt-3 font-semibold">{selected.title}</h2><p className="mt-2 text-sm">{selected.message}</p><p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{selected.barangays.join(', ') || 'All barangays'} · {new Date(selected.createdAt).toLocaleString()} · {selected.actionRequired ? selected.resolvedAt ? 'Resolved' : 'Needs action' : 'Update'}</p>
        {recordLink && <a className="mt-4 inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" href={recordLink}>Open record</a>}
        {selected.recordType==='id_verification' && role==='admin' && <p className="mt-3 text-sm">ID review is handled by the assigned barangay moderator. This update is for oversight; ID documents are not accessible here.</p>}
        {selected.recordType==='review_summary' && <button type="button" onClick={()=>{ setCategory(selected.category); setFilter('action'); }} className={`${control} mt-3`}>View pending requests</button>}
        {selected.diagnostics?.length ? <table className="mt-4 text-left text-sm"><caption className="mb-2 text-left">Current delivery failures</caption><thead><tr><th className="pr-6">Channel</th><th className="pr-6">Status</th><th>Count</th></tr></thead><tbody>{selected.diagnostics.map(row=><tr key={`${row.channel}:${row.state}`}><td className="pr-6 py-1">{row.channel}</td><td className="pr-6">{row.state}</td><td>{row.count}</td></tr>)}</tbody></table> : null}
      </>}
    </section>}
    <div className="mb-4 flex flex-wrap items-center gap-3"><label className="text-sm">Show<select value={filter} onChange={e=>setFilter(e.target.value)} className={`${control} ml-2`}><option value="all">All</option><option value="unread">Unread</option><option value="action">Needs action</option></select></label><label className="text-sm">Category<select value={category} onChange={e=>setCategory(e.target.value)} className={`${control} ml-2`}><option value="">All categories</option>{notificationCategories.map(value=><option value={value} key={value}>{labels[value]}</option>)}</select></label><button type="button" className={`${control} disabled:opacity-50`} disabled={busy || !page?.unreadCount} onClick={()=>void markRead()}>Mark all as read</button><button type="button" className={control} disabled={loading} onClick={()=>void load()}>Refresh</button></div>
    {error && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{error} <button type="button" onClick={()=>void load()} className="underline">Retry</button></p>}
    {loading && <p role="status" className="mb-4 text-sm">Loading notifications…</p>}
    {!loading && !error && page?.items.length===0 && <p className="rounded-xl border border-gray-200 p-8 text-center text-sm dark:border-gray-700">No notifications match this filter.</p>}
    <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-900">{page?.items.map(item=><li className={`flex flex-wrap items-start gap-3 p-4 ${!item.isRead ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`} key={item.id}>
      <a className="min-w-0 flex-1 rounded focus-visible:outline-2 focus-visible:outline-emerald-600" href={adminHref('Notifications',{ notification:item.id })}><p className="font-medium">{!item.isRead && <span aria-label="Unread" className="mr-2 text-emerald-700 dark:text-emerald-400">●</span>}{item.title}</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.message}</p><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{labels[item.category]} · {item.barangays.join(', ') || 'All barangays'} · {new Date(item.createdAt).toLocaleString()}</p></a>
      <div className="flex items-center gap-3 text-xs"><span>{item.actionRequired ? item.resolvedAt ? 'Resolved' : 'Needs action' : 'Update'}</span>{!item.isRead && <button type="button" disabled={busy} onClick={()=>void markRead(item.id)} className="rounded p-2 text-emerald-800 underline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300">Mark as read</button>}</div>
    </li>)}</ul>
    {page?.next && <button type="button" disabled={loading} onClick={()=>void load(true,page.next)} className={`${control} mt-4`}>Load older notifications</button>}
  </div>;
}
