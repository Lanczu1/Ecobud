import { Activity, Sun, Moon, UserCog } from 'lucide-react';
import { AdminSection } from './AdminSidebar';

interface AdminHeaderProps {
  activeSection: AdminSection;
  isDark: boolean;
  onToggleDark: () => void;
}

const sectionDescriptions: Record<AdminSection, string> = {
  Dashboard: 'Welcome back, Admin',
  Users: 'View and manage all registered members',
  'Learning Content': 'Manage eco-education articles and modules',
  Challenges: 'Design and manage community eco-challenges',
  Events: 'Organize and track community eco-events',
  Vendors: 'Manage eco-friendly vendor partners',
  'Swap Goods': 'Monitor and moderate community swap listings',
  Reports: 'Platform-wide performance metrics and insights',
};

export function AdminHeader({ activeSection, isDark, onToggleDark }: AdminHeaderProps) {
  return (
    <div className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8">
      <div>
        <h2 className="text-xl font-bold font-serif text-gray-900 animate-reveal">{activeSection}</h2>
        <p className="text-gray-500 text-sm mt-0.5 animate-reveal delay-60">{sectionDescriptions[activeSection]}</p>
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={onToggleDark}
          className="text-gray-400 hover:text-gray-600 transition-colors relative"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>

        <button className="text-gray-400 hover:text-gray-600 transition-colors relative group">
          <Activity className="w-6 h-6 animate-shake-bell" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white translate-x-1 -translate-y-1"></span>
        </button>

        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">Admin</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <UserCog className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
