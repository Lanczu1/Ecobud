import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, UserCog, Bell, X } from 'lucide-react';
import { AdminSection } from './AdminSidebar';

interface AdminHeaderProps {
  activeSection?: AdminSection;
  isDark: boolean;
  onToggleDark: () => void;
}

export function AdminHeader({ isDark, onToggleDark }: AdminHeaderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        notificationButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Fallback polling for DevTools network throttling which sometimes misses events
    const interval = setInterval(() => {
      if (navigator.onLine !== isOnline) {
        setIsOnline(navigator.onLine);
      }
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline]);

  const userJson = localStorage.getItem('ecobud_admin_user');
  const user = userJson ? JSON.parse(userJson) : null;
  const displayName = user?.profile?.displayName || user?.name || (user?.role === 'moderator' ? 'Moderator' : 'Admin');
  const userCity = user?.city || user?.profile?.city;
  const roleName = user?.role === 'moderator' 
    ? (userCity ? `Moderator — Brgy. ${userCity}` : 'Community Moderator') 
    : 'Administrator';

  return (
    <div className="h-20 bg-white border-b border-gray-100 flex items-center justify-end px-8">
      <div className="flex items-center gap-6">
        <button
          onClick={onToggleDark}
          className="inline-flex h-8 w-8 items-center justify-center text-gray-400 hover:text-gray-600 transition-colors relative"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>

        <div className="relative flex items-center" ref={notificationRef}>
          <button
            ref={notificationButtonRef}
            type="button"
            onClick={() => setNotificationsOpen(open => !open)}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-controls="admin-notifications"
            title="Notifications"
            className="relative inline-flex h-8 w-8 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-4"
          >
            <Bell className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-600 border-2 border-white dark:border-gray-900" />
          </button>
          {notificationsOpen && (
            <div id="admin-notifications" aria-label="Notifications" className="absolute right-0 top-full mt-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg text-gray-900 dark:text-gray-100">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h2 className="text-sm font-semibold">Notifications</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sample notifications</p>
                </div>
                <button type="button" aria-label="Close notifications" onClick={() => { setNotificationsOpen(false); notificationButtonRef.current?.focus(); }} className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-emerald-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  { title: 'New announcement', message: 'A community announcement is ready to view.' },
                  { title: 'Listing awaiting review', message: 'A Give & Get listing has been submitted for approval.' },
                  { title: 'Challenge submission', message: 'A challenge entry is awaiting review.' },
                ].map(notification => (
                  <li key={notification.title} className="px-4 py-3">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{notification.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            <p className="text-xs text-gray-500">{roleName}</p>
          </div>
          <div className="relative w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm border border-gray-200">
            <UserCog className="w-6 h-6" />
            {isOnline ? (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" title="Online" />
            ) : (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" title="Offline" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
