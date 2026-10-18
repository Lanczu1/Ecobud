import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../shared/accessibility/primitives';
import { useScreenActive } from '../../shared/ui/ScreenActivity';
import { formatStreakTimeLeft, streakCountdownParts } from '../../shared/api/streakSummary';
import type { StreakStatusPalette } from './StreakStatusParts';

export function StreakCountdown({ remainingMs, expiresAt, colors }: { remainingMs: number; expiresAt?: string | null; colors: StreakStatusPalette }) {
  const [now, setNow] = React.useState(Date.now);
  const visible = useScreenActive();
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
  const { days, hours, minutes, seconds } = streakCountdownParts(left);
  return <View style={{ gap: 9 }}>
    <View style={styles.captionRow}>
      <Text style={[styles.caption, { color: colors.muted }]}>Time remaining</Text>
      <Text style={[styles.dayLabel, { color: colors.ink }]}>{days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} remaining` : 'Less than a day'}</Text>
    </View>
    <View accessible accessibilityLabel={`Streak expiry countdown: ${formatStreakTimeLeft(left)}`} style={styles.clock}>
      {([{ label: 'Hours', value: hours }, { label: 'Minutes', value: minutes }, { label: 'Seconds', value: seconds }]).map(unit => <View key={unit.label} style={[styles.unit, { backgroundColor: colors.inset }]}>
        <Text style={[styles.number, { color: colors.ink }]}>{String(unit.value).padStart(2, '0')}</Text>
        <Text style={[styles.caption, { color: colors.muted }]}>{unit.label}</Text>
      </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  caption: { fontSize: 11, lineHeight: 17 },
  dayLabel: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  clock: { flexDirection: 'row', gap: 8 },
  unit: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 3 },
  number: { fontSize: 30, fontWeight: '800', lineHeight: 38, fontVariant: ['tabular-nums'] },
});
