import { ReactNode, useEffect, useRef } from 'react';
import { AdminSidebar, AdminSection } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { adminPost } from '../../utils/adminApi';

interface AdminLayoutProps {
  children: ReactNode;
  onLogout: () => void;
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export function AdminLayout({ children, onLogout, activeSection, onNavigate, isDark, onToggleDark }: AdminLayoutProps) {
  const sessionIdRef = useRef(`admin-web-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    
    const sendHeartbeat = () => {
      adminPost('/realtime/presence/heartbeat', {
        sessionId,
        appState: 'active',
        connectionState: navigator.onLine ? 'online' : 'offline'
      }).catch(console.error);
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    return () => {
      clearInterval(interval);
      adminPost('/realtime/presence/disconnect', {
        sessionId,
        appState: 'inactive',
        connectionState: 'offline'
      }).catch(console.error);
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden animate-fade-in">
      <AdminSidebar onLogout={onLogout} activeSection={activeSection} onNavigate={onNavigate} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader activeSection={activeSection} isDark={isDark} onToggleDark={onToggleDark} />
        <main className="flex-1 overflow-hidden relative">
          <div key={activeSection} className="animate-reveal absolute inset-0 overflow-y-auto overflow-x-hidden">
            <div className="min-h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
