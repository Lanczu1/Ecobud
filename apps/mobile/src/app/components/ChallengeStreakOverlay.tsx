import React from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { Modal } from '../../shared/accessibility/primitives';
import { Pressable, Text } from '../../shared/accessibility/primitives';
import { ecobudApi, type StreakSummary } from '../../shared/api/ecobudApi';
import { isStreakFlameActive, isStreakSummary, parseStreakSummary } from '../../shared/api/streakSummary';
import { useTheme } from '../../shared/theme/ThemeContext';
import type { EcoBudMobileModel } from '../types/home';
import { StreakFlame } from './StreakFlame';

export function ChallengeStreakOverlay({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const colors = theme.colors;
  const cached = model.dashboard?.streakSummary;
  const [summary, setSummary] = React.useState<StreakSummary | null>(() => isStreakSummary(cached) ? cached : null);
  const [loading, setLoading] = React.useState(() => !isStreakSummary(cached));
  const [restoring, setRestoring] = React.useState(false);
  const [error, setError] = React.useState('');
  const [focused, setFocused] = React.useState<string | null>(null);
  const [shown, setShown] = React.useState(false);
  const [reduceMotion, setReduceMotion] = React.useState<boolean | null>(null);
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const panelEntrance = React.useRef(new Animated.Value(0)).current;
  const closing = React.useRef(false);
  const token = model.session?.token;
  React.useEffect(() => {
    let mounted = true;
    closing.current = false;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => { if (mounted) setReduceMotion(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
      closing.current = true;
      backdropOpacity.stopAnimation();
      panelEntrance.stopAnimation();
    };
  }, [backdropOpacity, panelEntrance]);
  React.useEffect(() => {
    if (!shown || reduceMotion === null || closing.current) return;
    const animation = Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: reduceMotion ? 120 : 220, useNativeDriver: true }),
      reduceMotion
        ? Animated.timing(panelEntrance, { toValue: 1, duration: 120, useNativeDriver: true })
        : Animated.spring(panelEntrance, { toValue: 1, damping: 24, stiffness: 220, mass: 0.9, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [shown, reduceMotion, backdropOpacity, panelEntrance]);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: reduceMotion ? 100 : 180, useNativeDriver: true }),
      Animated.timing(panelEntrance, { toValue: 0, duration: reduceMotion ? 100 : 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) model.setActiveOverlay(null); });
  };
  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!token) throw new Error('Sign in to view your challenge streak.');
      setSummary(parseStreakSummary(await ecobudApi.fetchStreak(token)));
    } catch (cause) {
      setSummary(null);
      setError(cause instanceof Error ? cause.message : 'Unable to load your streak.');
    } finally { setLoading(false); }
  }, [token]);
  React.useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        if (!token) throw new Error('Sign in to view your challenge streak.');
        const latest = parseStreakSummary(await ecobudApi.fetchStreak(token));
        if (mounted) setSummary(latest);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Unable to load your streak.');
      } finally { if (mounted) setLoading(false); }
    }
    void refresh();
    return () => { mounted = false; };
  }, [token]);

  const restore = async () => {
    if (!token || restoring) return;
    setRestoring(true);
    setError('');
    try {
      setSummary(parseStreakSummary(await ecobudApi.restoreStreak(token)));
      await model.refreshEverything();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to restore your streak. Try again.');
    } finally { setRestoring(false); }
  };
  const data = isStreakSummary(summary) ? summary : null;
  const next = data?.milestones.find(item => !item.awarded);
  const active = data ? isStreakFlameActive(data.currentStreak, data.active) : false;
  const building = (data?.currentStreak ?? 0) < 3;
  const target = next?.challenges ?? 100;
  const progress = Math.min(1, (data?.currentStreak ?? 0) / target);
  const accent = colors.primary;
  const buttonColors = { backgroundColor: isDark ? '#34D399' : '#166534' };
  const buttonTextColor = isDark ? '#0B110E' : '#FFFFFF';
  const focusStyle = (name: string) => focused === name ? { borderColor: isDark ? '#FBBF24' : '#C2410C' } : null;

  return (
    <Modal transparent animationType="none" visible onShow={() => setShown(true)} onRequestClose={close}>
      <View style={styles.backdrop}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: backdropOpacity }]} />
        <Animated.View style={[styles.panel, {
          backgroundColor: colors.card,
          opacity: panelEntrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: reduceMotion !== false ? [] : [
            { translateY: panelEntrance.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) },
            { scale: panelEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        }]} accessibilityViewIsModal>
          <View style={[styles.heading, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Challenge streak</Text>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>Rewards for completed challenges</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close streak rewards" onPress={close} onFocus={() => setFocused('close')} onBlur={() => setFocused(null)} style={[styles.close, { backgroundColor: colors.surfaceMuted }, focusStyle('close')]}><Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>Close</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? <View style={styles.loading}><ActivityIndicator color={accent} accessibilityLabel="Loading streak rewards" /><Text style={[styles.body, { color: colors.textSecondary }]}>Loading your progress…</Text></View> : null}
            {error ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={[styles.body, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} onFocus={() => setFocused('reload')} onBlur={() => setFocused(null)} style={[styles.button, buttonColors, focusStyle('reload')]}><Text style={[styles.buttonText, { color: buttonTextColor }]}>Reload streak</Text></Pressable></View> : null}
            {data && !loading ? <>
              <View style={[styles.hero, { backgroundColor: colors.surfaceMuted }]}>
                <View style={styles.heroTop}>
                  <StreakFlame count={data.currentStreak} active={data.active} size={88} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.count, { color: colors.textPrimary }]}>{data.currentStreak}</Text>
                    <Text style={[styles.countLabel, { color: colors.textSecondary }]}>challenges completed</Text>
                  </View>
                </View>
                <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{building ? 'A little effort lights the flame' : active ? 'Your streak is burning' : 'Your progress is safe'}</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>{building ? `${3 - data.currentStreak} more ${3 - data.currentStreak === 1 ? 'challenge' : 'challenges'} to ignite your streak.` : active ? 'Keep completing challenges to reach your next reward.' : 'The flame has cooled. Restore it or complete a challenge.'}</Text>
                <View style={styles.progressHeading}>
                  <Text style={[styles.captionStrong, { color: accent }]}>{next ? `Next reward: ${target} challenges` : 'All milestones earned'}</Text>
                  <Text style={[styles.caption, { color: colors.textSecondary }]}>{Math.min(data.currentStreak, target)} / {target}</Text>
                </View>
                <View accessibilityRole="progressbar" accessibilityLabel="Progress toward the next challenge milestone" accessibilityValue={{ min: 0, max: target, now: Math.min(data.currentStreak, target) }} style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: accent, borderRadius: 4 }} /></View>
              </View>

              <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Milestone rewards</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>Awarded automatically, once each</Text></View>
              {data.milestones.map(item => {
                const isNext = item.challenges === next?.challenges;
                return <View key={item.challenges} style={[styles.reward, { borderColor: isNext ? accent : colors.border, backgroundColor: isNext ? colors.cardAlt : colors.card }]}>
                  <View style={[styles.checkpoint, { backgroundColor: item.awarded ? accent : colors.surfaceMuted }]}><Text style={[styles.checkpointText, { color: item.awarded ? buttonTextColor : colors.textPrimary }]}>{item.awarded ? '✓' : item.challenges}</Text></View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={styles.rewardHeading}><Text style={[styles.milestone, { color: colors.textPrimary }]}>{item.challenges} challenges</Text><Text style={[styles.rewardStatus, { color: item.awarded || isNext ? accent : colors.textSecondary }]}>{item.awarded ? 'Earned' : isNext ? 'Up next' : 'Locked'}</Text></View>
                    <View style={styles.rewardAmounts}><Text style={[styles.body, { color: colors.textSecondary }]}>{item.points.toLocaleString()} points</Text>{item.ecoCoins > 0 ? <Text style={[styles.body, { color: colors.textSecondary }]}>+ {item.ecoCoins} eco coins</Text> : null}</View>
                    {item.badge ? <Text style={[styles.captionStrong, { color: accent }]}>{item.badge} badge</Text> : null}
                  </View>
                </View>;
              })}
              <Text style={[styles.note, { color: colors.textSecondary }]}>Only completed challenges count. Milestone bonuses are added on top of each challenge’s reward.</Text>

              <View style={[styles.restoreSection, { borderTopColor: colors.border }]}>
                <View style={styles.rewardHeading}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Keep the flame alive</Text><Text style={[styles.captionStrong, { color: accent }]}>{data.restoresRemaining} / 3 restores</Text></View>
                <Text style={[styles.body, { color: colors.textSecondary }]}>After 7 days without a challenge, the flame turns gray. Your count stays saved.</Text>
                {!building && !active ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: !data.canRestore || restoring, busy: restoring }} disabled={!data.canRestore || restoring} onPress={() => void restore()} onFocus={() => setFocused('restore')} onBlur={() => setFocused(null)} style={[styles.button, data.canRestore ? buttonColors : { backgroundColor: isDark ? '#A8B3AE' : '#52685A' }, focusStyle('restore')]}><Text style={[styles.buttonText, { color: buttonTextColor }]}>{restoring ? 'Restoring…' : data.canRestore ? 'Restore Streak' : 'No restores left this month'}</Text></Pressable> : null}
                <Text style={[styles.note, { color: colors.textSecondary }]}>{building ? 'Restore unlocks when you reach 3 challenges.' : 'Restore brings back the flame for 7 days. It adds no challenges or rewards.'} Your 3 restores reset each month.</Text>
              </View>
            </> : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 460, maxHeight: '90%', borderRadius: 24, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12, borderBottomWidth: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  close: { minHeight: 44, minWidth: 56, padding: 8, borderWidth: 2, borderColor: 'transparent', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 24, gap: 10 },
  hero: { padding: 18, borderRadius: 18, gap: 8, marginBottom: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  count: { fontSize: 48, fontWeight: '900', lineHeight: 54 },
  countLabel: { fontSize: 13, lineHeight: 18 },
  heroTitle: { fontSize: 18, fontWeight: '700', lineHeight: 25 },
  body: { fontSize: 14, lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 18 },
  captionStrong: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  progressHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, marginTop: 10 },
  progressTrack: { height: 7, width: '100%', borderRadius: 4, overflow: 'hidden' },
  sectionHeading: { gap: 2, marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  checkpoint: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  checkpointText: { fontSize: 14, fontWeight: '800' },
  rewardHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  milestone: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  rewardStatus: { fontSize: 12, fontWeight: '600', lineHeight: 20 },
  rewardAmounts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  note: { fontSize: 12, lineHeight: 19 },
  restoreSection: { borderTopWidth: 1, paddingTop: 18, marginTop: 10, gap: 10 },
  button: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 2, borderColor: 'transparent' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  loading: { minHeight: 160, gap: 12, alignItems: 'center', justifyContent: 'center' },
  errorBox: { gap: 12, paddingVertical: 12 },
});
