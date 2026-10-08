import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { adminHref } from '../../services/adminNotifications';
import { useAdminNotifications } from './AdminNotificationProvider';
import { RecordIcon, StatusChip, notificationCategoryLabels, notificationStatus } from './notificationParts';
import './NotificationBell.css';

export function NotificationBell({ scopeLabel }: { scopeLabel: string }) {
  const { data,error,refresh }=useAdminNotifications();
  const [open,setOpen]=useState(false);
  const container=useRef<HTMLDivElement>(null); const trigger=useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    container.current?.querySelector<HTMLElement>('[data-close]')?.focus();
    const outside=(e:PointerEvent) => { if (!container.current?.contains(e.target as Node)) setOpen(false); };
    const keyboard=(e:KeyboardEvent) => { if (e.key==='Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown',outside); document.addEventListener('keydown',keyboard);
    return () => { document.removeEventListener('pointerdown',outside); document.removeEventListener('keydown',keyboard); };
  },[open]);
  const unread=data?.unreadCount ?? 0;
  return <div className="relative" ref={container}>
    <button ref={trigger} type="button" onClick={() => { setOpen(v=>!v); void refresh(); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-controls="admin-notifications" className="notification-trigger">
      <Bell size={20} strokeWidth={1.8} />{unread>0 && <span className="notification-unread-dot" aria-hidden="true" />}
    </button>
    {open && <div id="admin-notifications" aria-label="Notifications" className="notification-dropdown">
      <div className="notification-dropdown-header"><div><h2>Notifications</h2><p>{scopeLabel}</p></div><button data-close type="button" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="notification-close"><X size={16}/></button></div>
      <div className="notification-dropdown-list">
        {error && <div role="alert" className="p-4 text-sm text-red-700 dark:text-red-300">{error} <button type="button" onClick={() => void refresh()} className="underline">Retry</button></div>}
        {!data && !error && <p role="status" className="p-4 text-sm">Loading notifications…</p>}
        {data?.items.length===0 && <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No notifications yet. New updates will appear here.</p>}
        <ul>{data?.items.slice(0,3).map(item => <li key={item.id} className={!item.isRead ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}><a onClick={() => setOpen(false)} href={adminHref('Notifications',{ notification:item.id })} className="notification-preview">
          <RecordIcon recordType={item.recordType} unread={!item.isRead} />
          <span className="min-w-0 flex-1">
            <span className={`block text-sm text-gray-900 dark:text-white ${item.isRead ? 'font-medium' : 'font-bold'}`}>{!item.isRead && <span role="img" aria-label="Unread" className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-600 align-middle dark:bg-emerald-400" />}{item.title}</span>
            <span className="mt-0.5 block text-sm text-gray-600 dark:text-gray-400">{item.message}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400"><StatusChip status={notificationStatus(item)} />{notificationCategoryLabels[item.category]} · {new Date(item.createdAt).toLocaleString()}</span>
          </span>
        </a></li>)}</ul>
      </div>
      <a href={adminHref('Notifications')} onClick={() => setOpen(false)} className="notification-view-all">View all notifications</a>
    </div>}
  </div>;
}
