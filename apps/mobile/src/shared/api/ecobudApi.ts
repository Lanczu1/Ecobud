import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type {
  PresenceAppState,
  PresenceConnectionState,
  PresenceSyncResponse,
} from '../types/presence';

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

export interface RealtimeChannelMap {
  adminDashboard?: string;
  adminPresence?: string;
  adminUsers?: string;
  globalChallenges: string;
  globalLearn: string;
  presenceMembers?: string;
  userChallenges: string;
  userLearn: string;
  userNotice: string;
  userSwap?: string;
  userTracker: string;
}

export interface RealtimeSessionPayload {
  enabled: boolean;
  channels: RealtimeChannelMap | null;
}

export interface PresenceSyncRequest {
  sessionId?: string;
  appState: PresenceAppState;
  connectionState: PresenceConnectionState;
}

export interface DashboardData {
  streak: number;
  ecoPoints: number;
  ecoCoins: number;
  weeklyGoal: number;
  knowledgePoints: number;
  learningProgress: number;
  dailyTip: {
    title: string;
    description: string;
  };
  communityStats: {
    co2Saved: string;
    treesPlanted: number;
    communityMembers: number;
  };
}

export interface QuizQuestion {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
}

export interface LessonWithProgress {
  id: string;
  title: string;
  description: string;
  category?: string;
  difficulty?: string;
  content: string;
  is_published: boolean;
  created_at: string;
  progress: number;
  videoTimestamp?: number;
  status: 'not_started' | 'seen' | 'completed';
  imageUrl?: string | null;
  videoUrl?: string | null;
  transcript?: string | null;
  pointsReward?: number;
  durationMinutes?: number;
  hasQuiz?: boolean;
  featured?: boolean;
  quizQuestions?: QuizQuestion[];
  pages?: {
    id: string;
    title: string;
    description: string;
    content: string;
    order: number;
  }[];
  author?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
}

export interface ChallengeWithProgress {
  id: string;
  uniqueId?: string;
  title: string;
  description: string;
  difficulty: string;
  category: string | null;
  endDate?: string | null;
  expReward: number;
  ecoCoinReward: number;
  active: boolean;
  imageUrl: string | null;
  badgeLabel: string | null;
  type: string;
  aiDetectionTargets: string[];
  aiMinimumConfidence: number;
  isFeatured?: boolean;
  availableQuantity?: number;
  weeklyIncrementQuantity?: number;
  quantityUnit?: string;
  collectionPointName?: string;
  createdAt: string;
  updatedAt: string;
  deadlineLabel?: string;
  progress?: {
    progressPercentage: number;
    status: string;
    rejectionReason?: string | null;
    submissionId?: string;
    submission?: {
      id: string;
      status: string;
      proofUrl: string | null;
      afterProofUrl: string | null;
      detectedQuantity: number;
      reservedQuantity: number;
      qrToken: string | null;
      qrVerified: boolean;
      adminPreliminaryApproved: boolean;
      adminFinalApproved: boolean;
      rewardAwarded: boolean;
      ecoCoinsAwarded: number;
      expAwarded: number;
    };
    submissions?: any[];
  } | null;
  cycle?: {
    startDate: string;
    endDate: string;
    status: string;
    instanceId: string;
  };
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
  points: number;
  weeklyGoalProgress: number;
  completedDays: string[];
  logsByDate?: Record<string, { title: string; points: number }[]>;
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
  currentProgress?: number;
  targetProgress?: number;
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
    avatarUrl?: string | null;
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
  startDatetime: string;
  endDatetime: string;
  capacity: number;
  expReward: number;
  ecoCoinsReward?: number;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  spotsLeft?: number;
  isFeatured?: boolean;
  userStatus?: 'joined' | 'attended' | 'pending_approval' | 'rejected' | 'reward_claimed' | null;
  rejectionReason?: string;
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
  const headers: Record<string, string> = {};

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;

  try {
    const cacheBuster = path.includes('?') ? `&_cb=${Date.now()}` : `?_cb=${Date.now()}`;
    const url = `${API_BASE}${path}${cacheBuster}`;
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      `Unable to reach the ECOBUD API at ${apiOrigin}. Start apps/api first. If you are using Expo Go on a phone, set EXPO_PUBLIC_API_BASE_URL to http://YOUR_COMPUTER_IP:3000/api before starting Metro.`,
    );
  }

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const error = new Error(
      typeof data?.message === 'string' ? data.message : 'Unexpected ECOBUD API error.',
    );
    (error as any).status = response.status;
    throw error;
  }

  return data as T;
};

