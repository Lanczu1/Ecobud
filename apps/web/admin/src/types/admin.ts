export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdById?: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface UserResetResponse {
  message: string;
}

export interface LessonCreateData {
  title: string;
  description: string;
  content: string;
  category: string;
  isPublished: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  status: 'active' | 'pending' | 'suspended';
  points: number;
  currentStreak: number;
  createdAt: string;
  lastActionDate: string | null;
  isOnlineNow: boolean;
  profile: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export interface AdminDashboardActivityPoint {
  active: number;
  date: string;
  dateLabel: string;
  day: string;
  signups: number;
}

export interface AdminDashboardStats {
  overview: {
    activeToday: number;
    lessonCompletions: number;
    onlineNow: number;
    onlineWindowMinutes: number;
    signupsToday: number;
    snapshotDate: string;
    totalChallenges: number;
    totalLessons: number;
    totalPoints: number;
    totalSignups: number;
    totalUsers: number;
  };
  activityTrend: AdminDashboardActivityPoint[];
}

export interface AdminRealtimeChannelMap {
  adminDashboard?: string;
  adminPresence?: string;
  adminUsers?: string;
  presenceMembers?: string;
}

export interface AdminRealtimeSessionPayload {
  enabled: boolean;
  channels: AdminRealtimeChannelMap | null;
}
