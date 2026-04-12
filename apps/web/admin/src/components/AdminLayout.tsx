import React from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { 
  BookOpen, 
  LayoutDashboard, 
  Users, 
  Send, 
  LogOut,
} from 'lucide-react';
import logo from '../assets/logo.png';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Learn Modules', path: '/admin/learn', icon: BookOpen },
    { name: 'User Management', path: '/admin/users', icon: Users },
    { name: 'Challenges', path: '/admin/submissions', icon: Send },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="p-8 flex items-center gap-3">
          <img src={logo} alt="EcoBud" className="w-10 h-10 object-contain" />
          <span className="text-xl font-black text-slate-800 tracking-tight">EcoBud Admin</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-forest/10 rounded-full flex items-center justify-center text-forest font-black uppercase">
              {user.name?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 truncate">{user.name || 'Admin User'}</p>
                <p className="text-[10px] font-black text-forest uppercase tracking-widest">{user.role || 'Administrator'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all duration-300"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
