import {
  type ChallengeWithProgress,
  type DashboardData,
  type EcoBadge,
  type EcoEvent,
  type LeaderboardData,
  type LessonWithProgress,
  type ProfileData,
  type QuizQuestion,
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
  QuizQuestion,
  RewardsData,
  SessionPayload,
  TrackerData,
  TransparencyFeed,
  HabitSummary,
};

// ─── Enums & Literals ──────────────────────────────────────────────────────────

export type AppTab = 'home' | 'learn' | 'challenges' | 'tracker' | 'profile';
export type OverlayScreen = 'assistant' | 'events' | 'lesson' | 'quiz' | 'lessonCompleted' | 'leaderboard' | 'rewards' | 'transparency' | 'ai_mission' | 'claimParticles' | 'streakUnlocked' | 'streakRewards' | null;
export type AuthMode = 'member' | 'admin';
export type LearnFilterType = 'all' | 'not_started' | 'seen' | 'completed';

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
  hasUsableInternet: boolean;
  showBack?: boolean;
  title?: string;
  onBack?: () => void;
  onEventsPress?: () => void;
}

export interface SummaryCardsProps {
  currentStreak: number;
  ecoPoints: number;
  onPressRewards?: () => void;
  lastSevenDays?: Date[];
  completedDays?: string[];
}

export interface ActiveChallengeCardProps {
  dailyChallenge: ChallengeWithProgress;
  onComplete: () => void;
  onClaim?: () => void;
  isViewed?: boolean;
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
  selectedChallenge: ChallengeWithProgress | null;
  recentViewedMission: ChallengeWithProgress | null;
  viewedMissionIds: string[];
  quizQuestions: QuizQuestion[];
  currentQuestionIndex: number;
  selectedAnswer: string | null;
  quizAnswers: Record<string, string>;
  quizCompleted: boolean;
  quizScore: number;
  earnedPoints: number;
  earnedCoins: number;
  completionCelebrationType: 'quiz' | 'lesson' | 'claim';
  learnSearch: string;
  learnFilter: LearnFilterType;
  learnCategory: string;
  assistantInput: string;
  assistantMessages: AssistantMessage[];
  assistantQuickReplies: string[];
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
  hasUsableInternet: boolean;
  isUserOnline: boolean;
  notificationCount: number;
  claimRewardData: { points: number; coins: number; origin?: { x: number; y: number } } | null;
  triggerTestReward: (origin?: { x: number; y: number }) => void;
  setActiveTab: (tab: AppTab, silent?: boolean) => void;
  setActiveOverlay: (screen: OverlayScreen) => void;
  setLearnSearch: (value: string) => void;
  setLearnFilter: (value: LearnFilterType) => void;
  setLearnCategory: (value: string) => void;
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
  openChallengeMission: (challenge: ChallengeWithProgress) => void;
  openLesson: (lessonId: string) => Promise<void>;
  handleCompleteLesson: () => Promise<void>;
  handleUpdateLessonProgress: (lessonId: string, progress: number, videoTimestamp?: number) => Promise<void>;
  startQuiz: () => void;
  selectAnswer: (questionId: string, answer: string) => void;
  nextQuestion: () => void;
  submitQuiz: () => Promise<void>;
  resetQuiz: () => void;
  showLessonComplete: (type: 'quiz' | 'lesson' | 'claim') => void;
  handleChallengeProgress: (challenge: ChallengeWithProgress, nextProgress: number) => Promise<void>;
  handleHabitCheckIn: (habitId: string) => Promise<void>;
  handleJoinEvent: (eventId: string) => Promise<void>;
  handleAssistantSend: (seedMessage?: string) => Promise<void>;
  loadTrackerMonth: (offset: number) => Promise<void>;
  analyzeChallengeImage: (challengeId: string, uri: string) => Promise<{ passed: boolean; object: string; confidence: number; reason?: string; proofUrl?: string }>;
  handleSubmitChallengeProof: (challengeId: string, proofUrl: string) => Promise<void>;
  handleClaimChallengeReward: (challengeId: string) => Promise<void>;
}
