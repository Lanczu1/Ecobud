import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAdminLiveRefresh } from '../../hooks/useAdminLiveRefresh';
import { useToast } from '../../context/ToastContext';
import { fetchNotificationPage, restoreBrowserPush, type NotificationPage } from '../../services/adminNotifications';

const submissionAlerts: Record<string,[string,string]> = {
  id_verification: ['New ID verification submitted.','new ID verifications submitted.'],
  challenge_submission: ['New challenge proof submitted.','new challenge proofs submitted.'],
  listing: ['New Give & Get listing posted.','new Give & Get listings posted.'],
};

const Context = createContext<{ data: NotificationPage | null; error: string; refresh: () => Promise<void> } | null>(null);
export function AdminNotificationProvider({ children, enabled=true }: { children: ReactNode; enabled?: boolean }) {
  const [data,setData]=useState<NotificationPage | null>(null);
  const [error,setError]=useState('');
  const inFlight=useRef(false);
  const mounted=useRef(false);
  const { success: showAlert }=useToast();
  const seen=useRef<Set<string> | null>(null);
  const newestSeen=useRef(0);
  // Alerts ride on the same response that updates the bell, so both appear together.
  const announce=useCallback((page: NotificationPage) => {
    const first=seen.current===null;
    const known=seen.current ?? new Set<string>();
    const fresh: Record<string,number>={};
    let newest=newestSeen.current;
    for (const item of page.items) {
      const at=Date.parse(item.createdAt) || 0;
      // Older items can slide onto the first page after a dismissal; those are not new.
      if (!first && !known.has(item.id) && at>=newestSeen.current && item.actionRequired && !item.resolvedAt && submissionAlerts[item.recordType])
        fresh[item.recordType]=(fresh[item.recordType] ?? 0)+1;
      known.add(item.id); newest=Math.max(newest,at);
    }
    seen.current=known; newestSeen.current=newest;
    for (const [kind,count] of Object.entries(fresh)) showAlert(count===1 ? submissionAlerts[kind][0] : `${count} ${submissionAlerts[kind][1]}`);
  },[showAlert]);
  const refresh=useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current=true;
    try { const result=await fetchNotificationPage(); if (mounted.current) { setData(result); setError(''); announce(result); } }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not load notifications.'); }
    finally { inFlight.current=false; }
  },[enabled,announce]);
  useEffect(() => {
    if (!enabled) return;
    mounted.current=true;
    void refresh(); void restoreBrowserPush().catch(() => {});
    const update=() => { if (document.visibilityState==='visible' && navigator.onLine) void refresh(); };
    const timer=setInterval(update,30000);
    window.addEventListener('focus',update); window.addEventListener('online',update); document.addEventListener('visibilitychange',update);
    return () => { mounted.current=false; clearInterval(timer); window.removeEventListener('focus',update); window.removeEventListener('online',update); document.removeEventListener('visibilitychange',update); };
  },[refresh,enabled]);
  useAdminLiveRefresh(() => { if (navigator.onLine) void refresh(); },enabled);
  return <Context.Provider value={{ data,error,refresh }}>{children}</Context.Provider>;
}
export function useAdminNotifications() {
  const value=useContext(Context);
  if (!value) throw new Error('Notification provider is missing.');
  return value;
}
