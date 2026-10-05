import { useEffect, useState } from 'react';
import { Sun, Moon, UserCog } from 'lucide-react';
import type { AdminSection } from './AdminSidebar';
import { NotificationBell } from './NotificationBell';

interface AdminHeaderProps {
  activeSection?: AdminSection;
  isDark: boolean;
  onToggleDark: () => void;
}
export function AdminHeader({ isDark,onToggleDark }: AdminHeaderProps) {
  const [isOnline,setIsOnline]=useState(navigator.onLine);
  useEffect(() => {
    const update=() => setIsOnline(navigator.onLine);
    window.addEventListener('online',update); window.addEventListener('offline',update);
    const timer=setInterval(update,1000);
    return () => { window.removeEventListener('online',update); window.removeEventListener('offline',update); clearInterval(timer); };
  },[]);
  let user;
  try { user=JSON.parse(localStorage.getItem('ecobud_admin_user') || 'null'); } catch { user=null; }
  const name=user?.profile?.displayName || user?.name || (user?.role==='moderator' ? 'Moderator' : 'Admin');
  const city=user?.city || user?.profile?.city;
  const role=user?.role==='moderator' ? city ? `Moderator · Brgy. ${city}` : 'Community Moderator' : 'Administrator';
  return <header className="flex h-20 shrink-0 items-center justify-end border-b border-gray-100 bg-white px-4 sm:px-8 dark:border-gray-800 dark:bg-gray-900">
    <div className="flex items-center gap-4 sm:gap-6">
      <button type="button" onClick={onToggleDark} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="rounded p-1 text-gray-500 dark:text-gray-300 focus-visible:outline-2 focus-visible:outline-emerald-600">{isDark ? <Sun size={20}/> : <Moon size={20}/>}</button>
      <NotificationBell scopeLabel={user?.role==='moderator' ? city ? `Updates for Brgy. ${city}` : 'No barangay assigned' : 'Updates across all barangays'}/>
      <div className="flex items-center gap-3 border-l border-gray-100 pl-4 dark:border-gray-700"><div className="text-right"><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{role}</p></div><div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"><UserCog size={24}/><span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} title={isOnline ? 'Online' : 'Offline'}/></div></div>
    </div>
  </header>;
}
