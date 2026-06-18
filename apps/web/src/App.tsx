import { useState, useEffect } from 'react';
import { WebAuthView } from './components/WebAuthView';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminSection } from './components/admin/AdminSidebar';
import { Dashboard } from './components/admin/Dashboard';
import { ManageUsers } from './components/admin/pages/ManageUsers';
import { LearningContent } from './components/admin/pages/LearningContent';
import { Challenges } from './components/admin/pages/Challenges';
import { DailyQuests } from './components/admin/pages/DailyQuests';
import { Events } from './components/admin/pages/Events';
import { Vendors } from './components/admin/pages/Vendors';
import { SwapGoods } from './components/admin/pages/SwapGoods';
import { Reports } from './components/admin/pages/Reports';
import { Submissions } from './components/admin/pages/Submissions';
import { AuditLogs } from './components/admin/pages/AuditLogs';

function renderSection(section: AdminSection) {
  switch (section) {
    case 'Dashboard':        return <Dashboard />;
    case 'Users':            return <ManageUsers />;
    case 'Learning Content': return <LearningContent />;
    case 'Challenges':       return <Challenges />;
    case 'Daily Quests':     return <DailyQuests />;
    case 'Events':           return <Events />;
    case 'Vendors':          return <Vendors />;
    case 'Swap Goods':       return <SwapGoods />;
    case 'Reports':          return <Reports />;
    case 'Submissions':      return <Submissions />;
    case 'Audit Logs':       return <AuditLogs />;
    default:                 return <Dashboard />;
  }
}

export default function App() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!(localStorage.getItem('ecobud_admin_token') && localStorage.getItem('ecobud_admin_authenticated') === 'true');
  });
  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    const userJson = localStorage.getItem('ecobud_admin_user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.role === 'moderator') {
          return 'Submissions';
        }
      } catch (e) {}
    }
    return 'Dashboard';
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('ecobud_dark_mode') === 'true';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ecobud_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ecobud_dark_mode', 'false');
    }
  }, [isDark]);

  useEffect(() => {
    if (isAuthenticated) {
      document.title = `Ecobud Admin — ${activeSection}`;
    } else {
      document.title = 'Ecobud';
    }
  }, [isAuthenticated, activeSection]);

  const handleLogin = async (email: string, pass: string) => {
    setAuthError(null);
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.message || 'Login failed. Please try again.';
      setAuthError(msg);
      throw new Error(msg);
    }

    if (data.user.role !== 'admin' && data.user.role !== 'moderator') {
      const msg = 'Access denied. Admin or moderator role required.';
      setAuthError(msg);
      throw new Error(msg);
    }

    localStorage.setItem('ecobud_admin_token', data.token);
    localStorage.setItem('ecobud_admin_user', JSON.stringify(data.user));
    localStorage.setItem('ecobud_admin_authenticated', 'true');
    setIsAuthenticated(true);
    setActiveSection(data.user.role === 'moderator' ? 'Submissions' : 'Dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('ecobud_admin_token');
    localStorage.removeItem('ecobud_admin_user');
    localStorage.removeItem('ecobud_admin_authenticated');
  };

  const toggleDarkMode = () => {
    setIsDark(prev => !prev);
  };

  if (isAuthenticated) {
    return (
      <AdminLayout
        onLogout={handleLogout}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        isDark={isDark}
        onToggleDark={toggleDarkMode}
      >
        {renderSection(activeSection)}
      </AdminLayout>
    );
  }

  return (
    <WebAuthView
      onLogin={handleLogin}
      authError={authError}
      isDark={isDark}
      onToggleDark={toggleDarkMode}
    />
  );
}
