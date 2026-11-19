import { useState, useEffect, lazy, Suspense } from 'react';
import { API_HOST, endAdminServerSession, pingAdminSession } from './utils/adminApi';
import { WebAuthView } from './components/WebAuthView';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminSection } from './components/admin/AdminSidebar';
import { ToastProvider } from './context/ToastContext';
import { AdminNotificationProvider } from './components/admin/AdminNotificationProvider';
import { adminHref, revokeAdminPushSession } from './services/adminNotifications';
import {
  clearAdminSession, getAdminSessionTimes, getAdminToken, getAdminUserJson, hasAdminCredentials,
  onAdminSessionChange, recordAdminActivity, removeLegacyAdminSession, requestSharedAdminSession,
  saveAdminSession, signOutAdminTabs, type SignOutReason,
} from './utils/adminSession';
import { BadgesPageSkeleton } from './components/admin/pages/BadgesSkeleton';
import { BarangayReportsPageSkeleton, SystemReportsPageSkeleton } from './components/admin/pages/ReportsSkeleton';
import { AdminPageSkeleton } from './components/admin/pages/PageSkeletons';

// SECURITY: admin sessions are short because admins can change everyone's data.
// Idle: signed out after 30 minutes with no click, key, scroll or touch in any open dashboard tab.
// Absolute: signed out 12 hours after login, which matches the API's web token lifetime (no refresh token on web).
// Logout and both timeouts also end the session on the API (/api/web-session/logout), so a copied
// token stops working too. The API ends a session on its own after 35 idle minutes or 12 hours.
// Closing the tab or browser also signs out, because the session is kept in sessionStorage (see utils/adminSession.ts).
const WEB_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WEB_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

// Removes push alerts for this session, then ends the session on the server. Runs in that order
// because removing push alerts needs the session to still be open.
function endServerSession() {
  const token = getAdminToken();
  if (!token) return;
  void revokeAdminPushSession().catch(() => {}).then(() => endAdminServerSession(token));
}

// This tab only, without telling other tabs: a new tab with no session must not sign out the open ones.
function clearStoredAdminSession() {
  endServerSession();
  clearAdminSession();
}

// Logout and timeouts: this tab and every other open dashboard tab.
function signOutEverywhere(reason: SignOutReason) {
  endServerSession();
  signOutAdminTabs('all', reason);
}

function startingSection(): AdminSection {
  try {
    return JSON.parse(getAdminUserJson() || 'null')?.role === 'moderator' ? 'Announcements' : 'Dashboard';
  } catch {
    return 'Dashboard';
  }
}

// Runs on page load. A browser that restores closed tabs can bring sessionStorage back,
// so both timeouts are still checked here.
function hasValidStoredAdminSession(): boolean {
  removeLegacyAdminSession();
  const now = Date.now();
  const { startedAt, lastActivityAt } = getAdminSessionTimes();
  if (!hasAdminCredentials() || !startedAt || !lastActivityAt || now - startedAt >= WEB_ABSOLUTE_TIMEOUT_MS || now - lastActivityAt >= WEB_IDLE_TIMEOUT_MS) {
    clearStoredAdminSession();
    return false;
  }
  return true;
}

// Page code, loaded on first visit. After sign-in the pages a role can open are fetched quietly in the
// background too, so switching pages waits for data only, never for a code download.
const pageLoaders = {
  Dashboard: () => import('./components/admin/Dashboard').then(m => ({ default: m.Dashboard })),
  IdVerification: () => import('./components/admin/pages/IdVerification').then(m => ({ default: m.IdVerification })),
  Notifications: () => import('./components/admin/pages/Notifications').then(m => ({ default: m.Notifications })),
  ManageUsers: () => import('./components/admin/pages/ManageUsers').then(m => ({ default: m.ManageUsers })),
  UserActivityTransactions: () => import('./components/admin/pages/UserActivityTransactions').then(m => ({ default: m.UserActivityTransactions })),
  LearningContent: () => import('./components/admin/pages/LearningContent').then(m => ({ default: m.LearningContent })),
  Challenges: () => import('./components/admin/pages/Challenges').then(m => ({ default: m.Challenges })),
  Events: () => import('./components/admin/pages/Events').then(m => ({ default: m.Events })),
  GiveAndGetHub: () => import('./components/admin/pages/GiveAndGetHub').then(m => ({ default: m.GiveAndGetHub })),
  Redeem: () => import('./components/admin/pages/Redeem').then(m => ({ default: m.Redeem })),
  Reports: () => import('./components/admin/pages/Reports').then(m => ({ default: m.Reports })),
  BarangayReports: () => import('./components/admin/pages/BarangayReports').then(m => ({ default: m.Reports })),
  Announcements: () => import('./components/admin/pages/Announcements').then(m => ({ default: m.Announcements })),
  Badges: () => import('./components/admin/pages/Badges').then(m => ({ default: m.Badges })),
};
type PageName = keyof typeof pageLoaders;
const pagesByRole: Record<'admin' | 'moderator', PageName[]> = {
  admin: ['Dashboard', 'Notifications', 'ManageUsers', 'UserActivityTransactions', 'LearningContent', 'Challenges', 'Badges', 'Events', 'GiveAndGetHub', 'Redeem', 'Reports', 'Announcements'],
  moderator: ['Announcements', 'Notifications', 'IdVerification', 'Challenges', 'Events', 'GiveAndGetHub', 'Redeem', 'BarangayReports'],
};

