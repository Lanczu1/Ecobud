import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { adminHref } from '../../services/adminNotifications';
import { useAdminNotifications } from './AdminNotificationProvider';
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
      <Bell size={28} strokeWidth={1.8} />{unread>0 && <span className="notification-unread-dot" aria-hidden="true" />}
    </button>
    {open && <div id="admin-notifications" aria-label="Notifications" className="notification-dropdown">
      <div className="notification-dropdown-header"><div><h2>Notifications</h2><p>{scopeLabel}</p></div><button data-close type="button" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="notification-close"><X size={18}/></button></div>
      <div className="notification-dropdown-list">
        {error && <div role="alert" className="p-4 text-sm text-red-700 dark:text-red-300">{error} <button type="button" onClick={() => void refresh()} className="underline">Retry</button></div>}
        {!data && !error && <p role="status" className="p-4 text-sm">Loading notifications…</p>}
        {data?.items.length===0 && <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No notifications yet. New updates will appear here.</p>}
        <ul>{data?.items.slice(0,3).map(item => <li key={item.id}><a onClick={() => setOpen(false)} href={adminHref('Notifications',{ notification:item.id })} className="notification-preview"><p className="notification-preview-title">{!item.isRead && <span className="sr-only">Unread: </span>}{item.title}</p><p className="notification-preview-message">{item.message}</p></a></li>)}</ul>
      </div>
      <a href={adminHref('Notifications')} onClick={() => setOpen(false)} className="notification-view-all">View all notifications</a>
    </div>}
  </div>;
}
