import React from 'react';
import { View } from 'react-native';
import { Text } from '../../shared/accessibility/primitives';
import { StreakCountdown } from './StreakCountdown';
import { StreakStatusAction, StreakStatusHeader, streakStatusPalette, streakStatusStyles as styles } from './StreakStatusParts';

export function StreakExpiryWarning({ remainingMs, expiresAt, dark, onViewChallenges }: {
  remainingMs: number;
  expiresAt?: string | null;
  dark: boolean;
  onViewChallenges: () => void;
}) {
  const urgent = remainingMs <= 24 * 60 * 60 * 1000;
  const colors = streakStatusPalette(dark, urgent ? 'red' : 'yellow');
  return <View style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}>
    <StreakStatusHeader label={urgent ? 'Final 24 hours' : 'Expiry warning'} title="Keep your flame alive" icon={urgent ? 'alarm-outline' : 'timer-outline'} colors={colors} alert />
    <StreakCountdown remainingMs={remainingMs} expiresAt={expiresAt} colors={colors} />
    <Text style={[styles.body, { color: colors.ink }]}>Finish a challenge and claim its reward to refresh your 7-day timer.</Text>
    <StreakStatusAction onPress={onViewChallenges} colors={colors} />
    <Text style={[styles.note, { color: colors.muted }]}>Your completed challenge count stays saved.</Text>
  </View>;
}
