import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLearnManagement } from './pages/AdminLearnManagement';
import { AdminLogin } from './pages/AdminLogin';
import { AdminUserManagement } from './pages/AdminUserManagement';
import { AdminChallengeManagement } from './pages/AdminChallengeManagement';
import { AdminLayout } from './components/AdminLayout';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
};

// Placeholder for other pages
const Placeholder = ({ name }: { name: string }) => (
  <div className="p-20 text-center">
    <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-4">Section: {name}</h1>
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
          <Route path="/admin/learn" element={<AdminLearnManagement />} />
          <Route path="/admin/dashboard" element={<Placeholder name="Dashboard" />} />
          <Route path="/admin/users" element={<AdminUserManagement />} />
          <Route path="/admin/submissions" element={<AdminChallengeManagement />} />

          {/* Fallback inside portal */}
          <Route path="/admin" element={<Navigate to="/admin/learn" replace />} />
        </Route>

        {/* Global Fallback */}
        <Route path="/" element={<Navigate to="/admin/learn" replace />} />
      </Routes>
    </Router>
  );
}

export default App;