const uploadFileAsync = async <T>(path: string, token: string, uri: string, extraFields?: Record<string, string>) => {
  try {
    const uploadUrl = `${API_BASE}${path}`;

    if (Platform.OS === 'web') {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const formData = new FormData();
        
        if (extraFields) {
          Object.entries(extraFields).forEach(([key, value]) => {
            formData.append(key, value);
          });
        }
        
        formData.append('image', blob, 'upload.jpg');
        
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });
        
        let data;
        try {
          data = await res.json();
        } catch {}

        if (!res.ok) {
          const error = new Error(typeof data?.message === 'string' ? data.message : 'Unexpected ECOBUD API error.');
          (error as any).status = res.status;
          throw error;
        }

        return data as T;
      } catch (err: any) {
        if (err.message && (err.message.includes('Unexpected ECOBUD API error') || err.message.includes('Active AI challenge'))) {
          throw err;
        }
        throw new Error(err.message || `Unable to reach the ECOBUD API at ${apiOrigin}.`);
      }
    }

    const uploadType = (FileSystem as any).FileSystemUploadType?.MULTIPART ?? (FileSystem as any).UploadType?.MULTIPART ?? 1;
    
    const response = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: 'POST',
      uploadType: uploadType,
      fieldName: 'image',
      mimeType: 'image/jpeg',
      headers: {
        Authorization: `Bearer ${token}`
      },
      ...(extraFields ? { parameters: extraFields } : {})
    });

    let data;
    try {
      data = JSON.parse(response.body);
    } catch {}

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(typeof data?.message === 'string' ? data.message : 'Unexpected ECOBUD API error.');
      (error as any).status = response.status;
      throw error;
    }

    return data as T;
  } catch (err: any) {
    if (err.message && (err.message.includes('Unexpected ECOBUD API error') || err.message.includes('Active AI challenge'))) {
      throw err;
    }
    throw new Error(err.message || `Unable to reach the ECOBUD API at ${apiOrigin}.`);
  }
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
  fetchRealtimeSession: (token: string) =>
    request<RealtimeSessionPayload>('/realtime/session', { token }),
  connectPresence: (token: string, payload: PresenceSyncRequest) =>
    request<PresenceSyncResponse>('/realtime/presence/connect', {
      method: 'POST',
      token,
      body: payload,
    }),
  heartbeatPresence: (token: string, payload: PresenceSyncRequest) =>
    request<PresenceSyncResponse>('/realtime/presence/heartbeat', {
      method: 'POST',
      token,
      body: payload,
    }),
  disconnectPresence: (token: string, payload: PresenceSyncRequest) =>
    request<PresenceSyncResponse>('/realtime/presence/disconnect', {
      method: 'POST',
      token,
      body: payload,
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
    request<{ lessonId: string; status: LessonWithProgress['status']; progress: number; videoTimestamp?: number; awardedBadges?: EcoBadge[]; pointsAwarded?: number; ecoCoinsAwarded?: number }>('/learn/complete', {
      method: 'POST',
      token,
      body: { lessonId },
    }),
  updateLessonProgress: (token: string, lessonId: string, progress: number, videoTimestamp?: number) =>
    request<{ lessonId: string; status: LessonWithProgress['status']; progress: number; videoTimestamp?: number }>('/learn/progress', {
      method: 'POST',
      token,
      body: { lessonId, progress, videoTimestamp },
    }),
  resetKnowledgePoints: (token: string, userId?: string) =>
    request<{ userId: string; previousKnowledgePoints: number; knowledgePoints: number }>('/user/reset-knowledge', {
      method: 'POST',
      token,
      body: userId ? { userId } : {},
    }),
  fetchChallenges: (token: string) =>
    request<{ items: ChallengeWithProgress[]; isCycleActive?: boolean }>('/challenges/active', { token }),
  analyzeChallengeImage: (token: string, challengeId: string, uri: string) =>
    uploadFileAsync<{ passed: boolean; object: string; confidence: number; reason?: string; proofUrl?: string }>(
      `/challenges/${challengeId}/analyze`,
      token,
      uri
    ),
  uploadChallengeProofImage: (token: string, challengeId: string, uri: string) =>
    uploadFileAsync<{ proofUrl: string }>(
      `/challenges/${challengeId}/upload-proof`,
      token,
      uri
    ),
  submitChallengeProof: (token: string, challengeId: string, proofUrl: string, afterProofUrl?: string, detectedQuantity?: number) =>
    request(`/challenges/${challengeId}/submissions`, {
      method: 'POST',
      token,
      body: { proofUrl, afterProofUrl, detectedQuantity: detectedQuantity || 1 },
    }),
  verifyChallengeQr: (token: string, challengeId: string, qrData: string, latitude?: number, longitude?: number, submissionId?: string) =>
    request<{ message: string; submission: any }>(`/challenges/${challengeId}/verify-qr`, {
      method: 'POST',
      token,
      body: { qrData, latitude, longitude, submissionId },
    }),
  submitChallengeAfterPhoto: (token: string, challengeId: string, afterProofUrl: string, submissionId?: string) =>
    request<{ message: string; submission: any }>(`/challenges/${challengeId}/after-photo`, {
      method: 'POST',
      token,
      body: { afterProofUrl, submissionId },
    }),
  claimChallengeReward: (token: string, challengeId: string, submissionId?: string) =>
    request<{ message: string; awardedBadges?: EcoBadge[] }>(`/challenges/${challengeId}/claim`, {
      method: 'POST',
      token,
      body: { submissionId },
    }),
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
  uploadAvatar: (token: string, uri: string) =>
    uploadFileAsync<{ avatarUrl: string }>(
      '/users/me/avatar',
      token,
      uri
    ),
  updateSecuritySettings: (token: string, payload: { currentPassword: string; newEmail?: string; newPassword?: string }) =>
    request<{ success: boolean; message: string }>('/users/me/security', {
      method: 'PATCH',
      token,
      body: payload,
    }),
  fetchRewards: (token: string) =>
    request<RewardsData>('/experience/rewards', { token }),
  fetchLeaderboard: (token: string) =>
    request<LeaderboardData>('/experience/leaderboard', { token }),
  fetchEvents: (token?: string) =>
    request<{ items: EcoEvent[] }>('/events', token ? { token } : undefined),
  joinEvent: (token: string, eventId: string) =>
    request(`/events/${eventId}/join`, { method: 'POST', token, body: {} }),
  submitEventAttendance: (token: string, eventId: string, imageUri: string, qrData: string) => {
    return uploadFileAsync<{ success: boolean; message: string }>(
      `/events/${eventId}/submissions`,
      token,
      imageUri,
      { qrData }
    );
  },
  claimEventReward: (token: string, eventId: string) =>
    request<{ pointsAwarded: number; ecoCoinsAwarded: number; alreadyCompleted?: boolean }>(
      `/events/${eventId}/claim`,
      { method: 'POST', token, body: {} }
    ),
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
  sendAssistantMessage: (token: string, message: string, history: { role: 'user' | 'assistant'; content: string }[] = []) =>
    request<{ reply: string; quickReplies: string[] }>('/experience/assistant/chat', {
      method: 'POST',
      token,
      body: { message, history },
    }),

  // ─── Give & Get Hub (Swap) ───────────────────────────────────────────────
  fetchSwapListings: (token: string, params?: {
    search?: string;
    category?: string;
    meetupMethod?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.meetupMethod) query.set('meetupMethod', params.meetupMethod);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request<any[]>(`/swap/listings${qs ? `?${qs}` : ''}`, { token });
  },
  fetchSwapListingById: (token: string, id: string) =>
    request<any>(`/swap/listings/${id}`, { token }),
  createSwapListing: (token: string, body: any) =>
    request<any>('/swap/listings', { method: 'POST', token, body }),
  updateSwapListing: (token: string, id: string, body: any) =>
    request<any>(`/swap/listings/${id}`, { method: 'PATCH', token, body }),
  deleteSwapListing: (token: string, id: string) =>
    request<void>(`/swap/listings/${id}`, { method: 'DELETE', token }),
  uploadSwapImage: async (token: string, uri: string) => {
    const res = await uploadFileAsync<{ url: string }>('/swap/upload-image', token, uri);
    return res.url;
  },
  sendSwapRequest: (token: string, body: { listingId: string; message?: string }) =>
    request<any>('/swap/requests', { method: 'POST', token, body }),
  updateSwapRequestStatus: (token: string, requestId: string, status: string) =>
    request<any>(`/swap/requests/${requestId}/status`, { method: 'PATCH', token, body: { status } }),
  fetchSwapConversations: (token: string) =>
    request<any[]>('/swap/conversations', { token }),
  fetchSwapMessages: (token: string, swapRequestId: string) =>
    request<any[]>(`/swap/conversations/${swapRequestId}/messages`, { token }),
  sendSwapMessage: (token: string, swapRequestId: string, text: string, imageUrl?: string) =>
    request<any>(`/swap/conversations/${swapRequestId}/messages`, {
      method: 'POST',
      token,
      body: { text, imageUrl },
    }),
  markSwapMessagesRead: (token: string, swapRequestId: string) =>
    request<void>(`/swap/conversations/${swapRequestId}/read`, { method: 'PATCH', token }),
  fetchMySwapListings: (token: string) =>
    request<any[]>('/swap/my-listings', { token }),

  // Redeem
  fetchRedeemItems: (token: string) =>
    request<any[]>('/redeem/items', { token }),
  redeemItem: (token: string, itemId: string) =>
    request<any>('/redeem/redeem', { method: 'POST', token, body: { itemId } }),
  fetchMyRedeemRequests: (token: string) =>
    request<any[]>('/redeem/my-requests', { token }),
  claimRedeemRequest: (token: string, requestId: string) =>
    request<any>(`/redeem/requests/${requestId}/claim`, { method: 'PATCH', token }),
};

export const ecobudApiOrigin = apiOrigin;
