import { getQuizLessonProgress, getVideoProgressLimit, isLocalLessonProgressNewer } from '../utils/lessonProgress';
import { useNotifications } from './useNotifications';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Alert, DeviceEventEmitter, AppState, Platform, ToastAndroid } from 'react-native';
import { homeService } from '../services/homeService';
import {
  type AppTab,
  type AssistantMessage,
  type AssistantNotice,
  type AuthMode,
  type EcoBudMobileModel,
  type HabitTodayData,
  type ChallengeWithProgress,
  type DashboardData,
  type EcoEvent,
  type LeaderboardData,
  type LearnFilterType,
  type LessonWithProgress,
  type ProfileData,
  type QuizQuestion,
  type RewardsData,
  type SessionPayload,
  type MfaChallengePayload,
  type TrackerData,
  type TransparencyFeed,
  type OverlayScreen,
} from '../types/home';
import { usePresence } from '../../shared/presence/usePresence';
import { offlineSyncService } from '../../shared/offline/offlineSyncService';
import type { CreateOfflineMutationInput } from '../../shared/offline/offlineMutationQueue.types';
import { mobileStorage } from '../../shared/storage/mobileStorage';
import { supabaseClient } from '../../shared/supabase/supabaseClient';
import { realtimeService } from '../../shared/supabase/realtimeService';
import { type EcoBadge } from '../../shared/api/ecobudApi';
import { shiftMonth } from '../utils/appUtils';
import { triggerImpactLight, triggerSuccessHaptic, triggerWarningHaptic } from '../utils/haptics';
import { coachMarkSpotlightStore } from '../utils/coachMarkSpotlightStore';
import { useInAppNotification } from '../../shared/ui/InAppNotification';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// --- Constants ---

const SESSION_STORAGE_KEY = 'ecobud.mobile.session';
const ONBOARDING_STORAGE_KEY = 'ecobud.mobile.onboarding';
const VIEWED_MISSIONS_KEY = 'ecobud.mobile.viewedMissions';
const RECENT_VIEWED_KEY = 'ecobud.mobile.recentViewedMission';
const CHATBOT_ENABLED_STORAGE_KEY = 'ecobud.mobile.chatbotEnabled';
const CHATBOT_SIZE_STORAGE_KEY = 'ecobud.mobile.chatbotSize';
const PUSH_NOTIFICATIONS_ENABLED_STORAGE_KEY = 'ecobud.mobile.pushNotificationsEnabled';
const CACHED_HOME_DATA_STORAGE_KEY = 'ecobud.mobile.cached_home_data';
type FocusedResource = 'lessons' | 'challenges' | 'events';
const FOCUSED_REFRESH_INTERVAL_MS = 60_000;
type SecondaryResource = 'tracker' | 'profile' | 'rewards' | 'leaderboard' | 'transparency';
const SECONDARY_REFRESH_INTERVAL_MS = 5 * 60_000;

// --- Internal Utilities ---

function formatChatTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const formatPhParts = (date: Date, options: Intl.DateTimeFormatOptions) => {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    ...options,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return get;
};

