import { ReactNode } from 'react';
import { AdminSidebar, AdminSection } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

interface AdminLayoutProps {
  children: ReactNode;
  onLogout: () => void;
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export function AdminLayout({ children, onLogout, activeSection, onNavigate, isDark, onToggleDark }: AdminLayoutProps) {

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden animate-fade-in">
      <AdminSidebar onLogout={onLogout} activeSection={activeSection} onNavigate={onNavigate} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader activeSection={activeSection} isDark={isDark} onToggleDark={onToggleDark} />
        <main className="flex-1 overflow-hidden relative">
          <div id="admin-scroll-container" key={activeSection} className="animate-reveal absolute inset-0 overflow-y-auto overflow-x-hidden">
            <div className="min-h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
