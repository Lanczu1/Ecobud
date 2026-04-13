import React, { useState } from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
  LayoutDashboard,
  Users,
  Send,
  LogOut,
  Trophy,
  Activity,
  Zap,
  ShieldCheck,
  Bell,
  MessageSquare,
  Settings,
  ChevronDown,
  Menu,
  X,
  UserCog
} from 'lucide-react';
import logo from '../assets/logo.png';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Submissions', path: '/admin/submissions', icon: Send },
    { name: 'Challenges', path: '/admin/challenges', icon: Trophy },
    { name: 'Lessons', path: '/admin/learn', icon: BookOpen },
    { name: 'Eco Points', path: '/admin/points', icon: Zap },
    { name: 'Audit Logs', path: '/admin/audit', icon: ShieldCheck },
    { name: 'Analytics', path: '/admin/analytics', icon: Activity },
    { name: 'Notifications', path: '/admin/notifications', icon: Bell },
    { name: 'Feedback', path: '/admin/feedback', icon: MessageSquare },
    { name: 'Admin Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      {/* Top Navigation Bar */}
      <header className="h-16 bg-[#126027] text-white flex items-center justify-between px-6 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="EcoBud" className="h-10 w-auto" />
            <div className="h-4 w-px bg-white/20 hidden md:block" />
            <span className="text-lg font-bold tracking-tight hidden md:block">Admin Control Center</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <div
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-4 border-l border-white/10 pl-6 cursor-pointer group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none">{user.name || 'Admin'}</p>
                <p className="text-[10px] text-white/60 font-medium uppercase tracking-widest mt-1">{user.role || 'Moderator'}</p>
              </div>
              <div className="w-9 h-9 border-2 border-white/20 rounded-full flex items-center justify-center group-hover:border-white/50 transition-all shadow-sm bg-white/10">
                <UserCog size={20} className="text-white" />
              </div>
              <ChevronDown
                size={14}
                className={`text-white/50 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`}
              />
            </div>

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsProfileOpen(false)}
                />
                <div className="absolute right-0 mt-4 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-5 mb-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Account</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-5 py-3 text-red-500 hover:bg-red-50 transition-colors text-sm font-black"
                  >
                    <LogOut size={16} />
                    Logout Session
                  </button>
                  <div className="mx-3 mt-3 pt-3 border-t border-slate-50">
                    <p className="text-[9px] text-slate-300 text-center font-bold italic">EcoBud Control Center v1.0</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-[#E1E5EB] transition-all duration-300 ease-in-out flex flex-col shadow-sm z-40 ${isSidebarOpen ? 'w-64' : 'w-0 -translate-x-full'
            }`}
        >
          <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black transition-all group ${isActive
                    ? 'bg-[#126027] text-white shadow-lg shadow-emerald-500/10 scale-[1.02]'
                    : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#126027]'
                  }`
                }
              >
                <item.icon size={18} className="flex-shrink-0" />
                <span className="whitespace-nowrap">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100 mb-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black text-red-500 hover:bg-red-50 transition-all group"
            >
              <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
              <span>Logout Session</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-transparent">
          <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(102,187,106,0.16),_transparent_28%),linear-gradient(180deg,_#F8FBF8_0%,_#EEF3EF_100%)] p-1">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
