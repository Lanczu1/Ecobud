import React from 'react';
import { View } from 'react-native';
import { Text } from '../../shared/accessibility/primitives';
import type { StreakSummary } from '../../shared/api/ecobudApi';
import { streakExpiry } from '../../shared/api/streakSummary';
import { StreakExpiryWarning } from './StreakExpiryWarning';
import { StreakCountdown } from './StreakCountdown';
import { StreakStatusAction, streakStatusPalette, streakStatusStyles as styles } from './StreakStatusParts';

export function StreakExpiryStatus({ summary, expiry, dark, onRefresh }: {
  summary: StreakSummary | null | undefined;
  expiry: ReturnType<typeof streakExpiry>;
  dark: boolean;
  onViewChallenges: () => void;
  onRefresh?: () => void;
}) {
  if (!summary) return null;
  if (expiry.warning && expiry.remainingMs !== null) return <StreakExpiryWarning remainingMs={expiry.remainingMs} expiresAt={summary.expiresAt} dark={dark} />;
  const colors = streakStatusPalette(dark);
  const locked = summary.currentStreak < 1;
  const inactive = !locked && (!summary.active || expiry.expired);
  const missingExpiry = !locked && !inactive && expiry.remainingMs === null;
  const label = locked ? 'Timer not started' : inactive ? 'Streak expired' : missingExpiry ? 'Timer unavailable' : 'Streak timer';
  const refresh = missingExpiry && onRefresh;
  return <View style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}>
    <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
    {!locked && !inactive && expiry.remainingMs !== null ? <StreakCountdown remainingMs={expiry.remainingMs} expiresAt={summary.expiresAt} colors={colors} /> : null}
    {refresh ? <StreakStatusAction label="Refresh" onPress={refresh} colors={colors} /> : null}
  </View>;
}
