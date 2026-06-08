import { useEffect, useState } from 'react';
import { TrendingUp, Users, Trophy, BookOpen, Coins, ArrowUpRight, Download, AlertCircle, Loader2 } from 'lucide-react';
import { adminGet } from '../../../utils/adminApi';

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
    date: string;
    active: number;
    signups: number;
  }[];
}

function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} style={style} />;
}

export function Reports() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await adminGet<DashboardStats>('/admin/stats');
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load report data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const kpis = stats ? [
    { label: 'Total Users', value: stats.overview.totalUsers.toLocaleString(), change: `+${stats.overview.signupsToday} today`, up: true, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Lessons', value: stats.overview.totalLessons.toLocaleString(), change: `${stats.overview.lessonCompletions} completions`, up: true, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Active Challenges', value: stats.overview.totalChallenges.toLocaleString(), change: 'in database', up: true, icon: Trophy, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Eco Points Distributed', value: stats.overview.totalPoints.toLocaleString(), change: 'all time', up: true, icon: Coins, color: 'text-orange-500', bg: 'bg-orange-50' },
  ] : [];

  const maxActive = stats ? Math.max(...stats.activityTrend.map(d => d.active), 1) : 1;
  const maxSignups = stats ? Math.max(...stats.activityTrend.map(d => d.signups), 1) : 1;

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">Platform-wide performance metrics and insights</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200">
          <Download className="w-4 h-4" />Export Report
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div className="flex justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <Skeleton className="w-11 h-11 rounded-xl" />
                </div>
                <Skeleton className="h-4 w-32" />
              </div>
            ))
          : kpis.map((k, idx) => {
              const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-160' : 'delay-280';
              return (
                <div key={k.label} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group animate-reveal ${delayClass}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-gray-500 text-xs font-medium mb-1">{k.label}</p>
                      <h3 className="text-3xl font-serif font-bold text-gray-900">{k.value}</h3>
                    </div>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${k.bg} group-hover:scale-110 transition-transform duration-300`}>
                      <k.icon className={`w-5 h-5 ${k.color}`} />
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-semibold text-green-500">
                    <TrendingUp className="w-4 h-4" />
                    {k.change}
                  </span>
                </div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-reveal delay-160">
        {/* Active Users Chart (7-day trend) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-gray-900">Daily Active Users</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 days</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />Live data
            </span>
          </div>
          {loading ? (
            <div className="flex items-end gap-3 h-40 pt-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${30 + Math.random() * 70}%` }} />
              ))}
            </div>
          ) : stats ? (
            <div className="flex items-end gap-2 h-40">
              {stats.activityTrend.map(d => {
                const h = Math.round((d.active / maxActive) * 100);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group/bar">
                    <span className="text-xs font-bold text-gray-600 opacity-0 group-hover/bar:opacity-100 transition-opacity">{d.active}</span>
                    <div className="w-full relative flex items-end" style={{ height: '120px' }}>
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

        {/* New Signups Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-gray-900">New Signups</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 days</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />Live data
            </span>
          </div>
          {loading ? (
            <div className="flex items-end gap-3 h-40 pt-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${20 + Math.random() * 80}%` }} />
              ))}
            </div>
          ) : stats ? (
            <div className="flex items-end gap-2 h-40">
              {stats.activityTrend.map(d => {
                const h = Math.round((d.signups / maxSignups) * 100);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group/bar">
                    <span className="text-xs font-bold text-gray-600 opacity-0 group-hover/bar:opacity-100 transition-opacity">{d.signups}</span>
                    <div className="w-full relative flex items-end" style={{ height: '120px' }}>
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-sky-300 hover:from-blue-600 hover:to-sky-400 transition-all duration-300 cursor-pointer"
                        style={{ height: `${Math.max(h, 4)}%` }}
                        title={`${d.dateLabel}: ${d.signups} signups`}
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

      {/* 7-Day Summary Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-reveal delay-280">
        <div className="p-6 border-b border-gray-50">
          <h3 className="text-lg font-serif font-bold text-gray-900">7-Day Activity Summary</h3>
          <p className="text-xs text-gray-400 mt-0.5">Real-time data from your database</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Active Users</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">New Signups</th>
              </tr>
            </thead>
            <tbody className="">
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3.5"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-12" /></td>
                  </tr>
                ))
              ) : stats ? (
                [...stats.activityTrend].reverse().map(d => (
                  <tr key={d.date} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5 text-sm font-semibold text-gray-900">{d.dateLabel}</td>
                    <td className="px-4 py-3.5 text-sm text-green-600 font-bold">{d.active}</td>
                    <td className="px-4 py-3.5 text-sm text-blue-600 font-bold">+{d.signups}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading data...</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform Overview */}
      {!loading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-reveal delay-160">
          {[
            { label: 'Online Now', value: stats.overview.onlineNow, desc: 'users currently active', color: 'text-green-600', dot: 'bg-green-500' },
            { label: 'Active Today', value: stats.overview.activeToday, desc: 'users seen today', color: 'text-blue-600', dot: 'bg-blue-500' },
            { label: 'Lesson Completions', value: stats.overview.lessonCompletions, desc: 'total across all users', color: 'text-purple-600', dot: 'bg-purple-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${s.dot} animate-pulse`} />
                <p className="text-sm font-semibold text-gray-700">{s.label}</p>
              </div>
              <p className={`text-3xl font-serif font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
