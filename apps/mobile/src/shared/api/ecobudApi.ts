import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeApiBase = (value: string) => {
  const normalized = trimTrailingSlash(value.trim());
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

const readEnvApiBase = () => {
  const envValue =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.EXPO_PUBLIC_API_ORIGIN;

  return envValue?.trim() ? normalizeApiBase(envValue) : null;
};

const extractHost = (value: string) => {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    if (normalizedValue.includes('://')) {
      return new URL(normalizedValue).hostname;
    }

    return new URL(`http://${normalizedValue}`).hostname;
  } catch {
    return normalizedValue.split(':')[0] ?? null;
  }
};

const readMetroHost = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }

  const runtimeCandidates = [
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
    Constants.experienceUrl,
    NativeModules.SourceCode?.scriptURL,
  ];

  for (const candidate of runtimeCandidates) {
    if (!candidate) {
      continue;
    }

    const host = extractHost(candidate);
    if (host) {
      return host;
    }
  }

  return null;
};

const resolveApiBase = () => {
  const envApiBase = readEnvApiBase();
  if (envApiBase) {
    return envApiBase;
  }

  const metroHost = readMetroHost();
  if (metroHost && !(Platform.OS === 'android' && ['localhost', '127.0.0.1'].includes(metroHost))) {
    return `http://${metroHost}:3000/api`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }

  return 'http://localhost:3000/api';
};

const API_BASE = resolveApiBase();
const apiOrigin = API_BASE.replace(/\/api$/, '');

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  points: number;
  currentStreak: number;
  displayName: string;
  avatarUrl: string | null;
}

export interface SessionPayload {
  token: string;
  redirectPath: string;
  user: SessionUser;
}

export interface DashboardData {
  streak: number;
  ecoPoints: number;
  weeklyGoal: number;
}

export interface LessonWithProgress {
  id: string;
  title: string;
  description: string;
  content: string;
  is_published: boolean;
  created_at: string;
  progress: number;
  status: 'not_started' | 'seen' | 'completed';
  author?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
}

export interface ChallengeWithProgress {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category?: string | null;
  durationDays: number;
  pointsReward: number;
  imageUrl?: string | null;
  badgeLabel?: string | null;
  progressPercentage?: number;
  deadlineLabel?: string;
  progress?: {
    progressPercentage: number;
    status: string;
  } | null;
}

export interface HabitItem {
  id: string;
  slug: string;
  title: string;
  pointsReward: number;
  completedToday: boolean;
}

export interface HabitSummary {
  dateKey: string;
  items: HabitItem[];
  pointsEarnedToday: number;
}

export interface TrackerData {
  month: string;
  currentStreak: number;
  weeklyGoalProgress: number;
  completedDays: string[];
  todayHabits: HabitItem[];
}

export interface EcoBadge {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  requiredPoints: number;
  accentColor?: string | null;
  unlocked?: boolean;
}

export interface RewardsData {
  points: number;
  badges: EcoBadge[];
  achievements: {
    id: string;
    label: string;
    current: number;
    target: number;
    reward: number;
  }[];
}

export interface LeaderboardData {
  scope: string;
  currentUserRank: number | null;
  items: {
    rank: number;
    id: string;
    displayName: string;
    points: number;
    badges: string[];
    isCurrentUser: boolean;
  }[];
}

export interface EcoEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  capacity: number;
  pointsReward: number;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  spotsLeft?: number;
}

export interface TransparencyFeed {
  metrics: {
    totalActions: number;
    totalRewards: number;
    activeParticipants: number;
  };
  logs: {
    id: string;
    publicLabel: string;
    actionType: string;
    pointsAwarded: number;
    currentHash: string;
    previousHash: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  }[];
}

export interface ProfileData {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  status?: string | null;
  points: number;
  currentStreak: number;
  profile: {
    displayName: string;
    avatarUrl?: string | null;
    headline?: string | null;
    city?: string | null;
  } | null;
  badges: EcoBadge[];
  eventHistory: (EcoEvent & { status: string; attendedAt?: string | null })[];
  progress: {
    lessonsCompleted: number;
    activeChallenges: number;
  };
  recentLogs: TransparencyFeed['logs'];
}

interface RequestOptions {
  body?: unknown;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  token?: string;
}