function preloadPages(role?: string) {
  const pages = pagesByRole[role === 'moderator' ? 'moderator' : 'admin'];
  // One at a time while the browser is idle, so the open page keeps the network to itself.
  const next = (index: number) => {
    if (index >= pages.length) return;
    const run = () => void pageLoaders[pages[index]]().catch(() => {}).finally(() => next(index + 1));
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 200);
  };
  next(0);
}

const Dashboard = lazy(pageLoaders.Dashboard);
const IdVerification = lazy(pageLoaders.IdVerification);
const Notifications = lazy(pageLoaders.Notifications);
const ManageUsers = lazy(pageLoaders.ManageUsers);
const UserActivityTransactions = lazy(pageLoaders.UserActivityTransactions);
const LearningContent = lazy(pageLoaders.LearningContent);
const Challenges = lazy(pageLoaders.Challenges);
const Events = lazy(pageLoaders.Events);
const GiveAndGetHub = lazy(pageLoaders.GiveAndGetHub);
const Redeem = lazy(pageLoaders.Redeem);
const Reports = lazy(pageLoaders.Reports);
const BarangayReports = lazy(pageLoaders.BarangayReports);
const Announcements = lazy(pageLoaders.Announcements);
const Badges = lazy(pageLoaders.Badges);

const dashboardSkeleton = <AdminPageSkeleton subtitle="" body="table" />;

// While a page's code downloads, show that page's skeleton instead of a spinner.
function sectionSkeleton(section: string, role?: string) {
  switch (section) {
    case 'Dashboard': return dashboardSkeleton;
    case 'Notifications': return <AdminPageSkeleton title="Notifications" stats={0} body="table" />;
    case 'Users': return <AdminPageSkeleton stats={3} action body="table" />;
    case 'User Activity & Transactions': return role === 'admin'
      ? <AdminPageSkeleton title="User Activity & Transactions" subtitle="Choose a resident to show their transactions. History stays hidden until you open it." stats={0} body="table" />
      : <AdminPageSkeleton title="Challenges" action body="table" />;
    case 'Learning Content': return <AdminPageSkeleton title="Learning Content" subtitle="Create and manage eco-education articles and modules" action body="table" />;
    case 'Challenges': return <AdminPageSkeleton title="Challenges" action body="table" />;
    case 'Badges': return <BadgesPageSkeleton />;
    case 'Reports': return role === 'moderator' ? <BarangayReportsPageSkeleton /> : <SystemReportsPageSkeleton />;
    case 'Events': return <AdminPageSkeleton title="Events" subtitle="Organize and track community eco-events" action body="grid" />;
    case 'Give and Get Hub': return <AdminPageSkeleton title="Manage Listings" stats={5} body="grid" />;
    case 'Redeem': return <AdminPageSkeleton title="Redeem" subtitle="Manage reward catalog and redemption requests (Auto-syncing live)" action body="grid" />;
    case 'ID Verification': return role === 'moderator'
      ? <AdminPageSkeleton title="ID Verification" subtitle="Review and manage resident ID submissions in your assigned barangay." stats={0} body="list" />
      : dashboardSkeleton;
    case 'Announcements': return <AdminPageSkeleton title="Announcements" subtitle="Create, publish, and manage community announcements" action body="list" />;
    default: return dashboardSkeleton;
  }
}

