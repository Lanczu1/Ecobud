import React from 'react';
import { View } from 'react-native';
import { Text } from '../../shared/accessibility/primitives';
import { StreakCountdown } from './StreakCountdown';
import { streakStatusPalette, streakStatusStyles as styles } from './StreakStatusParts';

export function StreakExpiryWarning({ remainingMs, expiresAt, dark }: {
  remainingMs: number;
  expiresAt?: string | null;
  dark: boolean;
}) {
  const urgent = remainingMs <= 24 * 60 * 60 * 1000;
  const colors = streakStatusPalette(dark, urgent ? 'red' : 'yellow');
  return <View style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}>
    <Text accessibilityRole="alert" style={[styles.label, { color: colors.ink }]}>{urgent ? 'Final 24 hours' : 'Expires soon'}</Text>
    <StreakCountdown remainingMs={remainingMs} expiresAt={expiresAt} colors={colors} />
  </View>;
}
