import { useState, useEffect } from 'react';
import { Activity, Sun, Moon, UserCog } from 'lucide-react';
import { AdminSection } from './AdminSidebar';

interface AdminHeaderProps {
  activeSection?: AdminSection;
  isDark: boolean;
  onToggleDark: () => void;
}

export function AdminHeader({ isDark, onToggleDark }: AdminHeaderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
  const roleName = user?.role === 'moderator' ? 'Community Moderator' : 'Administrator';

  return (
    <div className="h-20 bg-white border-b border-gray-100 flex items-center justify-end px-8">
      <div className="flex items-center gap-6">
        <button
          onClick={onToggleDark}
          className="text-gray-400 hover:text-gray-600 transition-colors relative"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>

        <button className="text-gray-400 hover:text-gray-600 transition-colors relative group">
          <Activity className="w-6 h-6 animate-shake-bell" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white translate-x-1 -translate-y-1"></span>
        </button>

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