function renderSection(section: AdminSection, role?: string) {
  const accessibleSection = role === 'moderator' && ['Learning Content', 'Badges'].includes(section)
    ? 'Challenges'
    : section;

  return (
    <Suspense fallback={sectionSkeleton(accessibleSection, role)}>
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
          case 'Give and Get Hub': return <GiveAndGetHub />;
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
  // A new tab waits briefly for an open tab to share its session before showing the login screen.
  const [checkingOtherTabs, setCheckingOtherTabs] = useState(() => !isAuthenticated);
  const [activeSection, setActiveSection] = useState<AdminSection>(startingSection);
  const adminUserRole = (() => {
    try {
      return JSON.parse(getAdminUserJson() || 'null')?.role as string | undefined;
    } catch {
      return undefined;
    }
  })();
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('ecobud_dark_mode') === 'true';
  });

  useEffect(() => {
    if (isAuthenticated) preloadPages(adminUserRole);
  }, [isAuthenticated, adminUserRole]);

  useEffect(() => {
    if (!checkingOtherTabs) return;
    let cancelled = false;
    void requestSharedAdminSession().then(shared => {
      if (cancelled) return;
      // The shared session goes through the same 30-minute idle and 12-hour checks as a stored one.
      if (shared && hasValidStoredAdminSession()) {
        setActiveSection(startingSection());
        setIsAuthenticated(true);
      }
      setCheckingOtherTabs(false);
    });
    return () => { cancelled = true; };
  }, [checkingOtherTabs]);

  // Logins, logouts and timeouts in other tabs.
  useEffect(() => onAdminSessionChange(change => {
    if (change.kind === 'signed-in') {
      setAuthError(null);
      setActiveSection(startingSection());
      setIsAuthenticated(true);
      return;
    }
    setIsAuthenticated(false);
    setAuthError(change.reason === 'logout' ? null : 'Your session expired. Please sign in again.');
    window.location.hash = '';
  }), []);

  useEffect(() => {
    const update=() => setRouteHash(window.location.hash);
    window.addEventListener('hashchange',update);
    return () => window.removeEventListener('hashchange',update);
  },[]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const section=new URLSearchParams(routeHash.split('?')[1] || '').get('section');
    const allowed: AdminSection[]=['Dashboard','Announcements','Notifications','ID Verification','Users','Learning Content','Challenges','Badges','Events','Give and Get Hub','Redeem','User Activity & Transactions','Reports'];
    if (section === 'Notifications' && adminUserRole !== 'moderator') {
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
    let lastPing = Date.now();
    const recordActivity = () => {
      const now = Date.now();
      if (now - lastWrite >= 30_000) {
        recordAdminActivity(now);
        lastWrite = now;
      }
      // The server's idle limit is 35 minutes, so a ping every 2 minutes of use keeps it behind this
      // tab's 30-minute limit: the browser always times out first.
      if (now - lastPing >= 120_000) {
        lastPing = now;
        void pingAdminSession().catch(() => {});
      }
    };
    // Checked every 30 seconds while the dashboard is open.
    const enforceTimeout = () => {
      const now = Date.now();
      const { startedAt, lastActivityAt } = getAdminSessionTimes();
      if (!startedAt || !lastActivityAt || now - startedAt >= WEB_ABSOLUTE_TIMEOUT_MS || now - lastActivityAt >= WEB_IDLE_TIMEOUT_MS) {
        signOutEverywhere('expired');
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

    // Keeps regular users off the dashboard screens only. Real protection is the API's
    // requireAdminAccess / requireModeratorAccess on every admin request.
    if (data.user.role !== 'admin' && data.user.role !== 'moderator') {
      const msg = 'Access denied. Admin or moderator role required.';
      setAuthError(msg);
      throw new Error(msg);
    }

    // SECURITY: sessionStorage is readable by any script on this page. An injected script (XSS or a
    // compromised package) could copy this admin token; an httpOnly cookie would prevent that.
    saveAdminSession(data.token, data.user);
    setIsAuthenticated(true);
    setActiveSection(data.user.role === 'moderator' ? 'Announcements' : 'Dashboard');
  };

  const handleLogout = () => {
    signOutEverywhere('logout');
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

  // Blank for up to 300 ms instead of flashing the login screen at someone an open tab is about to sign in.
  if (checkingOtherTabs) return null;

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
