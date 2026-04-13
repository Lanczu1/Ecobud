import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
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
  type LessonWithProgress,
  type ProfileData,
  type RewardsData,
  type SessionPayload,
  type TrackerData,
  type TransparencyFeed,
  type OverlayScreen,
} from '../types/home';
import {
  createReadOnlySession,
  isReadOnlyRestrictedOverlay,
  isReadOnlyRestrictedTab,
  isReadOnlySession,
  showReadOnlyAccessAlert,
} from '../ReadOnlyExperience';
import { usePresence } from '../../shared/presence/usePresence';
import { realtimeService } from '../../shared/supabase/realtimeService';



// ─── Constants ──────────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = 'ecobud.mobile.session';
const ONBOARDING_STORAGE_KEY = 'ecobud.mobile.onboarding';

// ─── Internal Utilities ─────────────────────────────────────────────────────────

function formatChatTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function shiftMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const shifted = new Date(year, monthIndex - 1 + offset, 1);
  const nextYear = shifted.getFullYear();
  const nextMonth = String(shifted.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useHomeDashboard(): EcoBudMobileModel {
  const [initializing, setInitializing] = useState(true);
  const [booting, setBooting] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [activeTab, setActiveTabState] = useState<AppTab>('home');
  const [activeOverlay, setActiveOverlayState] = useState<OverlayScreen>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [learnSearch, setLearnSearch] = useState('');
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [authEmail, setAuthEmail] = useState('lanczu@ecobud.app');
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

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [habitsToday, setHabitsToday] = useState<HabitTodayData | null>(null);
  const [tracker, setTracker] = useState<TrackerData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [events, setEvents] = useState<EcoEvent[]>([]);
  const [transparency, setTransparency] = useState<TransparencyFeed | null>(null);
  const isReadOnlyExperience = useMemo(() => isReadOnlySession(session), [session]);
  const presence = usePresence(session, isReadOnlyExperience);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  );

  const filteredLessons = useMemo(() => {
    const query = learnSearch.trim().toLowerCase();
    if (!query) {
      return lessons;
    }

    return lessons.filter((lesson) =>
      `${lesson.title} ${lesson.description} ${lesson.content}`.toLowerCase().includes(query),
    );
  }, [learnSearch, lessons]);

  const todaysCompletedHabits = useMemo(
    () => habitsToday?.items.filter((item) => item.completedToday).length ?? 0,
    [habitsToday],
  );

  const persistSession = useCallback(async (nextSession: SessionPayload | null) => {
    if (nextSession) {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      return;
    }

    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const clearAppData = useCallback(() => {
    setDashboard(null);
    setLessons([]);
    setChallenges([]);
    setHabitsToday(null);
    setTracker(null);
    setProfile(null);
    setRewards(null);
    setLeaderboard(null);
    setEvents([]);
    setTransparency(null);
    setAssistantMessages([]);
    setSelectedLessonId(null);
  }, []);

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
    async (existingSession: SessionPayload, silent = false) => {
      if (!silent) {
        setRefreshing(true);
      }

      try {
        if (isReadOnlySession(existingSession)) {
          const data = await homeService.getReadOnlyHydrationData();
          clearAppData();
          setEvents(data.events);
          setTransparency(data.transparency);
          return;
        }

        const data = await homeService.getFullHydrationData(existingSession.token);

        setDashboard(data.dashboard);
        setLessons(data.lessons);
        setChallenges(data.challenges);
        setHabitsToday(data.habitsToday);
        setTracker(data.tracker);
        setProfile(data.profile);
        setRewards(data.rewards);
        setLeaderboard(data.leaderboard);
        setEvents(data.events);
        setTransparency(data.transparency);
        setSelectedLessonId((current) => current ?? data.lessons[0]?.id ?? null);
        setAssistantMessages((current) =>
          current.length > 0
            ? current
            : [
              {
                id: 'assistant-welcome',
                role: 'assistant',
                text: `Hello ${existingSession.user.displayName.split(' ')[0]}! I can help with composting, eco points, local events, or finding the right challenge for today.`,
                time: formatChatTime(new Date().toISOString()),
              },
            ],
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to reach ECOBUD right now.';
        if (!silent) {
          Alert.alert('Sync failed', message);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [clearAppData],
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const savedSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession) as SessionPayload;
            setSession(parsed);
            await hydrateApp(parsed, true);
          } catch (e) {
            console.error('Failed to parse saved session', e);
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

  useEffect(() => () => {
    if (realtimeRefreshTimer.current) {
      clearTimeout(realtimeRefreshTimer.current);
    }
  }, []);

  const ensureSession = useCallback(() => {
    if (!session) {
      throw new Error('Your session expired. Please sign in again.');
    }

    if (isReadOnlySession(session)) {
      throw new Error('This public viewer can only access public pages. Sign in to continue.');
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

  const continueWithReadOnlyAccess = useCallback(async () => {
    await runWithActionLoader('Opening public viewer...', async () => {
      await presence.disconnectPresence({ clearSessionId: true });
      const readOnlySession = createReadOnlySession();
      setAuthError(null);
      setSession(readOnlySession);
      clearAppData();
      setActiveOverlayState(null);
      setActiveTabState('home');
      await persistSession(null);
      await hydrateApp(readOnlySession);
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

  const handleSignUpArgs = useCallback(async (username: string, email: string, pass: string, otpCode?: string) => {
    await runWithActionLoader('Creating your account...', async () => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const nextSession = await homeService.register(email.trim(), pass, username.trim(), otpCode?.trim() || '');
        setSession(nextSession);
        await persistSession(nextSession);
        await hydrateApp(nextSession);
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
      await presence.disconnectPresence({ clearSessionId: true });
      setSession(null);
      clearAppData();
      setActiveOverlayState(null);
      setActiveTabState('home');
      await persistSession(null);
    }, 700);
  }, [clearAppData, persistSession, presence, runWithActionLoader]);

  const refreshEverything = useCallback(async () => {
    if (!session) {
      return;
    }

    await runWithActionLoader(isReadOnlyExperience ? 'Refreshing public viewer...' : 'Refreshing your dashboard...', async () => {
      await hydrateApp(session);
    });
  }, [hydrateApp, isReadOnlyExperience, runWithActionLoader, session]);

  const queueRealtimeRefresh = useCallback(
    (reason: string) => {
      if (!session || isReadOnlySession(session)) {
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
    if (!session || isReadOnlySession(session) || !presence.shouldMaintainRealtimeConnection) {
      setRealtimeConnected(false);
      return;
    }

    let cleanup = () => undefined;
    let isMounted = true;

    void realtimeService
      .connect(session, {
        onConnectionChange: (connected) => {
          if (!isMounted) {
            return;
          }

          setRealtimeConnected(connected);
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

  const openLesson = useCallback(async (lessonId: string) => {
    await runWithActionLoader('Opening lesson...', async () => {
      try {
        const activeSession = ensureSession();
        await homeService.markLessonSeen(activeSession.token, lessonId);
        await hydrateApp(activeSession, true);
      } catch (error) {
        Alert.alert('Unable to open lesson', error instanceof Error ? error.message : 'Please try again.');
        return;
      }

      setSelectedLessonId(lessonId);
      setActiveOverlayState('lesson');
    }, 420);
  }, [ensureSession, hydrateApp, runWithActionLoader]);

  const handleCompleteLesson = useCallback(async () => {
    await runWithActionLoader('Verifying lesson completion...', async () => {
      try {
        const activeSession = ensureSession();
        if (!selectedLessonId) {
          return;
        }

        setRefreshing(true);
        await homeService.completeLesson(activeSession.token, selectedLessonId);
        await hydrateApp(activeSession, true);
        Alert.alert('Lesson completed', 'You earned new ECO points and your progress has been verified.');
      } catch (error) {
        Alert.alert('Unable to complete lesson', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setRefreshing(false);
      }
    });
  }, [ensureSession, hydrateApp, runWithActionLoader, selectedLessonId]);

  const handleChallengeProgress = useCallback(
    async (challenge: ChallengeWithProgress, nextProgress: number) => {
      await runWithActionLoader('Updating challenge progress...', async () => {
        try {
          const activeSession = ensureSession();
          setRefreshing(true);
          await homeService.updateChallengeProgress(activeSession.token, challenge.id, Math.min(100, nextProgress));
          await hydrateApp(activeSession, true);
        } catch (error) {
          Alert.alert('Challenge update failed', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setRefreshing(false);
        }
      });
    },
    [ensureSession, hydrateApp, runWithActionLoader],
  );

  const handleHabitCheckIn = useCallback(
    async (habitId: string) => {
      await runWithActionLoader('Logging today\'s eco habit...', async () => {
        try {
          const activeSession = ensureSession();
          setRefreshing(true);
          await homeService.checkInHabit(activeSession.token, habitId);
          await hydrateApp(activeSession, true);
        } catch (error) {
          Alert.alert('Check-in failed', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setRefreshing(false);
        }
      });
    },
    [ensureSession, hydrateApp, runWithActionLoader],
  );

  const handleJoinEvent = useCallback(
    async (eventId: string) => {
      await runWithActionLoader('Reserving your event slot...', async () => {
        try {
          const activeSession = ensureSession();
          setRefreshing(true);
          await homeService.joinEvent(activeSession.token, eventId);
          await hydrateApp(activeSession, true);
          Alert.alert('You are in', 'Your event slot is reserved. Show up to earn your verified reward.');
        } catch (error) {
          Alert.alert('Unable to join event', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setRefreshing(false);
        }
      });
    },
    [ensureSession, hydrateApp, runWithActionLoader],
  );

  const handleAssistantSend = useCallback(
    async (seedMessage?: string) => {
      const outgoingText = (seedMessage ?? assistantInput).trim();
      if (!outgoingText) {
        return;
      }

      await runWithActionLoader('EcoBud is thinking...', async () => {
        try {
          const activeSession = ensureSession();
          const userMessage: AssistantMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            text: outgoingText,
            time: formatChatTime(new Date().toISOString()),
          };

          setAssistantMessages((current) => [...current, userMessage]);
          setAssistantInput('');
          setSendingMessage(true);

          const reply = await homeService.sendAssistantMessage(activeSession.token, outgoingText);

          setAssistantMessages((current) => [
            ...current,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              text: reply.reply,
              time: formatChatTime(new Date().toISOString()),
            },
          ]);
        } catch (error) {
          Alert.alert('Assistant unavailable', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setSendingMessage(false);
        }
      });
    },
    [assistantInput, ensureSession, runWithActionLoader],
  );

  const loadTrackerMonth = useCallback(
    async (offset: number) => {
      await runWithActionLoader(offset < 0 ? 'Loading previous month...' : 'Loading next month...', async () => {
        try {
          const activeSession = ensureSession();
          const baseMonth = tracker?.month ?? new Date().toISOString().slice(0, 7);
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
    (tab: AppTab) => {
      if (isReadOnlyExperience && isReadOnlyRestrictedTab(tab)) {
        showReadOnlyAccessAlert();
        return;
      }

      const labels: Record<AppTab, string> = {
        home: 'Opening Home',
        learn: 'Opening Learn',
        challenges: 'Opening Challenges',
        tracker: 'Opening Tracker',
        profile: 'Opening Profile',
      };

      flashActionLoader(`${labels[tab]}...`, () => {
        setActiveTabState(tab);
      });
    },
    [flashActionLoader, isReadOnlyExperience],
  );

  const setActiveOverlay = useCallback(
    (screen: OverlayScreen) => {
      if (!screen) {
        setActiveOverlayState(null);
        return;
      }

      if (isReadOnlyExperience && isReadOnlyRestrictedOverlay(screen)) {
        showReadOnlyAccessAlert();
        return;
      }

      const labels: Record<Exclude<OverlayScreen, null>, string> = {
        assistant: 'Opening EcoBud Assistant',
        events: 'Opening Eco Events',
        lesson: 'Opening lesson details',
        leaderboard: 'Opening leaderboard',
        rewards: 'Opening rewards',
        transparency: 'Opening transparency feed',
      };

      flashActionLoader(`${labels[screen]}...`, () => {
        setActiveOverlayState(screen);
      });
    },
    [flashActionLoader, isReadOnlyExperience],
  );

  const userDisplayName =
    profile?.profile?.displayName ??
    session?.user.displayName ??
    'EcoBud Member';
  const isUserOnline = Boolean(
    session &&
    !isReadOnlyExperience &&
    presence.isPresenceOnline &&
    realtimeConnected,
  );

  return {
    initializing,
    booting,
    hasOnboarded,
    session,
    isReadOnlyExperience,
    actionOverlayVisible,
    actionOverlayLabel,
    activeTab,
    activeOverlay,
    selectedLesson,
    learnSearch,
    assistantInput,
    assistantMessages,
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
    habitsToday,
    tracker,
    profile,
    rewards,
    leaderboard,
    events,
    transparency,
    todaysCompletedHabits,
    userDisplayName,
    hasUsableInternet: presence.hasUsableInternet,
    isUserOnline,
    notificationCount: isReadOnlyExperience ? 0 : Math.min(9, events.length),
    setActiveTab,
    setActiveOverlay,
    setLearnSearch,
    setAssistantInput,
    setAuthEmail,
    setAuthPassword,
    completeOnboarding,
    continueWithReadOnlyAccess,
    leaveReadOnlyAccess,
    handleLoginArgs,
    handleSignUpArgs,
    handleSendOTP,
    handleCheckUsernameAvailability,
    handleLogout,
    refreshEverything,
    openLesson,
    handleCompleteLesson,
    handleChallengeProgress,
    handleHabitCheckIn,
    handleJoinEvent,
    handleAssistantSend,
    loadTrackerMonth,
  };
}
