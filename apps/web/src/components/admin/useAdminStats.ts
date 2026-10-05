import { useEffect, useState } from 'react';
import { adminGet, getCachedAdminData, clearAdminApiCache } from '../../utils/adminApi';
import { adminRealtimeService } from '../../services/adminRealtimeService';

export interface DashboardStats {
  overview: {
    totalUsers: number;
    signupsToday: number;
    totalLessons: number;
    totalChallenges: number;
    totalCoinsRedeemed: number;
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

export function useAdminStats(loadErrorMessage: string) {
  const [stats, setStats] = useState<DashboardStats | null>(() => getCachedAdminData<DashboardStats>('/admin/stats'));
  const [loading, setLoading] = useState(() => !getCachedAdminData<DashboardStats>('/admin/stats'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStats(isInitial = false) {
      if (isInitial && !stats) setLoading(true);
      try {
        const statsData = await adminGet<DashboardStats>('/admin/stats');
        if (isMounted) {
          setStats(statsData);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted && isInitial && !stats) {
          setError(err.message || loadErrorMessage);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadStats(true);

    let unsubscribe: (() => void) | undefined;
    adminRealtimeService.connect({
      onStatsRefresh: () => {
        clearAdminApiCache('/admin/stats');
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

  return { stats, loading, error };
}
