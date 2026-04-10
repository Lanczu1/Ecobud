import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ecobudApi,
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
} from '../shared/api/ecobudApi';
import { ecoTheme } from '../shared/theme/ecoTheme';
import { AuthView } from '../features/auth/AuthView';

type AppTab = 'home' | 'learn' | 'challenges' | 'tracker' | 'profile';
type OverlayScreen = 'assistant' | 'events' | 'lesson' | 'leaderboard' | 'rewards' | 'transparency' | null;
type AuthMode = 'member' | 'admin';

interface HabitTodayData {
  dateKey: string;
  items: {
    id: string;
    slug: string;
    title: string;
    pointsReward: number;
    completedToday: boolean;
  }[];
  pointsEarnedToday: number;
}

interface AssistantMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  time: string;
}



const SESSION_STORAGE_KEY = 'ecobud.mobile.session';
const ONBOARDING_STORAGE_KEY = 'ecobud.mobile.onboarding';


export default function App() {
  const model = useEcoBudMobileApp();

  return (
    <SafeAreaProvider>
      <MobileShell model={model} />
    </SafeAreaProvider>
  );
}

interface EcoBudMobileModel {
  initializing: boolean;
  booting: boolean;
  hasOnboarded: boolean;
  session: SessionPayload | null;
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
  notificationCount: number;
  setActiveTab: (tab: AppTab) => void;
  setActiveOverlay: (screen: OverlayScreen) => void;
  setLearnSearch: (value: string) => void;
  setAssistantInput: (value: string) => void;
  setAuthEmail: (value: string) => void;
  setAuthPassword: (value: string) => void;
  completeOnboarding: () => Promise<void>;
  handleLoginArgs: (email: string, pass: string) => Promise<void>;
  handleSignUpArgs: (username: string, email: string, pass: string, otpCode?: string) => Promise<void>;
  handleSendOTP: (email: string) => Promise<{ success: boolean; message: string }>;
  handleLogout: () => Promise<void>;
  refreshEverything: () => Promise<void>;
  openLesson: (lessonId: string) => void;
  handleCompleteLesson: () => Promise<void>;
  handleChallengeProgress: (challenge: ChallengeWithProgress, nextProgress: number) => Promise<void>;
  handleHabitCheckIn: (habitId: string) => Promise<void>;
  handleJoinEvent: (eventId: string) => Promise<void>;
  handleAssistantSend: (seedMessage?: string) => Promise<void>;
  loadTrackerMonth: (offset: number) => Promise<void>;
}

function useEcoBudMobileApp(): EcoBudMobileModel {
  const [initializing, setInitializing] = useState(true);
  const [booting, setBooting] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [session, setSession] = useState<SessionPayload | null>(null);
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
      `${lesson.title} ${lesson.summary} ${lesson.category}`.toLowerCase().includes(query),
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
        const [
          dashboardData,
          lessonData,
          challengeData,
          habitsData,
          trackerData,
          profileData,
          rewardsData,
          leaderboardData,
          eventData,
          transparencyData,
        ] = await Promise.all([
          ecobudApi.fetchDashboard(existingSession.token),
          ecobudApi.fetchLessons(existingSession.token),
          ecobudApi.fetchChallenges(existingSession.token),
          ecobudApi.fetchHabitsToday(existingSession.token),
          ecobudApi.fetchTracker(existingSession.token),
          ecobudApi.fetchProfile(existingSession.token),
          ecobudApi.fetchRewards(existingSession.token),
          ecobudApi.fetchLeaderboard(existingSession.token),
          ecobudApi.fetchEvents(),
          ecobudApi.fetchTransparency(existingSession.token),
        ]);

        setDashboard(dashboardData);
        setLessons(lessonData.items);
        setChallenges(challengeData.items);
        setHabitsToday(habitsData);
        setTracker(trackerData);
        setProfile(profileData);
        setRewards(rewardsData);
        setLeaderboard(leaderboardData);
        setEvents(eventData.items);
        setTransparency(transparencyData);
        setSelectedLessonId((current) => current ?? lessonData.items[0]?.id ?? null);
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
    [],
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

  const handleLoginArgs = useCallback(async (email: string, pass: string) => {
    await runWithActionLoader('Signing you into EcoBud...', async () => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const nextSession = await ecobudApi.login(email.trim(), pass);
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
        const nextSession = await ecobudApi.register(email.trim(), pass, username.trim(), otpCode?.trim() || '');
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
      return await ecobudApi.sendOTP(email.trim());
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to send OTP.');
      throw error;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await runWithActionLoader('Signing you out...', async () => {
      setSession(null);
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
      setActiveOverlayState(null);
      setSelectedLessonId(null);
      setActiveTabState('home');
      await persistSession(null);
    }, 700);
  }, [persistSession, runWithActionLoader]);

  const refreshEverything = useCallback(async () => {
    if (!session) {
      return;
    }

    await runWithActionLoader('Refreshing your dashboard...', async () => {
      await hydrateApp(session);
    });
  }, [hydrateApp, runWithActionLoader, session]);

  const openLesson = useCallback((lessonId: string) => {
    flashActionLoader('Opening lesson...', () => {
      setSelectedLessonId(lessonId);
      setActiveOverlayState('lesson');
    });
  }, [flashActionLoader]);

  const handleCompleteLesson = useCallback(async () => {
    await runWithActionLoader('Verifying lesson completion...', async () => {
      try {
        const activeSession = ensureSession();
        if (!selectedLessonId) {
          return;
        }

        setRefreshing(true);
        await ecobudApi.completeLesson(activeSession.token, selectedLessonId);
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
          await ecobudApi.updateChallengeProgress(activeSession.token, challenge.id, Math.min(100, nextProgress));
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
          await ecobudApi.checkInHabit(activeSession.token, habitId);
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
          await ecobudApi.joinEvent(activeSession.token, eventId);
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

          const reply = await ecobudApi.sendAssistantMessage(activeSession.token, outgoingText);

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
          const nextTracker = await ecobudApi.fetchTracker(activeSession.token, targetMonth);
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
    [flashActionLoader],
  );

  const setActiveOverlay = useCallback(
    (screen: OverlayScreen) => {
      if (!screen) {
        setActiveOverlayState(null);
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
    [flashActionLoader],
  );

  const userDisplayName =
    profile?.profile?.displayName ??
    dashboard?.user.displayName ??
    session?.user.displayName ??
    'EcoBud Member';

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
    notificationCount: dashboard?.notificationsCount ?? 3,
    setActiveTab,
    setActiveOverlay,
    setLearnSearch,
    setAssistantInput,
    setAuthEmail,
    setAuthPassword,
    completeOnboarding,
    handleLoginArgs,
    handleSignUpArgs,
    handleSendOTP,
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

function ChatbotFAB({ onPress }: { onPress: () => void }) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.95);
  const floatAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  return (
    <Animated.View style={[styles.chatbotFabOuter, { transform: [{ translateY: floatAnim }, { scale }] }]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.chatbotFab}>
        <Image
          source={require('../../assets/chatbutton.png')}
          style={styles.chatbotFabImg}
        />
      </Pressable>
    </Animated.View>
  );
}

function MobileShell({ model }: { model: EcoBudMobileModel }) {
  let content: React.ReactNode;

  if (model.booting) {
    content = <BootView />;
  } else if (model.initializing) {
    content = <LaunchBackdrop />;

  } else if (!model.hasOnboarded) {
    content = <OnboardingView onComplete={model.completeOnboarding} />;
  } else if (!model.session) {
    content = (
      <AuthView
        authLoading={model.authLoading}
        authError={model.authError}
        onLogin={(email, pass) => void model.handleLoginArgs(email, pass)}
        onGoogleSignIn={() => console.log('Google Sign In')}
        onSignUp={(username, email, pass, otpCode) => void model.handleSignUpArgs(username, email, pass, otpCode)}
        onSendOTP={(email) => model.handleSendOTP(email)}
      />
    );
  } else if (model.activeOverlay) {
    content = <OverlayRouter model={model} />;
  } else {
    content = (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={model.refreshing}
              onRefresh={() => void model.refreshEverything()}
              tintColor={ecoTheme.colors.primaryDark}
            />
          }
          contentContainerStyle={styles.mainScrollContent}
        >
          {model.activeTab === 'home' && <HomeView model={model} />}
          {model.activeTab === 'learn' && <LearnView model={model} />}
          {model.activeTab === 'challenges' && <ChallengesView model={model} />}
          {model.activeTab === 'tracker' && <TrackerView model={model} />}
          {model.activeTab === 'profile' && <ProfileView model={model} />}
        </ScrollView>
        <ChatbotFAB onPress={() => model.setActiveOverlay('assistant')} />
        <BottomTabBar activeTab={model.activeTab} onChange={model.setActiveTab} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.actionHost}>
      {content}
      <ActionOverlayWrapper visible={model.actionOverlayVisible} label={model.actionOverlayLabel} />
    </View>
  );
}

function BootView() {
  const fadeIn = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(0.96)).current;
  const orbit = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 820,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.97,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 4800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [fadeIn, orbit, pulse]);

  const orbitRotate = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={['#081F1B', '#0E5D52', '#18A176']} style={styles.centeredScreen}>
        <View style={styles.bootBackdropOrb} />
        <View style={styles.bootBackdropOrbSecondary} />
        <View style={styles.bootCenterpiece}>
          <Animated.View style={[styles.bootOrbitalRing, { transform: [{ rotate: orbitRotate }] }]}>
            <View style={styles.bootOrbitalDot} />
          </Animated.View>
          <Animated.View style={[styles.bootLogoModern, { opacity: fadeIn, transform: [{ scale: pulse }] }]}>
            <EcoLogo light emphasis="hero" />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.bootTitleModern, { opacity: fadeIn }]}>Growing your EcoBud journey</Animated.Text>
        <Animated.Text style={[styles.bootSubtitleModern, { opacity: fadeIn }]}>
          Loading lessons, rewards, streaks, and your next green move.
        </Animated.Text>
        <Animated.View style={[styles.bootLoaderChip, { opacity: fadeIn }]}>
          <ActivityIndicator size="small" color="#C9FFE8" />
          <Text style={styles.bootLoaderText}>Preparing your experience</Text>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function LaunchBackdrop() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={['#071C19', '#0C5E54', '#17A07E']} style={styles.landingScreen}>
        <View style={styles.landingBackdropOrbPrimary} />
        <View style={styles.landingBackdropOrbSecondary} />
        <View style={styles.launchBackdropCenter}>
          <View style={styles.launchBackdropCore}>
            <EcoLogo light emphasis="hero" />
          </View>
          <Text style={styles.launchBackdropCopy}>Preparing your EcoBud welcome...</Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function EcobudActionOverlay({ label }: { label: string }) {
  const pulse = React.useRef(new Animated.Value(0.96)).current;
  const orbit = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.02,
          duration: 760,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.98,
          duration: 760,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [orbit, pulse]);

  const orbitRotate = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.actionOverlay}>
      <Animated.View style={[styles.actionOverlayCard, { transform: [{ scale: pulse }] }]}>
        <View style={styles.actionOverlayLogoWrap}>
          <View style={styles.actionOverlaySpinnerShell}>
            <Animated.View style={[styles.actionOverlaySpinnerRing, { transform: [{ rotate: orbitRotate }] }]}>
              <View style={styles.actionOverlaySpinnerDot} />
            </Animated.View>
            <View style={styles.actionOverlayLogoCore}>
              <EcoLogo light emphasis="hero" />
            </View>
          </View>
        </View>
        <Text style={styles.actionOverlayTitle}>{label}</Text>
        <Text style={styles.actionOverlayCopy}>Ecobud is getting things ready for you.</Text>
      </Animated.View>
    </View>
  );
}

function ActionOverlayWrapper({ visible, label }: { visible: boolean; label: string }) {
  const [renderVisible, setRenderVisible] = useState(visible);
  const opacity = React.useRef(new Animated.Value(visible ? 1 : 0)).current;

  React.useEffect(() => {
    if (visible) {
      setRenderVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setRenderVisible(false);
        }
      });
    }
  }, [visible, opacity]);

  if (!renderVisible) return null;

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, elevation: 9999 }, { opacity }]}>
      <EcobudActionOverlay label={label} />
    </Animated.View>
  );
}







