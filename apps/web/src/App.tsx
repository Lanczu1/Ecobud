import { useState, useEffect } from 'react';
import { API_HOST } from './utils/adminApi';
import { WebAuthView } from './components/WebAuthView';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminSection } from './components/admin/AdminSidebar';
import { Dashboard } from './components/admin/Dashboard';
import { ManageUsers } from './components/admin/pages/ManageUsers';
import { LearningContent } from './components/admin/pages/LearningContent';
import { Challenges } from './components/admin/pages/Challenges';

import { Events } from './components/admin/pages/Events';

import { GiveAndGetHub } from './components/admin/pages/GiveAndGetHub';
import { Redeem } from './components/admin/pages/Redeem';
import { Reports } from './components/admin/pages/Reports';

function renderSection(section: AdminSection) {
  switch (section) {
    case 'Dashboard':        return <Dashboard />;
    case 'Users':            return <ManageUsers />;
    case 'Learning Content': return <LearningContent />;
    case 'Challenges':       return <Challenges />;

    case 'Events':           return <Events />;

    case 'Give and Get Hub': return <GiveAndGetHub />;
    case 'Redeem':          return <Redeem />;
    case 'Reports':          return <Reports />;
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
          return 'Challenges';
        }
      } catch (e) {
        // ignore parse error
      }
    }
    return 'Dashboard';
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('ecobud_dark_mode') === 'true';
  });

  useEffect(() => {
    // Temporarily suppress all transitions so all elements switch theme simultaneously in one instant pass
    const css = document.createElement('style');
    css.type = 'text/css';
    css.appendChild(
      document.createTextNode(
        `*, *::before, *::after {
          -webkit-transition: none !important;
          -moz-transition: none !important;
          -o-transition: none !important;
          -ms-transition: none !important;
          transition: none !important;
        }`
      )
    );
    document.head.appendChild(css);

    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ecobud_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ecobud_dark_mode', 'false');
    }

    // Force DOM reflow to apply colors immediately
    void window.getComputedStyle(document.body);

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (document.head.contains(css)) {
          document.head.removeChild(css);
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      if (document.head.contains(css)) {
        document.head.removeChild(css);
      }
    };
  }, [isDark]);

  useEffect(() => {
    if (isAuthenticated) {
      document.title = `Ecobud Admin — ${activeSection}`;
    } else {
      document.title = 'Ecobud Admin';
    }
  }, [isAuthenticated, activeSection]);

  const handleLogin = async (email: string, pass: string) => {
    setAuthError(null);
    const res = await fetch(`${API_HOST}/api/auth/login`, {
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
    setActiveSection(data.user.role === 'moderator' ? 'Challenges' : 'Dashboard');
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