const parseJsonSafely = async (response: Response) => {
  const rawBody = await response.text();
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const request = async <T>(path: string, options: RequestOptions = {}) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(
      `Unable to reach the ECOBUD API at ${apiOrigin}. Start apps/api first. If you are using Expo Go on a phone, set EXPO_PUBLIC_API_BASE_URL to http://YOUR_COMPUTER_IP:3000/api before starting Metro.`,
    );
  }

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(
      typeof data?.message === 'string' ? data.message : 'Unexpected ECOBUD API error.',
    );
  }

  return data as T;
};

export const ecobudApi = {
  login: (email: string, password: string) =>
    request<SessionPayload>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  checkUsernameAvailability: (displayName: string) =>
    request<{ available: boolean; message: string }>(
      `/auth/check-username?displayName=${encodeURIComponent(displayName.trim())}`,
    ),
  register: (email: string, password: string, displayName: string, otpCode: string) =>
    request<SessionPayload>('/auth/register', {
      method: 'POST',
      body: { email, password, displayName, otpCode },
    }),
  sendOTP: (email: string) =>
    request<{ success: boolean; message: string }>('/auth/send-otp', {
      method: 'POST',
      body: { email },
    }),
  fetchDashboard: (token: string) =>
    request<DashboardData>('/home/dashboard', { token }),
  fetchLessons: (token: string) =>
    request<LessonWithProgress[]>('/learn/lessons', { token }),
  markLessonSeen: (token: string, lessonId: string) =>
    request<{ lessonId: string; status: LessonWithProgress['status']; progress: number }>('/learn/seen', {
      method: 'POST',
      token,
      body: { lessonId },
    }),
  completeLesson: (token: string, lessonId: string) =>
    request<{ lessonId: string; status: LessonWithProgress['status']; progress: number }>('/learn/complete', {
      method: 'POST',
      token,
      body: { lessonId },
    }),
  resetKnowledgePoints: (token: string, userId?: string) =>
    request<{ userId: string; previousKnowledgePoints: number; knowledgePoints: number }>('/user/reset-knowledge', {
      method: 'POST',
      token,
      body: userId ? { userId } : {},
    }),
  fetchChallenges: (token: string) =>
    request<{ items: ChallengeWithProgress[] }>('/challenges/active', { token }),
  updateChallengeProgress: (token: string, challengeId: string, progressPercentage: number) =>
    request(`/challenges/${challengeId}/progress`, {
      method: 'POST',
      token,
      body: { progressPercentage },
    }),
  fetchHabitsToday: (token: string) =>
    request<HabitSummary>('/habits/today', { token }),
  checkInHabit: (token: string, habitId: string) =>
    request(`/habits/${habitId}/check-in`, { method: 'POST', token }),
  fetchTracker: (token: string, month?: string) =>
    request<TrackerData>(`/experience/tracker${month ? `?month=${month}` : ''}`, { token }),
  fetchProfile: (token: string) =>
    request<ProfileData>('/users/me', { token }),
  fetchRewards: (token: string) =>
    request<RewardsData>('/experience/rewards', { token }),
  fetchLeaderboard: (token: string) =>
    request<LeaderboardData>('/experience/leaderboard', { token }),
  fetchEvents: () =>
    request<{ items: EcoEvent[] }>('/events'),
  joinEvent: (token: string, eventId: string) =>
    request(`/events/${eventId}/join`, { method: 'POST', token }),
  fetchTransparency: async (token: string) => {
    const [metrics, logs] = await Promise.all([
      request<TransparencyFeed['metrics']>('/transparency/metrics'),
      request<{ items: TransparencyFeed['logs'] }>('/transparency/logs?page=1&pageSize=12', {
        token,
      }),
    ]);

    return { metrics, logs: logs.items };
  },
  fetchPublicTransparency: async () => {
    const [metrics, logs] = await Promise.all([
      request<TransparencyFeed['metrics']>('/transparency/metrics'),
      request<{ items: TransparencyFeed['logs'] }>('/transparency/logs?page=1&pageSize=12'),
    ]);

    return { metrics, logs: logs.items };
  },
  sendAssistantMessage: (token: string, message: string) =>
    request<{ reply: string; quickReplies: string[] }>('/experience/assistant/chat', {
      method: 'POST',
      token,
      body: { message },
    }),
};

export const ecobudApiOrigin = apiOrigin;