function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const isLandscape = width > height;
  const isCompact = height < 740;
  const { scale, onPressIn, onPressOut } = usePressScale();

  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const screenFadeAnim = React.useRef(new Animated.Value(0)).current;
  const floatAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -15,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [screenFadeAnim, floatAnim]);

  const steps = [
    {
      title: 'Learn, Act, and\nEarn rewards',
      subtitle: 'Discover sustainable habits, join\nchallenges, and track your impact\nwith ECOBUD.',
      image: require('../../assets/onboarding_hero.png'),
      buttonText: 'Start Your Eco Journey',
    },
    {
      title: 'Verified Actions',
      subtitle: 'Every positive move matters.\nLog your activities and see real-time\ndata on how you are saving the planet.',
      image: require('../../assets/forest.png'),
      buttonText: 'Continue',
    },
    {
      title: 'Lead the Way',
      subtitle: 'Join a global community of eco-warriors.\nLead by example and earn rewards\nfor your contributions.',
      image: require('../../assets/floating_island.png'),
      buttonText: 'Get Started',
    },
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setStep(step + 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        onComplete();
      });
    }
  };

  const currentStepData = steps[step];

  return (
    <Animated.View style={[styles.newOnboardingContainer, { opacity: screenFadeAnim }]}>
      <StatusBar style="dark" />
      <SafeAreaView style={[styles.newOnboardingSafeArea, isLandscape && { flexDirection: 'row', alignItems: 'center' }]}>
        {!isLandscape && (
          <View style={styles.newOnboardingHeader}>
            <Image
              source={require('../../assets/newlogo.png')}
              style={styles.newOnboardingLogo}
              resizeMode="contain"
            />
          </View>
        )}

        <Animated.View style={[styles.newOnboardingHeroContent, isLandscape && { flex: 0.5, marginTop: 0 }, { opacity: fadeAnim, transform: [{ translateY: floatAnim }] }]}>
          <View style={styles.heroCircleWrapper}>
            <Image
              source={currentStepData.image}
              style={[
                styles.newOnboardingHeroImage,
                isCompact && !isLandscape && { height: '110%' },
              ]}
              resizeMode="cover"
            />
          </View>
        </Animated.View>

        <View style={[isLandscape ? { flex: 0.5, paddingRight: 30 } : { flex: 1 }]}>
          {!isLandscape && <View style={{ height: 20 }} />}

          <Animated.View style={[styles.newOnboardingTextContainer, isLandscape && { marginBottom: 20, paddingHorizontal: 0, alignItems: 'flex-start' }, { opacity: fadeAnim }]}>
            <Text style={[
              styles.newOnboardingTitle,
              isCompact && { fontSize: 28, lineHeight: 32 },
              isLandscape && { textAlign: 'left' }
            ]}>
              {currentStepData.title}
            </Text>
            <Text style={[
              styles.newOnboardingSubtitle,
              isLandscape && { textAlign: 'left', paddingHorizontal: 0 }
            ]}>
              {currentStepData.subtitle}
            </Text>
          </Animated.View>

          <View style={[styles.newOnboardingBottom, isLandscape && { paddingHorizontal: 0, paddingBottom: 0 }, step === 0 && { marginTop: 20 }]}>
            <Animated.View style={[{ transform: [{ scale }] }]}>
              <Pressable
                onPress={nextStep}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                style={styles.primaryButton}
              >
                <LinearGradient
                  colors={['#0B5F58', '#169070', '#69CDA8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButtonGradient}
                >
                  <View style={styles.primaryButtonGlow} />
                  <Animated.Text style={[styles.primaryButtonText, { opacity: fadeAnim }]}>
                    {currentStepData.buttonText}
                  </Animated.Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <View style={[styles.newOnboardingPagination, isLandscape && { alignSelf: 'flex-start' }]}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.newOnboardingDot,
                    i === step && styles.newOnboardingDotActive
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );


}

function TopNavbar({ model, title, showBack }: { model: EcoBudMobileModel; title?: string; showBack?: boolean }) {
  return (
    <View style={styles.topNavbar}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {showBack ? (
          <TouchableOpacity onPress={() => model.setActiveOverlay(null)} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color="#1A211D" />
          </TouchableOpacity>
        ) : (
          <Image source={{ uri: model.session?.user.avatarUrl ?? 'https://i.pravatar.cc/150?u=' + (model.session?.user.id || '1') }} style={styles.topNavAvatar} />
        )}
      </View>
      <Text style={[styles.topNavTitle, title ? styles.topNavTitleDark : {}]}>{title || 'ECOBUD'}</Text>
      <TouchableOpacity>
        <Ionicons name="notifications" size={24} color="#126027" />
        {model.notificationCount > 0 && <View style={styles.topNavBadge} />}
      </TouchableOpacity>
    </View>
  );
}

function HomeView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
        <Text style={styles.welcomeTitle}>Hello, {model.userDisplayName.split(' ')[0]}!</Text>
        <Text style={styles.welcomeSubtitle}>You've saved 4.2kg of CO2 today.</Text>

        <View style={styles.homeMetricRow}>
          <View style={styles.homeMetricCard}>
            <View style={styles.homeMetricIconWrapBadge}>
               <MaterialCommunityIcons name="fire" size={20} color="#126027" />
            </View>
            <Text style={styles.homeMetricValue}>{model.dashboard?.user.currentStreak ?? model.session?.user.currentStreak ?? 0}</Text>
            <Text style={styles.homeMetricLabel}>DAY STREAK</Text>
          </View>
          <View style={styles.homeMetricCard}>
            <View style={[styles.homeMetricIconWrapBadge, { backgroundColor: '#F0F5F2' }]}>
               <Ionicons name="leaf" size={18} color="#126027" />
            </View>
            <Text style={styles.homeMetricValue}>{model.dashboard?.user.points ?? model.session?.user.points ?? 0}</Text>
            <Text style={styles.homeMetricLabel}>ECO POINTS</Text>
          </View>
        </View>

        <View style={styles.weeklyGoalCard}>
          <Text style={styles.weeklyGoalLabel}>WEEKLY GOAL</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.weeklyGoalTitle}>85% Complete</Text>
            <Text style={styles.weeklyGoalText}>15kg / 20kg</Text>
          </View>
          <ProgressBar progress={85} />
        </View>

        {model.dashboard?.dailyChallenge ? (
          <View style={styles.todayChallengeCard}>
            <View style={styles.challengeBadge}>
              <Text style={styles.challengeBadgeText}>TODAY'S CHALLENGE</Text>
            </View>
            <Text style={styles.todayChallengeTitle}>{model.dashboard.dailyChallenge.title}</Text>
            <Text style={styles.todayChallengeDesc}>{model.dashboard.dailyChallenge.description}</Text>
            <TouchableOpacity style={styles.challengeCompleteBtn} onPress={() => void model.handleChallengeProgress(model.dashboard!.dailyChallenge!, 100)}>
              <Ionicons name="checkmark-circle" size={18} color="#126027" />
              <Text style={styles.challengeCompleteBtnText}>Mark as Complete</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.dailyTipCard}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <MaterialCommunityIcons name="lightbulb-on" size={12} color="#126027" />
              <Text style={[styles.welcomeLabel, { marginLeft: 4 }]}>DAILY TIP</Text>
            </View>
            <Text style={styles.tipTitle}>Cold Wash Advantage</Text>
            <Text style={styles.tipDesc}>Washing clothes at 30°C instead of 40°C can save up to 40% of energy usage over a year.</Text>
          </View>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1582735689369-dbcf0e2c8a7b?q=80&w=400&auto=format&fit=crop' }} style={styles.tipImage} />
        </View>

        <View style={styles.articleCard}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop' }} style={styles.articleImage} />
          <View style={styles.articleContent}>
            <View style={styles.rowBetween}>
              <Text style={styles.articleTitle}>Understanding Carbon Sequestration</Text>
              <Feather name="arrow-right" size={20} color="#126027" />
            </View>
            <Text style={styles.articleDesc}>Learn how our local forests are the unsung heroes of climate stability and how you can...</Text>
          </View>
        </View>
        <View style={{height: 100}} />
      </View>
    </>
  );
}

function LearnView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        
        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=800&auto=format&fit=crop' }} style={styles.featuredProgramCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.featuredProgramOverlay} />
          <View style={styles.featuredProgramContent}>
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <View style={styles.tagLight}><Text style={styles.tagLightText}>FEATURED COURSE</Text></View>
            </View>
            <Text style={styles.featuredProgramTitle}>Mastering Zero Waste: A Complete Guide</Text>
            <Text style={styles.featuredProgramDesc}>Learn the essential strategies to reduce your footprint and live a circular life through professional-led video lessons.</Text>
            
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
               <TouchableOpacity style={styles.featuredProgramBtn}>
                 <Ionicons name="play-circle" size={18} color="#FFF" style={{marginRight: 6}} />
                 <Text style={styles.featuredProgramBtnText}>Start Lesson</Text>
               </TouchableOpacity>

               <View style={{ flexDirection: 'row', gap: -8 }}>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=1'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=2'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=3'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={[styles.nftAvatar, {backgroundColor: '#1E4C31'}]}><Text style={{color: '#FFF', fontSize: 10, fontWeight: 'bold'}}>+12k</Text></View>
               </View>
            </View>
          </View>
        </ImageBackground>

        <View style={{marginTop: 24}}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Your Learning Path</Text>
            <Text style={styles.taskMetaValueDark}>65% Complete</Text>
          </View>
          <ProgressBar progress={65} />
          <Text style={styles.metaTextSmall}>Next: Micro-plastic Awareness (15 min)</Text>
        </View>

        <View style={styles.knowledgePointsCard}>
           <View style={styles.knowledgeIconWrap}>
              <MaterialCommunityIcons name="star-four-points" size={24} color="#FFF" />
           </View>
           <View>
              <Text style={styles.knowledgePointsLabel}>KNOWLEDGE POINTS</Text>
              <Text style={styles.knowledgePointsValue}>2,450</Text>
           </View>
        </View>

        <View style={[styles.rowBetween, { marginTop: 24 }]}>
          <View>
            <Text style={styles.sectionHeadline}>Browse Categories</Text>
            <Text style={styles.pageSubtitle}>Structured knowledge for a greener future</Text>
          </View>
          <TouchableOpacity><Text style={styles.taskMetaValueDark}>View All →</Text></TouchableOpacity>
        </View>
        
        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=800&auto=format&fit=crop' }} style={styles.categoryLargeCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.categoryLargeOverlay} />
          <View style={styles.featuredProgramContent}>
            <Text style={styles.categoryLargeTitle}>Waste Management Basics</Text>
            <Text style={styles.categoryLargeDesc}>Master sorting, recycling, and composting like a pro.</Text>
            <View style={{flexDirection: 'row', gap: 16}}>
               <View style={styles.rowMeta}><Ionicons name="document-text" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> 12 Lessons</Text></View>
               <View style={styles.rowMeta}><Ionicons name="time" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> 4.5 Hours</Text></View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.categoryMediumCard}>
           <View style={styles.badgeCircleLightGreen}><Ionicons name="leaf" size={18} color="#FFF" /></View>
           <Text style={styles.categoryMediumTitle}>Sustainable Living 101</Text>
           <Text style={styles.categoryMediumDesc}>Fundamental habits for an eco-conscious lifestyle.</Text>
           <TouchableOpacity style={styles.categoryOutlineBtn}><Text style={styles.categoryOutlineBtnText}>Start Learning</Text></TouchableOpacity>
        </View>

        <View style={styles.categorySmallCard}>
           <Ionicons name="water" size={18} color="#126027" />
           <Text style={styles.cardTitle}>Water Conservation</Text>
           <Text style={styles.metaTextSmallDark}>Reducing domestic water usage and footprint.</Text>
        </View>

        <View style={styles.categorySmallCard}>
           <Ionicons name="flash" size={18} color="#126027" />
           <Text style={styles.cardTitle}>Renewable Energy</Text>
           <Text style={styles.metaTextSmallDark}>Understanding solar, wind, and smart grids.</Text>
        </View>

        <View style={styles.categorySmallCard}>
           <Ionicons name="basket" size={18} color="#126027" />
           <Text style={styles.cardTitle}>Ethical Consumerism</Text>
           <Text style={styles.metaTextSmallDark}>How to shop with impact and transparency.</Text>
        </View>

        <Text style={[styles.sectionHeadline, { marginTop: 24, marginBottom: 16 }]}>Active Courses</Text>
        
        <View style={styles.activeCourseRow}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=200&auto=format&fit=crop' }} style={styles.courseThumb} />
          <View style={{flex: 1}}>
             <Text style={styles.cardTitle}>Circular Economy Principles</Text>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
               <View style={{flex: 1}}><ProgressBar progress={30} /></View>
               <Text style={styles.coursePercentText}>30% SEEN</Text>
             </View>
          </View>
          <Ionicons name="play-circle" size={32} color="#126027" />
        </View>

        <View style={styles.activeCourseRow}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1585320806055-e7bb0fff6ca2?q=80&w=200&auto=format&fit=crop' }} style={styles.courseThumb} />
          <View style={{flex: 1}}>
             <Text style={styles.cardTitle}>Urban Gardening & Composting</Text>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
               <View style={{flex: 1}}><ProgressBar progress={80} /></View>
               <Text style={styles.coursePercentText}>80% SEEN</Text>
             </View>
          </View>
          <Ionicons name="play-circle" size={32} color="#126027" />
        </View>

        <View style={{height: 100}} />
      </View>
    </>
  );
}

