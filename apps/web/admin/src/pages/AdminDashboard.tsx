import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  BookOpen,
  Trophy,
  TrendingUp,
  Activity,
  Zap,
  LayoutDashboard,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PresenceIndicator } from '../components/PresenceIndicator';
import { adminRealtimeService } from '../services/adminRealtimeService';
import { adminService } from '../services/adminService';
import type { AdminDashboardStats } from '../types/admin';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [livePresence, setLivePresence] = useState<{ count: number; ready: boolean }>({
    count: 0,
    ready: false,
  });

  const fetchStats = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchStats(true);

    let unsubscribe: () => void = () => {};
    const refreshTimer = window.setInterval(() => {
      void fetchStats();
    }, 60_000);

    void adminRealtimeService
      .connect({
        onDashboardRefresh: () => {
          void fetchStats();
        },
        onPresenceChange: (presence) => {
          setLivePresence({
            count: presence.count,
            ready: true,
          });
        },
      })
      .then((cleanup) => {
        unsubscribe = cleanup;
      });

    return () => {
      window.clearInterval(refreshTimer);
      unsubscribe();
    };
  }, []);

  if (loading || !stats) return <div className="p-8 text-center text-slate-500 animate-pulse uppercase font-black tracking-widest">Analyzing ecosystem...</div>;

  const snapshotDate = new Date(stats.overview.snapshotDate);
  const snapshotLabel = snapshotDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const activeTodayCount = livePresence.ready ? livePresence.count : stats.overview.activeToday;
  const hasUsersOnline = activeTodayCount > 0;

  const cards = [
    {
      title: 'Total Members',
      value: stats.overview.totalUsers.toLocaleString(),
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      badge: 'All time',
    },
    {
      title: 'Active Today',
      value: activeTodayCount.toLocaleString(),
      icon: Activity,
      color: 'text-forest',
      bg: 'bg-emerald-50',
      badge: 'Today',
      footer: snapshotLabel,
      presenceLabel: hasUsersOnline
        ? `${activeTodayCount} online now`
        : 'Offline now',
      presenceOnline: hasUsersOnline,
    },
    {
      title: 'Signups Today',
      value: stats.overview.signupsToday.toLocaleString(),
      icon: UserPlus,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      badge: 'Today',
      footer: snapshotLabel,
    },
    {
      title: 'Lessons Finished',
      value: stats.overview.lessonCompletions.toLocaleString(),
      icon: BookOpen,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      badge: 'All time',
    },
    {
      title: 'Points Awarded',
      value: stats.overview.totalPoints.toLocaleString(),
      icon: Zap,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      badge: 'All time',
    },
  ];

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <LayoutDashboard className="text-forest" size={36} />
          Executive Overview
        </h1>
        <p className="text-slate-500 font-medium mt-1">Real-time health monitoring of the EcoBud ecosystem.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="glass-card p-6 flex flex-col group hover:shadow-xl hover:shadow-forest/5 transition-all">
             <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${card.bg} ${card.color}`}>
                   <card.icon size={24} />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                   {'presenceLabel' in card && card.presenceLabel ? (
                     <PresenceIndicator
                       compact
                       isOnline={Boolean(card.presenceOnline)}
                       label={card.presenceLabel}
                     />
                   ) : null}
                   <div className="text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {card.badge}
                   </div>
                </div>
             </div>
             <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest">{card.title}</h3>
             <p className="text-3xl font-black text-slate-800 mt-1">{card.value}</p>
             {card.footer ? (
               <p className="mt-4 text-[11px] font-bold text-slate-400">{card.footer}</p>
             ) : null}
          </div>
        ))}
      </div>

      {/* Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8">
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h2 className="text-xl font-black text-slate-800">Community Engagement</h2>
                 <p className="text-slate-400 text-xs font-bold">Accurate daily active users and signups over the last 7 days. The Active Today card now reflects live connected members and drops immediately on signout or disconnect.</p>
              </div>
              <div className="flex items-center gap-2">
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-forest" /><span className="text-[10px] font-black text-slate-500 uppercase">Active</span></div>
                 <div className="flex items-center gap-1.5 ml-4"><div className="w-2.5 h-2.5 rounded-full bg-blue-400" /><span className="text-[10px] font-black text-slate-500 uppercase">Signups</span></div>
              </div>
           </div>
           
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={stats.activityTrend}>
                    <defs>
                       <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#126027" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#126027" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                       dataKey="day" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                       dy={10}
                    />
                    <YAxis hide />
                    <Tooltip 
                       labelFormatter={(_label, payload) => payload?.[0]?.payload?.dateLabel ?? ''}
                       contentStyle={{backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                       itemStyle={{fontSize: '12px', fontWeight: '800'}}
                    />
                    <Area 
                       type="monotone" 
                       dataKey="active" 
                       stroke="#126027" 
                       strokeWidth={4}
                       fillOpacity={1} 
                       fill="url(#colorActive)" 
                    />
                    <Area 
                       type="monotone" 
                       dataKey="signups" 
                       stroke="#60a5fa" 
                       strokeWidth={4}
                       fillOpacity={0} 
                    />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="glass-card p-8 flex flex-col">
           <h2 className="text-xl font-black text-slate-800 mb-2 text-center">Platform Capacity</h2>
           <p className="text-slate-400 text-xs font-bold mb-8 text-center">Modules vs Interactions</p>
           
           <div className="flex-1 flex flex-col justify-center space-y-10">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-forest flex items-center justify-center shadow-lg shadow-emerald-500/5">
                    <BookOpen size={28} />
                 </div>
                 <div className="flex-1">
                    <div className="flex justify-between mb-2">
                       <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Lesson Utility</span>
                       <span className="text-slate-800 font-black text-xs">88%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                       <div className="h-full bg-forest rounded-full" style={{width: '88%'}} />
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/5">
                    <Trophy size={28} />
                 </div>
                 <div className="flex-1">
                    <div className="flex justify-between mb-2">
                       <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Challenge ROI</span>
                       <span className="text-slate-800 font-black text-xs">64%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                       <div className="h-full bg-amber-500 rounded-full" style={{width: '64%'}} />
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/5">
                    <TrendingUp size={28} />
                 </div>
                 <div className="flex-1">
                    <div className="flex justify-between mb-2">
                       <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Carbon Delta</span>
                       <span className="text-slate-800 font-black text-xs">12.4%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 rounded-full" style={{width: '42%'}} />
                    </div>
                 </div>
              </div>
           </div>
           
           <button className="w-full py-4 mt-8 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-100 transition-all">
              Generate PDF Report
           </button>
        </div>
      </div>
    </div>
  );
};