const getPhDateKey = (date: Date = new Date()): string => {
  const get = formatPhParts(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const getPhMonthKey = (date: Date = new Date()): string => getPhDateKey(date).slice(0, 7);

// --- Hook ---

export function useHomeDashboard(): EcoBudMobileModel {
  const { showNotification } = useInAppNotification();
  const [initializing, setInitializing] = useState(true);
  const [booting, setBooting] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    try {
      return mobileStorage.getItemSync(ONBOARDING_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [notificationDestination, setNotificationDestination] = useState<{type:string;id:string}|null>(null);
  const [pendingNotificationId, setPendingNotificationId] = useState<string|null>(null);
  const [pushNotificationsEnabled, setPushNotificationsEnabledState] = useState(true);
  const notificationCount = useNotifications(session?.token, pushNotificationsEnabled);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  useEffect(() => { const sub = DeviceEventEmitter.addListener('openNotification', (id: string) => { setActiveOverlayState('notifications'); setPendingNotificationId(id); }); return () => sub.remove(); }, []);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [activeTab, setActiveTabState] = useState<AppTab>('home');
  const [tabHistory, setTabHistory] = useState<AppTab[]>(['home']);
  const lastBackPressRef = useRef<number>(0);
  const [challengesViewMode, setChallengesViewMode] = useState<'Discover' | 'My Tasks' | 'History'>('Discover');
  const [activeOverlay, setActiveOverlayState] = useState<OverlayScreen>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeWithProgress | null>(null);
  const [recentViewedMission, setRecentViewedMission] = useState<ChallengeWithProgress | null>(null);
  const [viewedMissionIds, setViewedMissionIds] = useState<string[]>([]);
  const [learnSearch, setLearnSearch] = useState('');
  const [learnFilter, setLearnFilter] = useState<LearnFilterType>('all');
  const [learnCategory, setLearnCategory] = useState<string>('All Categories');
  const [assistantInput, setAssistantInput] = useState('');
  const [claimRewardData, setClaimRewardData] = useState<{ points: number; coins: number; origin?: { x: number; y: number } } | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantNotice, setAssistantNotice] = useState<AssistantNotice | null>(null);
  const [assistantQuickReplies, setAssistantQuickReplies] = useState<string[]>([
    'How to compost?', 'What goes in recycling?', 'Tips for reducing waste', 'Tell me about eco-points',
  ]);
  const [authEmail, setAuthEmail] = useState('member@ecobud.app');
  const [authPassword, setAuthPassword] = useState('eco12345');
  const [authMode, setAuthMode] = useState<AuthMode>('member');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionOverlayVisible, setActionOverlayVisible] = useState(false);
  const [actionOverlayLabel, setActionOverlayLabel] = useState('Preparing EcoBud...');
  const actionOverlayTicket = React.useRef(0);
  const realtimeRefreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineSyncInFlightRef = React.useRef(false);
  const isHydratingRef = React.useRef(false);
  const resumeRefreshInFlightRef = React.useRef(false);
  const previousAppStateRef = React.useRef(AppState.currentState);
  const lastFocusedRefreshAtRef = React.useRef<Record<FocusedResource, number>>({ lessons: 0, challenges: 0, events: 0 });
  const focusedRefreshInFlightRef = React.useRef<Set<FocusedResource>>(new Set());
  const secondaryRefreshInFlightRef = React.useRef<Set<SecondaryResource>>(new Set());
  const lastSecondaryRefreshAtRef = React.useRef<Record<SecondaryResource, number>>({ tracker: 0, profile: 0, rewards: 0, leaderboard: 0, transparency: 0 });
  const currentSessionTokenRef = React.useRef<string | null>(null);
  currentSessionTokenRef.current = session?.token ?? null;

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [isCycleActive, setIsCycleActive] = useState<boolean>(true);
  const [habitsToday, setHabitsToday] = useState<HabitTodayData | null>(null);
  const [tracker, setTracker] = useState<TrackerData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardHasLoaded, setLeaderboardHasLoaded] = useState(false);
  const [events, setEvents] = useState<EcoEvent[]>([]);


  const [transparency, setTransparency] = useState<TransparencyFeed | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFailureMessage, setQuizFailureMessage] = useState<string | null>(null);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [pendingStreakUnlock, setPendingStreakUnlock] = useState(false);
  const [pendingBadgeQueue, setPendingBadgeQueue] = useState<EcoBadge[]>([]);
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<EcoBadge[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<EcoBadge | null>(null);
  const [completionCelebrationType, setCompletionCelebrationType] = useState<'quiz' | 'lesson' | 'claim'>('lesson');
  const [coachMarksCurrentStep, setCoachMarksCurrentStep] = useState(0);
  const [coachMarksVisible, setCoachMarksVisible] = useState(false);
  const [coachMarksReplay, setCoachMarksReplay] = useState(false);
  const setSpotlightTargetRect = coachMarkSpotlightStore.set;

  const [progressBarLayout, setProgressBarLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const [isChatbotEnabled, setIsChatbotEnabled] = useState(() => {
    try {
      const syncVal = mobileStorage.getItemSync(CHATBOT_ENABLED_STORAGE_KEY);
      if (syncVal !== null) {
        return JSON.parse(syncVal) !== false;
      }
    } catch { }
    return true;
  });

  const [chatbotSize, setChatbotSizeState] = useState<'small' | 'medium' | 'large'>(() => {
    try {
      const syncVal = mobileStorage.getItemSync(CHATBOT_SIZE_STORAGE_KEY);
      if (syncVal === 'small' || syncVal === 'medium' || syncVal === 'large') {
        return syncVal;
      }
    } catch { }
    return 'medium';
  });

  const [chatbotPosition, setChatbotPositionState] = useState<
    'top-left' | 'top-right' | 'center-left' | 'center-right' | 'bottom-left' | 'bottom-right'
  >(() => {
    try {
      const syncVal = mobileStorage.getItemSync('ecobud.mobile.chatbotPosition');
      if (
        syncVal === 'top-left' ||
        syncVal === 'top-right' ||
        syncVal === 'center-left' ||
        syncVal === 'center-right' ||
        syncVal === 'bottom-left' ||
        syncVal === 'bottom-right'
      ) {
        return syncVal;
      }
    } catch { }
    return 'bottom-right';
  });

  const setChatbotPosition = useCallback(
    async (
      pos: 'top-left' | 'top-right' | 'center-left' | 'center-right' | 'bottom-left' | 'bottom-right'
    ) => {
      setChatbotPositionState(pos);
      try {
        mobileStorage.setItemSync('ecobud.mobile.chatbotPosition', pos);
      } catch { }
      try {
        await mobileStorage.setItem('ecobud.mobile.chatbotPosition', pos);
      } catch (e) {
        console.warn('Failed to persist chatbot position preference', e);
      }
    },
    []
  );

  const setPushNotificationsEnabled = useCallback(async (enabled: boolean) => {
    setPushNotificationsEnabledState(enabled);
    try {
      await mobileStorage.setItem(PUSH_NOTIFICATIONS_ENABLED_STORAGE_KEY, JSON.stringify(enabled));
    } catch (e) {
      console.warn('Failed to persist push notifications preference', e);
    }
  }, []);

  const setChatbotEnabled = useCallback(async (enabled: boolean) => {
    setIsChatbotEnabled(enabled);
    try {
      mobileStorage.setItemSync(CHATBOT_ENABLED_STORAGE_KEY, JSON.stringify(enabled));
    } catch { }
    try {
      await mobileStorage.setItem(CHATBOT_ENABLED_STORAGE_KEY, JSON.stringify(enabled));
    } catch (e) {
      console.warn('Failed to persist chatbot preference', e);
    }
  }, []);

  const setChatbotSize = useCallback(async (size: 'small' | 'medium' | 'large') => {
    setChatbotSizeState(size);
    try {
      mobileStorage.setItemSync(CHATBOT_SIZE_STORAGE_KEY, size);
    } catch { }
    try {
      await mobileStorage.setItem(CHATBOT_SIZE_STORAGE_KEY, size);
    } catch (e) {
      console.warn('Failed to persist chatbot size preference', e);
    }
  }, []);

  const presence = usePresence(session);

  const openBadgeOverlay = useCallback((badge: EcoBadge) => {
    setSelectedBadge(badge);
    setNewlyUnlockedBadges([badge]);
    setActiveOverlayState('badgeUnlocked');
  }, []);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  );

  const filteredLessons = useMemo(() => {
    let result = lessons;

    if (learnCategory === 'Featured') {
      result = result.filter((lesson) => lesson.featured);
    } else if (learnCategory !== 'All Categories') {
      result = result.filter((lesson) => lesson.category === learnCategory || (!lesson.category && learnCategory === 'General'));
    }

    if (learnFilter !== 'all') {
      result = result.filter((lesson) => lesson.status === learnFilter);
    }
    const query = learnSearch.trim().toLowerCase();
    if (query) {
      result = result.filter((lesson) =>
        `${lesson.title} ${lesson.description} ${lesson.content}`.toLowerCase().includes(query),
      );
    }

    // Always sort so that featured lessons are at the top
    return [...result].sort((a: any, b: any) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return 0;
    });
  }, [learnSearch, learnFilter, learnCategory, lessons]);

  const todaysCompletedHabits = useMemo(
    () => (Array.isArray(habitsToday?.items) ? habitsToday.items.filter((item) => item.completedToday).length : 0),
    [habitsToday],
  );

  const loadLeaderboard = useCallback(async () => {
    const token = session?.token;
    if (!token || !presence.hasUsableInternet || AppState.currentState !== 'active') return;
    if (secondaryRefreshInFlightRef.current.has('leaderboard')) return;
    if (Date.now() - lastSecondaryRefreshAtRef.current.leaderboard < SECONDARY_REFRESH_INTERVAL_MS) return;

    secondaryRefreshInFlightRef.current.add('leaderboard');
    const requestStartedAt = Date.now();
    setLeaderboardLoading(true);
    if (leaderboard === null) {
      try {
        const cachedRaw = mobileStorage.getItemSync(`ecobud.mobile.leaderboard.${session!.user.id}`);
        const cached = cachedRaw ? JSON.parse(cachedRaw) as LeaderboardData : null;
        if (cached && Array.isArray(cached.items) && currentSessionTokenRef.current === token) {
          setLeaderboard(cached);
        }
      } catch { /* Ignore a stale or invalid local leaderboard snapshot. */ }
    }
    try {
      const result = await homeService.getLeaderboard(token);
      if (currentSessionTokenRef.current === token) {
        setLeaderboard(result);
        const cacheKey = `ecobud.mobile.leaderboard.${session!.user.id}`;
        const serialized = JSON.stringify(result);
        mobileStorage.setItemSync(cacheKey, serialized);
        void mobileStorage.setItem(cacheKey, serialized).catch(() => {});
        if (lastSecondaryRefreshAtRef.current.leaderboard <= requestStartedAt) {
          lastSecondaryRefreshAtRef.current.leaderboard = Date.now();
        }
      }
    } catch (error) {
      console.warn('[ECOBUD leaderboard refresh warning]:', error);
    } finally {
      if (currentSessionTokenRef.current === token) {
        setLeaderboardLoading(false);
        setLeaderboardHasLoaded(true);
      }
      secondaryRefreshInFlightRef.current.delete('leaderboard');
    }
  }, [session, presence.hasUsableInternet, leaderboard]);

  const persistSession = useCallback(async (nextSession: SessionPayload | null) => {
    if (nextSession) {
      await mobileStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      return;
    }

    await mobileStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const clearAppData = useCallback(() => {
    setDashboard(null);
    setLessons([]);
    setChallenges([]);
    setIsCycleActive(true);
    setHabitsToday(null);
    setTracker(null);
    setProfile(null);
    setRewards(null);
    setLeaderboard(null);
    setLeaderboardLoading(false);
    setLeaderboardHasLoaded(false);
    setEvents([]);
    setTransparency(null);
    setAssistantMessages([]);
    setSelectedLessonId(null);
    setSelectedChallenge(null);
    setSelectedBadge(null);
    setNewlyUnlockedBadges([]);
    setPendingBadgeQueue([]);
    setPendingStreakUnlock(false);
    setTabHistory(['home']);
    previousStreakRef.current = null;
    previousUnlockedBadgeIdsRef.current = null;
    lastSecondaryRefreshAtRef.current = { tracker: 0, profile: 0, rewards: 0, leaderboard: 0, transparency: 0 };
    void mobileStorage.removeItem(CACHED_HOME_DATA_STORAGE_KEY).catch(() => {});
    // Intentionally keep viewed missions across logouts
  }, []);

  const isRetryableOfflineActionError = useCallback((error: unknown) => {
    if (!(error instanceof Error)) {
      return false;
    }

    const normalizedMessage = error.message.toLowerCase();

    return (
      normalizedMessage.includes('unable to reach the ecobud api') ||
      normalizedMessage.includes('network') ||
      normalizedMessage.includes('fetch') ||
      normalizedMessage.includes('timeout')
    );
  }, []);

  const applyOfflineLessonSeen = useCallback((lessonId: string) => {
    setLessons((currentLessons) =>
      currentLessons.map((lesson) => {
        if (lesson.id !== lessonId) {
          return lesson;
        }

        if (lesson.status === 'completed') {
          return lesson;
        }

        return {
          ...lesson,
          progress: Math.max(lesson.progress, 25),
          status: 'seen',
        };
      }),
    );
  }, []);

  const applyOfflineLessonCompletion = useCallback((lessonId: string) => {
    setLessons((currentLessons) =>
      currentLessons.map((lesson) =>
        lesson.id === lessonId
          ? {
            ...lesson,
            progress: 100,
            status: 'completed',
          }
          : lesson,
      ),
    );
  }, []);

  const applyOfflineChallengeProgress = useCallback(
    (challengeId: string, nextProgress: number) => {
      const boundedProgress = Math.min(100, Math.max(0, nextProgress));

      setChallenges((currentChallenges) =>
        currentChallenges.map((challenge) =>
          challenge.id === challengeId
            ? {
              ...challenge,
              progressPercentage: boundedProgress,
              progress: {
                progressPercentage: boundedProgress,
                status: boundedProgress >= 100 ? 'completed' : 'in_progress',
              },
            }
            : challenge,
        ),
      );
    },
    [],
  );

  const applyOfflineHabitCheckIn = useCallback((habitId: string) => {
    setHabitsToday((currentHabits) => {
      if (!currentHabits) {
        return currentHabits;
      }

      let awardedPoints = 0;
      const nextItems = currentHabits.items.map((habit) => {
        if (habit.id !== habitId || habit.completedToday) {
          return habit;
        }

        awardedPoints = habit.pointsReward;
        return {
          ...habit,
          completedToday: true,
        };
      });

      if (awardedPoints === 0) {
        return currentHabits;
      }

      return {
        ...currentHabits,
        items: nextItems,
        pointsEarnedToday: currentHabits.pointsEarnedToday + awardedPoints,
      };
    });

    setTracker((currentTracker) => {
      if (!currentTracker) {
        return currentTracker;
      }

      return {
        ...currentTracker,
        todayHabits: currentTracker.todayHabits.map((habit) =>
          habit.id === habitId
            ? {
              ...habit,
              completedToday: true,
            }
            : habit,
        ),
      };
    });
  }, []);

  const queueOfflineAction = useCallback(
    async <TType extends CreateOfflineMutationInput['type']>(
      mutation: CreateOfflineMutationInput<TType>,
      options?: {
        alertMessage?: string;
        alertTitle?: string;
        applyOptimisticUpdate?: () => void;
      },
    ) => {
      await offlineSyncService.queueMutation(mutation);
      options?.applyOptimisticUpdate?.();

      if (options?.alertMessage) {
        showNotification({
          title: options.alertTitle ?? 'Saved offline',
          message: options.alertMessage,
          tone: 'warning',
        });
      }

      return 'queued' as const;
    },
    [showNotification],
  );

  const runMutationWithOfflineFallback = useCallback(
    async <TType extends CreateOfflineMutationInput['type']>(input: {
      mutation: CreateOfflineMutationInput<TType>;
      onlineAction: () => Promise<void>;
      applyOptimisticUpdate?: () => void;
      offlineAlertMessage?: string;
      offlineAlertTitle?: string;
    }) => {
      const queueMutation = () =>
        queueOfflineAction(input.mutation, {
          alertMessage: input.offlineAlertMessage,
          alertTitle: input.offlineAlertTitle,
          applyOptimisticUpdate: input.applyOptimisticUpdate,
        });

      if (!presence.hasUsableInternet) {
        return queueMutation();
      }

      try {
        await input.onlineAction();
        return 'online' as const;
      } catch (error) {
        if (isRetryableOfflineActionError(error)) {
          return queueMutation();
        }

        throw error;
      }
    },
    [isRetryableOfflineActionError, presence.hasUsableInternet, queueOfflineAction],
  );

  const runWithActionLoader = useCallback(
    async <T,>(label: string, action: () => Promise<T> | T, minimumDuration = 250) => {
      const ticket = ++actionOverlayTicket.current;
      const startedAt = Date.now();
      setActionOverlayLabel(label);
      setActionOverlayVisible(true);

      // Safety guard: dismiss loading overlay if an action takes too long
      const maxLoadingTimeout = setTimeout(() => {
        if (actionOverlayTicket.current === ticket) {
          setActionOverlayVisible(false);
        }
      }, 10000);

      try {
        return await action();
      } catch (err) {
        console.warn(`[runWithActionLoader] Operation failed for: ${label}`, err);
        throw err;
      } finally {
        clearTimeout(maxLoadingTimeout);
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minimumDuration - elapsed);
        if (remaining > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remaining));
        }

        if (actionOverlayTicket.current === ticket) {
          setActionOverlayVisible(false);
        }
      }
    },
    [],
  );

  const flashActionLoader = useCallback(
    (label: string, action: () => void, minimumDuration = 460) => {
      void runWithActionLoader(label, async () => {
        action();
      }, minimumDuration);
    },
    [runWithActionLoader],
  );

  const hydrateApp = useCallback(
    async (existingSession: SessionPayload | null | undefined, silent = false) => {
      if (!existingSession?.token || isHydratingRef.current) {
        return;
      }

      isHydratingRef.current = true;
      setIsHydrating(true);

      if (!silent) {
        setRefreshing(true);
      }

      try {
        // Step 1: Fetch Home Critical Data first (dashboard, lessons, challenges, habits, events)
        const homeData = await homeService.getHomeCriticalData(existingSession.token);

        const safeLessons = Array.isArray(homeData?.lessons) ? [...homeData.lessons] : [];
        safeLessons.sort((a: any, b: any) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return 0;
        });

        if (previousStreakRef.current === null && homeData?.dashboard) {
          previousStreakRef.current = homeData.dashboard.streak;
        }

        // Immediately update critical home state for fast UI rendering
        setDashboard(homeData?.dashboard ?? null);
        for (const lesson of safeLessons) {
          try {
            const raw = mobileStorage.getItemSync('@lesson_progress_' + existingSession.user.id + ':' + lesson.id);
            const saved = raw ? JSON.parse(raw) : null;
            if (saved && Number.isFinite(saved.progress) && Number.isFinite(saved.timestamp) &&
                isLocalLessonProgressNewer(saved.savedAt, lesson.progressUpdatedAt) && lesson.status !== 'completed') {
              lesson.progress = saved.progress;
              lesson.videoTimestamp = saved.timestamp;
            }
          } catch { /* Ignore invalid local records. */ }
        }
        setLessons(safeLessons);
        const safeChallenges = Array.isArray(homeData?.challenges) ? homeData.challenges : [];
        setChallenges(safeChallenges);
        setIsCycleActive(homeData?.isCycleActive ?? true);

        setHabitsToday(homeData?.habitsToday ?? null);
        setEvents(Array.isArray(homeData?.events) ? homeData.events : []);
        const hydratedAt = Date.now();
        lastFocusedRefreshAtRef.current = { lessons: hydratedAt, challenges: hydratedAt, events: hydratedAt };
        setSelectedLessonId((current) => current ?? safeLessons[0]?.id ?? null);

        // Release pull-to-refresh spinner immediately so UI feels instantaneous
        if (!silent) {
          setRefreshing(false);
        }

        const userDisplayName = existingSession?.user?.displayName || existingSession?.user?.name || 'Eco Warrior';
        const firstName = userDisplayName.split(' ')[0] || 'Eco Warrior';
        setAssistantMessages((current) =>
          current.length > 0
            ? current
            : [
              {
                id: 'assistant-welcome',
                role: 'assistant',
                text: `Hello ${firstName}! I can help with composting, eco points, local events, or finding the right challenge for today.`,
                time: formatChatTime(new Date().toISOString()),
              },
            ],
        );

        // Save critical home state to cache for instantaneous loading on next launch
        void mobileStorage.setItem(
          CACHED_HOME_DATA_STORAGE_KEY,
          JSON.stringify({
            dashboard: homeData?.dashboard ?? null,
            lessons: safeLessons,
            challenges: Array.isArray(homeData?.challenges) ? homeData.challenges : [],
            habitsToday: homeData?.habitsToday ?? null,
            events: Array.isArray(homeData?.events) ? homeData.events : [],
            cachedAt: Date.now(),
          }),
        ).catch(() => {});

      } catch (error) {
        const status = (error as any)?.status;
        const msg = error instanceof Error ? error.message : '';
        const isAuthExpired = status === 401 || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('unauthorized');

        if (isAuthExpired) {
          setSession(null);
          clearAppData();
          setActiveOverlayState(null);
          setActiveTabState('home');
          void persistSession(null);
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to reach ECOBUD right now.';
        
        // Offline-First Fallback: If network fails and challenges/dashboard are empty, restore from offline disk cache
        try {
          const cachedJson = await mobileStorage.getItem(CACHED_HOME_DATA_STORAGE_KEY);
          if (cachedJson) {
            const cached = JSON.parse(cachedJson);
            if (cached && typeof cached === 'object') {
              setChallenges((curr) => (curr.length === 0 && Array.isArray(cached.challenges) ? cached.challenges : curr));
              setDashboard((curr) => (!curr && cached.dashboard ? cached.dashboard : curr));
              setLessons((curr) => (curr.length === 0 && Array.isArray(cached.lessons) ? cached.lessons : curr));
              setHabitsToday((curr) => (!curr && cached.habitsToday ? cached.habitsToday : curr));
              setEvents((curr) => (curr.length === 0 && Array.isArray(cached.events) ? cached.events : curr));
            }
          }
        } catch { /* Ignore cache read errors */ }

        if (!silent) {
          console.warn('ECOBUD sync error:', message);
          Alert.alert('Offline Mode', 'Unable to reach ECOBUD servers. Showing saved challenges and data from your last session.');
        } else {
          console.warn('[ECOBUD hydrateApp (offline/unreachable)]:', message);
        }
      } finally {
        isHydratingRef.current = false;
        setIsHydrating(false);
        setRefreshing(false);
      }
    },
    [clearAppData, persistSession],
  );

  const syncQueuedOfflineActions = useCallback(
    async (activeSession: SessionPayload, refreshAfterSync = true): Promise<boolean> => {
      if (offlineSyncInFlightRef.current) {
        return false;
      }

      offlineSyncInFlightRef.current = true;

      try {
        const syncResult = await offlineSyncService.syncPendingMutations({
          token: activeSession.token,
          userId: activeSession.user.id,
        });

        const hadSyncedMutations = syncResult.syncedCount > 0;
        if (hadSyncedMutations && refreshAfterSync) {
          await hydrateApp(activeSession, true);
        }

        if (syncResult.failedCount > 0) {
          console.warn(
            `Offline sync finished with ${syncResult.failedCount} failed mutation(s).`,
          );
        }
        return hadSyncedMutations;
      } catch (error) {
        console.warn('Offline sync failed during reconnect.', error);
        return false;
      } finally {
        offlineSyncInFlightRef.current = false;
      }
    },
    [hydrateApp],
  );

  useEffect(() => {
    const bootstrapTimer = setTimeout(() => {
      setBooting(false);
      setInitializing(false);
    }, 3000);

    const bootstrap = async () => {
      try {
        const [
          savedViewedIds,
          savedRecent,
          savedChatbotEnabled,
          savedChatbotSize,
          savedSession,
          cachedHome,
          savedOnboarded,
        ] = await Promise.all([
          mobileStorage.getItem(VIEWED_MISSIONS_KEY),
          mobileStorage.getItem(RECENT_VIEWED_KEY),
          mobileStorage.getItem(CHATBOT_ENABLED_STORAGE_KEY),
          mobileStorage.getItem(CHATBOT_SIZE_STORAGE_KEY),
          mobileStorage.getItem(SESSION_STORAGE_KEY),
          mobileStorage.getItem(CACHED_HOME_DATA_STORAGE_KEY),
          mobileStorage.getItem(ONBOARDING_STORAGE_KEY),
        ]);

        if (savedOnboarded === 'true' || savedOnboarded === '1' || Boolean(savedOnboarded) || savedSession) {
          setHasOnboarded(true);
        }

        if (savedViewedIds) {
          try { setViewedMissionIds(JSON.parse(savedViewedIds)); } catch (e) { }
        }

        if (savedRecent) {
          try { setRecentViewedMission(JSON.parse(savedRecent)); } catch (e) { }
        }

        if (savedChatbotEnabled !== null) {
          try { setIsChatbotEnabled(JSON.parse(savedChatbotEnabled) !== false); } catch (e) { }
        }

        if (savedChatbotSize === 'small' || savedChatbotSize === 'medium' || savedChatbotSize === 'large') {
          setChatbotSizeState(savedChatbotSize);
        }

        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession) as SessionPayload;
            if (parsed && typeof parsed === 'object' && parsed.token && parsed.user) {
              let activeSession: SessionPayload | null = parsed;

              // Keep the saved session available immediately; refresh it and sync
              // server state in the background so network latency does not block startup.

              setSession(activeSession);

              // ─── Instant Stale-While-Revalidate Hydration ──────────────
              // If cached home dashboard data exists, apply it immediately to skip the loading state!
              if (cachedHome) {
                try {
                  const cached = JSON.parse(cachedHome);
                  if (cached && typeof cached === 'object') {
                    if (cached.dashboard) setDashboard(cached.dashboard);
                    if (Array.isArray(cached.lessons) && cached.lessons.length > 0) {
                      setLessons(cached.lessons);
                      setSelectedLessonId(cached.lessons[0]?.id ?? null);
                    }
                    if (Array.isArray(cached.challenges)) setChallenges(cached.challenges);
                    if (cached.habitsToday) setHabitsToday(cached.habitsToday);
                    if (Array.isArray(cached.events)) setEvents(cached.events);
                  }
                } catch (cacheErr) {
                  console.warn('[ECOBUD Cache hydrate warning]:', cacheErr);
                }
              }

              void (async () => {
                if (parsed.refreshToken) {
                  try {
                    activeSession = await homeService.refreshSession(parsed.refreshToken);
                    setSession(activeSession);
                    await persistSession(activeSession);
                  } catch (refreshError) {
                    const status = (refreshError as any)?.status;
                    if (status === 401 || status === 403) {
                      setSession(null);
                      await persistSession(null);
                      return;
                    }
                  }
                }
                if (activeSession?.token) void hydrateApp(activeSession, true);
              })();
            } else {
              await mobileStorage.removeItem(SESSION_STORAGE_KEY);
            }
          } catch (e) {
            console.error('Failed to parse saved session', e);
            await mobileStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Failed to bootstrap ECOBUD mobile app.', error);
      } finally {
        // Loading animation duration from Loading.json is exactly 3003ms (90 frames @ 29.97fps)
        const LOTTIE_CYCLE_MS = 0;
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(0, LOTTIE_CYCLE_MS - elapsed);

        finishTimer = setTimeout(() => {
          clearTimeout(bootstrapTimer);
          setBooting(false);
          setInitializing(false);
        }, remainingDelay);
      }
    };

    let finishTimer: ReturnType<typeof setTimeout> | null = null;
    const startTime = Date.now();
    void bootstrap();

    return () => {
      clearTimeout(bootstrapTimer);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [hydrateApp]);

  // Monitor streak unlock
  const previousStreakRef = React.useRef<number | null>(null);
  useEffect(() => {
    if (dashboard) {
      if (previousStreakRef.current !== null) {
        const prevEcoStreak = Math.floor(previousStreakRef.current / 3);
        const newEcoStreak = Math.floor(dashboard.streak / 3);
        if (newEcoStreak > prevEcoStreak && newEcoStreak > 0) {
          setPendingStreakUnlock(true);
        }
      }
      previousStreakRef.current = dashboard.streak;
    }
  }, [dashboard?.streak]);

  // Monitor newly unlocked collectible badges from rewards
  const previousUnlockedBadgeIdsRef = React.useRef<Set<string> | null>(null);
  useEffect(() => {
    if (rewards?.badges) {
      const currentUnlocked = rewards.badges.filter((b) => b.unlocked);
      const currentUnlockedIds = new Set(currentUnlocked.map((b) => b.id));

      if (previousUnlockedBadgeIdsRef.current !== null) {
        const newBadges = currentUnlocked.filter((b) => !previousUnlockedBadgeIdsRef.current!.has(b.id));
        if (newBadges.length > 0) {
          setPendingBadgeQueue((prev) => [...prev, ...newBadges]);
        }
      }

      previousUnlockedBadgeIdsRef.current = currentUnlockedIds;
    }
  }, [rewards?.badges]);

  // Trigger badge overlay when activeOverlay finishes/is null
  useEffect(() => {
    if (activeOverlay === null && pendingBadgeQueue.length > 0) {
      const nextBadge = pendingBadgeQueue[0];
      const t = setTimeout(() => {
        setSelectedBadge(nextBadge);
        setActiveOverlayState('badgeUnlocked');
        setPendingBadgeQueue((prev) => prev.slice(1));
      }, 400);
      return () => clearTimeout(t);
    }
  }, [activeOverlay, pendingBadgeQueue]);

  // Trigger streak overlay when other overlays finish
  useEffect(() => {
    if (activeOverlay === null && pendingBadgeQueue.length === 0 && pendingStreakUnlock) {
      // Small timeout to allow previous overlay to fully unmount
      const t = setTimeout(() => {
        setActiveOverlayState('streakUnlocked');
        setPendingStreakUnlock(false);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [activeOverlay, pendingBadgeQueue.length, pendingStreakUnlock]);

  useEffect(() => () => {
    if (realtimeRefreshTimer.current) {
      clearTimeout(realtimeRefreshTimer.current);
    }
  }, []);

  // Refresh only the data visible on the current page.
  useEffect(() => {
    if (!session?.token) return;
    const token = session.token;
    const visibleResources: FocusedResource[] = activeOverlay === 'events'
      ? ['events']
      : activeOverlay !== null
        ? []
        : activeTab === 'home'
          ? ['lessons', 'challenges', 'events']
          : activeTab === 'learn'
            ? ['lessons']
            : activeTab === 'challenges'
              ? ['challenges']
              : [];
    if (visibleResources.length === 0) return;

    const refreshVisible = () => {
      if (AppState.currentState !== 'active' || !presence.hasUsableInternet || isHydratingRef.current) return;
      for (const resource of visibleResources) {
        if (focusedRefreshInFlightRef.current.has(resource)) continue;
        if (Date.now() - lastFocusedRefreshAtRef.current[resource] < FOCUSED_REFRESH_INTERVAL_MS) continue;
        focusedRefreshInFlightRef.current.add(resource);
        const requestStartedAt = Date.now();
        void (async () => {
          try {
            if (resource === 'lessons') {
              const result = await homeService.getLessons(token);
              if (currentSessionTokenRef.current !== token || lastFocusedRefreshAtRef.current[resource] > requestStartedAt || !Array.isArray(result)) return;
              const safeLessons = [...result].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
              setLessons(safeLessons);
            } else if (resource === 'challenges') {
              const result = await homeService.getChallenges(token);
              if (currentSessionTokenRef.current !== token || lastFocusedRefreshAtRef.current[resource] > requestStartedAt) return;
              const items = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];
              setChallenges(items);
              setIsCycleActive(result?.isCycleActive ?? true);
            } else {
              const result = await homeService.getEvents(token);
              if (currentSessionTokenRef.current !== token || lastFocusedRefreshAtRef.current[resource] > requestStartedAt) return;
              setEvents(Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : []);
            }
            lastFocusedRefreshAtRef.current[resource] = Date.now();
          } catch {
            // Keep the previous data; the next focused refresh can retry.
          } finally {
            focusedRefreshInFlightRef.current.delete(resource);
          }
        })();
      }
    };
    refreshVisible();
    const interval = setInterval(refreshVisible, FOCUSED_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session?.token, presence.hasUsableInternet, activeTab, activeOverlay, isHydrating]);

  useEffect(() => {
    const trackerIsVisible = activeOverlay === null && activeTab === 'tracker';
    const leaderboardIsVisible = activeOverlay === 'leaderboard';
    if (!session?.token || !presence.hasUsableInternet || (isHydrating && !trackerIsVisible && !leaderboardIsVisible) || AppState.currentState !== 'active') return;
    const token = session.token;
    const needed: SecondaryResource[] = activeOverlay === 'leaderboard' ? ['leaderboard']
      : activeOverlay === 'rewards' || activeOverlay === 'streakRewards' || activeOverlay === 'redeemPoints' || activeOverlay === 'coinsHistory' ? ['rewards']
      : activeOverlay === 'transparency' ? ['transparency']
      : activeOverlay === 'editProfile' ? ['profile']
      : activeOverlay !== null ? []
      : activeTab === 'tracker' ? ['tracker']
      : activeTab === 'profile' ? ['profile', 'rewards']
      : activeTab === 'challenges' ? ['profile']
      : [];

    for (const resource of needed) {
      if (secondaryRefreshInFlightRef.current.has(resource) ||
          Date.now() - lastSecondaryRefreshAtRef.current[resource] < SECONDARY_REFRESH_INTERVAL_MS) continue;
      secondaryRefreshInFlightRef.current.add(resource);
      const requestStartedAt = Date.now();
      if (resource === 'leaderboard') setLeaderboardLoading(true);
      void (async () => {
        try {
          if (resource === 'tracker') {
            const requestedMonth = tracker?.month ?? getPhMonthKey();
            const cacheKey = `ecobud.mobile.tracker.${session!.user.id}.${requestedMonth}`;
            if (!tracker) {
              try {
                const cachedRaw = mobileStorage.getItemSync(cacheKey);
                const cached = cachedRaw ? JSON.parse(cachedRaw) as TrackerData : null;
                if (cached && cached.month === requestedMonth && currentSessionTokenRef.current === token) setTracker(cached);
              } catch { /* Ignore a stale or invalid local tracker snapshot. */ }
            }
            const result = await homeService.getTracker(token, requestedMonth);
            if (currentSessionTokenRef.current === token && lastSecondaryRefreshAtRef.current.tracker <= requestStartedAt) {
              setTracker(result);
              const resultCacheKey = `ecobud.mobile.tracker.${session!.user.id}.${result.month}`;
              const serialized = JSON.stringify(result);
              mobileStorage.setItemSync(resultCacheKey, serialized);
              void mobileStorage.setItem(resultCacheKey, serialized).catch(() => {});
            }
          } else if (resource === 'profile') {
            const result = await homeService.getProfile(token);
            if (currentSessionTokenRef.current === token) setProfile(result);
          } else if (resource === 'rewards') {
            const result = await homeService.getRewards(token);
            if (currentSessionTokenRef.current === token) {
              if (previousUnlockedBadgeIdsRef.current === null && result?.badges) {
                previousUnlockedBadgeIdsRef.current = new Set(result.badges.filter((badge) => badge.unlocked).map((badge) => String(badge.id)));
              }
              setRewards(result);
            }
          } else if (resource === 'leaderboard') {
            const result = await homeService.getLeaderboard(token);
            if (currentSessionTokenRef.current === token) setLeaderboard(result);
          } else {
            const result = await homeService.getTransparency(token);
            if (currentSessionTokenRef.current === token) setTransparency(result);
          }
          if (currentSessionTokenRef.current === token && lastSecondaryRefreshAtRef.current[resource] <= requestStartedAt) lastSecondaryRefreshAtRef.current[resource] = Date.now();
        } catch (error) {
          console.warn(`[ECOBUD ${resource} refresh warning]:`, error);
        } finally {
          if (resource === 'leaderboard' && currentSessionTokenRef.current === token) {
            setLeaderboardLoading(false);
            setLeaderboardHasLoaded(true);
          }
          secondaryRefreshInFlightRef.current.delete(resource);
        }
      })();
    }
  }, [session?.token, presence.hasUsableInternet, activeTab, activeOverlay, isHydrating, tracker?.month]);

  useEffect(() => {
    if (!session || !presence.hasUsableInternet) {
      return;
    }

    void syncQueuedOfflineActions(session);
  }, [presence.hasUsableInternet, session, syncQueuedOfflineActions]);

  useEffect(() => {
    if (recentViewedMission && challenges.length > 0) {
      const updated = challenges.find((c) => c.id === recentViewedMission.id);
      if (!updated) {
        setRecentViewedMission(null);
        void mobileStorage.removeItem(RECENT_VIEWED_KEY);
      } else if (updated.progress?.status !== recentViewedMission.progress?.status) {
        setRecentViewedMission(updated);
        void mobileStorage.setItem(RECENT_VIEWED_KEY, JSON.stringify(updated));
      }
    }
  }, [challenges, recentViewedMission]);

  const ensureSession = useCallback(() => {
    if (!session) {
      throw new Error('Your session expired. Please sign in again.');
    }

    return session;
  }, [session]);

  const completeOnboarding = useCallback(async () => {
    setBooting(true);
    try {
      setHasOnboarded(true);
      try { mobileStorage.setItemSync(ONBOARDING_STORAGE_KEY, 'true'); } catch {}
      await mobileStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } finally {
      setBooting(false);
    }
  }, []);

  const completeCoachMarks = useCallback(() => {
    setCoachMarksVisible(false);
    setCoachMarksReplay(false);
    setCoachMarksCurrentStep(0);
  }, []);

  const showCoachMarks = useCallback(() => {
    setCoachMarksCurrentStep(0);
    setCoachMarksReplay(true);
    setCoachMarksVisible(true);
  }, []);

  const continueWithReadOnlyAccess = useCallback(async () => {
    await runWithActionLoader('Opening public viewer...', async () => {
      await presence.disconnectPresence({ clearSessionId: true });
      
      setAuthError(null);
      
      clearAppData();
      setActiveOverlayState(null);
      setActiveTabState('home');
      await persistSession(null);
      
    }, 760);
  }, [clearAppData, hydrateApp, persistSession, runWithActionLoader]);

  const leaveReadOnlyAccess = useCallback(async () => {
    await runWithActionLoader('Returning to sign in...', async () => {
      setSession(null);
      clearAppData();
      setActiveOverlayState(null);
      setActiveTabState('home');
      await persistSession(null);
    }, 520);
  }, [clearAppData, persistSession, runWithActionLoader]);

  const handleLoginArgs = useCallback(async (email: string, pass: string): Promise<MfaChallengePayload | void> => {
    return runWithActionLoader('Signing you into EcoBud...', async () => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const nextSession = await homeService.login(email.trim(), pass);
        if ('mfaRequired' in nextSession) return nextSession;

        if (nextSession?.user?.role === 'admin' || nextSession?.user?.role === 'moderator') {
          throw new Error('Administrators and moderators cannot log in via the mobile app. Please use the web portal.');
        }

        setSession(nextSession);
        await persistSession(nextSession);
        void hydrateApp(nextSession, true);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Login failed.');
        return;
      } finally {
        setAuthLoading(false);
      }
    }, 0);
  }, [hydrateApp, persistSession, runWithActionLoader]);

  const handleGoogleSignIn = useCallback(async () => {
    setAuthError(null);

    try {
      if (!supabaseClient) {
        throw new Error('Supabase client is not initialized.');
      }

      const redirectUri = makeRedirectUri({
        scheme: 'ecobud',
        path: 'auth',
      });

      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          },
        },
      });

      if (error || !data?.url) {
        throw new Error(error?.message || 'Failed to initialize Google authentication URL.');
      }

      let authUrl = data.url;
      if (!authUrl.includes('prompt=')) {
        authUrl += `${authUrl.includes('?') ? '&' : '?'}prompt=select_account`;
      }

      // In production Android, preferEphemeralSession can cause the browser to fail to open or close instantly.
      // We also catch any explicit WebBrowser failure just in case.
      let authResult;
      try {
        authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
          showInRecents: true,
        });
      } catch (browserErr) {
        console.warn('WebBrowser open error:', browserErr);
        throw new Error('Failed to open secure browser for Google Sign In. Please try again.');
      }

      if (authResult.type !== 'success') {
        return;
      }

      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let authCode: string | null = null;

      if (authResult.url) {
        try {
          const cleanUrl = authResult.url.replace('#', '?');
          const urlObj = new URL(cleanUrl);
          accessToken = urlObj.searchParams.get('access_token');
          refreshToken = urlObj.searchParams.get('refresh_token');
          authCode = urlObj.searchParams.get('code');

          if (!accessToken && !authCode && cleanUrl.includes('=')) {
            const matches = cleanUrl.match(/access_token=([^&]+)/);
            if (matches && matches[1]) {
              accessToken = decodeURIComponent(matches[1]);
            }
            const refreshMatches = cleanUrl.match(/refresh_token=([^&]+)/);
            if (refreshMatches && refreshMatches[1]) {
              refreshToken = decodeURIComponent(refreshMatches[1]);
            }
            const codeMatches = cleanUrl.match(/code=([^&]+)/);
            if (codeMatches && codeMatches[1]) {
              authCode = decodeURIComponent(codeMatches[1]);
            }
          }
        } catch (urlErr) {
          // Ignore URL parsing error silently
        }
      }

      let authEmail = '';
      let authDisplayName = '';
      let authAvatarUrl = '';

      if (authCode) {
        try {
          const { data: codeData, error: codeErr } = await supabaseClient.auth.exchangeCodeForSession(authCode);
          if (!codeErr && codeData?.user?.email) {
            authEmail = codeData.user.email;
            authDisplayName = codeData.user.user_metadata?.full_name || codeData.user.user_metadata?.name || '';
            authAvatarUrl = codeData.user.user_metadata?.avatar_url || codeData.user.user_metadata?.picture || '';
          }
        } catch (e) {
          // Silently fallback
        }
      }

      if (!authEmail && accessToken) {
        try {
          const { data: sessionData, error: setSessionError } = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (!setSessionError && sessionData?.user?.email) {
            authEmail = sessionData.user.email;
            authDisplayName = sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || '';
            authAvatarUrl = sessionData.user.user_metadata?.avatar_url || sessionData.user.user_metadata?.picture || '';
          }
        } catch (sessionErr) {
          // Silently fallback
        }
      }

      if (!authEmail) {
        try {
          const { data: userData } = await supabaseClient.auth.getUser();
          if (userData?.user?.email) {
            authEmail = userData.user.email;
            authDisplayName = userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || '';
            authAvatarUrl = userData.user.user_metadata?.avatar_url || userData.user.user_metadata?.picture || '';
          }
        } catch (userErr) {
          // Silently fallback
        }
      }

      if (!authEmail) {
        return;
      }

      const { data: verifiedSession } = await supabaseClient.auth.getSession();
      const supabaseAccessToken = verifiedSession.session?.access_token;
      if (!supabaseAccessToken) throw new Error('Google sign-in session is missing. Please try again.');

      // The backend only returns account information for the verified identity.
      let userExists = false;
      let existingCity: string | null = null;
      try {
        const checkResult = await homeService.checkEmail(authEmail, supabaseAccessToken);
        userExists = Boolean(checkResult.exists);
        existingCity = checkResult.city ?? null;
      } catch (err) {
        // Fallback to proceed if check failed
      }

      const completeGoogleAuth = async (selectedCity?: string, isNewUser?: boolean): Promise<MfaChallengePayload | void> => {
        return runWithActionLoader('Signing you into EcoBud...', async () => {
          setAuthLoading(true);
          try {
            const nextSession = await homeService.googleLogin({
              accessToken: supabaseAccessToken,
              email: authEmail,
              displayName: authDisplayName,
              avatarUrl: authAvatarUrl,
              city: selectedCity || existingCity || undefined,
            });
            if ('mfaRequired' in nextSession) return nextSession;

            if (nextSession?.user?.role === 'admin' || nextSession?.user?.role === 'moderator') {
              throw new Error('Administrators and moderators cannot log in via the mobile app.');
            }


            setSession(nextSession);
            await persistSession(nextSession);
            void hydrateApp(nextSession, true).then(() => {
              if (isNewUser) {
                setTimeout(() => {
                  setCoachMarksCurrentStep(0);
                  setCoachMarksVisible(true);
                }, 400);
              }
            });
          } finally {
            setAuthLoading(false);
          }
        }, 700);
      };

      if (userExists) {
        // If user already exists, proceed directly to home dashboard without asking barangay
        return await completeGoogleAuth(undefined, false);
      } else {
        // If new user signing up via Google, prompt for barangay selection first
        return {
          requiresBarangay: true,
          email: authEmail,
          displayName: authDisplayName,
          avatarUrl: authAvatarUrl,
          onConfirmBarangay: async (chosenBarangay: string) => {
            await completeGoogleAuth(chosenBarangay, true);
          },
        };
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        return;
      }
      const errorMsg = error instanceof Error ? error.message : 'Google Sign-In failed.';
      setAuthError(errorMsg);
    }
  }, [ensureSession, hydrateApp, persistSession, runWithActionLoader]);

  const handleSignUpArgs = useCallback(async (username: string, email: string, pass: string, city: string, otpCode?: string) => {
    await runWithActionLoader('Creating your account...', async () => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const nextSession = await homeService.register(email.trim(), pass, username.trim(), city, otpCode?.trim() || '');
        setSession(nextSession);
        await persistSession(nextSession);
        void hydrateApp(nextSession, true).then(() => {
          setTimeout(() => {
            setCoachMarksCurrentStep(0);
            setCoachMarksVisible(true);
          }, 400);
        });
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Sign up failed.');
      } finally {
        setAuthLoading(false);
      }
    }, 0);
  }, [hydrateApp, persistSession, runWithActionLoader]);

  const handleVerifyMfaChallenge = useCallback(async (challengeToken: string, code: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const nextSession = await homeService.verifyMfaChallenge(challengeToken, code);
      if (nextSession?.user?.role === 'admin' || nextSession?.user?.role === 'moderator') {
        throw new Error('Administrators and moderators cannot log in via the mobile app. Please use the web portal.');
      }
      setSession(nextSession);
      await persistSession(nextSession);
      void hydrateApp(nextSession, true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authenticator verification failed.');
    } finally {
      setAuthLoading(false);
    }
  }, [hydrateApp, persistSession]);

  const handleSendOTP = useCallback(async (email: string) => {
    try {
      return await homeService.sendOTP(email.trim());
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to send OTP.');
      throw error;
    }
  }, []);

  const handleCheckUsernameAvailability = useCallback(async (displayName: string) => {
    return homeService.checkUsername(displayName.trim());
  }, []);

  const handleLogout = useCallback(async () => {
    await runWithActionLoader('Signing you out...', async () => {
      try {
        await presence.disconnectPresence({
          clearSessionId: true,
          requireImmediateSync: false,
        });
      } catch (err) {
        console.warn('[handleLogout] Presence disconnect non-fatal error:', err);
      }

      setSession(null);
      clearAppData();
      setActiveOverlayState(null);
      setActiveTabState('home');
      if (supabaseClient) {
        await supabaseClient.auth.signOut().catch(() => {});
      }
      await persistSession(null);
    }, 700).catch((error) => {
      console.warn('[handleLogout] Error during sign out loader:', error);
      // Guarantee local logout occurs even if any unexpected error happened
      setSession(null);
      clearAppData();
      setActiveOverlayState(null);
      setActiveTabState('home');
      void persistSession(null);
    });
  }, [clearAppData, persistSession, presence, runWithActionLoader]);

  const refreshEverything = useCallback(async () => {
    if (!session) {
      return;
    }

    await hydrateApp(session);
  }, [hydrateApp, session]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = previousAppStateRef.current;
      previousAppStateRef.current = nextState;

      const isReturningToForeground =
        nextState === 'active' &&
        (previousState === 'background' || previousState === 'inactive');

      if (
        !isReturningToForeground ||
        !session ||
        !presence.hasUsableInternet ||
        resumeRefreshInFlightRef.current
      ) {
        return;
      }

      resumeRefreshInFlightRef.current = true;

      void (async () => {
        try {
          let activeSession = session;

          if (session.refreshToken) {
            activeSession = await homeService.refreshSession(session.refreshToken);
            setSession(activeSession);
            await persistSession(activeSession);
          }

          const [_, hadSyncedMutations] = await Promise.all([
            hydrateApp(activeSession, true),
            syncQueuedOfflineActions(activeSession, false),
          ]);
          if (hadSyncedMutations) await hydrateApp(activeSession, true);
        } catch (error) {
          const status = (error as { status?: number } | null)?.status;
          if (status === 401 || status === 403) {
            setSession(null);
            clearAppData();
            setActiveOverlayState(null);
            setActiveTabState('home');
            await persistSession(null);
            Alert.alert('Session Expired', 'Your session is no longer valid. Please sign in again.');
            return;
          }

          console.warn('[ECOBUD foreground refresh warning]:', error);
        } finally {
          resumeRefreshInFlightRef.current = false;
        }
      })();
    });

    return () => subscription.remove();
  }, [clearAppData, hydrateApp, persistSession, presence.hasUsableInternet, session, syncQueuedOfflineActions]);

  const queueRealtimeRefresh = useCallback(
    (reason: string) => {
      if (!session) {
        return;
      }

      if (realtimeRefreshTimer.current) {
        clearTimeout(realtimeRefreshTimer.current);
      }

      realtimeRefreshTimer.current = setTimeout(() => {
        void hydrateApp(session, true).catch((error) => {
          console.warn(`Realtime refresh failed after ${reason}.`, error);
        });
      }, 450);
    },
    [hydrateApp, session],
  );

  useEffect(() => {
    if (!session || !presence.shouldMaintainRealtimeConnection) {
      setRealtimeConnected(false);
      return;
    }

    let cleanup: () => void = () => undefined;
    let isMounted = true;

    void realtimeService
      .connect(session, {
        onConnectionChange: (connected) => {
          if (!isMounted) {
            return;
          }

          setRealtimeConnected(connected);
        },
        onSessionExpired: () => {
          if (!isMounted) {
            return;
          }

          setSession(null);
          clearAppData();
          setActiveOverlayState(null);
          setActiveTabState('home');
          void persistSession(null);
          Alert.alert('Session Expired', 'Your session is no longer valid. Please sign in again.');
        },
        onNotice: (notice) => {
          if (!isMounted) {
            return;
          }

          DeviceEventEmitter.emit('notificationsChanged');
          DeviceEventEmitter.emit('notificationsInboxRefresh');
          DeviceEventEmitter.emit('ECO_REDEEM_SYNC');
          if (notice.scope !== 'notifications') {
            showNotification({
              title: notice.title,
              message: notice.message,
              tone: notice.level ?? 'info',
            });
          }
          queueRealtimeRefresh(`notice:${notice.scope}`);
        },
        onSignal: (signal) => {
          if (!isMounted) {
            return;
          }

          DeviceEventEmitter.emit('ECO_REDEEM_SYNC');
          queueRealtimeRefresh(`${signal.channel}:${signal.reason}`);
        },
      })
      .then((disconnect) => {
        if (!isMounted) {
          disconnect();
          return;
        }

        cleanup = disconnect;
      });

    return () => {
      isMounted = false;
      setRealtimeConnected(false);
      cleanup();
    };
  }, [presence.shouldMaintainRealtimeConnection, queueRealtimeRefresh, session]);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('ECO_POINTS_DROP_ANIMATION', () => {
      const activeSession = session;
      if (activeSession) {
        void hydrateApp(activeSession, true);
      }
    });
    return () => sub.remove();
  }, [session, hydrateApp]);

  const openLesson = useCallback(async (lessonId: string) => {
    await runWithActionLoader('Opening lesson...', async () => {
      try {
        const activeSession = ensureSession();
        const mutationMode = await runMutationWithOfflineFallback({
          mutation: {
            userId: activeSession.user.id,
            type: 'lesson-seen',
            payload: { lessonId },
            dedupeKey: `lesson-seen:${lessonId}`,
          },
          onlineAction: async () => {
            await homeService.markLessonSeen(activeSession.token, lessonId);
          },
          applyOptimisticUpdate: () => {
            applyOfflineLessonSeen(lessonId);
          },
        });

        if (mutationMode === 'online') {
          // Intentionally omitting hydrateApp here to avoid race conditions with updateLessonProgress
        }
      } catch (error) {
        Alert.alert('Unable to open lesson', error instanceof Error ? error.message : 'Please try again.');
        return;
      }

      setSelectedLessonId(lessonId);
      setActiveOverlayState('lesson');
    }, 420);
  }, [
    applyOfflineLessonSeen,
    ensureSession,
    hydrateApp,
    runMutationWithOfflineFallback,
    runWithActionLoader,
  ]);

  const openChallengeMission = useCallback((challenge: ChallengeWithProgress) => {
    const userBarangay = profile?.profile?.city?.trim();
    if (!userBarangay) {
      Alert.alert(
        'Barangay Location Required',
        'Please set your registered Barangay in your profile before participating in challenges to represent your community!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set Barangay',
            style: 'default',
            onPress: () => {
              setActiveOverlayState('editProfile');
            },
          },
        ]
      );
      return;
    }

    setSelectedChallenge(challenge);

    setRecentViewedMission(challenge);
    void mobileStorage.setItem(RECENT_VIEWED_KEY, JSON.stringify(challenge));

    setViewedMissionIds((prev) => {
      const next = prev.includes(challenge.id) ? prev : [...prev, challenge.id];
      void mobileStorage.setItem(VIEWED_MISSIONS_KEY, JSON.stringify(next));
      return next;
    });

    setActiveOverlayState('ai_mission');
  }, [profile]);

  const handleCompleteLesson = useCallback(async () => {
    await runWithActionLoader('Verifying lesson completion...', async () => {
      try {
        const activeSession = ensureSession();
        if (!selectedLessonId) {
          return;
        }

        setRefreshing(true);
        let unlockedBadges: EcoBadge[] = [];
        let earnedPts = selectedLesson?.pointsReward ?? 10;
        let earnedCns = 0;

        const mutationMode = await runMutationWithOfflineFallback({
          mutation: {
            userId: activeSession.user.id,
            type: 'lesson-complete',
            payload: { lessonId: selectedLessonId },
            dedupeKey: `lesson-complete:${selectedLessonId}`,
          },
          onlineAction: async () => {
            const res = await homeService.completeLesson(activeSession.token, selectedLessonId);
            if (res?.awardedBadges) {
              unlockedBadges = res.awardedBadges;
            }
            if (res?.pointsAwarded !== undefined) {
              earnedPts = res.pointsAwarded;
            }
            if (res?.ecoCoinsAwarded !== undefined) {
              earnedCns = res.ecoCoinsAwarded;
            }
          },
          applyOptimisticUpdate: () => {
            applyOfflineLessonCompletion(selectedLessonId);
          },
          offlineAlertMessage:
            'Lesson completion was saved on this device and will sync automatically when you reconnect.',
        });

        if (mutationMode === 'online') {
          await hydrateApp(activeSession, true);
          setEarnedPoints(earnedPts);
          setEarnedCoins(earnedCns);
          setNewlyUnlockedBadges(unlockedBadges);
          setCompletionCelebrationType('lesson');
          setActiveOverlayState('lessonCompleted');
        }
      } catch (error) {
        Alert.alert('Unable to complete lesson', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setRefreshing(false);
      }
    });
  }, [
    applyOfflineLessonCompletion,
    ensureSession,
    hydrateApp,
    runMutationWithOfflineFallback,
    runWithActionLoader,
    selectedLessonId,
    selectedLesson,
  ]);

  const pendingVideoProgressSaves = useRef(new Map<string, {
    token: string;
    userId: string;
    lessonId: string;
    progress: number;
    videoTimestamp: number;
  }>());
  const activeVideoProgressSaves = useRef(new Set<string>());

  const handleUpdateLessonProgress = useCallback(async (lessonId: string, progress: number, videoTimestamp?: number) => {
    try {
      const activeSession = ensureSession();
      // Optimistically update locally without a loading overlay
      const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));
      const lessonForProgress = lessons.find((lesson) => lesson.id === lessonId);
      const videoProgressLimit = getVideoProgressLimit(
        !!lessonForProgress?.hasQuiz,
        lessonForProgress?.pages?.length ?? 0,
      );

      const key = '@lesson_progress_' + activeSession.user.id + ':' + lessonId;
      let previous: { timestamp: number; progress: number; videoCompleted?: boolean } = { timestamp: 0, progress: 0 };
      try { previous = JSON.parse(mobileStorage.getItemSync(key) ?? 'null') ?? previous; } catch {}
      const isVideoResumeSave = Number.isFinite(videoTimestamp);
      const isVideoDone = Boolean(previous.videoCompleted)
        || (isVideoResumeSave && clampedProgress >= videoProgressLimit);
      // Keep lesson progress as a high-water mark while videoTimestamp follows
      // the actual playback position. Rewinding should move the resume point,
      // never pull the displayed progress bar backwards.
      const savedProgress = Math.max(
        previous.progress,
        lessonForProgress?.progress ?? 0,
        clampedProgress,
        isVideoDone ? videoProgressLimit : 0,
      );
      mobileStorage.setItemSync(key, JSON.stringify({
        timestamp: isVideoResumeSave ? videoTimestamp : previous.timestamp,
        progress: savedProgress,
        videoCompleted: isVideoDone,
        savedAt: Date.now(),
      }));
      if (isVideoResumeSave) {
        const saveKey = `${activeSession.user.id}:${lessonId}`;
        pendingVideoProgressSaves.current.set(saveKey, {
          token: activeSession.token,
          userId: activeSession.user.id,
          lessonId,
          progress: savedProgress,
          videoTimestamp: videoTimestamp!,
        });

        // Coalesce rapid playback events: while one request is in flight,
        // replace the pending checkpoint so the next request is always the
        // learner's newest position instead of replaying a stale backlog.
        if (!activeVideoProgressSaves.current.has(saveKey)) {
          activeVideoProgressSaves.current.add(saveKey);
          void (async () => {
            try {
              while (true) {
                const latest = pendingVideoProgressSaves.current.get(saveKey);
                if (!latest) break;
                pendingVideoProgressSaves.current.delete(saveKey);
                try {
                  await homeService.updateLessonProgress(
                    latest.token,
                    latest.lessonId,
                    latest.progress,
                    latest.videoTimestamp,
                  );
                } catch (error) {
                  // The synchronous local checkpoint remains authoritative on
                  // this device and is uploaded when the lesson opens again.
                  console.warn('[handleUpdateLessonProgress] API error:', error);
                  break;
                }
              }
            } finally {
              activeVideoProgressSaves.current.delete(saveKey);
            }
          })();
        }
      } else {
        void homeService.updateLessonProgress(activeSession.token, lessonId, savedProgress)
          .catch((error) => console.warn('[handleUpdateLessonProgress] API error:', error));
      }

      // Update local state so it's snappy
      setLessons((current) =>
        current.map((lesson) => {
          if (lesson.id === lessonId) {
            return {
              ...lesson,
              progress: Math.max(lesson.progress, savedProgress),
              videoTimestamp: isVideoResumeSave ? videoTimestamp : lesson.videoTimestamp,
            };
          }
          return lesson;
        })
      );
    } catch (error) {
      console.warn('[handleUpdateLessonProgress] error:', error);
    }
  }, [ensureSession]);

  const startQuiz = useCallback(() => {
    const questions = selectedLesson?.quizQuestions ? [...selectedLesson.quizQuestions] : [];
    
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    let restored: { order: string[]; index: number; answers: Record<string, string> } | null = null;
    try {
      const raw = mobileStorage.getItemSync('@lesson_quiz_' + session?.user.id + ':' + selectedLesson?.id);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && Array.isArray(saved.order) && saved.order.length === questions.length &&
          new Set(saved.order).size === questions.length && saved.order.every((id: string) => questions.some(q => q.id === id)) &&
          Number.isInteger(saved.index) && saved.index >= 0 && saved.index < questions.length && saved.answers && typeof saved.answers === 'object') restored = saved;
    } catch {}
    const ordered = restored ? restored.order.map(id => questions.find(q => q.id === id)!) : questions;
    const index = restored?.index ?? 0;
    setQuizQuestions(ordered);
    setCurrentQuestionIndex(index);
    setSelectedAnswer(restored?.answers[ordered[index]?.id] ?? null);
    setQuizAnswers(restored?.answers ?? {});
    setQuizCompleted(false);
    setQuizScore(0);
    setQuizFailureMessage(null);
    setActiveOverlayState('quiz');
  }, [selectedLesson, session?.user.id, setActiveOverlayState]);

  useEffect(() => {
    if (activeOverlay !== 'quiz' || !selectedLessonId || !quizQuestions.length || quizCompleted) return;
    mobileStorage.setItemSync('@lesson_quiz_' + session?.user.id + ':' + selectedLessonId, JSON.stringify({
      order: quizQuestions.map(q => q.id), index: currentQuestionIndex, answers: quizAnswers,
    }));
    void handleUpdateLessonProgress(selectedLessonId, getQuizLessonProgress(Object.keys(quizAnswers).length, quizQuestions.length));
  }, [activeOverlay, selectedLessonId, session?.user.id, quizQuestions, currentQuestionIndex, quizAnswers, quizCompleted, handleUpdateLessonProgress]);

  const selectAnswer = useCallback((questionId: string, answer: string) => {
    triggerImpactLight();
    setSelectedAnswer(answer);
    setQuizAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      triggerImpactLight();
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
    }
  }, [currentQuestionIndex, quizQuestions.length]);

  const submitQuiz = useCallback(async () => {
    await runWithActionLoader('Submitting quiz...', async () => {
      try {
        const activeSession = ensureSession();
        if (!selectedLessonId) return;

        const res = await homeService.completeLesson(activeSession.token, selectedLessonId, quizAnswers);

        if (res && res.passed === false) {
          triggerWarningHaptic();
          const score = res.score ?? 0;
          setQuizScore(score);
          setQuizCompleted(false);
          setQuizFailureMessage(res.message || `You scored ${score}%. You need at least 70% to pass. Try the questions again.`);
          const shuffledQuestions = selectedLesson?.quizQuestions ? [...selectedLesson.quizQuestions] : [...quizQuestions];
          for (let i = shuffledQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
          }
          if (shuffledQuestions.length > 1 && shuffledQuestions.every((question, index) => question.id === quizQuestions[index]?.id)) {
            shuffledQuestions.push(shuffledQuestions.shift()!);
          }
          setQuizQuestions(shuffledQuestions);
          setCurrentQuestionIndex(0);
          setSelectedAnswer(null);
          setQuizAnswers({});
          return;
        }

        triggerSuccessHaptic();
        const finalScore = res.score ?? 100;
        setQuizScore(finalScore);
        setQuizCompleted(true);
        const points = res.pointsAwarded ?? (selectedLesson?.pointsReward ?? 10);
        setEarnedPoints(points);
        setCompletionCelebrationType('quiz');
        setActiveOverlayState('lessonCompleted');





        void mobileStorage.removeItem('@lesson_quiz_' + activeSession.user.id + ':' + selectedLessonId)
          .catch((error) => console.warn('[submitQuiz] Unable to clear saved quiz state:', error));

        // The completion response is authoritative; refresh the rest of the
        // dashboard in the background so it does not delay the reward overlay.
        void hydrateApp(activeSession, true)
          .catch((error) => console.warn('[submitQuiz] Unable to refresh completed lesson:', error));




      } catch (error) {
        triggerWarningHaptic();
        Alert.alert('Unable to submit quiz', error instanceof Error ? error.message : 'Please try again.');
      }
    }, 0);
  }, [
    quizQuestions,
    quizAnswers,
    selectedLessonId,
    selectedLesson?.hasQuiz,
    ensureSession,
    hydrateApp,
    runWithActionLoader,
  ]);

  const resetQuiz = useCallback(() => {
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizAnswers({});
    setQuizCompleted(false);
    setQuizScore(0);
    setQuizFailureMessage(null);
  }, []);

  const dismissQuizFailure = useCallback(() => setQuizFailureMessage(null), []);

  const showLessonComplete = useCallback((type: 'quiz' | 'lesson' | 'claim') => {
    const points = selectedLesson?.pointsReward ?? 10;
    setEarnedPoints(points);
    setCompletionCelebrationType(type);
    setActiveOverlayState('lessonCompleted');
  }, [selectedLesson, setActiveOverlayState]);

  const refreshChallenges = useCallback(async (token: string) => {
    const fresh = await homeService.getChallenges(token);
    setChallenges(fresh.items);
    setIsCycleActive(fresh.isCycleActive ?? true);
  }, []);
  const handleChallengeProgress = useCallback(
    async (challenge: ChallengeWithProgress, nextProgress: number) => {
      await runWithActionLoader('Updating challenge progress...', async () => {
        try {
          const activeSession = ensureSession();
          setRefreshing(true);
          const boundedProgress = Math.min(100, nextProgress);
          const mutationMode = await runMutationWithOfflineFallback({
            mutation: {
              userId: activeSession.user.id,
              type: 'challenge-progress',
              payload: {
                challengeId: challenge.id,
                progressPercentage: boundedProgress,
              },
              dedupeKey: `challenge-progress:${challenge.id}`,
            },
            onlineAction: async () => {
              await homeService.updateChallengeProgress(
                activeSession.token,
                challenge.id,
                boundedProgress,
              );
            },
            applyOptimisticUpdate: () => {
              applyOfflineChallengeProgress(challenge.id, boundedProgress);
            },
          });

          if (mutationMode === 'online') {
            await refreshChallenges(activeSession.token);
          }
        } catch (error) {
          Alert.alert('Challenge update failed', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setRefreshing(false);
        }
      });
    },
    [
      applyOfflineChallengeProgress,
      ensureSession,
      refreshChallenges,
      runMutationWithOfflineFallback,
      runWithActionLoader,
    ],
  );

  const handleHabitCheckIn = useCallback(
    async (habitId: string) => {
      await runWithActionLoader('Logging today\'s eco habit...', async () => {
        try {
          const activeSession = ensureSession();
          setRefreshing(true);
          const mutationMode = await runMutationWithOfflineFallback({
            mutation: {
              userId: activeSession.user.id,
              type: 'habit-check-in',
              payload: {
                habitId,
                dateKey: habitsToday?.dateKey ?? getPhDateKey(),
              },
              dedupeKey: `habit-check-in:${habitsToday?.dateKey ?? getPhDateKey()}:${habitId}`,
            },
            onlineAction: async () => {
              await homeService.checkInHabit(activeSession.token, habitId);
            },
            applyOptimisticUpdate: () => {
              applyOfflineHabitCheckIn(habitId);
            },
            offlineAlertMessage:
              'Today\'s check-in was saved offline and will sync automatically when internet is back.',
          });

          if (mutationMode === 'online') {
            setHabitsToday(await homeService.getHabitsToday(activeSession.token));
          }
        } catch (error) {
          Alert.alert('Check-in failed', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setRefreshing(false);
        }
      });
    },
    [
      applyOfflineHabitCheckIn,
      ensureSession,
      habitsToday?.dateKey,
      runMutationWithOfflineFallback,
      runWithActionLoader,
    ],
  );

  const handleJoinEvent = useCallback(
    async (eventId: string) => {
      return runWithActionLoader('Reserving your event slot...', async () => {
        try {
          const activeSession = ensureSession();
          setRefreshing(true);
          const mutationMode = await runMutationWithOfflineFallback({
            mutation: {
              userId: activeSession.user.id,
              type: 'event-join',
              payload: { eventId },
              dedupeKey: `event-join:${eventId}`,
            },
            onlineAction: async () => {
              await homeService.joinEvent(activeSession.token, eventId);
            },
            offlineAlertTitle: 'Join request saved offline',
            offlineAlertMessage:
              'Your event join request will sync automatically when you reconnect. Final slot confirmation happens on the server.',
          });

          if (mutationMode === 'online') {
            setEvents((current) => current.map((event) =>
              event.id === eventId ? { ...event, userStatus: 'joined' } : event,
            ));
            showNotification({
              title: 'You are in!',
              message: 'Your event slot is reserved. Show up to earn your verified reward.',
              tone: 'success',
            });
            void homeService.getEvents(activeSession.token).then(setEvents)
              .catch((error) => console.warn('[handleJoinEvent] Unable to refresh events:', error));
            return true;
          }
          return false;
        } catch (error) {
          showNotification({
            title: 'Unable to join event',
            message: error instanceof Error ? error.message : 'Please try again.',
            tone: 'error',
          });
          return false;
        } finally {
          setRefreshing(false);
        }
      }, 0);
    },
    [ensureSession, runMutationWithOfflineFallback, runWithActionLoader, showNotification],
  );

  const handleClaimEventReward = useCallback(
    async (eventId: string) => {
      await runWithActionLoader('Claiming reward...', async () => {
        try {
          const activeSession = ensureSession();
          setRefreshing(true);

          const event = events.find((e) => e.id === eventId);
          const expReward = event?.expReward ?? 0;
          const coinReward = event?.ecoCoinsReward ?? 0;

          const result = await homeService.claimEventReward(activeSession.token, eventId);

          const pointsAwarded = result.pointsAwarded || expReward;
          const coinsAwarded = result.ecoCoinsAwarded || coinReward;

          try {
            setDashboard(await homeService.getDashboard(activeSession.token));
          } catch (refreshError) {
            console.warn('[handleClaimEventReward] Dashboard refresh failed:', refreshError);
          }
          setEarnedPoints(pointsAwarded);
          setEarnedCoins(coinsAwarded);
          setActiveOverlayState('eventApproved');
        } catch (error: any) {
          showNotification({
            title: 'Reward not claimed',
            message: error.message || 'Failed to claim reward.',
            tone: 'error',
          });
        } finally {
          setRefreshing(false);
        }
      });
    },
    [events, ensureSession, runWithActionLoader, showNotification]
  );

  const handleAssistantSend = useCallback(
    async (seedMessage?: string) => {
      const outgoingText = (seedMessage ?? assistantInput).trim();
      if (!outgoingText || sendingMessage) {
        return;
      }

      let activeSession: SessionPayload;
      try {
        activeSession = ensureSession();
      } catch (err) {
        Alert.alert('Session required', err instanceof Error ? err.message : 'Please sign in again.');
        return;
      }

      const userMessage: AssistantMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: outgoingText,
        time: formatChatTime(new Date().toISOString()),
      };

      setAssistantMessages((current) => [...current, userMessage]);
      setAssistantInput('');
      setAssistantNotice(null);
      setSendingMessage(true);

      try {
        // Send only turns that occurred before the current message. The API
        // appends outgoingText as the current user turn after this history.
        const history = assistantMessages.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.text,
        }));

        const reply = await homeService.sendAssistantMessage(activeSession.token, outgoingText, history);

        // [TEMPORARY DEBUG] Log raw response received by frontend to diagnose rendering issues
        if (__DEV__) {
          console.log('\n[EcoGuide Debug] Frontend received raw response:');
          console.log(reply.reply);
          console.log('---------------------------------------------------\n');
        }

        setAssistantMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: reply.reply,
            time: formatChatTime(new Date().toISOString()),
          },
        ]);

        // Update quick replies with contextual suggestions from the AI
        if (reply.quickReplies?.length) {
          setAssistantQuickReplies(reply.quickReplies);
        }
      } catch (error) {
        const status = typeof error === 'object' && error !== null && 'status' in error
          ? (error as { status?: unknown }).status
          : undefined;

        triggerWarningHaptic();
        setAssistantNotice(status === 429
          ? {
              title: 'Chat limit reached',
              message: 'You’ve used the available AI messages for now. Please wait a few minutes, then try again.',
              tone: 'warning',
            }
          : {
              title: 'Assistant unavailable',
              message: error instanceof Error ? error.message : 'Please try again in a moment.',
              tone: 'error',
            });
      } finally {
        setSendingMessage(false);
      }
    },
    [assistantInput, assistantMessages, ensureSession, sendingMessage],
  );

  const loadTrackerMonth = useCallback(
    async (offset: number) => {
      await runWithActionLoader(offset < 0 ? 'Loading previous month...' : 'Loading next month...', async () => {
        try {
          const activeSession = ensureSession();
          const baseMonth = tracker?.month ?? getPhMonthKey();
          const targetMonth = shiftMonth(baseMonth, offset);
          setRefreshing(true);
          lastSecondaryRefreshAtRef.current.tracker = Date.now();
          const nextTracker = await homeService.getTracker(activeSession.token, targetMonth);
          setTracker(nextTracker);
        } catch (error) {
          lastSecondaryRefreshAtRef.current.tracker = 0;
          Alert.alert('Unable to load month', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setRefreshing(false);
        }
      });
    },
    [ensureSession, runWithActionLoader, tracker?.month],
  );

  const setActiveTab = useCallback(
    (tab: AppTab, silent: boolean = false) => {
      setActiveTabState((prev) => {
        if (prev !== tab) {
          setTabHistory((history) => {
            // Avoid duplicate consecutive entries and limit history size to 25
            const nextHistory = history[history.length - 1] === tab ? history : [...history, tab];
            return nextHistory.length > 25 ? nextHistory.slice(-25) : nextHistory;
          });
        }
        return tab;
      });
    },
    [],
  );

  const setActiveOverlay = useCallback(
    (screen: OverlayScreen) => {
      if (!screen) {
        setActiveOverlayState(null);
        return;
      }

      setActiveOverlayState(screen);
    },
    [],
  );

  /**
   * Hardware & gesture back button handler (Facebook-style tab history & overlay handling)
   * Returns true if the back action was consumed, or false to permit default exit.
   */
  const handleHardwareBackPress = useCallback((): boolean => {
    // 1. If CoachMarks walkthrough tutorial is open, close it
    if (coachMarksVisible) {
      completeCoachMarks();
      return true;
    }

    // 2. If an overlay is active, handle overlay back hierarchy
    if (activeOverlay) {
      if (activeOverlay === 'quiz') {
        // Step back from quiz to lesson detail
        resetQuiz();
        setActiveOverlayState('lesson');
        return true;
      }

      // Special handling for lesson completed celebration -> return to lesson or close
      if (activeOverlay === 'lessonCompleted') {
        resetQuiz();
        setActiveOverlayState(null);
        return true;
      }

      // For all other overlays (assistant, events, lesson, leaderboard, rewards, etc.)
      setActiveOverlayState(null);
      return true;
    }

    // 3. If in Challenges tab and viewing My Tasks or History, step back to Discover view
    if (activeTab === 'challenges' && challengesViewMode !== 'Discover') {
      setChallengesViewMode('Discover');
      return true;
    }

    // 4. Facebook-style Tab Navigation History Stack:
    // If the user has navigated between tabs, pop backwards
    if (tabHistory.length > 1) {
      // Create new history without the current top tab
      const nextHistory = [...tabHistory];
      nextHistory.pop(); // remove current active tab
      const previousTab = nextHistory[nextHistory.length - 1];

      setTabHistory(nextHistory);
      setActiveTabState(previousTab);
      return true;
    }

    // 5. If user is on a tab other than 'home' but history is somehow 1 entry, go to 'home'
    if (activeTab !== 'home') {
      setActiveTabState('home');
      setTabHistory(['home']);
      return true;
    }

    // 6. User is at root ('home') with no previous history -> Double-back to exit
    const now = Date.now();
    if (now - lastBackPressRef.current < 2000) {
      // User pressed back twice within 2 seconds -> Allow app to exit
      return false;
    }

    lastBackPressRef.current = now;
    if (Platform.OS === 'android') {
      ToastAndroid.show('Press back again to exit EcoBud', ToastAndroid.SHORT);
    }
    return true;
  }, [
    activeOverlay,
    activeTab,
    challengesViewMode,
    coachMarksVisible,
    completeCoachMarks,
    resetQuiz,
    tabHistory,
  ]);

  const analyzeChallengeImage = useCallback(async (challengeId: string, uri: string) => {
    try {
      const activeSession = ensureSession();
      const result = await homeService.analyzeChallengeImage(activeSession.token, challengeId, uri);
      return result;
    } catch (error) {
      throw error;
    }
  }, [ensureSession, lessons]);

  const uploadChallengeProofImage = useCallback(async (challengeId: string, uri: string) => {
    try {
      const activeSession = ensureSession();
      const result = await homeService.uploadChallengeProofImage(activeSession.token, challengeId, uri);
      return result;
    } catch (error) {
      throw error;
    }
  }, [ensureSession]);

  const showChallengeMessage = useCallback((message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      console.warn(`[Challenges] ${message}`);
    }
  }, []);

  const reconcileChallengeMutation = useCallback(async (
    token: string,
    challengeId: string,
    isCommitted: (challenge: ChallengeWithProgress) => boolean,
  ) => {
    try {
      const fresh = await homeService.getChallenges(token);
      setChallenges(fresh.items);
      const challenge = fresh.items.find((item: ChallengeWithProgress) =>
        item.id === challengeId || item.cycle?.instanceId === challengeId || (item as any).instanceId === challengeId
      );
      return Boolean(challenge && isCommitted(challenge));
    } catch {
      return false;
    }
  }, []);

  const isUncertainChallengeFailure = (error: unknown) =>
    ['timeout', 'offline', 'server'].includes(String((error as any)?.code || ''));

  const handleSubmitChallengeProof = useCallback(async (challengeId: string, proofUrl: string, afterProofUrl?: string, detectedQuantity?: number, analysisToken?: string, proofText?: string) => {
    await runWithActionLoader('Submitting before photo...', async () => {
      try {
        const activeSession = ensureSession();
        setRefreshing(true);
        await homeService.submitChallengeProof(activeSession.token, challengeId, proofUrl, afterProofUrl, detectedQuantity, analysisToken, proofText);
        // Optimistically update the challenge state to pending
        setChallenges((currentChallenges) =>
          currentChallenges.map((challenge) =>
            challenge.id === challengeId
              ? {
                ...challenge,
                progress: {
                  progressPercentage: challenge.progress?.progressPercentage || 0,
                  status: 'pending',
                  submission: {
                    id: 'temp',
                    status: 'pending',
                    proofUrl,
                    afterProofUrl: null,
                    detectedQuantity: detectedQuantity || 1,
                    reservedQuantity: detectedQuantity || 1,
                    qrToken: null,
                    qrVerified: false,
                    adminPreliminaryApproved: false,
                    adminFinalApproved: false,
                    rewardAwarded: false,
                    ecoCoinsAwarded: 0,
                    expAwarded: 0,
                  }
                },
              }
              : challenge
          )
        );
        await refreshChallenges(activeSession.token);
      } catch (error) {
        const activeSession = ensureSession();
        const committed = isUncertainChallengeFailure(error) && await reconcileChallengeMutation(
          activeSession.token,
          challengeId,
          (challenge) => Boolean(
            challenge.progress?.submission?.proofUrl === proofUrl ||
            challenge.progress?.submissions?.some((submission: any) => submission.proofUrl === proofUrl)
          ),
        );
        if (committed) {
          showChallengeMessage('Before photo submitted successfully.');
          return;
        }
        showChallengeMessage(error instanceof Error ? error.message : 'Before photo was not submitted. Please try again.');
        throw error;
      } finally {
        setRefreshing(false);
      }
    });
  }, [ensureSession, refreshChallenges, reconcileChallengeMutation, runWithActionLoader, showChallengeMessage]);

  const handleVerifyChallengeQr = useCallback(async (challengeId: string, qrData: string, latitude?: number, longitude?: number, submissionId?: string) => {
    await runWithActionLoader('Verifying Barangay QR code...', async () => {
      try {
        const activeSession = ensureSession();
        setRefreshing(true);
        await homeService.verifyChallengeQr(activeSession.token, challengeId, qrData, latitude, longitude, submissionId);
        await refreshChallenges(activeSession.token);
      } catch (error) {
        Alert.alert('QR Verification failed', error instanceof Error ? error.message : 'Please try again.');
        throw error;
      } finally {
        setRefreshing(false);
      }
    });
  }, [ensureSession, refreshChallenges, runWithActionLoader]);

  const handleSubmitChallengeAfterPhoto = useCallback(async (challengeId: string, afterProofUrl: string, submissionId?: string) => {
    await runWithActionLoader('Submitting after photo for final review...', async () => {
      try {
        const activeSession = ensureSession();
        setRefreshing(true);
        await homeService.submitChallengeAfterPhoto(activeSession.token, challengeId, afterProofUrl, submissionId);
        await refreshChallenges(activeSession.token);
      } catch (error) {
        const activeSession = ensureSession();
        const committed = isUncertainChallengeFailure(error) && await reconcileChallengeMutation(
          activeSession.token,
          challengeId,
          (challenge) => Boolean(
            challenge.progress?.submission?.afterProofUrl === afterProofUrl ||
            challenge.progress?.submissions?.some((submission: any) => submission.afterProofUrl === afterProofUrl)
          ),
        );
        if (committed) {
          showChallengeMessage('After photo submitted. Awaiting review.');
          return;
        }
        showChallengeMessage(error instanceof Error ? error.message : 'After photo was not submitted. Please try again.');
        throw error;
      } finally {
        setRefreshing(false);
      }
    });
  }, [ensureSession, refreshChallenges, reconcileChallengeMutation, runWithActionLoader, showChallengeMessage]);

  const triggerTestReward = useCallback((origin?: { x: number; y: number }) => {
    setClaimRewardData({ points: 10, coins: 10, origin });
    setActiveOverlayState('claimParticles');
  }, []);

  const handleClaimChallengeReward = useCallback(async (challengeId: string, origin?: { x: number; y: number }, submissionId?: string) => {
    const challenge = challenges.find((c) =>
      c.id === challengeId || c.cycle?.instanceId === challengeId || (c as any).instanceId === challengeId
    );
    if (!challenge) {
      return;
    }

    setRefreshing(true);
    try {
      const activeSession = ensureSession();

      const targetSub = submissionId
        ? challenge.progress?.submissions?.find((s: any) => s.id === submissionId) || (challenge.progress?.submission?.id === submissionId ? challenge.progress.submission : null)
        : challenge.progress?.submission;

      const totalExp = (targetSub && targetSub.expAwarded) || challenge.expReward;
      const totalCoins = (targetSub && targetSub.ecoCoinsAwarded !== undefined) ? targetSub.ecoCoinsAwarded : challenge.ecoCoinReward;

      setEarnedPoints(totalExp);
      setEarnedCoins(totalCoins);

      const res = await homeService.claimChallengeReward(activeSession.token, challengeId, submissionId);

      const validOrigin = origin && origin.x > 0 && origin.y > 0 ? origin : undefined;
      setClaimRewardData({ points: totalExp, coins: totalCoins, origin: validOrigin });
      setCompletionCelebrationType('claim');
      setActiveOverlayState('claimParticles');
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challengeId || c.cycle?.instanceId === challengeId || (c as any).instanceId === challengeId
            ? {
                ...c,
                progress: c.progress
                  ? {
                      ...c.progress,
                      status: 'completed',
                      submission: c.progress.submission
                        ? { ...c.progress.submission, status: 'completed', rewardAwarded: true }
                        : c.progress.submission,
                      submissions: c.progress.submissions?.map((s: any) =>
                        !submissionId || s.id === submissionId
                          ? { ...s, status: 'completed', rewardAwarded: true }
                          : s
                      ),
                    }
                  : c.progress,
              }
            : c
        )
      );
      if (res?.awardedBadges && res.awardedBadges.length > 0) {
        setNewlyUnlockedBadges(res.awardedBadges);
        setPendingBadgeQueue((prev) => [...prev, ...res.awardedBadges!]);
      }

      try {
        setDashboard(await homeService.getDashboard(activeSession.token));
      } catch (refreshError) {
        console.warn('[handleClaimChallengeReward] Dashboard refresh failed:', refreshError);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '';
      const activeSession = ensureSession();
      const committed = isUncertainChallengeFailure(error) && await reconcileChallengeMutation(
        activeSession.token,
        challengeId,
        (freshChallenge) => {
          const submissions = freshChallenge.progress?.submissions || [];
          const submission = submissionId
            ? submissions.find((item: any) => item.id === submissionId)
            : freshChallenge.progress?.submission;
          return Boolean(submission?.rewardAwarded || freshChallenge.progress?.status === 'completed');
        },
      );
      if (committed || errMsg.toLowerCase().includes('already claimed')) {
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === challengeId || c.cycle?.instanceId === challengeId || (c as any).instanceId === challengeId
              ? {
                  ...c,
                  progress: c.progress
                    ? {
                        ...c.progress,
                        status: 'completed',
                        submission: c.progress.submission
                          ? { ...c.progress.submission, status: 'completed', rewardAwarded: true }
                          : c.progress.submission,
                        submissions: c.progress.submissions?.map((s: any) =>
                          !submissionId || s.id === submissionId
                            ? { ...s, status: 'completed', rewardAwarded: true }
                            : s
                        ),
                      }
                    : c.progress,
                }
              : c
          )
        );
        try {
          const activeSession = ensureSession();
          await refreshChallenges(activeSession.token);
        } catch {
          // ignore
        }
        showChallengeMessage('Reward claimed successfully.');
      } else {
        showChallengeMessage(errMsg || 'Reward was not claimed. Please try again.');
      }
    } finally {
      setRefreshing(false);
    }
  }, [challenges, ensureSession, refreshChallenges, reconcileChallengeMutation, showChallengeMessage]);

  const handleUpdateProfileImage = useCallback(async (uri: string) => {
    await runWithActionLoader('Uploading image...', async () => {
      try {
        const activeSession = ensureSession();
        const res = await homeService.uploadAvatar(activeSession.token, uri);

        if (res?.avatarUrl) {
          const updatedSession = {
            ...activeSession,
            user: {
              ...activeSession.user,
              avatarUrl: res.avatarUrl,
            },
          };
          setSession(updatedSession);
          await persistSession(updatedSession);
        }

        await hydrateApp(activeSession, true);
        return res;
      } catch (error) {
        Alert.alert('Upload Failed', error instanceof Error ? error.message : 'Please try again.');
        throw error;
      }
    });
  }, [ensureSession, runWithActionLoader, hydrateApp, persistSession]);

  const handleUpdateProfile = useCallback(async (payload: { displayName?: string; email?: string; city?: string }) => {
    await runWithActionLoader('Saving profile changes...', async () => {
      try {
        const activeSession = ensureSession();
        const res = await homeService.updateProfile(activeSession.token, payload);

        const updatedSession = {
          ...activeSession,
          token: res.token || activeSession.token,
          user: {
            ...activeSession.user,
            name: res.name || activeSession.user.name,
            displayName: res.name || payload.displayName || activeSession.user.displayName,
            email: res.email || payload.email || activeSession.user.email,
          },
        };
        await persistSession(updatedSession);
        setSession(updatedSession);

        if (res.profile) {
          setProfile((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              name: res.name || prev.name,
              email: res.email || prev.email,
              profile: {
                ...prev.profile,
                ...res.profile,
                displayName: res.profile.displayName || payload.displayName || prev.profile?.displayName,
                city: res.profile.city !== undefined ? res.profile.city : prev.profile?.city,
              },
            };
          });
        }

      } catch (error) {
        throw error;
      }
    });
  }, [ensureSession, runWithActionLoader, persistSession]);

  const handleUpdateSecuritySettings = useCallback(async (payload: { currentPassword: string; newEmail?: string; emailCode?: string; newPassword?: string }) => {
    await runWithActionLoader('Updating security settings...', async () => {
      try {
        const activeSession = ensureSession();
        const result = await homeService.updateSecuritySettings(activeSession.token, payload);

        {
          // Persist the replacement token after old sessions are revoked.
          const updatedSession = {
            ...activeSession,
            token: result.token,
            user: {
              ...activeSession.user,
              email: payload.newEmail || activeSession.user.email,
            }
          };
          await persistSession(updatedSession);
          setSession(updatedSession);
        }
      } catch (error) {
        throw error;
      }
    });
  }, [ensureSession, runWithActionLoader, persistSession]);

  const getTotpStatus = useCallback(async () => {
    const activeSession = ensureSession();
    return homeService.getTotpStatus(activeSession.token);
  }, [ensureSession]);

  const beginTotpEnrollment = useCallback(async () => {
    const activeSession = ensureSession();
    return homeService.beginTotpEnrollment(activeSession.token);
  }, [ensureSession]);

  const confirmTotpEnrollment = useCallback(async (enrollmentId: string, code: string) => {
    const activeSession = ensureSession();
    const result = await homeService.confirmTotpEnrollment(activeSession.token, enrollmentId, code);
    const updatedSession = { ...activeSession, token: result.token, refreshToken: result.refreshToken };
    setSession(updatedSession);
    await persistSession(updatedSession);
    return result.recoveryCodes;
  }, [ensureSession, persistSession]);

  const rotateMfaRecoveryCodes = useCallback(async (code: string) => {
    const activeSession = ensureSession();
    const result = await homeService.rotateMfaRecoveryCodes(activeSession.token, code);
    return result.recoveryCodes;
  }, [ensureSession]);

  const disableTotp = useCallback(async (code: string) => {
    const activeSession = ensureSession();
    const result = await homeService.disableTotp(activeSession.token, code);
    const updatedSession = { ...activeSession, token: result.token, refreshToken: result.refreshToken };
    setSession(updatedSession);
    await persistSession(updatedSession);
  }, [ensureSession, persistSession]);

  const userDisplayName =
    profile?.profile?.displayName ??
    session?.user.displayName ??
    'EcoBud Member';
  const isUserOnline = Boolean(
    session &&
    presence.isPresenceOnline &&
    realtimeConnected,
  );

  return {
    initializing,
    booting,
    isHydrating,
    hasOnboarded,
    session,
    actionOverlayVisible,
    actionOverlayLabel,
    activeTab,
    activeOverlay,
    selectedLesson,
    selectedChallenge,
    recentViewedMission,
    viewedMissionIds,
    quizQuestions,
    currentQuestionIndex,
    selectedAnswer,
    quizAnswers,
    quizCompleted,
    quizScore,
    quizFailureMessage,
    earnedPoints,
    earnedCoins,
    completionCelebrationType,
    learnSearch,
    learnFilter,
    learnCategory,
    assistantInput,
    claimRewardData,
    assistantMessages,
    assistantQuickReplies,
    assistantNotice,
    authEmail,
    authPassword,
    authMode,
    authLoading,
    authError,
    refreshing,
    sendingMessage,
    dashboard,
    lessons,
    filteredLessons,
    challenges,
    isCycleActive,
    habitsToday,
    tracker,
    profile,
    rewards,
    newlyUnlockedBadges,
    setNewlyUnlockedBadges,
    selectedBadge,
    setSelectedBadge,
    openBadgeOverlay,
    leaderboard,
    leaderboardLoading,
    leaderboardHasLoaded,
    loadLeaderboard,
    events,
    transparency,
    todaysCompletedHabits,
    userDisplayName,
    hasUsableInternet: presence.hasUsableInternet,
    isUserOnline,
    notificationCount,
    notificationDestination,
    setNotificationDestination,
    focusedEventId,
    setFocusedEventId,
    pendingNotificationId,
    setPendingNotificationId,
    challengesViewMode,
    setChallengesViewMode,
    setActiveTab,
    setActiveOverlay,
    setLearnSearch,
    setLearnFilter,
    setLearnCategory,
    setAssistantInput,
    dismissAssistantNotice: () => setAssistantNotice(null),
    setAuthEmail,
    setAuthPassword,
    completeOnboarding,
    continueWithReadOnlyAccess,
    leaveReadOnlyAccess,
    handleLoginArgs,
    handleVerifyMfaChallenge,
    handleGoogleSignIn,
    handleSignUpArgs,
    handleSendOTP,
    handleCheckUsernameAvailability,
    handleLogout,
    refreshEverything,

    openLesson,
    triggerTestReward,
    handleCompleteLesson,
    handleUpdateLessonProgress,
    startQuiz,
    selectAnswer,
    nextQuestion,
    submitQuiz,
    resetQuiz,
    dismissQuizFailure,
    showLessonComplete,

    handleHabitCheckIn,
    handleJoinEvent,
    handleClaimEventReward,
    handleAssistantSend,
    loadTrackerMonth,
    openChallengeMission,
    handleChallengeProgress,
    analyzeChallengeImage,
    uploadChallengeProofImage,
    handleSubmitChallengeProof,
    handleVerifyChallengeQr,
    handleSubmitChallengeAfterPhoto,
    handleClaimChallengeReward,
    handleUpdateProfileImage,
    handleUpdateProfile,
    handleUpdateSecuritySettings,
    getTotpStatus,
    beginTotpEnrollment,
    confirmTotpEnrollment,
    rotateMfaRecoveryCodes,
    disableTotp,
    coachMarksCurrentStep,
    setCoachMarksCurrentStep,
    coachMarksVisible,
    coachMarksReplay,
    completeCoachMarks,
    showCoachMarks,
    setSpotlightTargetRect,
    progressBarLayout,
    setProgressBarLayout,
    isChatbotEnabled,
    setChatbotEnabled,
    chatbotSize,
    setChatbotSize,
    chatbotPosition,
    setChatbotPosition,
    pushNotificationsEnabled,
    setPushNotificationsEnabled,
    handleHardwareBackPress,
  };

}
