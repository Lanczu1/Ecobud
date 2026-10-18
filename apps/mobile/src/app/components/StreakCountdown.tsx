import React from 'react';
import { AccessibilityInfo, Easing, StyleSheet, View } from 'react-native';
import { Animated } from '../../shared/accessibility/animations';
import { Text } from '../../shared/accessibility/primitives';
import { useScreenActive } from '../../shared/ui/ScreenActivity';
import { formatStreakTimeLeft, streakCountdownParts } from '../../shared/api/streakSummary';
import type { StreakStatusPalette } from './StreakStatusParts';

export function StreakCountdown({ remainingMs, expiresAt, colors }: { remainingMs: number; expiresAt?: string | null; colors: StreakStatusPalette }) {
  const [now, setNow] = React.useState(Date.now);
  const visible = useScreenActive();
  const [reduceMotion, setReduceMotion] = React.useState<boolean | null>(null);
  const progress = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const deadline = React.useMemo(() => {
    const serverDeadline = expiresAt ? Date.parse(expiresAt) : NaN;
    return Number.isFinite(serverDeadline) ? serverDeadline : Date.now() + remainingMs;
  }, [expiresAt, remainingMs]);
  React.useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible, deadline]);
  const left = Math.max(0, deadline - now);
  const fraction = Math.max(0, Math.min(1, left / (7 * 24 * 60 * 60 * 1000)));
  React.useEffect(() => {
    if (!visible || reduceMotion !== false) {
      progress.setValue(fraction);
      return;
    }
    const animation = Animated.timing(progress, { toValue: fraction, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [fraction, visible, reduceMotion, progress]);
  const { days, hours, minutes, seconds } = streakCountdownParts(left);
  const clock = [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
  return <View style={styles.countdown}>
    <Text accessibilityLabel={`Streak expiry countdown: ${formatStreakTimeLeft(left)}`} style={[styles.clock, { color: colors.ink }]}>{days}d {clock}</Text>
    <View accessibilityRole="progressbar" accessibilityLabel="Time remaining in the 7-day streak timer" accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100), text: formatStreakTimeLeft(left) }} style={[styles.track, { backgroundColor: colors.inset }]}>
      <Animated.View style={[styles.fill, { backgroundColor: colors.accent, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  countdown: { flexGrow: 1, flexBasis: 130, gap: 4 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  clock: { fontSize: 16, fontWeight: '700', lineHeight: 22, fontVariant: ['tabular-nums'], textAlign: 'right' },
});
