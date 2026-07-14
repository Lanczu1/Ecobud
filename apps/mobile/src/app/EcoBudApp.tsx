import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
  StyleSheet,
  LogBox,
} from 'react-native';

// Suppress the Expo/React Native DevTools client connection warnings
LogBox.ignoreLogs([
  'devtools client',
  'Failed to initialize devtools client',
]);
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  type EcoBudMobileModel,
} from './types/home';
import { ecoTheme } from '../shared/theme/ecoTheme';
import { AuthView } from '../features/auth/AuthView';
import {
  ReadOnlyExperienceView,
} from './ReadOnlyExperience';
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
} from './components';
import { HomeView, LearnView } from './components/HomeLearnViews';
import { styles } from './styles/appStyles';
import { useHomeDashboard } from './hooks/useHomeDashboard';

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
        onGoogleSignIn={() => console.log('Google Sign In')}
        onContinueAsGuest={() => void model.continueWithReadOnlyAccess()}
        onSignUp={(username, email, pass, otpCode) => void model.handleSignUpArgs(username, email, pass, otpCode)}
        onSendOTP={(email) => model.handleSendOTP(email)}
        onCheckUsernameAvailability={(displayName) => model.handleCheckUsernameAvailability(displayName)}
      />
    );
  } else {
    content = (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView
          ref={scrollRef}
          refreshControl={
            <RefreshControl
              refreshing={model.refreshing}
              onRefresh={() => void model.refreshEverything()}
              tintColor={ecoTheme.colors.primaryDark}
            />
          }
          contentContainerStyle={styles.mainScrollContent}
        >
          {model.isReadOnlyExperience ? (
            <ReadOnlyExperienceView
              activeTab={model.activeTab}
              notificationCount={model.notificationCount}
              featuredEvent={model.events[0] ?? null}
              transparencyMetrics={model.transparency?.metrics ?? null}
              onOpenEvents={() => model.setActiveOverlay('events')}
              onOpenTransparency={() => model.setActiveOverlay('transparency')}
              onExitReadOnlyExperience={() => void model.leaveReadOnlyAccess()}
            />
          ) : (
            <>
              {model.activeTab === 'home' && <HomeView model={model} />}
              {model.activeTab === 'learn' && <LearnView model={model} />}
              {model.activeTab === 'challenges' && <ChallengesView model={model} />}
              {model.activeTab === 'tracker' && <TrackerView model={model} />}
              {model.activeTab === 'profile' && <ProfileView model={model} />}
            </>
          )}
        </ScrollView>
        {!model.isReadOnlyExperience ? <ChatbotFAB onPress={() => model.setActiveOverlay('assistant')} /> : null}
        <BottomTabBar activeTab={model.activeTab} onChange={model.setActiveTab} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.actionHost}>
      {content}
      {model.activeOverlay && (
        <View style={StyleSheet.absoluteFill}>
          <OverlayRouter model={model} />
        </View>
      )}
      <ActionOverlayWrapper visible={model.actionOverlayVisible} label={model.actionOverlayLabel} />
    </View>
  );
}
