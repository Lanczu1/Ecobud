import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Trophy, 
  Calendar, 
  Store, 
  ArrowLeftRight, 
  FileText, 
  LogOut 
} from 'lucide-react';

export type AdminSection = 'Dashboard' | 'Users' | 'Learning Content' | 'Challenges' | 'Events' | 'Vendors' | 'Swap Goods' | 'Reports';

interface SidebarProps {
  onLogout: () => void;
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
}

const menuItems: { name: AdminSection; icon: React.ElementType }[] = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Users', icon: Users },
  { name: 'Learning Content', icon: BookOpen },
  { name: 'Challenges', icon: Trophy },
  { name: 'Events', icon: Calendar },
  { name: 'Vendors', icon: Store },
  { name: 'Swap Goods', icon: ArrowLeftRight },
  { name: 'Reports', icon: FileText },
];

export function AdminSidebar({ onLogout, activeSection, onNavigate }: SidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-full shadow-sm">
      <div className="p-6 flex items-center gap-3 select-none">
        <img 
          src="/logo.png" 
          alt="EcoBud Logo" 
          className="w-10 h-10 object-contain rounded-xl transition-transform duration-500 hover:scale-110 hover:rotate-12 cursor-pointer filter drop-shadow-sm" 
        />
        <div>
          <h1 className="font-bold text-gray-800 tracking-wider font-serif text-lg leading-tight">ECOBUD</h1>
          <p className="text-[10px] text-green-600 font-semibold uppercase tracking-widest">Admin Panel</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-2 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = item.name === activeSection;
            return (
              <li key={item.name}>
                <button
                  onClick={() => onNavigate(item.name)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                    isActive
                      ? 'bg-green-50 text-green-600 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                  <span className="text-sm">{item.name}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
}
