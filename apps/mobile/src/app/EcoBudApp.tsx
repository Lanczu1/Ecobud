import { StatusBar } from 'expo-status-bar';
import React, { useState, useCallback } from 'react';
import {
  Alert,
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

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  type EcoBudMobileModel,
} from './types/home';
import { ecoTheme } from '../shared/theme/ecoTheme';
import { AuthView } from '../features/auth/AuthView';
import {
  BootView,
  LaunchBackdrop,
  OnboardingView,
  ChallengesView,
  TrackerView,
  ProfileView,
  OverlayRouter,
  ChatbotFAB,
  BottomTabBar,
  ActionOverlayWrapper,
  MarketplaceView,
} from './components';
import { HomeView, LearnView } from './components/HomeLearnViews';
import { styles } from './styles/appStyles';
import { useHomeDashboard } from './hooks/useHomeDashboard';
import { ScreenTransition } from '../shared/ui/ScreenTransition';

/**
 * EcoBud App - Main Shell
 * This is the root composition layer of the application.
 * Business logic is handled in hooks/useHomeDashboard.
 * Styling is modularized in styles/appStyles.
 * Components are extracted into the components/ directory.
 */
export default function App() {
  const model = useHomeDashboard();

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <MobileShell model={model} />
    </SafeAreaProvider>
  );
}

function MobileShell({ model }: { model: EcoBudMobileModel }) {
  const scrollRef = React.useRef<ScrollView>(null);
  const [hideMarketplaceChrome, setHideMarketplaceChrome] = useState(false);

  const handleMarketplaceChromeChange = useCallback((hidden: boolean) => {
    setHideMarketplaceChrome(hidden);
  }, []);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [model.activeTab]);

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
        onGoogleSignIn={() => model.handleGoogleSignIn()}
        onSignUp={(username, email, pass, city, otpCode) => void model.handleSignUpArgs(username, email, pass, city, otpCode)}
        onSendOTP={(email) => model.handleSendOTP(email)}
        onCheckUsernameAvailability={(displayName) => model.handleCheckUsernameAvailability(displayName)}
      />
    );
  } else {
    content = (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        {model.activeTab === 'marketplace' ? (
          <ScreenTransition key="marketplace">
            <MarketplaceView model={model} onHideChrome={handleMarketplaceChromeChange} />
          </ScreenTransition>
        ) : (
          <ScreenTransition key={model.activeTab}>
            <ScrollView
              ref={scrollRef}
              refreshControl={
                <RefreshControl
                  refreshing={model.refreshing}
                  onRefresh={() => void model.refreshEverything()}
                  tintColor={ecoTheme.colors.primaryDark}
                  colors={[ecoTheme.colors.primaryDark, '#4ADE80']}
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
          </ScreenTransition>
        )}
        {!(model.activeTab === 'marketplace' && hideMarketplaceChrome) && (
          <>
            <ChatbotFAB onPress={() => model.setActiveOverlay('assistant')} />
            <BottomTabBar activeTab={model.activeTab} onChange={model.setActiveTab} />
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.actionHost}>
      {content}
      {model.activeOverlay && (
        <View style={StyleSheet.absoluteFill}>
          <ScreenTransition key={model.activeOverlay}>
            <OverlayRouter model={model} />
          </ScreenTransition>
        </View>
      )}
      <ActionOverlayWrapper visible={model.actionOverlayVisible} label={model.actionOverlayLabel} />
    </View>
  );
}
