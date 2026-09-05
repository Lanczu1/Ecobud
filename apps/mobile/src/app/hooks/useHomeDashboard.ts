import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, DeviceEventEmitter, AppState } from 'react-native';
import { homeService } from '../services/homeService';
import {
  type AppTab,
  type AssistantMessage,
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
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// ─── Constants ──────────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = 'ecobud.mobile.session';
const ONBOARDING_STORAGE_KEY = 'ecobud.mobile.onboarding';
const VIEWED_MISSIONS_KEY = 'ecobud.mobile.viewedMissions';
const RECENT_VIEWED_KEY = 'ecobud.mobile.recentViewedMission';
const CHATBOT_ENABLED_STORAGE_KEY = 'ecobud.mobile.chatbotEnabled';

// ─── Internal Utilities ─────────────────────────────────────────────────────────

function formatChatTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// EcoBud uses Philippines (Asia/Manila, UTC+8) calendar days. Intl keeps the
// key correct regardless of the device's own timezone.
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

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useHomeDashboard(): EcoBudMobileModel {
  const [initializing, setInitializing] = useState(true);
  const [booting, setBooting] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [activeTab, setActiveTabState] = useState<AppTab>('home');
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

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [isCycleActive, setIsCycleActive] = useState<boolean>(true);
  const [habitsToday, setHabitsToday] = useState<HabitTodayData | null>(null);
  const [tracker, setTracker] = useState<TrackerData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [events, setEvents] = useState<EcoEvent[]>([]);


  const [transparency, setTransparency] = useState<TransparencyFeed | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [pendingStreakUnlock, setPendingStreakUnlock] = useState(false);
  const [pendingBadgeQueue, setPendingBadgeQueue] = useState<EcoBadge[]>([]);
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<EcoBadge[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<EcoBadge | null>(null);
  const [completionCelebrationType, setCompletionCelebrationType] = useState<'quiz' | 'lesson' | 'claim'>('lesson');
  const [coachMarksCurrentStep, setCoachMarksCurrentStep] = useState(0);
  const [coachMarksVisible, setCoachMarksVisible] = useState(false);
  const [spotlightTargetRect, setSpotlightTargetRectState] = useState<{ x: number; y: number; width: number; height: number; borderRadius?: number } | null>(null);

  const setSpotlightTargetRect = useCallback((rect: { x: number; y: number; width: number; height: number; borderRadius?: number } | null) => {
    setSpotlightTargetRectState((prev) => {
      if (!prev && !rect) return prev;
      if (
        prev &&
        rect &&
        Math.round(prev.x) === Math.round(rect.x) &&
        Math.round(prev.y) === Math.round(rect.y) &&
        Math.round(prev.width) === Math.round(rect.width) &&
        Math.round(prev.height) === Math.round(rect.height) &&
        prev.borderRadius === rect.borderRadius
      ) {
        return prev;
      }
      return rect;
    });
  }, []);

  const [progressBarLayout, setProgressBarLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isChatbotEnabled, setIsChatbotEnabled] = useState(true);

  const setChatbotEnabled = useCallback(async (enabled: boolean) => {
    setIsChatbotEnabled(enabled);
    try {
      await mobileStorage.setItem(CHATBOT_ENABLED_STORAGE_KEY, JSON.stringify(enabled));
    } catch (e) {
      console.warn('Failed to persist chatbot preference', e);
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
    setEvents([]);
    setTransparency(null);
    setAssistantMessages([]);
    setSelectedLessonId(null);
    setSelectedChallenge(null);
    setSelectedBadge(null);
    setNewlyUnlockedBadges([]);
    setPendingBadgeQueue([]);
    setPendingStreakUnlock(false);
    previousStreakRef.current = null;
    previousUnlockedBadgeIdsRef.current = null;
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
        Alert.alert(options.alertTitle ?? 'Saved offline', options.alertMessage);
      }

      return 'queued' as const;
    },
    [],
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
    async <T,>(label: string, action: () => Promise<T> | T, minimumDuration = 720) => {
      const ticket = ++actionOverlayTicket.current;
      const startedAt = Date.now();
      setActionOverlayLabel(label);
      setActionOverlayVisible(true);

      try {
        return await action();
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = minimumDuration - elapsed;
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
      if (!existingSession?.token) {
        return;
      }

      if (!silent) {
        setRefreshing(true);
      }

      try {
        const data = await homeService.getFullHydrationData(existingSession.token);

        const safeLessons = Array.isArray(data?.lessons) ? [...data.lessons] : [];
        safeLessons.sort((a: any, b: any) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return 0;
        });

        // Initialize baseline refs on first hydration if not yet set
        if (previousStreakRef.current === null && data?.dashboard) {
          previousStreakRef.current = data.dashboard.streak;
        }
        if (previousUnlockedBadgeIdsRef.current === null && data?.rewards?.badges) {
          const unlockedIds = new Set<string>(data.rewards.badges.filter((b: any) => b.unlocked).map((b: any) => String(b.id)));
          previousUnlockedBadgeIdsRef.current = unlockedIds;
        }

        setDashboard(data?.dashboard ?? null);
        setLessons(safeLessons);
        setChallenges(Array.isArray(data?.challenges) ? data.challenges : []);
        setIsCycleActive(data?.isCycleActive ?? true);
        setHabitsToday(data?.habitsToday ?? null);
        setTracker(data?.tracker ?? null);
        setProfile(data?.profile ?? null);
        setRewards(data?.rewards ?? null);
        setLeaderboard(data?.leaderboard ?? null);
        setEvents(Array.isArray(data?.events) ? data.events : []);
        setTransparency(data?.transparency ?? null);
        setSelectedLessonId((current) => current ?? safeLessons[0]?.id ?? null);
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
      } catch (error) {
        const status = (error as any)?.status;
        const msg = error instanceof Error ? error.message : '';
        const isAuthExpired = status === 401 || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('unauthorized');

        if (isAuthExpired) {
          // Token is expired or invalid - silently wipe invalid session so app resets cleanly
          setSession(null);
          clearAppData();
          setActiveOverlayState(null);
          setActiveTabState('home');
          void persistSession(null);
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to reach ECOBUD right now.';
        if (!silent) {
          console.warn('ECOBUD sync error:', message);
          Alert.alert('Sync failed', message);
        } else {
          // Silent background sync / bootstrap fallback: warn softly in dev without popping up RedBox/LogBox error banner
          console.warn('[ECOBUD hydrateApp (offline/unreachable)]:', message);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [clearAppData, persistSession],
  );

  const syncQueuedOfflineActions = useCallback(
    async (activeSession: SessionPayload) => {
      if (offlineSyncInFlightRef.current) {
        return;
      }

      offlineSyncInFlightRef.current = true;

      try {
        const syncResult = await offlineSyncService.syncPendingMutations({
          token: activeSession.token,
          userId: activeSession.user.id,
        });

        if (syncResult.syncedCount > 0) {
          await hydrateApp(activeSession, true);
        }

        if (syncResult.failedCount > 0) {
          console.warn(
            `Offline sync finished with ${syncResult.failedCount} failed mutation(s).`,
          );
        }
      } catch (error) {
        console.warn('Offline sync failed during reconnect.', error);
      } finally {
        offlineSyncInFlightRef.current = false;
      }
    },
    [hydrateApp],
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const savedViewedIds = await mobileStorage.getItem(VIEWED_MISSIONS_KEY);
        if (savedViewedIds) {
          try { setViewedMissionIds(JSON.parse(savedViewedIds)); } catch (e) { }
        }

        const savedRecent = await mobileStorage.getItem(RECENT_VIEWED_KEY);
        if (savedRecent) {
          try { setRecentViewedMission(JSON.parse(savedRecent)); } catch (e) { }
        }

        const savedChatbotEnabled = await mobileStorage.getItem(CHATBOT_ENABLED_STORAGE_KEY);
        if (savedChatbotEnabled !== null) {
          try { setIsChatbotEnabled(JSON.parse(savedChatbotEnabled) !== false); } catch (e) { }
        }

        const savedSession = await mobileStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession) as SessionPayload;
            if (parsed && typeof parsed === 'object' && parsed.token && parsed.user) {
              setSession(parsed);
              await hydrateApp(parsed, true);
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
        setBooting(false);
        setInitializing(false);
      }
    };

    void bootstrap();
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

  // Auto-sync polling for Lessons, Challenges, Events & Real-time status updates
  useEffect(() => {
    if (!session?.token) return;

    const interval = setInterval(() => {
      if (AppState.currentState === 'active' && presence.hasUsableInternet) {
        // Silently fetch latest lessons, challenges and events without blocking UI
        Promise.all([
          homeService.getLessons(session.token).catch(() => null),
          homeService.getChallenges(session.token).catch(() => null),
          homeService.getEvents(session.token).catch(() => null),
        ]).then(([lessonsRes, challengesRes, newEvents]) => {
          if (lessonsRes && Array.isArray(lessonsRes)) {
            const safeLessons = [...lessonsRes];
            safeLessons.sort((a: any, b: any) => {
              if (a.featured && !b.featured) return -1;
              if (!a.featured && b.featured) return 1;
              return 0;
            });
            setLessons(safeLessons);
          }
          if (challengesRes) {
            setChallenges(Array.isArray(challengesRes?.items) ? challengesRes.items : Array.isArray(challengesRes) ? challengesRes : []);
            setIsCycleActive(challengesRes?.isCycleActive ?? true);
          }
          if (newEvents) {
            setEvents(Array.isArray(newEvents) ? newEvents : Array.isArray((newEvents as any)?.items) ? (newEvents as any).items : []);
          }
        }).catch(() => {});
      }
    }, 3000); // Automatically sync every 3 seconds for seamless real-time updates

    return () => clearInterval(interval);
  }, [session?.token, presence.hasUsableInternet]);

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
    const startedAt = Date.now();
    setBooting(true);

    try {
      setHasOnboarded(true);
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = 920 - elapsed;
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }
      setBooting(false);
    }
  }, []);

  const completeCoachMarks = useCallback(() => {
    setCoachMarksVisible(false);
    setCoachMarksCurrentStep(0);
  }, []);

  const showCoachMarks = useCallback(() => {
    setCoachMarksCurrentStep(0);
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

  const handleLoginArgs = useCallback(async (email: string, pass: string) => {
    await runWithActionLoader('Signing you into EcoBud...', async () => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const nextSession = await homeService.login(email.trim(), pass);

        if (nextSession?.user?.role === 'admin' || nextSession?.user?.role === 'moderator') {
          throw new Error('Administrators and moderators cannot log in via the mobile app. Please use the web portal.');
        }

        setSession(nextSession);
        await persistSession(nextSession);
        await hydrateApp(nextSession);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Login failed.');
      } finally {
        setAuthLoading(false);
      }
    }, 900);
  }, [hydrateApp, persistSession, runWithActionLoader]);

  const handleGoogleSignIn = useCallback(async () => {
    setAuthError(null);

    try {
      if (!supabaseClient) {
        throw new Error('Supabase client is not initialized.');
      }

      const redirectUri = makeRedirectUri({
        scheme: 'ecobud',
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

      const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
        showInRecents: true,
        preferEphemeralSession: true,
      });

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

      // Check if this google account already exists in database
      let userExists = false;
      let existingCity: string | null = null;
      try {
        const checkResult = await homeService.checkEmail(authEmail);
        userExists = Boolean(checkResult.exists);
        existingCity = checkResult.city ?? null;
      } catch (err) {
        // Fallback to proceed if check failed
      }

      const completeGoogleAuth = async (selectedCity?: string, isNewUser?: boolean) => {
        await runWithActionLoader('Signing you into EcoBud...', async () => {
          setAuthLoading(true);
          try {
            const nextSession = await homeService.googleLogin({
              email: authEmail,
              displayName: authDisplayName,
              avatarUrl: authAvatarUrl,
              city: selectedCity || existingCity || undefined,
            });

            if (nextSession?.user?.role === 'admin' || nextSession?.user?.role === 'moderator') {
              throw new Error('Administrators and moderators cannot log in via the mobile app.');
            }

            setSession(nextSession);
            await persistSession(nextSession);
            await hydrateApp(nextSession);

            if (isNewUser) {
              setTimeout(() => {
                setCoachMarksCurrentStep(0);
                setCoachMarksVisible(true);
              }, 400);
            }
          } finally {
            setAuthLoading(false);
          }
        }, 700);
      };

      if (userExists) {
        // If user already exists, proceed directly to home dashboard without asking barangay
        await completeGoogleAuth(undefined, false);
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
  }, [hydrateApp, persistSession, runWithActionLoader]);

  const handleSignUpArgs = useCallback(async (username: string, email: string, pass: string, city: string, otpCode?: string) => {
    await runWithActionLoader('Creating your account...', async () => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const nextSession = await homeService.register(email.trim(), pass, username.trim(), city, otpCode?.trim() || '');
        setSession(nextSession);
        await persistSession(nextSession);
        await hydrateApp(nextSession);
        // Automatically trigger tour for newly registered users right after verification loading
        setTimeout(() => {
          setCoachMarksCurrentStep(0);
          setCoachMarksVisible(true);
        }, 400);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Sign up failed.');
      } finally {
        setAuthLoading(false);
      }
    }, 900);
  }, [hydrateApp, persistSession, runWithActionLoader]);

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
      const disconnectResult = await presence.disconnectPresence({
        clearSessionId: true,
        requireImmediateSync: true,
      });

      if (presence.hasUsableInternet && !disconnectResult.synced) {
        throw new Error('Unable to update your live status on the server. Please try signing out again.');
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
      Alert.alert(
        'Sign out incomplete',
        error instanceof Error ? error.message : 'Please try again.',
      );
    });
  }, [clearAppData, persistSession, presence, runWithActionLoader]);

  const refreshEverything = useCallback(async () => {
    if (!session) {
      return;
    }

    await runWithActionLoader('Refreshing your dashboard...', async () => {
      await hydrateApp(session);
    });
  }, [hydrateApp, runWithActionLoader, session]);

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

          Alert.alert(notice.title, notice.message);
          queueRealtimeRefresh(`notice:${notice.scope}`);
        },
        onSignal: (signal) => {
          if (!isMounted) {
            return;
          }

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
        let earnedCns = 0; // Default or maybe 5 if we want offline fallback, but we'll get from online

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
  ]);

  const handleUpdateLessonProgress = useCallback(async (lessonId: string, progress: number, videoTimestamp?: number) => {
    try {
      const activeSession = ensureSession();
      // Optimistically update locally without a loading overlay
      const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

      // Fire and forget server update
      homeService.updateLessonProgress(activeSession.token, lessonId, clampedProgress, videoTimestamp).catch((err) => {
        console.error('[handleUpdateLessonProgress] API error:', err);
      });

      // Update local state so it's snappy
      setLessons((current) =>
        current.map((lesson) => {
          if (lesson.id === lessonId) {
            return {
              ...lesson,
              progress: Math.max(lesson.progress, clampedProgress),
              videoTimestamp: videoTimestamp ?? lesson.videoTimestamp,
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

    setQuizQuestions(questions);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizAnswers({});
    setQuizCompleted(false);
    setQuizScore(0);
    setActiveOverlayState('quiz');
  }, [selectedLesson, setActiveOverlayState]);

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
          Alert.alert('Quiz Failed', res.message || `You scored ${score}%. You need at least 70% to pass. Please try again.`);
          setCurrentQuestionIndex(0);
          setSelectedAnswer(null);
          setQuizAnswers({});
          return;
        }

        triggerSuccessHaptic();
        const finalScore = res.score ?? 100;
        setQuizScore(finalScore);
        setQuizCompleted(true);

        await hydrateApp(activeSession, true);
        const points = res.pointsAwarded ?? (selectedLesson?.pointsReward ?? 10);
        setEarnedPoints(points);
        setCompletionCelebrationType('quiz');
        setActiveOverlayState('lessonCompleted');
      } catch (error) {
        triggerWarningHaptic();
        Alert.alert('Unable to submit quiz', error instanceof Error ? error.message : 'Please try again.');
      }
    });
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
  }, []);

  const showLessonComplete = useCallback((type: 'quiz' | 'lesson' | 'claim') => {
    const points = selectedLesson?.pointsReward ?? 10;
    setEarnedPoints(points);
    setCompletionCelebrationType(type);
    setActiveOverlayState('lessonCompleted');
  }, [selectedLesson, setActiveOverlayState]);

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
            await hydrateApp(activeSession, true);
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
      hydrateApp,
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
            await hydrateApp(activeSession, true);
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
      hydrateApp,
      runMutationWithOfflineFallback,
      runWithActionLoader,
    ],
  );

  const handleJoinEvent = useCallback(
    async (eventId: string) => {
      await runWithActionLoader('Reserving your event slot...', async () => {
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
            await hydrateApp(activeSession, true);
            Alert.alert('You are in', 'Your event slot is reserved. Show up to earn your verified reward.');
          }
        } catch (error) {
          Alert.alert('Unable to join event', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setRefreshing(false);
        }
      });
    },
    [ensureSession, hydrateApp, runMutationWithOfflineFallback, runWithActionLoader],
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

          // Hydrate first (mirrors lesson flow) so dashboard.ecoPoints is
          // already the NEW value before the overlay shows. The overlay
          // display logic will subtract earnedPoints to show the PRE-reward
          // value on the LevelCard — then when the user taps Continue and
          // the particles land, ECO_POINTS_DROP_ANIMATION triggers hydrateApp
          // again and the LevelCard counts up to the new total.
          await hydrateApp(activeSession, true);

          setEarnedPoints(pointsAwarded);
          setEarnedCoins(coinsAwarded);
          setActiveOverlayState('eventApproved');
        } catch (error: any) {
          Alert.alert('Error', error.message || 'Failed to claim reward.');
        } finally {
          setRefreshing(false);
        }
      });
    },
    [events, ensureSession, runWithActionLoader, hydrateApp]
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
      setSendingMessage(true);

      try {
        // Build conversation history for the AI (last 10 messages, converted to {role, content})
        const currentMessages = [...assistantMessages, userMessage];
        const history = currentMessages.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.text,
        }));

        const reply = await homeService.sendAssistantMessage(activeSession.token, outgoingText, history);

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
        Alert.alert('Assistant unavailable', error instanceof Error ? error.message : 'Please try again.');
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
          const nextTracker = await homeService.getTracker(activeSession.token, targetMonth);
          setTracker(nextTracker);
        } catch (error) {
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
      setActiveTabState(tab);
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

  const analyzeChallengeImage = useCallback(async (challengeId: string, uri: string) => {
    try {
      const activeSession = ensureSession();
      const result = await homeService.analyzeChallengeImage(activeSession.token, challengeId, uri);
      return result;
    } catch (error) {
      throw error;
    }
  }, [ensureSession]);

  const uploadChallengeProofImage = useCallback(async (challengeId: string, uri: string) => {
    try {
      const activeSession = ensureSession();
      const result = await homeService.uploadChallengeProofImage(activeSession.token, challengeId, uri);
      return result;
    } catch (error) {
      throw error;
    }
  }, [ensureSession]);

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
                    detectedQuantity: 1,
                    reservedQuantity: 1,
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
        await hydrateApp(activeSession, true);
      } catch (error) {
        Alert.alert('Submission failed', error instanceof Error ? error.message : 'Please try again.');
        throw error;
      } finally {
        setRefreshing(false);
      }
    });
  }, [ensureSession, hydrateApp, runWithActionLoader]);

  const handleVerifyChallengeQr = useCallback(async (challengeId: string, qrData: string, latitude?: number, longitude?: number, submissionId?: string) => {
    await runWithActionLoader('Verifying Barangay QR code...', async () => {
      try {
        const activeSession = ensureSession();
        setRefreshing(true);
        await homeService.verifyChallengeQr(activeSession.token, challengeId, qrData, latitude, longitude, submissionId);
        await hydrateApp(activeSession, true);
      } catch (error) {
        Alert.alert('QR Verification failed', error instanceof Error ? error.message : 'Please try again.');
        throw error;
      } finally {
        setRefreshing(false);
      }
    });
  }, [ensureSession, hydrateApp, runWithActionLoader]);

  const handleSubmitChallengeAfterPhoto = useCallback(async (challengeId: string, afterProofUrl: string, submissionId?: string) => {
    await runWithActionLoader('Submitting after photo for final review...', async () => {
      try {
        const activeSession = ensureSession();
        setRefreshing(true);
        await homeService.submitChallengeAfterPhoto(activeSession.token, challengeId, afterProofUrl, submissionId);
        await hydrateApp(activeSession, true);
      } catch (error) {
        Alert.alert('After photo submission failed', error instanceof Error ? error.message : 'Please try again.');
        throw error;
      } finally {
        setRefreshing(false);
      }
    });
  }, [ensureSession, hydrateApp, runWithActionLoader]);

  const triggerTestReward = useCallback((origin?: { x: number; y: number }) => {
    setClaimRewardData({ points: 10, coins: 10, origin });
    setActiveOverlayState('claimParticles');
  }, []);

  const handleClaimChallengeReward = useCallback(async (challengeId: string, origin?: { x: number; y: number }, submissionId?: string) => {
    const challenge = challenges.find((c) => c.id === challengeId || (c as any).instanceId === challengeId);
    if (!challenge) {
      return;
    }

    setRefreshing(true);
    try {
      const activeSession = ensureSession();

      const totalExp = challenge.expReward;
      const totalCoins = challenge.ecoCoinReward;

      setEarnedPoints(totalExp);
      setEarnedCoins(totalCoins);

      if (origin) {
        setClaimRewardData({ points: totalExp, coins: totalCoins, origin });
      }
      
      setCompletionCelebrationType('claim');
      setActiveOverlayState('claimParticles');

      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challengeId || (c as any).instanceId === challengeId
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

      const res = await homeService.claimChallengeReward(activeSession.token, challengeId, submissionId);
      if (res?.awardedBadges && res.awardedBadges.length > 0) {
        setNewlyUnlockedBadges(res.awardedBadges);
        setPendingBadgeQueue((prev) => [...prev, ...res.awardedBadges!]);
      }

      await hydrateApp(activeSession, true);
    } catch (error) {
      Alert.alert('Claim failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [challenges, ensureSession, hydrateApp]);

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

        Alert.alert('Success', 'Profile updated successfully.');
      } catch (error) {
        Alert.alert('Update Failed', error instanceof Error ? error.message : 'Please try again.');
        throw error;
      }
    });
  }, [ensureSession, runWithActionLoader, persistSession]);

  const handleUpdateSecuritySettings = useCallback(async (payload: { currentPassword: string; newEmail?: string; newPassword?: string }) => {
    await runWithActionLoader('Updating security settings...', async () => {
      try {
        const activeSession = ensureSession();
        await homeService.updateSecuritySettings(activeSession.token, payload);
        if (payload.newEmail) {
          // Update local session
          const updatedSession = {
            ...activeSession,
            user: {
              ...activeSession.user,
              email: payload.newEmail,
            }
          };
          await persistSession(updatedSession);
          setSession(updatedSession);
        }
        Alert.alert('Success', 'Security settings updated successfully.');
      } catch (error) {
        Alert.alert('Update Failed', error instanceof Error ? error.message : 'Please try again.');
        throw error;
      }
    });
  }, [ensureSession, runWithActionLoader, persistSession]);

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
    events,
    transparency,
    todaysCompletedHabits,
    userDisplayName,
    hasUsableInternet: presence.hasUsableInternet,
    isUserOnline,
    notificationCount: Math.min(9, events.length),
    challengesViewMode,
    setChallengesViewMode,
    setActiveTab,
    setActiveOverlay,
    setLearnSearch,
    setLearnFilter,
    setLearnCategory,
    setAssistantInput,
    setAuthEmail,
    setAuthPassword,
    completeOnboarding,
    continueWithReadOnlyAccess,
    leaveReadOnlyAccess,
    handleLoginArgs,
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
    coachMarksCurrentStep,
    setCoachMarksCurrentStep,
    coachMarksVisible,
    completeCoachMarks,
    showCoachMarks,
    spotlightTargetRect,
    setSpotlightTargetRect,
    progressBarLayout,
    setProgressBarLayout,
    isChatbotEnabled,
    setChatbotEnabled,
  };

}
