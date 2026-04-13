import React from 'react';
import { Activity, Clock3, Wifi } from 'lucide-react';
import type { AdminOnlineUser } from '../types/admin';
import { PresenceIndicator } from './PresenceIndicator';

interface OnlineUsersPanelProps {
  users: AdminOnlineUser[];
  snapshotDate: string;
  loading?: boolean;
  error?: string | null;
}

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return 'No signal yet';
  }

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const OnlineUsersPanel: React.FC<OnlineUsersPanelProps> = ({
  users,
  snapshotDate,
  loading = false,
  error = null,
}) => {
  return (
    <div className="glass-card p-8 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Wifi className="text-forest" size={20} />
            Online Users
          </h2>
          <p className="text-slate-400 text-xs font-bold">
            Presence rows are deduplicated per user. Last seen updates from the active session heartbeat.
          </p>
        </div>
        <div className="text-[11px] font-bold text-slate-400">
          Snapshot: {new Date(snapshotDate).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-slate-50 px-6 py-10 text-center text-sm font-black uppercase tracking-widest text-slate-400 animate-pulse">
          Syncing presence roster...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 px-6 py-5 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && users.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-10 text-center text-slate-400">
          <Activity className="mx-auto mb-3" size={28} />
          <p className="text-sm font-black uppercase tracking-widest">No users are online right now.</p>
          <p className="mt-2 text-xs font-bold">The count will update instantly when a valid session comes online.</p>
        </div>
      ) : null}

      {!loading && !error && users.length > 0 ? (
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-black text-slate-800">
                      {user.profile?.displayName || user.name}
                    </h3>
                    <PresenceIndicator compact isOnline={user.isOnlineNow} label="Live" />
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-400">{user.email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-wider">
                  <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-500">
                    {user.activeSessionCount} active session{user.activeSessionCount === 1 ? '' : 's'}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                    {user.connectionState ?? 'online'}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                    {user.appState ?? 'active'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 text-xs font-bold text-slate-500 md:flex-row md:items-center md:gap-6">
                <div className="flex items-center gap-2">
                  <Clock3 size={14} className="text-slate-400" />
                  <span>Last seen: {formatTimestamp(user.lastSeenAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-slate-400" />
                  <span>Connected: {formatTimestamp(user.connectedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
