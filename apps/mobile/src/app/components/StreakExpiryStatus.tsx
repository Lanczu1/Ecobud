import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../shared/accessibility/primitives';
import type { StreakSummary } from '../../shared/api/ecobudApi';
import { streakExpiry } from '../../shared/api/streakSummary';
import { StreakExpiryWarning } from './StreakExpiryWarning';
import { StreakCountdown } from './StreakCountdown';
import { StreakStatusAction, StreakStatusHeader, streakStatusPalette, streakStatusStyles as styles } from './StreakStatusParts';

export function StreakExpiryStatus({ summary, expiry, dark, onViewChallenges, onRefresh }: {
  summary: StreakSummary | null | undefined;
  expiry: ReturnType<typeof streakExpiry>;
  dark: boolean;
  onViewChallenges: () => void;
  onRefresh?: () => void;
}) {
  if (!summary) return null;
  if (expiry.warning && expiry.remainingMs !== null) return <StreakExpiryWarning remainingMs={expiry.remainingMs} expiresAt={summary.expiresAt} dark={dark} onViewChallenges={onViewChallenges} />;
  const colors = streakStatusPalette(dark);
  const locked = summary.currentStreak < 1;
  const inactive = !locked && (!summary.active || expiry.expired);
  const missingExpiry = !locked && !inactive && expiry.remainingMs === null;
  const title = locked ? 'Light your first flame' : inactive ? 'Bring back your flame' : missingExpiry ? 'Sync your streak timer' : 'Your flame is active';
  const label = locked ? 'Streak timer not started' : inactive ? 'Streak paused' : 'Streak timer';
  const detail = locked ? 'Complete your first challenge and claim its reward to start your 7-day timer.'
    : inactive ? 'Complete a challenge and claim its reward, or use Restore in streak rewards. Your challenge count is safe.'
    : missingExpiry ? 'The expiry time is not available from the server yet. Refresh to check again.'
    : 'Each completed challenge reward refreshes your timer to 7 days.';
  const refresh = missingExpiry && onRefresh;
  return <View style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}>
    <StreakStatusHeader label={label} title={title} icon={locked ? 'lock-closed-outline' : inactive ? 'refresh-outline' : 'timer-outline'} colors={colors} />
    {locked ? <View style={{ gap: 9 }}>
      <View style={local.progressLabel}><Text style={[styles.body, { color: colors.ink, fontWeight: '700' }]}>{summary.currentStreak} of 1 completed</Text><Text style={[styles.note, { color: colors.muted }]}>Flame unlock</Text></View>
      <View accessibilityRole="progressbar" accessibilityLabel="Complete your first challenge to start the streak timer" accessibilityValue={{ min: 0, max: 1, now: summary.currentStreak }} style={local.progress}>
        <View style={[local.segment, { backgroundColor: colors.inset }]} />
      </View>
    </View> : null}
    {!locked && !inactive && expiry.remainingMs !== null ? <StreakCountdown remainingMs={expiry.remainingMs} expiresAt={summary.expiresAt} colors={colors} /> : null}
    <Text style={[styles.body, { color: colors.ink }]}>{detail}</Text>
    <StreakStatusAction label={refresh ? 'Refresh streak' : 'View challenges'} onPress={refresh || onViewChallenges} colors={colors} />
    {locked ? <Text style={[styles.note, { color: colors.muted }]}>No timer is running yet. Your progress stays saved.</Text> : null}
  </View>;
}

const local = StyleSheet.create({
  progressLabel: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  progress: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 7, borderRadius: 4 },
});
