import {
  type ChallengeWithProgress,
  type DashboardData,
  type EcoBadge,
  type EcoEvent,
  type LeaderboardData,
  type LessonWithProgress,
  type ProfileData,
  type RewardsData,
  type SessionPayload,
  type TrackerData,
  type TransparencyFeed,
  type HabitSummary,
} from '../../shared/api/ecobudApi';

export type {
  ChallengeWithProgress,
  DashboardData,
  EcoBadge,
  EcoEvent,
  LeaderboardData,
  LessonWithProgress,
  ProfileData,
  RewardsData,
  SessionPayload,
  TrackerData,
  TransparencyFeed,
  HabitSummary,
};

// ─── Enums & Literals ──────────────────────────────────────────────────────────

export type AppTab = 'home' | 'learn' | 'challenges' | 'tracker' | 'profile';
export type OverlayScreen = 'assistant' | 'events' | 'lesson' | 'leaderboard' | 'rewards' | 'transparency' | null;
export type AuthMode = 'member' | 'admin';

// ─── Core Data Interfaces ──────────────────────────────────────────────────────

export interface HabitTodayItem {
  id: string;
  slug: string;
  title: string;
  pointsReward: number;
  completedToday: boolean;
}

export interface HabitTodayData {
  dateKey: string;
  items: HabitTodayItem[];
  pointsEarnedToday: number;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  time: string;
}

// ─── Component Props ───────────────────────────────────────────────────────────

export interface HeaderProps {
  userDisplayName: string;
  notificationCount: number;
  isUserOnline: boolean;
  showBack?: boolean;
  title?: string;
  onBack?: () => void;
}

export interface SummaryCardsProps {
  currentStreak: number;
  ecoPoints: number;
}

export interface ActiveChallengeCardProps {
  dailyChallenge: ChallengeWithProgress;
  onComplete: () => void;
}

export interface UpcomingEventCardProps {
  event: EcoEvent;
  isReadOnly: boolean;
  onJoin: () => void;
  onSignIn: () => void;
}

export interface QuickActionsProps {
  weeklyGoal: number;
}

export interface CommunityImpactCardProps {
  co2Saved: string;
  treesPlanted: number;
  communityMembers: number;
}

// ─── Hook Model Interface ──────────────────────────────────────────────────────

/**
 * The consolidated state and handlers returned by the useHomeDashboard hook.
 */
export interface EcoBudMobileModel {
  initializing: boolean;
  booting: boolean;
  hasOnboarded: boolean;
  session: SessionPayload | null;
  isReadOnlyExperience: boolean;
  actionOverlayVisible: boolean;
  actionOverlayLabel: string;
  activeTab: AppTab;
  activeOverlay: OverlayScreen;
  selectedLesson: LessonWithProgress | null;
  learnSearch: string;
  assistantInput: string;
  assistantMessages: AssistantMessage[];
  authEmail: string;
  authPassword: string;
  authMode: AuthMode;
  authLoading: boolean;
  authError: string | null;
  refreshing: boolean;
  sendingMessage: boolean;
  dashboard: DashboardData | null;
  lessons: LessonWithProgress[];
  filteredLessons: LessonWithProgress[];
  challenges: ChallengeWithProgress[];
  habitsToday: HabitTodayData | null;
  tracker: TrackerData | null;
  profile: ProfileData | null;
  rewards: RewardsData | null;
  leaderboard: LeaderboardData | null;
  events: EcoEvent[];
  transparency: TransparencyFeed | null;
  todaysCompletedHabits: number;
  userDisplayName: string;
  isUserOnline: boolean;
  notificationCount: number;
  setActiveTab: (tab: AppTab) => void;
  setActiveOverlay: (screen: OverlayScreen) => void;
  setLearnSearch: (value: string) => void;
  setAssistantInput: (value: string) => void;
  setAuthEmail: (value: string) => void;
  setAuthPassword: (value: string) => void;
  completeOnboarding: () => Promise<void>;
  continueWithReadOnlyAccess: () => Promise<void>;
  leaveReadOnlyAccess: () => Promise<void>;
  handleLoginArgs: (email: string, pass: string) => Promise<void>;
  handleSignUpArgs: (username: string, email: string, pass: string, otpCode?: string) => Promise<void>;
  handleSendOTP: (email: string) => Promise<{ success: boolean; message: string }>;
  handleCheckUsernameAvailability: (displayName: string) => Promise<{ available: boolean; message: string }>;
  handleLogout: () => Promise<void>;
  refreshEverything: () => Promise<void>;
  openLesson: (lessonId: string) => Promise<void>;
  handleCompleteLesson: () => Promise<void>;
  handleChallengeProgress: (challenge: ChallengeWithProgress, nextProgress: number) => Promise<void>;
  handleHabitCheckIn: (habitId: string) => Promise<void>;
  handleJoinEvent: (eventId: string) => Promise<void>;
  handleAssistantSend: (seedMessage?: string) => Promise<void>;
  loadTrackerMonth: (offset: number) => Promise<void>;
}
