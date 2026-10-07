import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchNotificationPage, restoreBrowserPush, type NotificationPage } from '../../services/adminNotifications';

const Context = createContext<{ data: NotificationPage | null; error: string; refresh: () => Promise<void> } | null>(null);
export function AdminNotificationProvider({ children, enabled=true }: { children: ReactNode; enabled?: boolean }) {
  const [data,setData]=useState<NotificationPage | null>(null);
  const [error,setError]=useState('');
  const inFlight=useRef(false);
  const mounted=useRef(false);
  const refresh=useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current=true;
    try { const result=await fetchNotificationPage(); if (mounted.current) { setData(result); setError(''); } }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not load notifications.'); }
    finally { inFlight.current=false; }
  },[enabled]);
  useEffect(() => {
    if (!enabled) return;
    mounted.current=true;
    void refresh(); void restoreBrowserPush().catch(() => {});
    const update=() => { if (document.visibilityState==='visible' && navigator.onLine) void refresh(); };
    const timer=setInterval(update,30000);
    window.addEventListener('focus',update); window.addEventListener('online',update); document.addEventListener('visibilitychange',update);
    return () => { mounted.current=false; clearInterval(timer); window.removeEventListener('focus',update); window.removeEventListener('online',update); document.removeEventListener('visibilitychange',update); };
  },[refresh,enabled]);
  return <Context.Provider value={{ data,error,refresh }}>{children}</Context.Provider>;
}
export function useAdminNotifications() {
  const value=useContext(Context);
  if (!value) throw new Error('Notification provider is missing.');
  return value;
}