function ChallengesView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.pageTitle}>Challenges</Text>
        <Text style={styles.pageSubtitle}>Turn your eco-intentions into daily impact.</Text>

        <View style={[styles.rowBetween, { marginTop: 24, marginBottom: 16 }]}>
          <Text style={styles.welcomeLabel}>TODAY'S HABITS</Text>
        </View>
        <Text style={[styles.sectionHeadline, { marginTop: 0 }]}>Consistency is Key</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24, gap: 16, paddingBottom: 16 }}>
          {model.habitsToday?.items.map((habit) => (
            <View key={habit.id} style={styles.habitSquareCard}>
              <View style={styles.habitIconWrap}>
                 <Ionicons name="leaf" size={18} color="#126027" />
              </View>
              <Text style={styles.habitTopText}>{habit.title}</Text>
              <Text style={styles.habitMetaText}>Daily • {habit.pointsReward} XP</Text>
              <TouchableOpacity
                disabled={habit.completedToday}
                onPress={() => void model.handleHabitCheckIn(habit.id)}
                style={[styles.habitSquareBtn, habit.completedToday && { backgroundColor: 'transparent' }]}
              >
                {habit.completedToday ? (
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View style={styles.activeDot} />
                    <Text style={styles.habitActiveText}>ACTIVE</Text>
                  </View>
                ) : (
                  <Text style={styles.habitSquareBtnText}>LOG TASK</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <Text style={[styles.welcomeLabel, { marginTop: 24, marginBottom: 8 }]}>ACTIVE CHALLENGES</Text>
        <Text style={styles.sectionHeadline}>Featured Programs</Text>

        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop' }} style={styles.featuredProgramCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.featuredProgramOverlay} />
          <View style={styles.featuredProgramContent}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={styles.tagDark}><Text style={styles.tagDarkText}>HARD</Text></View>
              <View style={styles.tagLight}><Text style={styles.tagLightText}>1,200 XP</Text></View>
            </View>
            <Text style={styles.featuredProgramTitle}>The Forest Legacy Project</Text>
            <Text style={styles.featuredProgramDesc}>Commit to 30 days of plastic-free living and tree planting advocacy.</Text>
            
            <View style={styles.featuredGlassBar}>
               <View style={styles.rowBetween}>
                 <Text style={styles.progressLabelLight}>OVERALL PROGRESS</Text>
                 <Text style={styles.progressLabelLight}>65%</Text>
               </View>
               <View style={styles.progressTrackLight}>
                 <View style={[styles.progressFillLight, { width: '65%' }]} />
               </View>
            </View>
            <TouchableOpacity style={styles.featuredProgramBtn}>
              <Text style={styles.featuredProgramBtnText}>CONTINUE JOURNEY</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <View style={styles.taskCard}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1585320806055-e7bb0fff6ca2?q=80&w=200&auto=format&fit=crop' }} style={styles.taskCardImg} />
          <View style={styles.taskCardBody}>
            <View style={styles.rowBetween}>
               <Text style={styles.taskMetaLabel}>INTERMEDIATE</Text>
               <Text style={styles.taskMetaValue}>4/10 DAYS</Text>
            </View>
            <Text style={styles.taskCardTitle}>Urban Micro-Garden</Text>
            <ProgressBar progress={40} />
            <TouchableOpacity style={styles.taskActionBtn}><Text style={styles.taskActionBtnText}>START TASK</Text></TouchableOpacity>
          </View>
        </View>
        <View style={styles.taskCard}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=200&auto=format&fit=crop' }} style={styles.taskCardImg} />
          <View style={styles.taskCardBody}>
            <View style={styles.rowBetween}>
               <Text style={styles.taskMetaLabel}>BEGINNER</Text>
               <Text style={styles.taskMetaValue}>0/7 DAYS</Text>
            </View>
            <Text style={styles.taskCardTitle}>Pure Water Guardian</Text>
            <ProgressBar progress={0} />
            <TouchableOpacity style={styles.taskActionBtn}><Text style={styles.taskActionBtnText}>START TASK</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.nftPromoCard}>
          <Text style={styles.welcomeLabelLight}>UNLOCKED SOON</Text>
          <Text style={styles.nftPromoTitle}>Rare Digital Seed</Text>
          <Text style={styles.nftPromoDesc}>Complete 2 more challenges this week to earn the exclusive 'Ancient Oak' NFT badge.</Text>
          <View style={{ flexDirection: 'row', gap: -8, marginTop: 12 }}>
            <View style={styles.nftAvatar}><Ionicons name="trophy" size={14} color="#FFF" /></View>
            <View style={[styles.nftAvatar, {backgroundColor: '#7D9984'}]}><Ionicons name="star" size={14} color="#FFF" /></View>
            <View style={[styles.nftAvatar, {backgroundColor: '#5C7A63'}]}><Text style={{color: '#FFF', fontSize: 10, fontWeight: 'bold'}}>+3</Text></View>
          </View>
        </View>

        <View style={{height: 100}} />
      </View>
    </>
  );
}

function TrackerView({ model }: { model: EcoBudMobileModel }) {
  const trackerMonth = model.tracker?.month ?? new Date().toISOString().slice(0, 7);
  const calendarCells = buildCalendarCells(trackerMonth, model.tracker?.completedDays ?? []);

  return (
    <>
      <TopNavbar model={model} showBack={true} title="Habits Tracker" />

      <ScrollView contentContainerStyle={styles.homeContent}>
        <SurfaceCard style={[styles.trackerHeroCard, {backgroundColor: '#126027', borderRadius: 24, padding: 24}]}>
          <View style={styles.trackerHeroLeft}>
            <Text style={[styles.trackerHeroTitle, {color: '#FFF', fontSize: 20, fontWeight: '800'}]}>You are on fire!</Text>
            <Text style={[styles.trackerHeroStreak, {color: '#4ADE80', fontSize: 28, fontWeight: '900', marginTop: 8}]}>{model.tracker?.currentStreak ?? 0} day streak</Text>
            <Text style={[styles.metaTextWhite, {marginTop: 8}]}>Weekly Eco Goal: {model.todaysCompletedHabits}/7 days</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard style={[styles.calendarCard, {marginTop: 16, backgroundColor: '#FFF', borderRadius: 24, padding: 20}]}>
          <View style={styles.rowBetween}>
            <TouchableOpacity onPress={() => void model.loadTrackerMonth(-1)}>
              <Feather name="chevron-left" size={24} color="#6B7A75" />
            </TouchableOpacity>
            <Text style={[styles.calendarMonth, {fontSize: 16, fontWeight: '800', color: '#1A211D'}]}>{formatMonthLabel(trackerMonth)}</Text>
            <TouchableOpacity onPress={() => void model.loadTrackerMonth(1)}>
              <Feather name="chevron-right" size={24} color="#6B7A75" />
            </TouchableOpacity>
          </View>

          <View style={[styles.calendarWeekRow, {flexDirection: 'row', justifyContent: 'space-between', marginTop: 16}]}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={[styles.calendarWeekLabel, {width: 40, textAlign: 'center', color: '#6B7A75', fontSize: 12, fontWeight: '700'}]}>
                {day}
              </Text>
            ))}
          </View>

          <View style={[styles.calendarGrid, {flexDirection: 'row', flexWrap: 'wrap', marginTop: 8}]}>
            {calendarCells.map((cell, index) => (
              <View key={`${cell.dateKey ?? 'empty'}-${index}`} style={[styles.calendarCell, {width: '14.28%', padding: 4, alignItems: 'center'}]}>
                {cell.dateKey ? (
                  <View style={[
                    {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
                    cell.completed && {backgroundColor: '#4ADE80'},
                    cell.isToday && !cell.completed && {borderWidth: 2, borderColor: '#126027'}
                  ]}>
                    <Text style={[
                      {color: '#1A211D', fontSize: 12, fontWeight: '600'},
                      cell.completed && {color: '#126027', fontWeight: '800'},
                      cell.isToday && {fontWeight: '800'}
                    ]}>{cell.day}</Text>
                  </View>
                ) : (
                  <View style={{width: 36, height: 36}} />
                )}
              </View>
            ))}
          </View>
        </SurfaceCard>

        <Text style={[styles.sectionHeadline, {marginTop: 24, marginBottom: 12}]}>Daily Check-in</Text>
        {model.tracker?.todayHabits.map((habit) => (
          <SurfaceCard key={habit.id} style={[styles.checkInCard, {flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center'}]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, {fontSize: 16, fontWeight: '700', color: '#1A211D'}]}>{habit.title}</Text>
              <Text style={{fontSize: 12, color: '#6B7A75', marginTop: 4}}>{habit.pointsReward} XP</Text>
            </View>
            <TouchableOpacity
              onPress={() => void model.handleHabitCheckIn(habit.id)}
              disabled={habit.completedToday}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: habit.completedToday ? '#F0F5F2' : '#126027',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
              {habit.completedToday ? <Ionicons name="checkmark" size={16} color="#4ADE80" /> : <Feather name="plus" size={16} color="#FFF" />}
            </TouchableOpacity>
          </SurfaceCard>
        ))}
      </ScrollView>
    </>
  );
}

function ProfileView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <View style={styles.availablePointsCard}>
          <Text style={styles.pointsLabel}>AVAILABLE POINTS</Text>
          <View style={{flexDirection: 'row', alignItems: 'baseline', marginBottom: 24}}>
            <Text style={styles.pointsBigValue}>{model.dashboard?.user.points?.toLocaleString() ?? '2,450'}</Text>
            <Text style={styles.pointsUnit}> Leaves</Text>
          </View>
          <View style={styles.rowBetween}>
            <TouchableOpacity style={styles.pointsBtnPrimary}><Text style={styles.pointsBtnPrimaryText}>Exchange Points</Text></TouchableOpacity>
            <TouchableOpacity style={styles.pointsBtnSecondary}><Text style={styles.pointsBtnSecondaryText}>History</Text></TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionHeadline, { marginTop: 24 }]}>Lifetime Journey</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.metaText}>Level 12 • Forest Guardian</Text>
          <Text style={styles.taskMetaValueDark}>850 XP TO LEVEL 13</Text>
        </View>
        
        <View style={styles.carbonOffsetCard}>
          <View style={styles.carbonIconWrap}>
             <Ionicons name="leaf" size={24} color="#126027" />
          </View>
          <View style={{flex: 1}}>
             <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Carbon Offset</Text>
                <Text style={styles.carbonValueDark}>1.2 Tons</Text>
             </View>
             <ProgressBar progress={70} />
          </View>
        </View>

        <Text style={[styles.sectionHeadline, { marginTop: 24 }]}>Collectible Badges</Text>
        <View style={styles.badgeGrid}>
           {/* Badge 1 */}
           <View style={styles.badgeCard}>
             <View style={styles.badgeCircleDark}>
                <Ionicons name="trash" size={32} color="#FFF" />
                <View style={styles.badgeTagGold}><Text style={styles.badgeTagGoldText}>GOLD</Text></View>
             </View>
             <Text style={styles.badgeTitle}>Waste Warrior</Text>
             <Text style={styles.badgeDesc}>Recycled for 30 consecutive days</Text>
           </View>

           {/* Badge 2 */}
           <View style={styles.badgeCard}>
             <View style={styles.badgeCircleMedium}>
                <Ionicons name="flash" size={32} color="#FFF" />
             </View>
             <Text style={styles.badgeTitle}>Energy Saver</Text>
             <Text style={styles.badgeDesc}>Reduced home energy by 15%</Text>
           </View>

           {/* Badge 3 Locked */}
           <View style={styles.badgeCard}>
             <View style={styles.badgeCircleLight}>
                <Ionicons name="bicycle" size={32} color="#B0C4B8" />
             </View>
             <Text style={styles.badgeTitleLight}>Pedal Power</Text>
             <View style={styles.lockedRow}>
               <Ionicons name="lock-closed" size={12} color="#126027" />
               <Text style={styles.lockedText}>LOCKED</Text>
             </View>
             <View style={{width: 60, alignSelf:'center', marginTop: 8}}><ProgressBar progress={30} /></View>
           </View>

           {/* Badge 4 Locked */}
           <View style={styles.badgeCard}>
             <View style={styles.badgeCircleLight}>
                <Ionicons name="water" size={32} color="#B0C4B8" />
             </View>
             <Text style={styles.badgeTitleLight}>Water Wise</Text>
             <View style={styles.lockedRow}>
               <Ionicons name="lock-closed" size={12} color="#126027" />
               <Text style={styles.lockedText}>LOCKED</Text>
             </View>
             <View style={{width: 60, alignSelf:'center', marginTop: 8}}><ProgressBar progress={10} /></View>
           </View>
        </View>

        <View style={styles.nftPromoCardLight}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=200&auto=format&fit=crop' }} style={styles.nftPromoLightImg} />
          <View style={{flex: 1}}>
             <Text style={styles.welcomeLabel}>NEW CHALLENGE</Text>
             <Text style={styles.nftPromoTitleDark}>Plant 10 Seeds this week</Text>
             <Text style={styles.nftPromoDescDark}>Earn the "Garden Guardian" badge and +500 leaves.</Text>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <SecondaryButton label="Sign Out" onPress={() => void model.handleLogout()} />
        </View>

        <View style={{height: 100}} />
      </View>
    </>
  );
}

function OverlayRouter({ model }: { model: EcoBudMobileModel }) {
  switch (model.activeOverlay) {
    case 'assistant':
      return <AssistantOverlay model={model} />;
    case 'events':
      return <EventsOverlay model={model} />;
    case 'lesson':
      return <LessonOverlay model={model} />;
    case 'leaderboard':
      return <LeaderboardOverlay model={model} />;
    case 'rewards':
      return <RewardsOverlay model={model} />;
    case 'transparency':
      return <TransparencyOverlay model={model} />;
    default:
      return null;
  }
}

function AssistantOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} title="AI Assistant" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
          
          <View style={{alignItems: 'center', marginBottom: 24, opacity: 0.7}}>
             <View style={[styles.badgeCircleMedium, {width: 48, height: 48, borderRadius: 24, marginBottom: 8}]}>
                <Ionicons name="chatbubbles" size={24} color="#FFF" />
             </View>
             <Text style={styles.metaTextSmallDark}>EcoBud Assistant is here to help</Text>
          </View>

          {model.assistantMessages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.chatBubble,
                message.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleBot,
              ]}
            >
              <Text style={message.role === 'user' ? styles.chatBubbleTextUser : styles.chatBubbleTextBot}>{message.text}</Text>
              <Text style={message.role === 'user' ? styles.chatTimeUser : styles.chatTimeBot}>{message.time}</Text>
            </View>
          ))}
          {model.sendingMessage ? <ActivityIndicator color="#126027" style={{ marginTop: 12, alignSelf: 'flex-start' }} /> : null}
        </ScrollView>

        <View style={{paddingHorizontal: 24, paddingBottom: 12}}>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
             {['How to compost?', 'Where is the next event?', 'My Eco Points', 'Find a challenge'].map((reply) => (
                <TouchableOpacity key={reply} onPress={() => void model.handleAssistantSend(reply)} style={styles.categoryOutlineBtn}>
                  <Text style={[styles.categoryOutlineBtnText, {paddingHorizontal: 12}]}>{reply}</Text>
                </TouchableOpacity>
              ))}
           </ScrollView>
        </View>

        <View style={styles.assistantComposer}>
          <TextInput
            value={model.assistantInput}
            onChangeText={model.setAssistantInput}
            placeholder="Mesaage ECOBUD..."
            placeholderTextColor="#6B7A75"
            style={styles.chatInput}
          />
          <TouchableOpacity onPress={() => void model.handleAssistantSend()} style={styles.circularAddBtn}>
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function EventsOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.welcomeLabel}>DIRECTORY</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.pageTitle}>Eco Events</Text>
          <View style={styles.filterPillGroup}>
             <View style={styles.filterPillActive}><MaterialCommunityIcons name="view-list" size={16} color="#126027"/><Text style={styles.filterPillActiveText}> List</Text></View>
             <View style={styles.filterPillInactive}><MaterialCommunityIcons name="map" size={16} color="#6B7A75"/><Text style={styles.filterPillInactiveText}> Map</Text></View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, marginTop: 16, marginBottom: 24}}>
           <View style={styles.categoryPillActive}><Text style={styles.categoryPillActiveText}>All Events</Text></View>
           <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Clean-ups</Text></View>
           <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Tree Planting</Text></View>
        </ScrollView>

        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1618477461853-cf6ed80fabe5?q=80&w=800&auto=format&fit=crop' }} style={styles.eventFeaturedCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.eventFeaturedOverlay} />
          <View style={styles.featuredProgramContent}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 'auto' }}>
              <View style={styles.tagLight}><Text style={styles.tagLightText}>FEATURED</Text></View>
              <View style={styles.tagDark}><Text style={styles.tagDarkText}>CLEAN-UP</Text></View>
            </View>
            
            <View style={{flexDirection: 'row', gap: 16, marginBottom: 8, marginTop: 40}}>
               <View style={styles.rowMeta}><Ionicons name="calendar" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> Oct 24, 2024</Text></View>
               <View style={styles.rowMeta}><Ionicons name="location" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> Crystal Bay</Text></View>
            </View>
            <Text style={styles.featuredProgramTitle}>The Great Coastal Sweep</Text>
            
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
               <View style={{ flexDirection: 'row', gap: -8 }}>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=4'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=5'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=6'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={[styles.nftAvatar, {backgroundColor: '#1E4C31'}]}><Text style={{color: '#FFF', fontSize: 10, fontWeight: 'bold'}}>+142</Text></View>
               </View>
               <TouchableOpacity style={styles.eventJoinBtnInfo}>
                 <Text style={styles.eventJoinBtnInfoText}>Join Event</Text>
               </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.eventListCard}>
          <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop' }} style={styles.eventListImg} imageStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
             <View style={styles.dateTagRight}><Text style={styles.dateTagRightText}>OCT 28</Text></View>
          </ImageBackground>
          <View style={styles.eventListBody}>
            <Text style={styles.welcomeLabel}>TREE PLANTING</Text>
            <Text style={styles.cardTitle}>Urban Forest Revival</Text>
            <View style={[styles.rowMeta, {marginBottom: 16}]}><Ionicons name="location" size={14} color="#6B7A75"/><Text style={styles.metaTextSmallDark}> Lincoln Park, NYC</Text></View>
            <TouchableOpacity style={styles.quickJoinBtn}><Text style={styles.quickJoinBtnText}>Quick Join</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.eventListCard}>
          <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&auto=format&fit=crop' }} style={styles.eventListImg} imageStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
             <View style={styles.dateTagRight}><Text style={styles.dateTagRightText}>NOV 02</Text></View>
          </ImageBackground>
          <View style={styles.eventListBody}>
            <Text style={styles.welcomeLabel}>WORKSHOP</Text>
            <Text style={styles.cardTitle}>Zero-Waste Living 101</Text>
            <View style={[styles.rowMeta, {marginBottom: 16}]}><Ionicons name="location" size={14} color="#6B7A75"/><Text style={styles.metaTextSmallDark}> Community Hub</Text></View>
            <TouchableOpacity style={styles.quickJoinBtn}><Text style={styles.quickJoinBtnText}>Quick Join</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.eventListCard}>
          <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1531206715517-5c0ba140fea2?q=80&w=800&auto=format&fit=crop' }} style={styles.eventListImg} imageStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />
          <View style={styles.eventListBody}>
            <Text style={styles.welcomeLabel}>CAMPAIGN</Text>
            <Text style={styles.cardTitle}>Eco March for Climate</Text>
            <Text style={styles.metaTextSmallDark}>Join thousands as we walk for a greener future and advocate for sustainable policies in our city center.</Text>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16}}>
               <View>
                  <Text style={styles.metaTextSmallDark}>DATE</Text>
                  <Text style={styles.cardTitle}>Nov 15, 2024</Text>
               </View>
               <TouchableOpacity style={styles.circularAddBtn}>
                  <Ionicons name="add" size={24} color="#FFF" />
               </TouchableOpacity>
            </View>
          </View>
        </View>

      <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}

function LessonOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <OverlayScaffold
      title={model.selectedLesson?.title ?? 'Lesson Detail'}
      subtitle={model.selectedLesson?.category ?? 'Eco course'}
      onBack={() => model.setActiveOverlay(null)}
    >
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        {model.selectedLesson ? (
          <>
            <LessonMedia imageUrl={model.selectedLesson.imageUrl} iconName="book" large />
            <SurfaceCard style={styles.lessonDetailCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{model.selectedLesson.title}</Text>
                <TinyBadge label={`${model.selectedLesson.pointsReward} pts`} />
              </View>
              <Text style={styles.sectionCaption}>{model.selectedLesson.summary}</Text>
              <View style={styles.lessonMetaRow}>
                <ChallengeMeta icon="time-outline" label={`${model.selectedLesson.durationMinutes} min`} />
                <ChallengeMeta icon="star-outline" label={model.selectedLesson.rating.toFixed(1)} />
                <ChallengeMeta icon="leaf-outline" label={model.selectedLesson.category} />
              </View>
              <Text style={styles.lessonBodyText}>{model.selectedLesson.content}</Text>
              <PrimaryButton label="Complete Lesson" onPress={() => void model.handleCompleteLesson()} />
            </SurfaceCard>
          </>
        ) : null}
      </ScrollView>
    </OverlayScaffold>
  );
}

function LeaderboardOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} title="Leaderboard" />
      <View style={[styles.homeContent, {flex: 1}]}>
        <View style={styles.leaderboardFilterRow}>
          <TouchableOpacity style={[styles.filterPillActive, {flex: 1, justifyContent: 'center'}]}><Text style={styles.filterPillActiveText}>Global</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.filterPillInactive, {flex: 1, justifyContent: 'center'}]}><Text style={styles.filterPillInactiveText}>Friends</Text></TouchableOpacity>
        </View>

        <View style={styles.leaderboardTop3}>
           <View style={[styles.lbTopCard, {marginTop: 40}]}>
              <View style={styles.lbAvatarWrap}>
                 <Image source={{uri: 'https://i.pravatar.cc/150?img=12'}} style={styles.lbAvatarImg} />
                 <View style={[styles.lbRankBadge, {backgroundColor: '#B0BEC5'}]}><Text style={styles.lbRankText}>2</Text></View>
              </View>
              <Text style={styles.lbTopName}>Sarah M.</Text>
              <Text style={styles.lbTopPoints}>12.4k pts</Text>
           </View>
           <View style={styles.lbTopCard}>
              <View style={styles.lbAvatarWrap}>
                 <Image source={{uri: 'https://i.pravatar.cc/150?img=33'}} style={[styles.lbAvatarImg, {width: 80, height: 80}]} />
                 <View style={[styles.lbRankBadge, {backgroundColor: '#FFD700', width: 28, height: 28, borderRadius: 14}]}><Text style={[styles.lbRankText, {fontSize: 14}]}>1</Text></View>
              </View>
              <Text style={[styles.lbTopName, {fontSize: 18, fontWeight: 'bold'}]}>Alex Eco</Text>
              <Text style={[styles.lbTopPoints, {color: '#126027', fontWeight: 'bold'}]}>15.2k pts</Text>
           </View>
           <View style={[styles.lbTopCard, {marginTop: 40}]}>
              <View style={styles.lbAvatarWrap}>
                 <Image source={{uri: 'https://i.pravatar.cc/150?img=44'}} style={styles.lbAvatarImg} />
                 <View style={[styles.lbRankBadge, {backgroundColor: '#CD7F32'}]}><Text style={styles.lbRankText}>3</Text></View>
              </View>
              <Text style={styles.lbTopName}>John D.</Text>
              <Text style={styles.lbTopPoints}>11.1k pts</Text>
           </View>
        </View>

        <ScrollView style={{flex: 1, marginTop: 24, paddingHorizontal: 4}}>
           {[4,5,6,7,8,9,10].map(rank => (
             <View key={rank} style={styles.lbListRow}>
                <Text style={styles.lbListRank}>{rank}</Text>
                <Image source={{uri: `https://i.pravatar.cc/100?img=${rank+10}`}} style={styles.lbListAvatar} />
                <View style={{flex: 1, marginLeft: 16}}>
                   <Text style={styles.cardTitle}>User {rank}</Text>
                </View>
                <Text style={styles.lbListPoints}>{11000 - rank*500} pts</Text>
             </View>
           ))}
        </ScrollView>
        
        <View style={styles.lbCurrentUserCard}>
           <Text style={styles.lbListRank}>42</Text>
           <Image source={{uri: model.session?.user.avatarUrl ?? 'https://i.pravatar.cc/100'}} style={styles.lbListAvatar} />
           <View style={{flex: 1, marginLeft: 16}}>
              <Text style={[styles.cardTitle, {color: '#FFF'}]}>You</Text>
           </View>
           <Text style={[styles.lbListPoints, {color: '#FFF'}]}>{model.dashboard?.user?.points ?? 2450} pts</Text>
        </View>

      </View>
    </View>
  );
}

function RewardsOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <OverlayScaffold
      title="Rewards & Badges"
      subtitle="Track unlocks and next milestones"
      onBack={() => model.setActiveOverlay(null)}
    >
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        <SurfaceCard style={styles.rewardsHeroCard}>
          <Text style={styles.rewardsHeroValue}>{model.rewards?.points ?? 0} ECO Points</Text>
          <Text style={styles.sectionCaption}>Available for exchange</Text>
        </SurfaceCard>

        <Text style={styles.sectionHeadline}>Badges</Text>
        <View style={styles.badgesGrid}>
          {(model.rewards?.badges ?? []).map((badge) => (
            <BadgeCard key={badge.id} badge={badge} fullWidth />
          ))}
        </View>

        <Text style={styles.sectionHeadline}>Lifetime Achievements</Text>
        {(model.rewards?.achievements ?? []).map((achievement) => {
          const progress = Math.min(100, Math.round((achievement.current / achievement.target) * 100));

          return (
            <SurfaceCard key={achievement.id} style={styles.achievementCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>
                  {achievement.label} ({achievement.current}/{achievement.target})
                </Text>
                <Text style={styles.logPoints}>{achievement.reward} pts</Text>
              </View>
              <ProgressBar progress={progress} />
            </SurfaceCard>
          );
        })}
      </ScrollView>
    </OverlayScaffold>
  );
}

function TransparencyOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <OverlayScaffold
      title="Activity Transparency"
      subtitle="Verified impact logs and immutable reward history"
      onBack={() => model.setActiveOverlay(null)}
    >
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        <View style={styles.timelineRail}>
          {(model.transparency?.logs ?? []).map((log, index) => (
            <View key={log.id} style={styles.timelineRow}>
              <View style={styles.timelineNodeWrap}>
                <View style={styles.timelineNode} />
                {index < (model.transparency?.logs.length ?? 0) - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <SurfaceCard style={styles.timelineCard}>
                <Text style={styles.cardTitle}>{log.publicLabel}</Text>
                <Text style={styles.sectionCaption}>{formatLongDate(log.timestamp)}</Text>
                <Text style={styles.hashText}>{shortHash(log.currentHash)}</Text>
              </SurfaceCard>
            </View>
          ))}
        </View>

        {(model.transparency?.logs ?? []).map((log) => (
          <SurfaceCard key={`detail-${log.id}`} style={styles.transparencyDetailCard}>
            <View style={styles.rowMeta}>
              <MaterialCommunityIcons name="leaf" size={22} color={ecoTheme.colors.primaryDark} />
              <Text style={styles.cardTitle}>Verified on ECOBUD ledger</Text>
            </View>
            <Text style={styles.transparencyLine}>Action: {log.actionType}</Text>
            <Text style={styles.transparencyLine}>Points: +{log.pointsAwarded}</Text>
            <Text style={styles.transparencyLine}>Date: {formatLongDate(log.timestamp)}</Text>
            <Text style={styles.transparencyLine}>Transaction: {shortHash(log.currentHash)}</Text>
            <SecondaryButton
              label="View Explorer"
              onPress={() => Alert.alert('Explorer placeholder', `Transaction hash:\n${log.currentHash}`)}
            />
          </SurfaceCard>
        ))}
      </ScrollView>
    </OverlayScaffold>
  );
}

function EcoGlowIllustration() {
  const crownLeaves = [
    { key: 'one', style: styles.illustrationLeafBadgeOne, rotate: '-34deg' as const },
    { key: 'two', style: styles.illustrationLeafBadgeTwo, rotate: '-12deg' as const },
    { key: 'three', style: styles.illustrationLeafBadgeThree, rotate: '10deg' as const },
    { key: 'four', style: styles.illustrationLeafBadgeFour, rotate: '28deg' as const },
    { key: 'five', style: styles.illustrationLeafBadgeFive, rotate: '40deg' as const },
  ];

  const flowers = [
    {
      key: 'left',
      style: styles.illustrationFlowerLeft,
      petalColor: '#FFD8CA',
      coreColor: '#F0A24D',
    },
    {
      key: 'center',
      style: styles.illustrationFlowerCenter,
      petalColor: '#FFD8E0',
      coreColor: '#F0BD4D',
    },
    {
      key: 'right',
      style: styles.illustrationFlowerRight,
      petalColor: '#FFC9D0',
      coreColor: '#E89545',
    },
  ];

  return (
    <View style={styles.illustrationWrap}>
      <View style={styles.illustrationAura} />
      <View style={styles.illustrationAuraSecondary} />
      <LinearGradient
        colors={['rgba(250,255,246,0.9)', 'rgba(228,255,223,0.56)', 'rgba(204,243,187,0.12)']}
        start={{ x: 0.12, y: 0.04 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.illustrationBubble}
      />
      <View style={styles.illustrationGlowDotOne} />
      <View style={styles.illustrationGlowDotTwo} />
      <View style={styles.illustrationGlowDotThree} />
      <View style={[styles.illustrationDewDrop, styles.illustrationDewDropOne]} />
      <View style={[styles.illustrationDewDrop, styles.illustrationDewDropTwo]} />
      <View style={[styles.illustrationDewDrop, styles.illustrationDewDropThree]} />

      {crownLeaves.map((leaf) => (
        <LinearGradient
          key={leaf.key}
          colors={['rgba(255,255,255,0.96)', 'rgba(199,244,174,0.88)', 'rgba(121,203,110,0.96)']}
          start={{ x: 0.08, y: 0.04 }}
          end={{ x: 0.88, y: 0.94 }}
          style={[styles.illustrationLeafBadge, leaf.style, { transform: [{ rotate: leaf.rotate }] }]}
        >
          <View style={styles.illustrationLeafVein} />
        </LinearGradient>
      ))}

      <View style={styles.illustrationStemLeft} />
      <View style={styles.illustrationStemCenter} />
      <View style={styles.illustrationStemRight} />
      <View style={[styles.illustrationSproutLeaf, styles.illustrationSproutLeafLeft]} />
      <View style={[styles.illustrationSproutLeaf, styles.illustrationSproutLeafRight]} />

      {flowers.map((flower) => (
        <View key={flower.key} style={[styles.illustrationFlower, flower.style]}>
          <View style={[styles.illustrationFlowerPetal, styles.illustrationFlowerPetalTop, { backgroundColor: flower.petalColor }]} />
          <View style={[styles.illustrationFlowerPetal, styles.illustrationFlowerPetalRight, { backgroundColor: flower.petalColor }]} />
          <View style={[styles.illustrationFlowerPetal, styles.illustrationFlowerPetalBottom, { backgroundColor: flower.petalColor }]} />
          <View style={[styles.illustrationFlowerPetal, styles.illustrationFlowerPetalLeft, { backgroundColor: flower.petalColor }]} />
          <View style={[styles.illustrationFlowerCore, { backgroundColor: flower.coreColor }]} />
        </View>
      ))}

      <View style={styles.illustrationLeafPodLeft}>
        <View style={styles.illustrationLeafPodInner} />
      </View>
      <View style={styles.illustrationLeafPodRight}>
        <View style={styles.illustrationLeafPodInner} />
      </View>

      <LinearGradient
        colors={['#F5FFD6', '#C7F09C', '#82CF6A']}
        start={{ x: 0.15, y: 0.02 }}
        end={{ x: 0.82, y: 1 }}
        style={styles.illustrationCharacter}
      >
        <View style={styles.illustrationCharacterGlow} />
        <View style={[styles.illustrationArm, styles.illustrationArmLeft]} />
        <View style={[styles.illustrationArm, styles.illustrationArmRight]} />
        <View style={[styles.illustrationLeg, styles.illustrationLegLeft]} />
        <View style={[styles.illustrationLeg, styles.illustrationLegRight]} />

        <View style={styles.illustrationEyeRow}>
          <View style={styles.illustrationEye}>
            <View style={styles.illustrationEyeSpark} />
          </View>
          <View style={styles.illustrationEye}>
            <View style={styles.illustrationEyeSpark} />
          </View>
        </View>
        <View style={styles.illustrationSmile} />
        <View style={[styles.illustrationBlush, styles.illustrationBlushLeft]} />
        <View style={[styles.illustrationBlush, styles.illustrationBlushRight]} />
      </LinearGradient>
    </View>
  );
}

function EcoLogo({ light = false, emphasis = 'default' }: { light?: boolean; emphasis?: 'default' | 'hero' }) {
  const hero = emphasis === 'hero';

  return (
    <View style={[styles.logoRow, hero && styles.logoRowHero]}>
      <View style={[styles.logoBadge, light && styles.logoBadgeLight, hero && styles.logoBadgeHero, { backgroundColor: 'transparent', borderWidth: 0 }]}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: hero ? 48 : 34, height: hero ? 48 : 34, resizeMode: 'contain' }}
        />
      </View>
      <Text style={[styles.logoText, light && styles.logoTextLight, hero && styles.logoTextHero]}>ECOBUD</Text>
    </View>
  );
}

function OverlayScaffold({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.overlayShell}>
      <LinearGradient colors={['#071C19', '#0C5E54', '#17A07E']} style={styles.overlayHeader}>
        <SafeAreaView>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color="#FFF" />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>{title}</Text>
          <Text style={styles.overlaySubtitle}>{subtitle}</Text>
        </SafeAreaView>
      </LinearGradient>
      <View style={styles.overlayBody}>{children}</View>
    </View>
  );
}

function usePressScale(pressedScale = 0.97) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = useCallback((toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 150,
    }).start();
  }, [scale]);

  const onPressIn = useCallback(() => {
    animateTo(pressedScale);
  }, [animateTo, pressedScale]);

  const onPressOut = useCallback(() => {
    animateTo(1);
  }, [animateTo]);

  return { scale, onPressIn, onPressOut };
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled, style]}
    >
      <LinearGradient
        colors={['#0B5F58', '#169070', '#69CDA8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButtonGradient}
      >
        <View style={styles.primaryButtonGlow} />
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SecondaryButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.secondaryButton, style]}>
      <View style={styles.secondaryButtonGradient}>
        <Text style={styles.secondaryButtonText}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SurfaceCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.surfaceCard, style]}>{children}</View>;
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progress))}%` }]} />
    </View>
  );
}

function LessonMedia({
  imageUrl,
  iconName,
  large = false,
}: {
  imageUrl?: string | null;
  iconName: string;
  large?: boolean;
}) {
  const height = large ? 200 : 140;
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.lessonMedia, { height }]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.lessonMediaFallback, { height }]}>
      <Ionicons name={(iconName as any) || 'book'} size={40} color={ecoTheme.colors.primaryDark} />
    </View>
  );
}

function TinyBadge({ label, gold = false }: { label: string; gold?: boolean }) {
  return (
    <View style={[styles.tinyBadge, gold && styles.tinyBadgeGold]}>
      <Text style={[styles.tinyBadgeText, gold && styles.tinyBadgeTextGold]}>{label}</Text>
    </View>
  );
}

function ChallengeMeta({
  icon,
  label,
}: {
  icon: string;
  label: string;
}) {
  return (
    <View style={styles.challengeMetaWrap}>
      <Ionicons name={icon as any} size={16} color={ecoTheme.colors.textSoft} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

function AvatarBubble({ label, size }: { label: string; size: number }) {
  return (
    <View style={[styles.avatarBubble, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarInitials}>{initialsFromLabel(label)}</Text>
    </View>
  );
}

function BadgeCard({ badge, fullWidth = false }: { badge: EcoBadge & { unlocked?: boolean }; fullWidth?: boolean }) {
  const unlocked = Boolean(badge.unlocked);

  return (
    <View style={[styles.badgeCard, fullWidth && styles.badgeCardFull, !unlocked && styles.badgeCardLocked]}>
      <View style={[styles.badgeIconWrap, !unlocked && styles.badgeIconWrapLocked]}>
        <Ionicons
          name={unlocked ? 'ribbon' : 'lock-closed'}
          size={28}
          color={unlocked ? ecoTheme.colors.primaryDark : '#777777'}
        />
      </View>
      <Text style={styles.badgeName}>{badge.name}</Text>
      <Text style={styles.badgeRequirement}>
        {unlocked ? `${badge.requiredPoints} pts unlocked` : `Requires ${badge.requiredPoints} ECO Points`}
      </Text>
    </View>
  );
}

function ProgressRing({ value }: { value: number }) {
  return (
    <View style={styles.progressRingOuter}>
      <View style={styles.progressRingInner}>
        <Text style={styles.progressRingValue}>{value}%</Text>
      </View>
    </View>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileMetric}>
      <Text style={styles.profileMetricValue}>{value}</Text>
      <Text style={styles.profileMetricLabel}>{label}</Text>
    </View>
  );
}

function BottomTabBar({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const items: { key: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'home', label: 'Home', icon: 'home-outline' },
    { key: 'learn', label: 'Learn', icon: 'book-outline' },
    { key: 'challenges', label: 'Challenges', icon: 'trophy-outline' },
    { key: 'tracker', label: 'Tracker', icon: 'bar-chart-outline' },
    { key: 'profile', label: 'Profile', icon: 'person-outline' },
  ];

  return (
    <View style={styles.bottomBar}>
      {items.map((item) => {
        const isActive = item.key === activeTab;

        return (
          <TouchableOpacity key={item.key} onPress={() => onChange(item.key)} style={styles.bottomBarItem}>
            <Ionicons name={item.icon} size={24} color={isActive ? ecoTheme.colors.primaryDark : '#9BA2A7'} />
            <Text style={[styles.bottomBarLabel, isActive && styles.bottomBarLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function getLessonProgressPercent(status?: string | null) {
  if (status === 'COMPLETED') {
    return 100;
  }

  if (status === 'IN_PROGRESS') {
    return 60;
  }

  return 10;
}

function formatChatTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatLongDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });
}

function shiftMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const shifted = new Date(year, monthIndex - 1 + offset, 1);
  const nextYear = shifted.getFullYear();
  const nextMonth = String(shifted.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

function buildCalendarCells(month: string, completedDays: string[]) {
  const [year, monthIndex] = month.split('-').map(Number);
  const completedSet = new Set(completedDays);
  const firstDate = new Date(year, monthIndex - 1, 1);
  const lastDate = new Date(year, monthIndex, 0);
  const startPadding = firstDate.getDay();
  const todayKey = new Date().toISOString().slice(0, 10);
  const cells: { dateKey: string | null; day: number | null; completed: boolean; isToday: boolean }[] = [];

  for (let index = 0; index < startPadding; index += 1) {
    cells.push({ dateKey: null, day: null, completed: false, isToday: false });
  }

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    const dateKey = `${year}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      dateKey,
      day,
      completed: completedSet.has(dateKey),
      isToday: dateKey === todayKey,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, day: null, completed: false, isToday: false });
  }

  return cells;
}

function initialsFromLabel(label: string) {
  const [first = '', second = ''] = label.trim().split(/\s+/);
  return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase() || 'EB';
}

