import { useState, useEffect, lazy, Suspense } from 'react';
import { API_HOST } from './utils/adminApi';
import { WebAuthView } from './components/WebAuthView';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminSection } from './components/admin/AdminSidebar';
import { ToastProvider } from './context/ToastContext';
import { AdminNotificationProvider } from './components/admin/AdminNotificationProvider';
import { adminHref, revokeAdminPushSession } from './services/adminNotifications';

const WEB_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const WEB_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const WEB_SESSION_STARTED_KEY = 'ecobud_admin_session_started_at';
const WEB_LAST_ACTIVITY_KEY = 'ecobud_admin_last_activity_at';

function clearStoredAdminSession() {
  if (localStorage.getItem('ecobud_admin_token')) void revokeAdminPushSession().catch(() => {});
  localStorage.removeItem('ecobud_admin_token');
  localStorage.removeItem('ecobud_admin_user');
  localStorage.removeItem('ecobud_admin_authenticated');
  localStorage.removeItem(WEB_SESSION_STARTED_KEY);
  localStorage.removeItem(WEB_LAST_ACTIVITY_KEY);
}

function hasValidStoredAdminSession(): boolean {
  const now = Date.now();
  const startedAt = Number(localStorage.getItem(WEB_SESSION_STARTED_KEY));
  const lastActivityAt = Number(localStorage.getItem(WEB_LAST_ACTIVITY_KEY));
  const hasCredentials = Boolean(localStorage.getItem('ecobud_admin_token') && localStorage.getItem('ecobud_admin_authenticated') === 'true');
  if (!hasCredentials || !startedAt || !lastActivityAt || now - startedAt >= WEB_ABSOLUTE_TIMEOUT_MS || now - lastActivityAt >= WEB_IDLE_TIMEOUT_MS) {
    clearStoredAdminSession();
    return false;
  }
  return true;
}

const Dashboard = lazy(() => import('./components/admin/Dashboard').then((m) => ({ default: m.Dashboard })));
const IdVerification = lazy(() => import('./components/admin/pages/IdVerification').then(m => ({ default: m.IdVerification })));
const Notifications = lazy(() => import('./components/admin/pages/Notifications').then(m => ({ default: m.Notifications })));
const ManageUsers = lazy(() => import('./components/admin/pages/ManageUsers').then((m) => ({ default: m.ManageUsers })));
const UserActivityTransactions = lazy(() => import('./components/admin/pages/UserActivityTransactions').then(m => ({ default: m.UserActivityTransactions })));
const LearningContent = lazy(() => import('./components/admin/pages/LearningContent').then((m) => ({ default: m.LearningContent })));
const Challenges = lazy(() => import('./components/admin/pages/Challenges').then((m) => ({ default: m.Challenges })));
const Events = lazy(() => import('./components/admin/pages/Events').then((m) => ({ default: m.Events })));
const GiveAndGetHub = lazy(() => import('./components/admin/pages/GiveAndGetHub').then((m) => ({ default: m.GiveAndGetHub })));
const Redeem = lazy(() => import('./components/admin/pages/Redeem').then((m) => ({ default: m.Redeem })));
const Reports = lazy(() => import('./components/admin/pages/Reports').then((m) => ({ default: m.Reports })));
const BarangayReports = lazy(() => import('./components/admin/pages/BarangayReports').then((m) => ({ default: m.Reports })));
const Announcements = lazy(() => import('./components/admin/pages/Announcements').then((m) => ({ default: m.Announcements })));

function SectionFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-80 w-full py-12">
      <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 tracking-wide uppercase">
        Loading module...
      </span>
    </div>
  );
}

const Badges = lazy(() => import('./components/admin/pages/Badges').then((m) => ({ default: m.Badges })));

function renderSection(section: AdminSection, role?: string) {
  const accessibleSection = role === 'moderator' && ['Learning Content', 'Badges'].includes(section)
    ? 'Challenges'
    : section;

  return (
    <Suspense fallback={<SectionFallback />}>
      {(() => {
        switch (accessibleSection) {
          case 'Dashboard':        return <Dashboard />;
          case 'Notifications':    return <Notifications />;
          case 'ID Verification': return role === 'moderator' ? <IdVerification /> : <Dashboard />;
          case 'Users':            return <ManageUsers />;
          case 'User Activity & Transactions': return role === 'admin' ? <UserActivityTransactions /> : <Challenges />;
          case 'Learning Content': return <LearningContent />;
          case 'Challenges':       return <Challenges />;
          case 'Badges':           return <Badges />;
          case 'Events':           return <Events />;
          case 'Give and Get Hub': return role === 'moderator' ? <GiveAndGetHub /> : <Dashboard />;
          case 'Redeem':          return <Redeem />;
          case 'Reports':          return role === 'moderator' ? <BarangayReports role="moderator" /> : <Reports />;
          case 'Announcements':    return <Announcements />;
          default:                 return <Dashboard />;
        }
      })()}
    </Suspense>
  );
}

