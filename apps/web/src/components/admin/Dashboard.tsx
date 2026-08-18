import { useEffect, useState } from 'react';
import { Users, Trophy, BookOpen, Coins, AlertCircle } from 'lucide-react';
import { adminGet } from '../../utils/adminApi';
import { adminRealtimeService } from '../../services/adminRealtimeService';

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


function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} style={style} />;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStats(isInitial = false) {
      if (isInitial) setLoading(true);
      try {
        const statsData = await adminGet<DashboardStats>('/admin/stats');
        if (isMounted) {
          setStats(statsData);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted && isInitial) {
          setError(err.message || 'Failed to load dashboard data.');
        }
      } finally {
        if (isMounted && isInitial) {
          setLoading(false);
        }
      }
    }

    loadStats(true);

    let unsubscribe: (() => void) | undefined;
    adminRealtimeService.connect({
      onStatsRefresh: () => {
        loadStats(false);
      },
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-full">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 flex items-center gap-4 max-w-lg">
          <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
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

      <div className="grid grid-cols-1 gap-8 animate-reveal delay-160">
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
                        className="w-full rounded-t-lg bg-linear-to-t from-green-500 to-emerald-300 hover:from-green-600 hover:to-emerald-400 transition-all duration-300 cursor-pointer"
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

      </div>
    </div>
  );
}
