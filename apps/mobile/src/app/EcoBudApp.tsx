import { AccessibilityProvider } from '../shared/accessibility/AccessibilityContext';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useCallback } from 'react';
import {
  BackHandler,
  RefreshControl,
  FlatList,
  View,
  StyleSheet,
  LogBox,
  Platform,
  AppState,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Text, TextInput } from '../shared/accessibility/primitives';

// Suppress the Expo/React Native DevTools client connection warnings
LogBox.ignoreLogs([
  'devtools client',
  'Failed to initialize devtools client',
]);

import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type EcoBudMobileModel,
} from './types/home';
import { ecoTheme, ThemeProvider, useTheme } from '../shared/theme/ecoTheme';
import { AuthView } from '../features/auth/AuthView';
import {
  BootView,
  LaunchBackdrop,
  OnboardingView,
  ChallengesView,
  TrackerView,
  ProfileView,
  OverlayRouter,
  BottomTabBar,
  ActionOverlayWrapper,
  MarketplaceView,
  CoachMarksOverlay,
  ChatbotFAB,
} from './components';
import { HomeView, LearnView } from './components/HomeLearnViews';
import { HOME_DASHBOARD_ROWS, type HomeDashboardSection } from './utils/homeDashboardRows';
import { createHomeAnimationVisibilityStore } from './utils/homeAnimationVisibility';
import { HomeAnimationVisibilityContext } from './components/HomeAnimationVisibility';
import { styles } from './styles/appStyles';
import { useHomeDashboard } from './hooks/useHomeDashboard';
import { ScreenTransition } from '../shared/ui/ScreenTransition';
import { InAppNotificationProvider } from '../shared/ui/InAppNotification';
import { UpdateRequiredGate } from '../shared/update/UpdateRequiredGate';

/**
 * EcoBud App - Main Shell
 * This is the root composition layer of the application.
 * Business logic is handled in hooks/useHomeDashboard.
 * Styling is modularized in styles/appStyles.
 * Components are extracted into the components/ directory.
 */
export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <AccessibilityProvider>
      <ThemeProvider>
        <UpdateRequiredGate>
          <InAppNotificationProvider>
            <AppWithModel />
          </InAppNotificationProvider>
        </UpdateRequiredGate>
      </ThemeProvider>
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}

function AppWithModel() {
  const model = useHomeDashboard();
  return <MobileShell model={model} />;
}

type ScrollAwareChatbotHandle = { setScrolling: (scrolling: boolean) => void };
const homeRowKey = (item: number) => String(item);
const ScrollAwareChatbot = React.memo(React.forwardRef<ScrollAwareChatbotHandle, React.ComponentProps<typeof ChatbotFAB>>(
  function ScrollAwareChatbot(props, ref) {
    const [scrolling, setScrolling] = useState(false);
    React.useImperativeHandle(ref, () => ({ setScrolling }), []);
    return <ChatbotFAB {...props} performanceMode={props.performanceMode === 'default' && scrolling ? 'quiet' : props.performanceMode} />;
  },
));

