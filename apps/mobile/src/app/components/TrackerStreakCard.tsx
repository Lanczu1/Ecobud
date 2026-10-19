import React from 'react';
import { View } from 'react-native';
import { Text, Pressable } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';
import { useScreenActive } from '../../shared/ui/ScreenActivity';
import type { EcoBudMobileModel } from '../types/home';
import { useCurrentStreakSummary } from '../hooks/useCurrentStreakSummary';
import { useStreakExpiry } from '../hooks/useStreakExpiry';
import { savedStreakCount } from '../../shared/api/streakSummary';
import { moderateScale, verticalScale } from '../utils/responsive';
import { CoachMarkTarget } from './CoachMarkTarget';
import { SummaryCards } from './SummaryCards';
import { StreakExpiryStatus } from './StreakExpiryStatus';

export function TrackerStreakCard({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const screenActive = useScreenActive();
  const streak = useCurrentStreakSummary(model.session?.token, model.dashboard?.streakSummary, screenActive);
  const expiry = useStreakExpiry(streak.summary);
  React.useEffect(() => {
    if (streak.summary?.active && expiry.expired) streak.refresh();
  }, [streak.summary?.active, expiry.expired, streak.refresh]);
  return <>
    <CoachMarkTarget name="ecoStreak" borderRadius={moderateScale(24)} active={model.coachMarksVisible && model.coachMarksCurrentStep === 2} pollWhileActive={!model.coachMarksReplay} onMeasure={rect => model.setSpotlightTargetRect?.(rect)} style={{ marginBottom: verticalScale(14) }}>
      <SummaryCards
        currentStreak={streak.summary?.currentStreak ?? model.dashboard?.streak ?? model.tracker?.currentStreak ?? model.session?.user.currentStreak ?? 0}
        streakActive={expiry.active}
        savedStreak={savedStreakCount(streak.summary)}
        ecoPoints={model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0}
        onPressRewards={() => model.setActiveOverlay('streakRewards')}
        onOpenStreakOverlay={() => model.setActiveOverlay('streakUnlocked')}
        style={{ marginBottom: 0 }}
      />
    </CoachMarkTarget>
    {streak.loading && !streak.summary ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textSecondary, paddingVertical: 12 }}>Syncing streak expiry...</Text> : null}
    {streak.error ? <View style={{ gap: 8, paddingVertical: 12 }}><Text accessibilityRole="alert" style={{ color: theme.colors.textPrimary }}>{streak.error}</Text><Pressable accessibilityRole="button" onPress={streak.refresh} style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10 }}><Text style={{ color: theme.colors.textPrimary }}>Retry streak sync</Text></Pressable></View> : null}
    <StreakExpiryStatus summary={streak.summary} expiry={expiry} dark={isDark} onRefresh={streak.refresh} onViewChallenges={() => model.setActiveTab('challenges')} />
  </>;
}
