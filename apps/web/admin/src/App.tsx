import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLearnManagement } from './pages/AdminLearnManagement';
import { AdminLogin } from './pages/AdminLogin';
import { AdminUserManagement } from './pages/AdminUserManagement';
import { AdminChallengeManagement } from './pages/AdminChallengeManagement';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminSubmissions } from './pages/AdminSubmissions';
import { AdminAuditLogs } from './pages/AdminAuditLogs';
import { AdminLayout } from './components/AdminLayout';
import {
  getAdminPortalHomePath,
  getStoredAdminUser,
  hasAdminPortalAccess,
} from './utils/adminSession';

// Protected Route Component
const ProtectedRoute = ({
  children,
  allowedRoles = ['admin', 'moderator'],
}: {
  children: React.ReactNode;
  allowedRoles?: Array<'admin' | 'moderator'>;
}) => {
  const token = localStorage.getItem('admin_token');
  const user = getStoredAdminUser();

  if (!token || !hasAdminPortalAccess(user?.role)) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getAdminPortalHomePath(user.role)} replace />;
  }

  return <>{children}</>;
};

const AdminHomeRedirect = () => {
  const user = getStoredAdminUser();
  return <Navigate to={getAdminPortalHomePath(user?.role)} replace />;
};

// Placeholder for future expansion
const Placeholder = ({ name }: { name: string }) => (
  <div className="p-20 text-center animate-in zoom-in duration-500">
    <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-4">{name}</h1>
    <div className="inline-block px-4 py-2 bg-emerald-100 text-forest rounded-full text-xs font-black uppercase tracking-widest mb-8">
      Coming Soon
    </div>
    <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
      This module is part of the EcoBud Admin expansion. We are currently building out the interface for this section to match the highest standards of planet-positive administration.
    </p>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected Admin Area */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminHomeRedirect />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUserManagement />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/submissions" element={<AdminSubmissions />} />
          <Route path="/admin/challenges" element={<AdminChallengeManagement />} />
          <Route path="/admin/learn" element={<AdminLearnManagement />} />
          <Route path="/admin/audit" element={<AdminAuditLogs />} />
          
          {/* Feature place holders */}
          <Route path="/admin/points" element={<Placeholder name="Eco Points Management" />} />
          <Route path="/admin/analytics" element={<Placeholder name="Live Analytics" />} />
          <Route path="/admin/notifications" element={<Placeholder name="Global Notifications" />} />
          <Route path="/admin/feedback" element={<Placeholder name="User Feedback" />} />
          <Route path="/admin/settings" element={<Placeholder name="System Settings" />} />
        </Route>

        {/* Global Fallback */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
