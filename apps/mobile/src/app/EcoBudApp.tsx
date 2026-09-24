import { StatusBar } from 'expo-status-bar';
import React, { useState, useCallback } from 'react';
import {
  BackHandler,
  RefreshControl,
  ScrollView,
  View,
  StyleSheet,
  LogBox,
  Text,
  TextInput,
} from 'react-native';

// Suppress the Expo/React Native DevTools client connection warnings
LogBox.ignoreLogs([
  'devtools client',
  'Failed to initialize devtools client',
]);

// Disable font scaling globally so the app doesn't break when phone screen zoom/font size is increased
// @ts-expect-error
Text.defaultProps = Text.defaultProps || {};
// @ts-expect-error
Text.defaultProps.allowFontScaling = false;
// @ts-expect-error
TextInput.defaultProps = TextInput.defaultProps || {};
// @ts-expect-error
TextInput.defaultProps.allowFontScaling = false;

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
      <ThemeProvider>
        <UpdateRequiredGate>
          <InAppNotificationProvider>
            <AppWithModel />
          </InAppNotificationProvider>
        </UpdateRequiredGate>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppWithModel() {
  const model = useHomeDashboard();
  return <MobileShell model={model} />;
}

function MobileShell({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef<ScrollView>(null);
  const scrollYRef = React.useRef(0);
  const pendingSearchY = React.useRef<number | null>(null);
  const [searchKeyboardHeight, setSearchKeyboardHeight] = useState(0);
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
        scrollRef.current?.scrollTo({ y: pendingSearchY.current, animated: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [searchKeyboardHeight]);

  React.useEffect(() => {
    scrollYRef.current = 0;
    pendingSearchY.current = null;
    setSearchKeyboardHeight(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [model.activeTab]);

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
            <ScrollView
              ref={scrollRef}
              onContentSizeChange={() => {
                if (pendingSearchY.current === null) return;
                const targetY = pendingSearchY.current;
                pendingSearchY.current = null;
                scrollRef.current?.scrollTo({ y: targetY, animated: true });
              }}
              onScroll={(event) => { scrollYRef.current = event.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshControl={
                <RefreshControl
                  refreshing={model.refreshing}
                  onRefresh={() => void model.refreshEverything()}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary, theme.colors.primaryLight]}
                />
              }
              contentContainerStyle={[styles.mainScrollContent, { paddingBottom: (styles.mainScrollContent.paddingBottom as number) + insets.bottom }]}
            >
              {model.activeTab === 'home' && <HomeView model={model} />}
              {model.activeTab === 'tracker' && <TrackerView model={model} />}
              {model.activeTab === 'profile' && <ProfileView model={model} />}
            </ScrollView>
          </ScreenTransition>
        )}
        {!(model.activeTab === 'marketplace' && hideMarketplaceChrome) && (
          <BottomTabBar activeTab={model.activeTab} onChange={model.setActiveTab} />
        )}
        {Boolean(
          model.isChatbotEnabled &&
          !model.activeOverlay &&
          !model.coachMarksVisible &&
          (model.activeTab === 'home' ||
            model.activeTab === 'learn' ||
            model.activeTab === 'challenges' ||
            (model.activeTab === 'marketplace' && !hideMarketplaceChrome))
        ) && (
          <ChatbotFAB
            size={model.chatbotSize}
            position={model.chatbotPosition}
            performanceMode={model.activeTab === 'marketplace' ? 'reduced' : 'default'}
            onPositionChange={(pos) => void model.setChatbotPosition(pos)}
            onPress={() => model.setActiveOverlay('assistant')}
            onLongPress={() => void model.setChatbotEnabled(false)}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.actionHost, { backgroundColor: theme.colors.background }]}>
      {content}
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
          scrollRef.current?.scrollTo({ y, animated });
        }}
        onScrollBy={(delta, animated = true) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, scrollYRef.current + delta), animated });
        }}
        model={model}
      />
      <ActionOverlayWrapper visible={model.actionOverlayVisible} label={model.actionOverlayLabel} />
    </View>
  );
}
