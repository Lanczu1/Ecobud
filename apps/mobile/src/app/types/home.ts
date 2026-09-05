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

export type AppTab = 'home' | 'learn' | 'challenges' | 'tracker' | 'profile' | 'marketplace';
export type OverlayScreen = 'assistant' | 'events' | 'lesson' | 'quiz' | 'lessonCompleted' | 'leaderboard' | 'rewards' | 'transparency' | 'ai_mission' | 'claimParticles' | 'streakUnlocked' | 'streakRewards' | 'badgeUnlocked' | 'settings' | 'editProfile' | 'coinsHistory' | 'eventApproved' | 'redeemPoints' | 'notifications' | 'ecoLevels' | null;
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
  userAvatarUrl?: string;
  notificationCount: number;
  hasUsableInternet: boolean;
  showBack?: boolean;
  title?: string;
  onBack?: () => void;
  onProfilePress?: () => void;
  onEventsPress?: () => void;
  onTrackerPress?: () => void;
  onNotificationsPress?: () => void;
  onAssistantPress?: () => void;
}

export interface SummaryCardsProps {
  currentStreak: number;
  ecoPoints: number;
  onPressRewards?: () => void;
  onOpenStreakOverlay?: () => void;
  lastSevenDays?: Date[];
  completedDays?: string[];
  style?: any;
}

export interface ActiveChallengeCardProps {
  dailyChallenge: ChallengeWithProgress;
  onComplete: () => void;
  onClaim?: (origin?: { x: number; y: number }) => void;
  isViewed?: boolean;
  isCycleActive?: boolean;
}

export interface UpcomingEventCardProps {
  event: EcoEvent;
  isReadOnly?: boolean;
  onJoin?: () => void;
  onSignIn?: () => void;
  onRecordAttendance?: () => void;
  onClaimReward?: () => void;
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
  isCycleActive: boolean;
  habitsToday: HabitTodayData | null;
  tracker: TrackerData | null;
  profile: ProfileData | null;
  rewards: RewardsData | null;
  newlyUnlockedBadges: EcoBadge[];
  setNewlyUnlockedBadges: (badges: EcoBadge[]) => void;
  selectedBadge: EcoBadge | null;
  setSelectedBadge: (badge: EcoBadge | null) => void;
  openBadgeOverlay: (badge: EcoBadge) => void;
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
  challengesViewMode: 'Discover' | 'My Tasks' | 'History';
  setChallengesViewMode: (mode: 'Discover' | 'My Tasks' | 'History') => void;
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
  handleGoogleSignIn: () => Promise<{
    requiresBarangay: boolean;
    email: string;
    displayName: string;
    avatarUrl: string;
    onConfirmBarangay: (chosenBarangay: string) => Promise<void>;
  } | void>;
  handleSignUpArgs: (username: string, email: string, pass: string, city: string, otpCode?: string) => Promise<void>;
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
  handleClaimEventReward: (eventId: string) => Promise<void>;
  handleAssistantSend: (seedMessage?: string) => Promise<void>;
  loadTrackerMonth: (offset: number) => Promise<void>;
  analyzeChallengeImage: (challengeId: string, uri: string) => Promise<{
    passed: boolean;
    object: string;
    confidence: number;
    reason?: string;
    proofUrl?: string;
    detectedCount?: number;
    targetQuantity?: number;
    calculatedExpReward?: number;
    calculatedEcoCoins?: number;
    box_2d?: [number, number, number, number] | null;
  }>;
  uploadChallengeProofImage: (challengeId: string, uri: string) => Promise<{ proofUrl: string }>;
  handleSubmitChallengeProof: (challengeId: string, proofUrl: string, afterProofUrl?: string, detectedQuantity?: number, analysisToken?: string, proofText?: string) => Promise<void>;
  handleVerifyChallengeQr: (challengeId: string, qrData: string, latitude?: number, longitude?: number, submissionId?: string) => Promise<void>;
  handleSubmitChallengeAfterPhoto: (challengeId: string, afterProofUrl: string, submissionId?: string) => Promise<void>;
  handleClaimChallengeReward: (challengeId: string, origin?: { x: number; y: number }, submissionId?: string) => Promise<void>;
  handleUpdateProfileImage: (uri: string) => Promise<any>;
  handleUpdateProfile: (payload: { displayName?: string; email?: string; city?: string }) => Promise<void>;
  handleUpdateSecuritySettings: (payload: { currentPassword: string; newEmail?: string; newPassword?: string }) => Promise<void>;
  coachMarksCurrentStep: number;
  setCoachMarksCurrentStep: (step: number) => void;
  coachMarksVisible: boolean;
  completeCoachMarks: () => void;
  showCoachMarks: () => void;
  spotlightTargetRect: { x: number; y: number; width: number; height: number; borderRadius?: number } | null;
  setSpotlightTargetRect: (rect: { x: number; y: number; width: number; height: number; borderRadius?: number } | null) => void;
  /** Real measured screen position of the LevelCard progress bar, for accurate particle targeting */
  progressBarLayout: { x: number; y: number; width: number; height: number } | null;
  setProgressBarLayout: (layout: { x: number; y: number; width: number; height: number } | null) => void;
  /** Whether the floating leaf mascot AI chatbot is enabled or hidden by the user */
  isChatbotEnabled: boolean;
  setChatbotEnabled: (enabled: boolean) => Promise<void>;
}