function shortHash(hash: string) {
  if (hash.length <= 14) {
    return hash;
  }

  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

const styles = StyleSheet.create({
  onbGlassCard: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  onbEcoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: ecoTheme.colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  onbTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  onbDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  onbBtn: {
    width: '100%',
    borderRadius: 100,
    overflow: 'hidden',
    shadowColor: ecoTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  onbGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  onbBtnTxt: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  actionHost: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 27, 23, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  actionOverlayCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: 'rgba(8, 35, 30, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#0E6D60',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  actionOverlayLogoWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  actionOverlaySpinnerShell: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOverlaySpinnerRing: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(207,255,234,0.22)',
    alignItems: 'center',
  },
  actionOverlaySpinnerDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    marginTop: 9,
    backgroundColor: '#B4FBE0',
    shadowColor: '#B4FBE0',
    shadowOpacity: 0.72,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  actionOverlayLogoCore: {
    width: 98,
    height: 98,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 88, 76, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#18A176',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  actionOverlayTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: '#F2FFF8',
    textAlign: 'center',
  },
  actionOverlayCopy: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(227,255,244,0.76)',
    textAlign: 'center',
  },
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    overflow: 'hidden',
  },
  bootBackdropOrb: {
    position: 'absolute',
    top: -70,
    right: -35,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(115, 255, 206, 0.12)',
  },
  bootBackdropOrbSecondary: {
    position: 'absolute',
    bottom: -110,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bootOrbitalRing: {
    position: 'absolute',
    width: 216,
    height: 216,
    borderRadius: 108,
    borderWidth: 1,
    borderColor: 'rgba(204,255,235,0.22)',
    alignItems: 'center',
  },
  bootOrbitalDot: {
    position: 'absolute',
    top: 12,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#C9FFE8',
    shadowColor: '#9FF7D4',
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  bootCenterpiece: {
    width: 216,
    height: 216,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  bootLogoModern: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(4, 27, 21, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#72F1C1',
    shadowOpacity: 0.38,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 15,
  },
  bootTitleModern: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ECFDF5',
    letterSpacing: 0.3,
  },
  bootSubtitleModern: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(225,255,245,0.82)',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  bootLoaderChip: {
    marginTop: 28,
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  bootLoaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E9FFF5',
  },
  landingScreen: {
    flex: 1,
    overflow: 'hidden',
  },
  landingBackdropOrbPrimary: {
    position: 'absolute',
    top: -80,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(206, 255, 233, 0.14)',
  },
  landingBackdropOrbSecondary: {
    position: 'absolute',
    bottom: -110,
    left: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  launchBackdropCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  launchBackdropCore: {
    width: 150,
    height: 150,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#93FFD2',
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  launchBackdropCopy: {
    marginTop: 22,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#F1FFF8',
    textAlign: 'center',
  },
  landingShell: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  landingContent: {
    borderRadius: 38,
    paddingHorizontal: 24,
    paddingVertical: 26,
    backgroundColor: 'rgba(7, 32, 28, 0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  landingBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  landingBadgeText: {
    color: '#F5FFF9',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  landingVisual: {
    height: 276,
    marginTop: 22,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingOrbitalRing: {
    position: 'absolute',
    width: 208,
    height: 208,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(213,255,236,0.22)',
    alignItems: 'center',
  },
  landingOrbitalDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    marginTop: 9,
    backgroundColor: '#D5FFEC',
    shadowColor: '#D5FFEC',
    shadowOpacity: 0.76,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  landingLogoCoreShell: {
    width: 156,
    height: 156,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#9DF4CA',
    shadowOpacity: 0.2,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  landingStatCard: {
    position: 'absolute',
    width: 126,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F4FFF9',
    shadowColor: '#042821',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  landingStatLeft: {
    left: 0,
    top: 38,
  },
  landingStatRight: {
    right: 0,
    bottom: 28,
  },
  landingStatTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    color: ecoTheme.colors.text,
  },
  landingStatValue: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: ecoTheme.colors.textSoft,
  },
  landingTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '900',
    color: '#F7FFF9',
    textAlign: 'center',
  },
  landingCopy: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 25,
    color: 'rgba(239,255,247,0.84)',
    textAlign: 'center',
  },
  landingFeatureList: {
    marginTop: 22,
    gap: 12,
  },
  landingFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  landingFeatureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  landingFeatureTextWrap: {
    flex: 1,
  },
  landingFeatureTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F7FFF9',
  },
  landingFeatureSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(235,255,244,0.72)',
  },
  landingActions: {
    marginTop: 24,
    gap: 12,
  },
  landingFootnote: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(229,255,240,0.62)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  onboardingScreen: {
    flex: 1,
    backgroundColor: '#0D4238',
  },
  onboardingBackdropImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.34,
  },
  onboardingBackdropTint: {
    ...StyleSheet.absoluteFillObject,
  },
  onboardingBackdropOrbTop: {
    position: 'absolute',
    top: -54,
    right: -28,
    width: 232,
    height: 232,
    borderRadius: 116,
    backgroundColor: 'rgba(218,255,185,0.18)',
  },
  onboardingBackdropOrbBottom: {
    position: 'absolute',
    bottom: -88,
    left: -62,
    width: 258,
    height: 258,
    borderRadius: 129,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  onboardingBackdropLeafRight: {
    position: 'absolute',
    right: -12,
    top: 158,
    transform: [{ rotate: '8deg' }],
  },
  onboardingBackdropLeafLeft: {
    position: 'absolute',
    left: -12,
    bottom: 74,
    transform: [{ rotate: '-18deg' }],
  },
  onboardingBackdropLeafTop: {
    position: 'absolute',
    top: 56,
    left: 18,
    transform: [{ rotate: '-12deg' }],
  },
  onboardingShell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  onboardingCard: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: '#063D2E',
    shadowOpacity: 0.30,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
    overflow: 'hidden',
  },
  onboardingCardCompact: {
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  onboardingGlassLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
  },
  onboardingCardTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
  },
  onboardingGlassShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  onboardingGlassShimmer: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  onboardingFrostEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  onboardingCardGlow: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(200,255,175,0.12)',
  },
  onboardingCardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  onboardingBrandRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  onboardingBrandImage: {
    width: 130,
    height: 82,
  },
  onboardingBrandImageCompact: {
    width: 108,
    height: 68,
  },
  onboardingHeroWrap: {
    marginTop: 4,
    marginBottom: 8,
  },
  onboardingHeroWrapCompact: {
    marginTop: 0,
    marginBottom: 2,
  },
  onboardingStepContent: {
    flex: 1,
    width: '100%',
  },
  onboardingStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  onboardingStepEyebrowGlass: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  onboardingStepEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(12, 71, 59, 0.78)',
  },
  onboardingStepCounter: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  onboardingStepCounterText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#134B3F',
  },
  onboardingShowcaseWrap: {
    width: '100%',
    minHeight: 286,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingShowcaseWrapCompact: {
    minHeight: 228,
  },
  onboardingHeroChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#0E5A4C',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  onboardingHeroChipCompact: {
    minHeight: 38,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  onboardingHeroChipLeft: {
    top: 38,
    left: 4,
  },
  onboardingHeroChipRight: {
    top: 84,
    right: 6,
  },
  onboardingHeroChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#145947',
  },
  onboardingHeroMetricChip: {
    position: 'absolute',
    bottom: 22,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 176,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#0B5F58',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  onboardingHeroMetricChipCompact: {
    bottom: 14,
    minWidth: 160,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  onboardingHeroMetricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F6FFF8',
  },
  onboardingHeroMetricLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(239,255,246,0.82)',
  },
  onboardingPreviewOrb: {
    position: 'absolute',
    width: 248,
    height: 248,
    borderRadius: 124,
    backgroundColor: 'rgba(220,255,194,0.24)',
  },
  onboardingPreviewPanel: {
    width: '100%',
    borderRadius: 34,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  onboardingPreviewPanelCompact: {
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  onboardingPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  onboardingPreviewStepLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: 'rgba(18, 73, 60, 0.62)',
  },
  onboardingPreviewTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '900',
    color: '#143A31',
  },
  onboardingPreviewBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  onboardingPreviewFeatureStack: {
    gap: 10,
  },
  onboardingPreviewFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.60)',
  },
  onboardingPreviewFeatureRowCompact: {
    gap: 10,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  onboardingPreviewFeatureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingPreviewFeatureTextWrap: {
    flex: 1,
  },
  onboardingPreviewFeatureTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#143A31',
  },
  onboardingPreviewFeatureDetail: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(20, 58, 49, 0.74)',
  },
  onboardingPreviewFooter: {
    marginTop: 14,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onboardingPreviewFooterText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#145947',
  },
  illustrationWrap: {
    width: 320,
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  illustrationAura: {
    position: 'absolute',
    width: 272,
    height: 272,
    borderRadius: 136,
    backgroundColor: 'rgba(223,255,186,0.18)',
  },
  illustrationAuraSecondary: {
    position: 'absolute',
    width: 320,
    height: 228,
    borderRadius: 118,
    backgroundColor: 'rgba(244,255,239,0.20)',
    transform: [{ translateY: 18 }],
  },
  illustrationBubble: {
    position: 'absolute',
    bottom: 38,
    width: 286,
    height: 224,
    borderRadius: 118,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.46)',
  },
  illustrationGlowDotOne: {
    position: 'absolute',
    left: 54,
    top: 126,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F7FFD4',
    shadowColor: '#F7FFD4',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  illustrationGlowDotTwo: {
    position: 'absolute',
    right: 56,
    top: 152,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF3C8',
    shadowColor: '#FFF3C8',
    shadowOpacity: 0.74,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  illustrationGlowDotThree: {
    position: 'absolute',
    right: 88,
    bottom: 76,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBFFE5',
    shadowColor: '#FBFFE5',
    shadowOpacity: 0.74,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  illustrationDewDrop: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.46)',
  },
  illustrationDewDropOne: {
    top: 78,
    left: 56,
    width: 22,
    height: 30,
    borderRadius: 14,
  },
  illustrationDewDropTwo: {
    top: 96,
    right: 46,
    width: 16,
    height: 24,
    borderRadius: 12,
  },
  illustrationDewDropThree: {
    right: 74,
    bottom: 118,
    width: 18,
    height: 26,
    borderRadius: 13,
  },
  illustrationLeafBadge: {
    position: 'absolute',
    width: 54,
    height: 76,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D9FFCE',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  illustrationLeafBadgeOne: {
    left: 44,
    top: 34,
  },
  illustrationLeafBadgeTwo: {
    left: 86,
    top: 10,
  },
  illustrationLeafBadgeThree: {
    left: 134,
    top: 0,
  },
  illustrationLeafBadgeFour: {
    right: 86,
    top: 14,
  },
  illustrationLeafBadgeFive: {
    right: 46,
    top: 46,
  },
  illustrationLeafVein: {
    width: 4,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  illustrationStemLeft: {
    position: 'absolute',
    left: 68,
    bottom: 64,
    width: 4,
    height: 78,
    borderRadius: 999,
    backgroundColor: '#6FA863',
    transform: [{ rotate: '-12deg' }],
  },
  illustrationStemCenter: {
    position: 'absolute',
    left: 116,
    bottom: 58,
    width: 5,
    height: 94,
    borderRadius: 999,
    backgroundColor: '#73B468',
  },
  illustrationStemRight: {
    position: 'absolute',
    right: 72,
    bottom: 58,
    width: 4,
    height: 82,
    borderRadius: 999,
    backgroundColor: '#6FA863',
    transform: [{ rotate: '12deg' }],
  },
  illustrationSproutLeaf: {
    position: 'absolute',
    width: 26,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#82C776',
  },
  illustrationSproutLeafLeft: {
    left: 52,
    bottom: 128,
    transform: [{ rotate: '-26deg' }],
  },
  illustrationSproutLeafRight: {
    right: 56,
    bottom: 116,
    transform: [{ rotate: '26deg' }],
  },
  illustrationFlower: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationFlowerLeft: {
    left: 30,
    bottom: 34,
  },
  illustrationFlowerCenter: {
    left: 126,
    bottom: 48,
  },
  illustrationFlowerRight: {
    right: 34,
    bottom: 32,
  },
  illustrationFlowerPetal: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  illustrationFlowerPetalTop: {
    top: 0,
  },
  illustrationFlowerPetalRight: {
    right: 0,
  },
  illustrationFlowerPetalBottom: {
    bottom: 0,
  },
  illustrationFlowerPetalLeft: {
    left: 0,
  },
  illustrationFlowerCore: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
  },
  illustrationLeafPodLeft: {
    position: 'absolute',
    left: 18,
    bottom: 74,
    width: 76,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(130, 198, 116, 0.42)',
    justifyContent: 'center',
    transform: [{ rotate: '-16deg' }],
  },
  illustrationLeafPodRight: {
    position: 'absolute',
    right: 18,
    bottom: 84,
    width: 76,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(130, 198, 116, 0.38)',
    justifyContent: 'center',
    transform: [{ rotate: '18deg' }],
  },
  illustrationLeafPodInner: {
    width: 42,
    height: 18,
    borderRadius: 999,
    marginHorizontal: 14,
    backgroundColor: 'rgba(240,255,237,0.58)',
  },
  illustrationCharacter: {
    position: 'absolute',
    bottom: 62,
    width: 164,
    height: 198,
    borderRadius: 80,
    alignItems: 'center',
    paddingTop: 86,
    shadowColor: '#D7FFC3',
    shadowOpacity: 0.42,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  illustrationCharacterGlow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    bottom: 20,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  illustrationArm: {
    position: 'absolute',
    top: 92,
    width: 54,
    height: 58,
    borderRadius: 28,
    backgroundColor: '#B7EA8A',
  },
  illustrationArmLeft: {
    left: -18,
    transform: [{ rotate: '20deg' }],
  },
  illustrationArmRight: {
    right: -18,
    transform: [{ rotate: '-18deg' }],
  },
  illustrationLeg: {
    position: 'absolute',
    bottom: -22,
    width: 44,
    height: 56,
    borderRadius: 24,
    backgroundColor: '#8ACA6C',
  },
  illustrationLegLeft: {
    left: 34,
  },
  illustrationLegRight: {
    right: 34,
  },
  illustrationEyeRow: {
    flexDirection: 'row',
    gap: 26,
  },
  illustrationEye: {
    width: 18,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#224C37',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  illustrationEyeSpark: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  illustrationSmile: {
    width: 34,
    height: 16,
    marginTop: 12,
    borderBottomWidth: 4,
    borderColor: '#2C6E46',
    borderRadius: 999,
  },
  illustrationBlush: {
    position: 'absolute',
    top: 116,
    width: 24,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 174, 146, 0.56)',
  },
  illustrationBlushLeft: {
    left: 30,
  },
  illustrationBlushRight: {
    right: 30,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  logoRowHero: {
    marginBottom: 0,
    gap: 14,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DDF5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeLight: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoBadgeHero: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: ecoTheme.colors.primaryDark,
    letterSpacing: 0.4,
  },
  logoTextHero: {
    fontSize: 28,
    letterSpacing: 1.2,
  },
  logoTextLight: {
    color: '#FFFFFF',
  },
  onboardingTitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
    textAlign: 'center',
    color: '#151A16',
    marginBottom: 6,
  },
  onboardingTitleCompact: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 4,
  },
  onboardingCopy: {
    fontSize: 14,
    lineHeight: 21,
    color: '#21342B',
    textAlign: 'center',
    marginBottom: 8,
  },
  onboardingCopyCompact: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  onboardingSpotlightGlass: {
    marginBottom: 10,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  onboardingSpotlightGlassCompact: {
    marginBottom: 6,
    borderRadius: 14,
  },
  onboardingSpotlightInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  onboardingSpotlightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#145947',
  },
  onboardingBottomActions: {
    gap: 6,
  },
  onboardingExistingAccount: {
    marginTop: 4,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  onboardingExistingAccountText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(21, 26, 22, 0.50)',
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#13917B',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonGradient: {
    minHeight: 58,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  primaryButtonGlow: {
    position: 'absolute',
    width: 132,
    height: 132,
    top: -82,
    right: -18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    overflow: 'hidden',
  },
  secondaryButtonGradient: {
    minHeight: 50,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
  },
  paginationDots: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 6,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(76, 117, 76, 0.22)',
  },
  dotActive: {
    width: 28,
    backgroundColor: '#72B865',
  },

  newOnboardingContainer: {
    flex: 1,
    backgroundColor: '#EBF5ED',
  },
  newOnboardingSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  newOnboardingHeader: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  newOnboardingLogo: {
    width: 140,
    height: 32,
  },
  newOnboardingHeroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: -20,
  },
  heroCircleWrapper: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#13917B',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  newOnboardingHeroImage: {
    width: '125%',
    height: '125%', // scaled up to crop out bottom artifacts/buttons
  },
  newOnboardingTextContainer: {
    paddingHorizontal: 30,
    alignItems: 'center',
    marginBottom: 40,
  },
  newOnboardingTitle: {
    fontWeight: '800',
    fontSize: 34,
    color: '#123D2B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 40,
  },
  newOnboardingSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#123D2B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  newOnboardingBottom: {
    paddingHorizontal: 30,
    paddingBottom: Platform.OS === 'ios' ? 10 : 40,
  },
  newOnboardingButton: {
    backgroundColor: '#519E59',
    borderRadius: 30,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  newOnboardingButtonText: {
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 18,
  },
  newOnboardingPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: Platform.OS === 'ios' ? 10 : 0,
  },
  newOnboardingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C8D7CD',
  },
  newOnboardingDotActive: {
    width: 24,
    backgroundColor: '#519E59',
  },

  authShell: {
    flexGrow: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  authHero: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  authTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 12,
  },
  authSubtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.88)',
  },
  authCard: {
    marginHorizontal: 18,
    marginTop: -26,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: ecoTheme.radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2EFE7',
    shadowColor: ecoTheme.colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  sectionHeadline: {
    fontSize: 22,
    fontWeight: '900',
    color: ecoTheme.colors.text,
    marginBottom: 10,
  },
  sectionCaption: {
    fontSize: 15,
    lineHeight: 22,
    color: ecoTheme.colors.textSoft,
  },
  quickLoginRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 10,
  },
  quickPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    backgroundColor: '#F6FBF8',
    overflow: 'hidden',
  },
  quickPillActive: {
    borderColor: ecoTheme.colors.primaryDark,
    shadowColor: '#158771',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  quickPillGradient: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  quickPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
  },
  quickPillTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginTop: 16,
  },
  inputLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  textInput: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    paddingHorizontal: 16,
    fontSize: 16,
    color: ecoTheme.colors.text,
  },
  authError: {
    color: '#C44536',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  authHintBox: {
    marginTop: 18,
    backgroundColor: '#F5FBF7',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0EFE3',
  },
  authHintTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: ecoTheme.colors.text,
    marginBottom: 6,
  },
  authHintCopy: {
    fontSize: 13,
    color: ecoTheme.colors.textSoft,
    lineHeight: 20,
  },
  mainScrollContent: {
    paddingBottom: 110,
  },
  homeHero: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 34,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#0C5A4D',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  homeHeroGreeting: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 26,
  },
  homeHeroSubcopy: {
    marginTop: 10,
    fontSize: 18,
    color: 'rgba(255,255,255,0.90)',
  },
  notificationBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    right: -3,
    top: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E15A4E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  notificationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  contentSection: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 18,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E3EFE7',
    shadowColor: ecoTheme.colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  metricLabel: {
    marginTop: 6,
    fontSize: 14,
    color: ecoTheme.colors.textSoft,
  },
  surfaceCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: ecoTheme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4F0E8',
    shadowColor: ecoTheme.colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  challengeFeatureCard: {
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E7F6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
  },
  challengeHeadline: {
    fontSize: 18,
    fontWeight: '800',
    color: ecoTheme.colors.text,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: ecoTheme.colors.textSoft,
  },
  progressLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: ecoTheme.colors.text,
  },
  progressTrack: {
    height: 12,
    borderRadius: 8,
    backgroundColor: '#E4E9E6',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#249D7A',
  },
  horizontalList: {
    gap: 14,
    paddingRight: 8,
  },
  lessonHighlightCard: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: ecoTheme.radius.lg,
    overflow: 'hidden',
    shadowColor: ecoTheme.colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  lessonHighlightBody: {
    padding: 16,
    gap: 8,
  },
  lessonHighlightTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  lessonMedia: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#C7E9CD',
  },
  lessonMediaFallback: {
    width: '100%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3EFE7',
    shadowColor: ecoTheme.colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  actionIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8F6EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: ecoTheme.colors.text,
  },
  actionCardSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: ecoTheme.colors.textSoft,
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pageHeaderTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  pageHeaderSubtitle: {
    marginTop: 8,
    fontSize: 16,
    color: 'rgba(255,255,255,0.88)',
  },
  searchField: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#E3E9E4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: ecoTheme.colors.text,
  },
  featuredLessonCard: {
    gap: 14,
  },
  featuredOverlay: {
    position: 'absolute',
    left: '50%',
    top: 92,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(47, 165, 95, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseRowCard: {
    gap: 10,
  },
  courseRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  courseRowTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ecoTheme.colors.text,
  },
  coursePercent: {
    alignSelf: 'flex-end',
    fontSize: 16,
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
  },
  habitsCard: {
    gap: 12,
    backgroundColor: '#EEF7F1',
  },
  habitRow: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  habitTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ecoTheme.colors.text,
    maxWidth: 210,
  },
  pointsPill: {
    minWidth: 60,
    minHeight: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5F7EE',
    paddingHorizontal: 10,
  },
  pointsPillMuted: {
    backgroundColor: '#E4F7E9',
  },
  pointsPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: ecoTheme.colors.primaryDark,
  },
  pointsEarnedText: {
    fontSize: 16,
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
    textAlign: 'center',
  },
  challengeListCard: {
    padding: 14,
  },
  challengeListTop: {
    flexDirection: 'row',
    gap: 14,
  },
  miniMedia: {
    width: 100,
    height: 100,
    borderRadius: 18,
    backgroundColor: '#C9ECD0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeContent: {
    flex: 1,
    gap: 8,
  },
  challengeListTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    color: ecoTheme.colors.text,
    marginRight: 10,
  },
  challengeMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  challengeActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  inlinePanelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 22,
    backgroundColor: '#EAF8EF',
    borderWidth: 1,
    borderColor: '#DCEEDF',
  },
  inlinePanelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
  },
  trackerHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackerHeroLeft: {
    flex: 1,
    paddingRight: 14,
  },
  trackerHeroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  trackerHeroStreak: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '900',
    color: '#111111',
    marginVertical: 8,
  },
  progressRingOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 14,
    borderColor: '#D9F0DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  progressRingValue: {
    fontSize: 28,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  calendarCard: {
    gap: 16,
  },
  calendarMonth: {
    fontSize: 18,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarWeekLabel: {
    width: '14.2%',
    textAlign: 'center',
    fontSize: 14,
    color: ecoTheme.colors.textSoft,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2%',
    alignItems: 'center',
    marginBottom: 10,
  },
  calendarBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7F4',
  },
  calendarBubbleActive: {
    backgroundColor: '#55B85D',
  },
  calendarBubbleToday: {
    borderWidth: 2,
    borderColor: ecoTheme.colors.primaryDark,
  },
  calendarBubbleText: {
    fontSize: 16,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  calendarBubbleTextActive: {
    color: '#FFFFFF',
  },
  calendarBubblePlaceholder: {
    width: 38,
    height: 38,
  },
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkInTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ecoTheme.colors.text,
  },
  checkInButton: {
    minWidth: 110,
  },
  profileSummaryCard: {
    gap: 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarBubble: {
    backgroundColor: '#CBEFD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '900',
    color: ecoTheme.colors.primaryDark,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  profilePointsPill: {
    borderRadius: 20,
    backgroundColor: '#ECFAEF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  profilePointsText: {
    fontSize: 16,
    fontWeight: '900',
    color: ecoTheme.colors.primaryDark,
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  profileMetric: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#F5FBF7',
    padding: 14,
    alignItems: 'center',
  },
  profileMetricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  profileMetricLabel: {
    marginTop: 6,
    fontSize: 13,
    color: ecoTheme.colors.textSoft,
  },
  badgeCard: {
    width: 150,
    minHeight: 180,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#31B65B',
    backgroundColor: '#FFFFFF',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCardFull: {
    width: '48%',
  },
  badgeCardLocked: {
    borderColor: '#B8B8B8',
    backgroundColor: '#E4E4E4',
  },
  badgeIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#EDF9F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  badgeIconWrapLocked: {
    backgroundColor: '#D2D2D2',
  },
  badgeName: {
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  badgeRequirement: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: ecoTheme.colors.textSoft,
    marginTop: 10,
  },
  logPreviewCard: {
    gap: 10,
  },
  logPoints: {
    fontSize: 15,
    fontWeight: '900',
    color: ecoTheme.colors.primaryDark,
  },
  hashText: {
    fontSize: 14,
    color: '#8A94A0',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  overlayShell: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  overlayHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  overlayTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 18,
  },
  overlaySubtitle: {
    marginTop: 8,
    fontSize: 16,
    color: 'rgba(255,255,255,0.88)',
  },
  overlayBody: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -12,
    overflow: 'hidden',
  },
  overlayScroll: {
    padding: 18,
    gap: 16,
  },
  assistantHero: {
    alignItems: 'center',
    paddingTop: 18,
  },
  assistantMascot: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#ECF8EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantThread: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  assistantBubble: {
    maxWidth: '85%',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  assistantBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
  },
  assistantBubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#DFF6E4',
  },
  assistantBubbleText: {
    fontSize: 18,
    lineHeight: 26,
    color: ecoTheme.colors.text,
  },
  assistantTime: {
    marginTop: 8,
    fontSize: 12,
    color: ecoTheme.colors.textSoft,
  },
  quickReplyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  quickReplyChip: {
    minHeight: 42,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ecoTheme.colors.primary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FBF3',
  },
  quickReplyText: {
    fontSize: 15,
    color: ecoTheme.colors.primaryDark,
    fontWeight: '700',
  },
  assistantComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  assistantInput: {
    flex: 1,
    minHeight: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    fontSize: 16,
    color: ecoTheme.colors.text,
  },
  sendButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ecoTheme.colors.primaryDark,
  },
  segmentedControl: {
    flexDirection: 'row',
    margin: 18,
    marginBottom: 0,
    backgroundColor: '#E8ECE8',
    borderRadius: 24,
    padding: 4,
  },
  segmentActive: {
    flex: 1,
    minHeight: 46,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentInactive: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActiveText: {
    fontSize: 16,
    fontWeight: '800',
    color: ecoTheme.colors.text,
  },
  segmentInactiveText: {
    fontSize: 16,
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
  },
  eventCard: {
    gap: 12,
  },
  eventJoinButton: {
    minWidth: 110,
    flex: 0,
  },
  lessonDetailCard: {
    gap: 14,
  },
  lessonMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  lessonBodyText: {
    fontSize: 16,
    lineHeight: 26,
    color: ecoTheme.colors.text,
  },
  leaderboardCard: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  leaderboardCardActive: {
    backgroundColor: '#E8F6EE',
  },
  rankLabel: {
    width: 58,
    fontSize: 18,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  leaderboardName: {
    fontSize: 18,
    fontWeight: '900',
    color: ecoTheme.colors.text,
    maxWidth: 190,
  },
  badgePillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tinyBadge: {
    minHeight: 30,
    borderRadius: 16,
    backgroundColor: '#EEF8F1',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinyBadgeGold: {
    backgroundColor: '#F6E4A3',
  },
  tinyBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
  },
  tinyBadgeTextGold: {
    color: '#856400',
  },
  rewardsHeroCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardsHeroValue: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: ecoTheme.colors.primary,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    gap: 12,
  },
  timelineRail: {
    gap: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  timelineNodeWrap: {
    width: 26,
    alignItems: 'center',
  },
  timelineNode: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ecoTheme.colors.primaryDark,
    borderWidth: 4,
    borderColor: '#D4EFE1',
    marginTop: 16,
  },
  timelineLine: {
    width: 4,
    flex: 1,
    backgroundColor: '#CFEBDD',
    minHeight: 86,
    borderRadius: 2,
  },
  timelineCard: {
    flex: 1,
    gap: 8,
    borderWidth: 1,
    borderColor: '#C3DFF5',
  },
  transparencyDetailCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#D6EADF',
  },
  transparencyLine: {
    fontSize: 15,
    color: ecoTheme.colors.text,
  },
  bottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 78,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#DCE8E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: ecoTheme.colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bottomBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bottomBarLabel: {
    fontSize: 12,
    color: '#98A0A5',
  },
  bottomBarLabelActive: {
    color: ecoTheme.colors.primaryDark,
    fontWeight: '800',
  },
  chatbotFabOuter: {
    position: 'absolute',
    right: 20,
    bottom: 110,
    zIndex: 999,
  },
  chatbotFab: {
    shadowColor: '#10816A',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderRadius: 34,
  },
  chatbotFabImg: {
    width: 68,
    height: 68,
    resizeMode: 'contain',
  },

  topNavbar: {
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F9F7',
  },
  topNavAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  topNavTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#126027',
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
  },
  topNavTitleDark: {
    color: '#1A211D',
  },
  topNavBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  homeContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  welcomeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1.5,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A211D',
    marginTop: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6B7A75',
    marginTop: 4,
    marginBottom: 24,
  },
  homeMetricRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  homeMetricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  homeMetricIconWrapBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  homeMetricValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 4,
  },
  homeMetricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1,
  },
  weeklyGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  weeklyGoalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1,
    marginBottom: 12,
  },
  weeklyGoalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A211D',
    marginBottom: 12,
  },
  weeklyGoalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7A75',
  },
  todayChallengeCard: {
    backgroundColor: '#D4F7D4',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  challengeBadge: {
    backgroundColor: '#126027',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  challengeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  todayChallengeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#126027',
    marginBottom: 8,
  },
  todayChallengeDesc: {
    fontSize: 15,
    color: '#126027',
    opacity: 0.8,
    marginBottom: 24,
  },
  challengeCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  challengeCompleteBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#126027',
  },
  dailyTipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A211D',
    marginBottom: 4,
  },
  tipDesc: {
    fontSize: 14,
    color: '#6B7A75',
    lineHeight: 20,
  },
  tipImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  articleImage: {
    width: '100%',
    height: 160,
  },
  articleContent: {
    padding: 20,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A211D',
    flex: 1,
    marginRight: 16,
  },
  articleDesc: {
    fontSize: 14,
    color: '#6B7A75',
    lineHeight: 22,
    marginTop: 8,
  },
  bottomTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -5 },
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabButton: {
    alignItems: 'center',
    gap: 4,
  },
  tabIconContainer: {
    padding: 10,
    borderRadius: 16,
  },
  tabIconActive: {
    backgroundColor: '#EDF6F1',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7A75',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: '#126027',
    fontWeight: '800',
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A211D',
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#6B7A75',
    marginTop: 4,
  },
  habitSquareCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#126027',
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  habitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDF6F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  habitTopText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A211D',
    textAlign: 'center',
    marginBottom: 4,
  },
  habitMetaText: {
    fontSize: 12,
    color: '#6B7A75',
    marginBottom: 16,
  },
  habitSquareBtn: {
    backgroundColor: '#126027',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  habitSquareBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  habitActiveText: {
    color: '#126027',
    fontSize: 12,
    fontWeight: '800',
  },
  featuredProgramCard: {
    width: '100%',
    height: 380,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  featuredProgramOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 96, 39, 0.4)',
  },
  featuredProgramContent: {
    padding: 24,
  },
  tagDark: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  tagDarkText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  tagLight: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  tagLightText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  featuredProgramTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 8, lineHeight: 30 },
  featuredProgramDesc: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginBottom: 20, lineHeight: 22 },
  featuredProgramBtn: { backgroundColor: '#126027', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  featuredProgramBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  featuredGlassBar: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 16, marginBottom: 16 },
  progressLabelLight: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  progressTrackLight: { backgroundColor: 'rgba(255,255,255,0.3)', height: 6, borderRadius: 3, marginTop: 8 },
  progressFillLight: { backgroundColor: '#FFF', height: 6, borderRadius: 3 },
  taskCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 12, marginBottom: 16, alignItems: 'center' },
  taskCardImg: { width: 80, height: 80, borderRadius: 14 },
  taskCardBody: { flex: 1, paddingLeft: 16 },
  taskMetaLabel: { fontSize: 10, fontWeight: '800', color: '#4ADE80', letterSpacing: 1 },
  taskMetaValue: { fontSize: 10, fontWeight: '800', color: '#6B7A75' },
  taskCardTitle: { fontSize: 16, fontWeight: '700', color: '#1A211D', marginVertical: 6 },
  taskActionBtn: { backgroundColor: '#F0F5F2', paddingVertical: 8, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  taskActionBtnText: { color: '#126027', fontSize: 12, fontWeight: '800' },
  nftPromoCard: { backgroundColor: '#126027', borderRadius: 24, padding: 20, marginTop: 16 },
  welcomeLabelLight: { fontSize: 10, fontWeight: '800', color: '#4ADE80', letterSpacing: 1.5, marginBottom: 8 },
  nftPromoTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  nftPromoDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
  nftAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#126027', alignItems: 'center', justifyContent: 'center' },
  availablePointsCard: { backgroundColor: '#126027', padding: 24, borderRadius: 24, marginTop: 16 },
  pointsLabel: { color: '#4ADE80', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  pointsBigValue: { color: '#FFF', fontSize: 48, fontWeight: '800' },
  pointsUnit: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '600' },
  pointsBtnPrimary: { backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16 },
  pointsBtnPrimaryText: { color: '#126027', fontSize: 14, fontWeight: '800' },
  pointsBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16 },
  pointsBtnSecondaryText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  taskMetaValueDark: { fontSize: 12, fontWeight: '800', color: '#126027' },
  carbonOffsetCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  carbonIconWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EDF6F1', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  carbonValueDark: { fontSize: 16, fontWeight: '800', color: '#126027' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 },
  badgeCircleDark: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#126027', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeCircleMedium: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeCircleLight: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0F5F2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeCircleLightGreen: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeTagGold: { position: 'absolute', bottom: -10, backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 2, borderColor: '#FFF' },
  badgeTagGoldText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  badgeTitle: { fontSize: 14, fontWeight: '800', color: '#1A211D', textAlign: 'center', marginBottom: 4 },
  badgeTitleLight: { fontSize: 14, fontWeight: '800', color: '#6B7A75', textAlign: 'center', marginBottom: 4 },
  badgeDesc: { fontSize: 12, color: '#6B7A75', textAlign: 'center' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedText: { fontSize: 10, fontWeight: '800', color: '#126027', letterSpacing: 1 },
  nftPromoCardLight: { backgroundColor: '#FFF', borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  nftPromoLightImg: { width: 80, height: 80, borderRadius: 16, marginRight: 16 },
  nftPromoTitleDark: { fontSize: 18, fontWeight: '800', color: '#1A211D', marginBottom: 4 },
  nftPromoDescDark: { fontSize: 12, color: '#6B7A75', lineHeight: 18 },
  metaTextSmall: { fontSize: 12, color: '#6B7A75', marginTop: 8 },
  metaTextSmallDark: { fontSize: 12, color: '#6B7A75', lineHeight: 18 },
  metaTextWhite: { fontSize: 12, color: '#FFF', fontWeight: '600' },
  knowledgePointsCard: { backgroundColor: '#F59E0B', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  knowledgeIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  knowledgePointsLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '800', letterSpacing: 1 },
  knowledgePointsValue: { fontSize: 24, color: '#FFF', fontWeight: '800' },
  categoryLargeCard: { width: '100%', height: 200, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', marginTop: 16, marginBottom: 16 },
  categoryLargeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26, 33, 29, 0.5)' },
  categoryLargeTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  categoryLargeDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16 },
  categoryMediumCard: { backgroundColor: '#126027', borderRadius: 24, padding: 24, marginBottom: 16 },
  categoryMediumTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  categoryMediumDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16, lineHeight: 22 },
  categoryOutlineBtn: { borderWidth: 1, borderColor: '#4ADE80', borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  categoryOutlineBtnText: { color: '#4ADE80', fontSize: 14, fontWeight: '800' },
  categorySmallCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 12 },
  activeCourseRow: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 12, marginBottom: 12, alignItems: 'center' },
  courseThumb: { width: 60, height: 60, borderRadius: 12, marginRight: 16 },
  coursePercentText: { fontSize: 10, fontWeight: '800', color: '#6B7A75', letterSpacing: 1 },
  fullscreenOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F7F9F7', zIndex: 100 },
  filterPillGroup: { flexDirection: 'row', backgroundColor: '#EDF6F1', borderRadius: 20, padding: 4 },
  filterPillActive: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, alignItems: 'center' },
  filterPillActiveText: { color: '#1A211D', fontSize: 12, fontWeight: '700' },
  filterPillInactive: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, alignItems: 'center' },
  filterPillInactiveText: { color: '#6B7A75', fontSize: 12, fontWeight: '600' },
  categoryPillActive: { backgroundColor: '#126027', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  categoryPillActiveText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  categoryPillInactive: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  categoryPillInactiveText: { color: '#6B7A75', fontSize: 14, fontWeight: '600' },
  eventFeaturedCard: { width: '100%', height: 350, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 24 },
  eventFeaturedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26, 33, 29, 0.4)' },
  eventJoinBtnInfo: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  eventJoinBtnInfoText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  eventListCard: { backgroundColor: '#FFF', borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  eventListImg: { width: '100%', height: 160 },
  dateTagRight: { position: 'absolute', right: 16, top: 16, backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  dateTagRightText: { color: '#1A211D', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  eventListBody: { padding: 20 },
  quickJoinBtn: { backgroundColor: '#EDF6F1', paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  quickJoinBtnText: { color: '#126027', fontSize: 14, fontWeight: '800' },
  circularAddBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#126027', alignItems: 'center', justifyContent: 'center' },
  leaderboardFilterRow: { flexDirection: 'row', backgroundColor: '#EDF6F1', borderRadius: 20, padding: 4, marginTop: 16 },
  leaderboardTop3: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, paddingHorizontal: 16 },
  lbTopCard: { alignItems: 'center', width: '30%' },
  lbAvatarWrap: { marginBottom: 12, alignItems: 'center' },
  lbAvatarImg: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#FFF' },
  lbRankBadge: { position: 'absolute', bottom: -8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  lbRankText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  lbTopName: { fontSize: 16, fontWeight: '700', color: '#1A211D', marginBottom: 4 },
  lbTopPoints: { fontSize: 14, fontWeight: '600', color: '#6B7A75' },
  lbListRow: { flexDirection: 'row', backgroundColor: '#FFF', alignItems: 'center', padding: 12, borderRadius: 20, marginBottom: 8 },
  lbListRank: { width: 30, fontSize: 16, fontWeight: '800', color: '#6B7A75', textAlign: 'center' },
  lbListAvatar: { width: 40, height: 40, borderRadius: 20 },
  lbListPoints: { fontSize: 14, fontWeight: '800', color: '#126027' },
  lbCurrentUserCard: { flexDirection: 'row', backgroundColor: '#126027', alignItems: 'center', padding: 16, borderRadius: 24, position: 'absolute', bottom: 32, left: 24, right: 24, shadowColor: '#126027', shadowOpacity: 0.2, shadowRadius: 10 },

  chatBubble: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    maxWidth: '85%',
  },
  chatBubbleBot: {
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  chatBubbleUser: {
    backgroundColor: '#126027',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatBubbleTextBot: {
    color: '#1A211D',
    fontSize: 14,
    lineHeight: 22,
  },
  chatBubbleTextUser: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 22,
  },
  chatTimeBot: {
    fontSize: 10,
    color: '#6B7A75',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  chatTimeUser: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  chatInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F7F9F7',
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 14,
    color: '#1A211D',
  },
});
