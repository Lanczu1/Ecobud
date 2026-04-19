import React, { useState, useEffect } from 'react';
import { PresenceIndicator } from '../components/PresenceIndicator';
import { adminRealtimeService } from '../services/adminRealtimeService';
import { adminService } from '../services/adminService';
import type { AdminUser } from '../types/admin';
import {
  Users,
  Search,
  Shield,
  User as UserIcon,
  Mail,
  Trophy,
  Zap,
  ChevronRight,
  RefreshCcw,
} from 'lucide-react';

export const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [livePresence, setLivePresence] = useState<{
    onlineUserIds: string[];
    sessionCountByUserId: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const refreshBurstTimers = React.useRef<number[]>([]);

  const fetchUsers = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await adminService.getUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to load users.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const clearRefreshBurst = React.useCallback(() => {
    refreshBurstTimers.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    refreshBurstTimers.current = [];
  }, []);

  const scheduleRefreshBurst = React.useCallback(() => {
    clearRefreshBurst();

    [0, 1500, 5000].forEach((delayMs) => {
      const timerId = window.setTimeout(() => {
        void fetchUsers();
      }, delayMs);

      refreshBurstTimers.current.push(timerId);
    });
  }, [clearRefreshBurst]);

  useEffect(() => {
    void fetchUsers(true);

    let unsubscribe: () => void = () => {};

    void adminRealtimeService
      .connect({
        onPresenceChange: (presence) => {
          setLivePresence({
            onlineUserIds: presence.onlineUserIds,
            sessionCountByUserId: presence.sessionCountByUserId,
          });
          scheduleRefreshBurst();
        },
        onUsersRefresh: () => {
          scheduleRefreshBurst();
        },
        onDashboardRefresh: () => {
          scheduleRefreshBurst();
        },
      })
      .then((cleanup) => {
        unsubscribe = cleanup;
      });

    return () => {
      clearRefreshBurst();
      unsubscribe();
    };
  }, [clearRefreshBurst, scheduleRefreshBurst]);

  const handleResetKnowledge = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s knowledge points?')) return;
    setResettingId(userId);
    try {
      await adminService.resetUserKnowledge(userId);
      await fetchUsers();
    } catch (err) {
      alert('Failed to reset knowledge points');
    } finally {
      setResettingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.profile?.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && users.length === 0) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Loading Users...</div>;
  }

  if (!loading && users.length === 0 && error) {
    return <div className="p-8 text-center text-rose-600 font-black">{error}</div>;
  }

  return (
    <div className="p-8 space-y-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Users className="text-forest" size={36} />
            User Management
          </h1>
          <p className="text-slate-500 font-medium mt-1">Manage EcoBud members, monitor progress, and handle account status.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search users..."
                className="pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 ring-forest/20 w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user, index) => {
          const onlineNow = livePresence
            ? livePresence.onlineUserIds.includes(user.id)
            : user.isOnlineNow;
          const activeSessionCount = livePresence
            ? livePresence.sessionCountByUserId[user.id] ?? 0
            : user.activeSessionCount;
          const connectionState = livePresence
            ? (onlineNow ? 'online' : 'offline')
            : user.connectionState;
          const appState = livePresence && !onlineNow ? null : user.appState;

          return (
            <div
              key={user.id}
              style={{ animationDelay: `${index * 50}ms` }}
              className="glass-card p-6 flex flex-col group hover:shadow-xl hover:shadow-forest/5 transition-all animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-forest/10 flex items-center justify-center text-forest overflow-hidden">
                    {user.profile?.avatarUrl ? (
                      <img src={user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 leading-tight">{user.profile?.displayName || user.name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-black text-slate-400 mt-1">
                      {user.role === 'admin' ? (
                        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          <Shield size={10} /> Admin
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">Member</span>
                      )}
                    </div>
                  </div>
                </div>
                <PresenceIndicator
                  compact
                  isOnline={onlineNow}
                  label={onlineNow ? 'Online' : 'Offline'}
                />
              </div>

              <div className="space-y-3 mb-6 flex-1">
                <div className="flex items-center gap-2 text-slate-500">
                  <Mail size={14} className="opacity-50" />
                  <span className="text-xs font-bold truncate">{user.email}</span>
                </div>
                <div className="text-[11px] font-bold text-slate-400">
                  {user.lastSeenAt
                    ? `Last seen: ${new Date(user.lastSeenAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`
                    : 'No presence signal recorded yet'}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-1.5">
                    <Trophy size={14} className="text-amber-500" />
                    <span className="text-xs font-black text-slate-700">{user.points} <span className="text-slate-400 font-bold">PTS</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap size={14} className="text-forest" />
                    <span className="text-xs font-black text-slate-700">{user.currentStreak} <span className="text-slate-400 font-bold">STREAK</span></span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">
                    {activeSessionCount} session{activeSessionCount === 1 ? '' : 's'}
                  </span>
                  {connectionState ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                      {connectionState}
                    </span>
                  ) : null}
                  {appState ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                      {appState}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleResetKnowledge(user.id)}
                  disabled={resettingId === user.id}
                  className="flex-1 py-2.5 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 hover:text-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  {resettingId === user.id ? <RefreshCcw size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                  Reset KP
                </button>
                <button className="px-4 py-2.5 bg-forest text-white rounded-xl hover:bg-forest/90 transition-all">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-30">
            <Users size={64} className="mx-auto mb-4" />
            <p className="font-black text-xl">No users found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
