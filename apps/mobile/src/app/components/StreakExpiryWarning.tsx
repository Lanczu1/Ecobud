import React from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
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
  const breath = useBreathing(urgent);
  return <Animated.View style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }, breath]}>
    <Text accessibilityRole="alert" style={[styles.label, { color: colors.ink }]}>{urgent ? 'Final 24 hours' : 'Expires soon'}</Text>
    <StreakCountdown remainingMs={remainingMs} expiresAt={expiresAt} colors={colors} />
  </Animated.View>;
}

// A slow in-and-out pulse for the final day. Skipped when the user has reduce motion on.
function useBreathing(enabled: boolean) {
  const value = React.useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = React.useState(true);
  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(result => { if (mounted) setReduced(result); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  React.useEffect(() => {
    if (!enabled || reduced) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [enabled, reduced, value]);
  if (!enabled || reduced) return null;
  return {
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }],
  };
}
