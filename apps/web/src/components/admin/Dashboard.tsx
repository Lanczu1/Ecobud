import { useEffect, useState } from 'react';
import { Users, Trophy, BookOpen, Coins, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { adminGet } from '../../utils/adminApi';

interface DashboardStats {
  overview: {
    totalUsers: number;
    signupsToday: number;
    totalLessons: number;
    totalChallenges: number;
    totalPoints: number;
    lessonCompletions: number;
    onlineNow: number;
    activeToday: number;
  };
  activityTrend: {
    day: string;
    dateLabel: string;
    active: number;
    signups: number;
  }[];
}

interface AuditLog {
  id: string;
  action: string;
  details: string | null;
  timestamp: string;
  user: { name: string; email: string } | null;
}

function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} style={style} />;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, logsData] = await Promise.all([
          adminGet<DashboardStats>('/admin/stats'),
          adminGet<AuditLog[]>('/admin/audit'),
        ]);
        setStats(statsData);
        setAuditLogs(logsData);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-full">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 flex items-center gap-4 max-w-lg">
          <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-gray-900">Failed to load dashboard</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const statCards = stats ? [
    {
      title: 'Total Users',
      value: stats.overview.totalUsers.toLocaleString(),
      sub: `+${stats.overview.signupsToday} today`,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100',
    },
    {
      title: 'Active Challenges',
      value: stats.overview.totalChallenges.toLocaleString(),
      sub: 'total challenges',
      icon: Trophy,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
    },
    {
      title: 'Lessons',
      value: stats.overview.totalLessons.toLocaleString(),
      sub: `${stats.overview.lessonCompletions} completions`,
      icon: BookOpen,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-100',
    },
    {
      title: 'Eco Points Distributed',
      value: stats.overview.totalPoints.toLocaleString(),
      sub: `${stats.overview.onlineNow} online now`,
      icon: Coins,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-100',
    },
  ] : [];

  return (
    <div className="p-8 space-y-8 bg-gray-50/50 min-h-full">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-9 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))
          : statCards.map((stat, idx) => {
              const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-160' : 'delay-280';
              return (
                <div
                  key={stat.title}
                  className={`bg-white p-6 rounded-2xl border ${stat.borderColor} shadow-sm flex flex-col animate-reveal ${delayClass} hover:-translate-y-1.5 hover:shadow-lg hover:border-green-200 transition-all duration-300 group cursor-pointer`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-1">{stat.title}</p>
                      <h3 className="text-3xl font-serif font-bold text-gray-900">{stat.value}</h3>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">{stat.sub}</p>
                </div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-reveal delay-160">
        {/* Activity Trend Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-gray-900">7-Day Activity</h3>
              <p className="text-xs text-gray-400 mt-0.5">Active users per day</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-end gap-3 h-32">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="flex-1" style={{ height: `${40 + Math.random() * 60}%` }} />
              ))}
            </div>
          ) : stats ? (
            <div className="flex items-end gap-2 h-32">
              {stats.activityTrend.map((d) => {
                const max = Math.max(...stats.activityTrend.map(x => x.active), 1);
                const h = Math.round((d.active / max) * 100);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group/bar">
                    <span className="text-xs font-bold text-gray-600 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                      {d.active}
                    </span>
                    <div className="w-full relative flex items-end" style={{ height: '96px' }}>
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-green-500 to-emerald-300 hover:from-green-600 hover:to-emerald-400 transition-all duration-300 cursor-pointer"
                        style={{ height: `${Math.max(h, 4)}%` }}
                        title={`${d.dateLabel}: ${d.active} active`}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{d.day}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Recent Audit Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-serif font-bold text-gray-900">Recent Admin Activity</h3>
            <button className="text-green-600 text-sm font-medium flex items-center gap-1 hover:text-green-700 transition-colors">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> No activity yet
            </div>
          ) : (
            <div className="space-y-4">
              {auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="flex gap-4 p-2 rounded-xl hover:bg-gray-50/50 transition-colors duration-200">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-green-700">
                      {log.user?.name?.charAt(0)?.toUpperCase() ?? 'S'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      <span className="font-semibold">{log.user?.name ?? 'System'}</span>{' '}
                      <span className="text-gray-500">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
