import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, UserCheck, UserX, Mail, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { adminGet, adminPost } from '../../../utils/adminApi';
import { adminRealtimeService } from '../../../services/adminRealtimeService';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  status: 'active' | 'pending' | 'suspended';
  points: number;
  createdAt: string;
  lastSeenAt: string | null;
  isOnlineNow: boolean;
  profile: { displayName: string; avatarUrl: string | null } | null;
}

const statusColors: Record<string, string> = {
  online: 'bg-green-50 text-green-700 border-green-100',
  offline: 'bg-red-50 text-red-700 border-red-100',
};

const roleColors: Record<string, string> = {
  user: 'bg-blue-50 text-blue-600 border-blue-100',
  moderator: 'bg-purple-50 text-purple-700 border-purple-100',
  admin: 'bg-orange-50 text-orange-700 border-orange-100',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function ManageUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewTab, setViewTab] = useState<'Members' | 'Staff'>('Members');

  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const data = await adminGet<AdminUser[]>('/admin/users');
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();

    let unsubscribe: () => void;
    adminRealtimeService.connect({
      onUsersRefresh: () => {
        loadUsers();
      },
      onPresenceChange: (presence) => {
        const now = new Date().toISOString();
        setUsers(prev => prev.map(u => {
          const isOnlineNow = presence.onlineUserIds.includes(u.id);
          return {
            ...u,
            isOnlineNow,
            lastSeenAt: isOnlineNow || u.isOnlineNow ? now : u.lastSeenAt
          };
        }));
      }
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleBlock = async (userId: string) => {
    setProcessingId(userId);
    try {
      await adminPost(`/admin/users/${userId}/block`, {});
      // The realtime subscription will trigger a refresh, but we can optimistically update
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'suspended' } : u));
    } catch (err: any) {
      alert(err.message || 'Failed to block user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnblock = async (userId: string) => {
    setProcessingId(userId);
    try {
      await adminPost(`/admin/users/${userId}/unblock`, {});
      // Optimistic update
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active' } : u));
    } catch (err: any) {
      alert(err.message || 'Failed to unblock user');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = useMemo(() =>
    users.filter(u => {
      const matchTab = viewTab === 'Members' ? u.role === 'user' : (u.role === 'admin' || u.role === 'moderator');
      const matchStatus = filterStatus === 'All' || (filterStatus === 'Online' ? u.isOnlineNow : !u.isOnlineNow);
      const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      return matchTab && matchStatus && matchSearch;
    }), [users, search, filterStatus, viewTab]);

  const tabUsers = users.filter(u => viewTab === 'Members' ? u.role === 'user' : (u.role === 'admin' || u.role === 'moderator'));
  const totalOnline = tabUsers.filter(u => u.isOnlineNow).length;
  const totalOffline = tabUsers.filter(u => !u.isOnlineNow).length;

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Header and Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold text-gray-900">Manage {viewTab}</h2>
            <p className="text-gray-500 text-sm mt-1">View and manage {viewTab === 'Members' ? 'registered EcoBud members' : 'system administrators and moderators'}</p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200">
          <button 
            onClick={() => setViewTab('Members')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${viewTab === 'Members' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Members
          </button>
          <button 
            onClick={() => setViewTab('Staff')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${viewTab === 'Staff' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Staff (Admins & Moderators)
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: `Total ${viewTab}`, value: loading ? '—' : tabUsers.length, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Online', value: loading ? '—' : totalOnline, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Offline', value: loading ? '—' : totalOffline, color: 'text-gray-600', bg: 'bg-gray-50' },
        ].map((s, idx) => {
          const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : 'delay-160';
          return (
            <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 p-5 shadow-sm animate-reveal ${delayClass} hover:-translate-y-1 hover:shadow-md transition-all duration-300`}>
              <p className="text-sm text-gray-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-center animate-reveal delay-160">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {['All', 'Online', 'Offline'].map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-4 py-2 text-sm rounded-xl border font-medium transition-all ${filterStatus === f ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-reveal delay-280">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/70">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">User</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Role</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Status</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Last Active</th>
              {viewTab === 'Members' && <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Points</th>}
              {viewTab === 'Members' && <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Joined</th>}
              {viewTab === 'Members' && <th className="px-4 py-4"></th>}
            </tr>
          </thead>
          <tbody className="">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-9 h-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                    {viewTab === 'Members' && <td className="px-4 py-4"><Skeleton className="h-4 w-12" /></td>}
                    {viewTab === 'Members' && <td className="px-4 py-4"><Skeleton className="h-4 w-20" /></td>}
                    {viewTab === 'Members' && <td className="px-4 py-4"></td>}
                  </tr>
                ))
              : filtered.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {user.profile?.avatarUrl ? (
                            <img src={user.profile.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full bg-gray-100 object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-xs font-bold text-green-700">{user.name.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          {user.isOnlineNow ? (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                          ) : (
                            (user.role === 'admin' || user.role === 'moderator') && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                            )
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{user.profile?.displayName || user.name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${roleColors[user.role]}`}>
                        <Shield className="w-3 h-3" />
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${user.isOnlineNow ? statusColors.online : statusColors.offline}`}>
                        {user.isOnlineNow ? 'Active' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {user.isOnlineNow ? (
                        <span className="text-xs font-medium text-green-600">Right now</span>
                      ) : user.lastSeenAt ? (
                        <span className="text-xs text-gray-500">
                          {new Date(user.lastSeenAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Never</span>
                      )}
                    </td>
                    {viewTab === 'Members' && (
                      <td className="px-4 py-4">
                        <span className="text-sm font-bold text-green-600">{user.points.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 ml-1">pts</span>
                      </td>
                    )}
                    {viewTab === 'Members' && (
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    )}
                    {viewTab === 'Members' && (
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {user.status !== 'suspended' && (
                            <button 
                              onClick={() => handleBlock(user.id)}
                              disabled={processingId === user.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors"
                            >
                              {processingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                              Block
                            </button>
                          )}
                          {user.status === 'suspended' && (
                            <button 
                              onClick={() => handleUnblock(user.id)}
                              disabled={processingId === user.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-600 bg-green-50 hover:bg-green-100 disabled:opacity-50 rounded-lg transition-colors"
                            >
                              {processingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                              Unblock
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {users.length === 0 ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-gray-300" />
                <p>No users found in database</p>
              </div>
            ) : 'No users match your search.'}
          </div>
        )}
      </div>
    </div>
  );
}