export default function App() {
  const [routeHash,setRouteHash]=useState(window.location.hash);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return hasValidStoredAdminSession();
  });
  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    const userJson = localStorage.getItem('ecobud_admin_user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.role === 'moderator') {
          return 'Announcements';
        }
      } catch (e) {
        // ignore parse error
      }
    }
    return 'Dashboard';
  });
  const adminUserRole = (() => {
    try {
      return JSON.parse(localStorage.getItem('ecobud_admin_user') || 'null')?.role as string | undefined;
    } catch {
      return undefined;
    }
  })();
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('ecobud_dark_mode') === 'true';
  });

  useEffect(() => {
    const update=() => setRouteHash(window.location.hash);
    window.addEventListener('hashchange',update);
    return () => window.removeEventListener('hashchange',update);
  },[]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const section=new URLSearchParams(routeHash.split('?')[1] || '').get('section');
    const allowed: AdminSection[]=['Dashboard','Announcements','Notifications','ID Verification','Users','Learning Content','Challenges','Badges','Events','Give and Get Hub','Redeem','User Activity & Transactions','Reports'];
    if ((section === 'Give and Get Hub' || section === 'Notifications') && adminUserRole !== 'moderator') {
      setActiveSection('Dashboard');
      window.location.hash = adminHref('Dashboard');
    } else if (allowed.includes(section as AdminSection)) setActiveSection(section as AdminSection);
  },[routeHash,isAuthenticated,adminUserRole]);

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

  useEffect(() => {
    if (!isAuthenticated) return;
    let lastWrite = 0;
    const recordActivity = () => {
      const now = Date.now();
      if (now - lastWrite >= 30_000) {
        localStorage.setItem(WEB_LAST_ACTIVITY_KEY, String(now));
        lastWrite = now;
      }
    };
    const enforceTimeout = () => {
      const now = Date.now();
      const startedAt = Number(localStorage.getItem(WEB_SESSION_STARTED_KEY));
      const lastActivityAt = Number(localStorage.getItem(WEB_LAST_ACTIVITY_KEY));
      if (!startedAt || !lastActivityAt || now - startedAt >= WEB_ABSOLUTE_TIMEOUT_MS || now - lastActivityAt >= WEB_IDLE_TIMEOUT_MS) {
        clearStoredAdminSession();
        setIsAuthenticated(false);
        setAuthError('Your session expired. Please sign in again.');
      }
    };
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => window.addEventListener(event, recordActivity, { passive: true }));
    const timer = window.setInterval(enforceTimeout, 30_000);
    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, recordActivity));
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);

  const handleLogin = async (email: string, pass: string) => {
    setAuthError(null);
    const res = await fetch(`${API_HOST}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, clientType: 'web' }),
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
    const signedInAt = Date.now();
    localStorage.setItem(WEB_SESSION_STARTED_KEY, String(signedInAt));
    localStorage.setItem(WEB_LAST_ACTIVITY_KEY, String(signedInAt));
    setIsAuthenticated(true);
    setActiveSection(data.user.role === 'moderator' ? 'Announcements' : 'Dashboard');
  };

  const handleLogout = () => {
    clearStoredAdminSession();
    setIsAuthenticated(false);
    window.location.hash='';
  };

  const toggleDarkMode = () => {
    setIsDark(prev => !prev);
  };

  if (isAuthenticated) {
    return (
      <ToastProvider>
        <AdminNotificationProvider enabled={adminUserRole === 'moderator'}>
        <AdminLayout
          onLogout={handleLogout}
          activeSection={activeSection}
          onNavigate={section => { window.location.hash=adminHref(section); setActiveSection(section); }}
          isDark={isDark}
          onToggleDark={toggleDarkMode}
        >
          <div key={activeSection==='Notifications' ? 'notifications' : routeHash}>
            {new URLSearchParams(routeHash.split('?')[1] || '').has('record') && <div className="m-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Showing the linked record. If it was removed or your access changed, it may no longer be available. <a className="underline" href={adminHref(activeSection)}>Return to all records</a></div>}
            {renderSection(activeSection, adminUserRole)}
          </div>
        </AdminLayout>
        </AdminNotificationProvider>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <WebAuthView
        onLogin={handleLogin}
        authError={authError}
        isDark={isDark}
        onToggleDark={toggleDarkMode}
      />
    </ToastProvider>
  );
}