function MobileShell({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const homeBottomChromeHeight = (windowWidth < 380 ? 58 : 64) + (insets.bottom > 0 ? insets.bottom : windowWidth < 380 ? 10 : 14);
  const [homeAnimations] = useState(createHomeAnimationVisibilityStore);
  const homeScreenExposed = model.activeTab === 'home' && !model.activeOverlay && !model.coachMarksVisible && !model.actionOverlayVisible;
  React.useLayoutEffect(() => {
    const updateVisibility = () => homeAnimations.setScreenVisible(homeScreenExposed && AppState.currentState === 'active');
    updateVisibility();
    const subscription = AppState.addEventListener('change', state => homeAnimations.setScreenVisible(homeScreenExposed && state === 'active'));
    return () => { subscription.remove(); homeAnimations.setScreenVisible(false); };
  }, [homeAnimations, homeScreenExposed]);
  const scrollRef = React.useRef<FlatList<HomeDashboardSection>>(null);
  const scrollYRef = React.useRef(0);
  const pendingSearchY = React.useRef<number | null>(null);
  const [searchKeyboardHeight, setSearchKeyboardHeight] = useState(0);
  const chatbotRef = React.useRef<ScrollAwareChatbotHandle>(null);
  const [hideMarketplaceChrome, setHideMarketplaceChrome] = useState(false);
  const [onboardingAnimationPending, setOnboardingAnimationPending] = useState(false);
  const finishOnboardingAnimation = useCallback(() => setOnboardingAnimationPending(false), []);

  const handleCompleteOnboarding = useCallback(() => {
    setOnboardingAnimationPending(true);
    void model.completeOnboarding();
  }, [model.completeOnboarding]);

  const handleMarketplaceChromeChange = useCallback((hidden: boolean) => {
    setHideMarketplaceChrome(hidden);
  }, []);

  const handleChatbotPositionChange = useCallback((position: Parameters<typeof model.setChatbotPosition>[0]) => {
    void model.setChatbotPosition(position);
  }, [model.setChatbotPosition]);
  const handleOpenAssistant = useCallback(() => model.setActiveOverlay('assistant'), [model.setActiveOverlay]);
  const handleDisableChatbot = useCallback(() => void model.setChatbotEnabled(false), [model.setChatbotEnabled]);
  const renderHomeRow = useCallback(({ item }: { item: HomeDashboardSection }) => (
    <HomeAnimationVisibilityContext.Provider value={homeAnimations}>
      <HomeView model={model} section={item} />
    </HomeAnimationVisibilityContext.Provider>
  ), [model, homeAnimations]);
  const measureHomeViewport = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    homeAnimations.setViewport(insets.top + y, Math.max(0, height - homeBottomChromeHeight));
    const nativeScroll = scrollRef.current?.getNativeScrollRef();
    if (nativeScroll && 'measureInWindow' in nativeScroll) {
      nativeScroll.measureInWindow((_x, screenY, _width, screenHeight) => {
        homeAnimations.setViewport(screenY, Math.max(0, screenHeight - homeBottomChromeHeight));
      });
    }
  }, [homeAnimations, homeBottomChromeHeight, insets.top]);

  const handleSearchKeyboardChange = useCallback((keyboardHeight: number, searchScreenY?: number) => {
    setSearchKeyboardHeight(keyboardHeight);
    pendingSearchY.current = keyboardHeight > 0 && searchScreenY !== undefined
      ? Math.max(0, scrollYRef.current + searchScreenY - insets.top - 16)
      : null;
  }, [insets.top]);

  React.useEffect(() => {
    if (searchKeyboardHeight <= 0 || pendingSearchY.current === null) return;
    const frame = requestAnimationFrame(() => {
      if (pendingSearchY.current !== null) {
        scrollRef.current?.scrollToOffset({ offset: pendingSearchY.current, animated: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [searchKeyboardHeight]);

  React.useEffect(() => {
    scrollYRef.current = 0;
    homeAnimations.setOffset(0);
    chatbotRef.current?.setScrolling(false);
    pendingSearchY.current = null;
    setSearchKeyboardHeight(0);
    if (scrollRef.current) {
      scrollRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [model.activeTab, homeAnimations]);

  // Global Android Hardware & Gesture Back Button listener (Facebook-style tab history & overlay handling)
  React.useEffect(() => {
    const onHardwareBack = () => {
      // Only handle if user is authenticated and not currently in onboarding/booting
      if (!model.session || model.booting || model.initializing || !model.hasOnboarded) {
        return false;
      }
      return model.handleHardwareBackPress();
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => backSubscription.remove();
  }, [model]);

  let content: React.ReactNode;

  if (model.booting || onboardingAnimationPending) {
    content = <BootView onFinish={onboardingAnimationPending ? finishOnboardingAnimation : undefined} />;
  } else if (model.initializing) {
    content = <LaunchBackdrop />;
  } else if (!model.hasOnboarded) {
    content = <OnboardingView onComplete={handleCompleteOnboarding} />;
  } else if (!model.session) {
    content = (
      <AuthView
        authLoading={model.authLoading}
        authError={model.authError}
        onLogin={(email, pass) => model.handleLoginArgs(email, pass)}
        onVerifyMfa={model.handleVerifyMfaChallenge}
        onGoogleSignIn={() => model.handleGoogleSignIn()}
        onSignUp={(username, email, pass, city, otpCode) => void model.handleSignUpArgs(username, email, pass, city, otpCode)}
        onSendOTP={(email) => model.handleSendOTP(email)}
        onCheckUsernameAvailability={(displayName) => model.handleCheckUsernameAvailability(displayName)}
      />
    );
  } else {
    content = (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {model.activeTab === 'marketplace' ? (
          <ScreenTransition key="marketplace" enabled={!model.coachMarksReplay || !model.coachMarksVisible}>
            <MarketplaceView model={model} onHideChrome={handleMarketplaceChromeChange} />
          </ScreenTransition>
        ) : model.activeTab === 'learn' ? (
          <ScreenTransition key="learn" enabled={!model.coachMarksReplay || !model.coachMarksVisible}>
            <LearnView model={model} onSearchKeyboardChange={handleSearchKeyboardChange} keyboardHeight={searchKeyboardHeight} />
          </ScreenTransition>
        ) : model.activeTab === 'challenges' ? (
          <ScreenTransition key="challenges" enabled={!model.coachMarksReplay || !model.coachMarksVisible}>
            <ChallengesView model={model} onSearchKeyboardChange={handleSearchKeyboardChange} keyboardHeight={searchKeyboardHeight} />
          </ScreenTransition>
        ) : (
          <ScreenTransition key={model.activeTab} enabled={!model.coachMarksReplay || !model.coachMarksVisible}>
            <FlatList<HomeDashboardSection>
              ref={scrollRef}
              data={model.activeTab === 'home' ? HOME_DASHBOARD_ROWS : []}
              renderItem={model.activeTab === 'home' ? renderHomeRow : null}
              keyExtractor={homeRowKey}
              initialNumToRender={model.activeTab === 'home' ? 4 : 1}
              maxToRenderPerBatch={model.activeTab === 'home' ? 4 : 1}
              windowSize={model.activeTab === 'home' ? 5 : 3}
              updateCellsBatchingPeriod={50}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.mainScrollContent, { paddingBottom: (styles.mainScrollContent.paddingBottom as number) + insets.bottom }]}
              ListHeaderComponent={
                <>
              {model.activeTab === 'tracker' && <TrackerView model={model} />}
              {model.activeTab === 'profile' && <ProfileView model={model} />}
                </>
              }
              onContentSizeChange={() => {
                if (pendingSearchY.current === null) return;
                const targetY = pendingSearchY.current;
                pendingSearchY.current = null;
                scrollRef.current?.scrollToOffset({ offset: targetY, animated: true });
              }}
              onLayout={model.activeTab === 'home' ? measureHomeViewport : undefined}
              onScroll={(event) => {
                scrollYRef.current = event.nativeEvent.contentOffset.y;
                if (model.activeTab === 'home') homeAnimations.setOffset(scrollYRef.current);
              }}
              onScrollBeginDrag={() => { if (model.activeTab === 'home') chatbotRef.current?.setScrolling(true); }}
              onScrollEndDrag={() => { if (model.activeTab === 'home') chatbotRef.current?.setScrolling(false); }}
              onMomentumScrollBegin={() => { if (model.activeTab === 'home') chatbotRef.current?.setScrolling(true); }}
              onMomentumScrollEnd={() => { if (model.activeTab === 'home') chatbotRef.current?.setScrolling(false); }}
              scrollEventThrottle={64}
              removeClippedSubviews={Platform.OS === 'android'}
              refreshControl={
                <RefreshControl
                  refreshing={model.refreshing}
                  onRefresh={() => void model.refreshEverything()}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary, theme.colors.primaryLight]}
                />
              }
            />
          </ScreenTransition>
        )}
        {!(model.activeTab === 'marketplace' && hideMarketplaceChrome) && (
          <BottomTabBar activeTab={model.activeTab} onChange={model.setActiveTab} onTargetLayout={model.setClaimRewardTarget} />
        )}
      </SafeAreaView>
    );
  }

  const mascotVisible = Boolean(model.session && model.hasOnboarded && !model.booting && !model.initializing && !onboardingAnimationPending && model.isChatbotEnabled && !model.activeOverlay && !model.coachMarksVisible && !(model.activeTab === 'marketplace' && hideMarketplaceChrome));

  return (
    <View style={[styles.actionHost, { backgroundColor: theme.colors.background }]}>
      {content}
      <View pointerEvents={mascotVisible ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, { display: mascotVisible ? 'flex' : 'none' }]}>
        <HomeAnimationVisibilityContext.Provider value={model.activeTab === 'home' ? homeAnimations : null}>
          <ScrollAwareChatbot
            ref={chatbotRef}
            dock={model.chatbotDock}
            onDockChange={model.setChatbotDock}
            size={model.chatbotSize}
            position={model.chatbotPosition}
            performanceMode={!mascotVisible || model.activeTab === 'marketplace' || (model.activeTab === 'challenges' && model.challengesViewMode === 'History') ? 'reduced' : 'default'}
            onPositionChange={handleChatbotPositionChange}
            onPress={handleOpenAssistant}
            onLongPress={handleDisableChatbot}
          />
        </HomeAnimationVisibilityContext.Provider>
      </View>
      {model.activeOverlay && (
        <View style={StyleSheet.absoluteFill}>
          <ScreenTransition key={model.activeOverlay}>
            <OverlayRouter model={model} />
          </ScreenTransition>
        </View>
      )}
      <CoachMarksOverlay
        visible={Boolean(model.session && model.coachMarksVisible)}
        replay={model.coachMarksReplay}
        onFinish={model.completeCoachMarks}
        onSkip={model.completeCoachMarks}
        activeTab={model.activeTab}
        onTabChange={model.setActiveTab}
        onScrollTo={(y, animated = true) => {
          scrollRef.current?.scrollToOffset({ offset: y, animated });
        }}
        onScrollBy={(delta, animated = true) => {
          scrollRef.current?.scrollToOffset({ offset: Math.max(0, scrollYRef.current + delta), animated });
        }}
        model={model}
      />
      <ActionOverlayWrapper visible={model.actionOverlayVisible} label={model.actionOverlayLabel} />
    </View>
  );
}
