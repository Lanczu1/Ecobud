import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { ecobudApi, type StreakSummary } from '../../shared/api/ecobudApi';
import type { EcoBudMobileModel } from '../types/home';

export function ChallengeStreakOverlay({ model }: { model: EcoBudMobileModel }) {
  const [summary, setSummary] = React.useState<StreakSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [restoring, setRestoring] = React.useState(false);
  const [error, setError] = React.useState('');
  const [focused, setFocused] = React.useState<string | null>(null);
  const token = model.session?.token;
  const close = () => model.setActiveOverlay(null);
  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!token) throw new Error('Sign in to view your challenge streak.');
      setSummary(await ecobudApi.fetchStreak(token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your streak.');
    } finally { setLoading(false); }
  }, [token]);
  React.useEffect(() => { void load(); }, [load]);

  const restore = async () => {
    if (!token || restoring) return;
    setRestoring(true);
    setError('');
    try {
      setSummary(await ecobudApi.restoreStreak(token));
      await model.refreshEverything();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to restore your streak. Try again.');
    } finally { setRestoring(false); }
  };
  const next = summary?.milestones.find(item => !item.awarded);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.panel} accessibilityViewIsModal>
          <View style={styles.heading}>
            <Text style={styles.title}>Challenge streak</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close streak rewards" onPress={close} onFocus={() => setFocused('close')} onBlur={() => setFocused(null)} style={[styles.close, focused === 'close' && styles.focus]}><Text style={styles.closeText}>Close</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {loading ? <ActivityIndicator color="#166534" accessibilityLabel="Loading streak rewards" /> : null}
            {error ? <View accessibilityRole="alert"><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} onFocus={() => setFocused('reload')} onBlur={() => setFocused(null)} style={[styles.secondary, focused === 'reload' && styles.focus]}><Text style={styles.buttonText}>Reload streak</Text></Pressable></View> : null}
            {summary && !loading ? <>
              <View style={styles.progress}>
                {summary.active ? <LottieView source={require('../../../assets/Fire.lottie')} autoPlay loop style={styles.flame} /> : <Image source={require('../../../assets/Unfire.png')} style={styles.flame} resizeMode="contain" />}
                <Text style={styles.count}>{summary.currentStreak}</Text>
                <Text style={styles.subtitle}>completed challenges</Text>
                <Text style={styles.status}>{summary.currentStreak === 0 ? 'Complete your first challenge to start.' : summary.active ? 'Your streak is active.' : 'Your streak is inactive. Your count is saved.'}</Text>
              </View>
              <Text style={styles.body}>Only completed challenges count. Learn activities and eco events do not add to this streak.</Text>
              <Text style={styles.section}>{next ? summary.currentStreak >= next.challenges ? 'Milestone bonus ready on your next completion' : `${next.challenges - summary.currentStreak} more to reach ${next.challenges} challenges` : 'All milestones earned'}</Text>
              {summary.milestones.map(item => <View key={item.challenges} style={styles.reward}>
                <View style={styles.rewardHeading}><Text style={styles.milestone}>{item.challenges} challenges</Text><Text style={styles.rewardStatus}>{item.awarded ? 'Awarded' : summary.currentStreak >= item.challenges ? 'On next completion' : 'Locked'}</Text></View>
                <Text style={styles.body}>{item.points.toLocaleString()} bonus points{item.ecoCoins > 0 ? ` + ${item.ecoCoins} eco coins` : ''}{item.badge ? ` + ${item.badge} badge` : ''}</Text>
              </View>)}
              <Text style={styles.body}>Rewards are added automatically once per milestone, on top of the challenge reward.</Text>
              <View style={styles.restore}>
                <Text style={styles.section}>Restore Streak</Text>
                <Text style={styles.body}>After 7 days without a completed challenge, the flame turns gray. Restore brings back its color for 7 days. It adds no challenges or rewards.</Text>
                <Text style={styles.status}>{summary.restoresRemaining} of 3 restores left this month</Text>
                {!summary.active && summary.currentStreak > 0 ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: !summary.canRestore || restoring, busy: restoring }} disabled={!summary.canRestore || restoring} onPress={() => void restore()} onFocus={() => setFocused('restore')} onBlur={() => setFocused(null)} style={[styles.button, (!summary.canRestore || restoring) && styles.disabled, focused === 'restore' && styles.focus]}><Text style={styles.buttonText}>{restoring ? 'Restoring…' : summary.canRestore ? 'Restore Streak' : 'No restores left this month'}</Text></Pressable> : null}
                <Text style={styles.body}>Completing a challenge also reactivates the flame. Restores reset each month in Philippine time.</Text>
              </View>
            </> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 460, maxHeight: '90%', backgroundColor: '#F7FCF8', borderRadius: 24, padding: 20 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 23, fontWeight: '800', color: '#14532D', flex: 1 },
  close: { minHeight: 44, minWidth: 44, justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', padding: 4 },
  focus: { borderWidth: 2, borderColor: '#C2410C' },
  closeText: { color: '#166534', fontWeight: '700' },
  content: { paddingBottom: 16, gap: 12 },
  progress: { alignItems: 'center', paddingVertical: 12 },
  flame: { width: 72, height: 72 },
  count: { fontSize: 48, fontWeight: '900', color: '#14532D' },
  subtitle: { fontSize: 16, color: '#334B3C' },
  status: { fontSize: 14, color: '#334B3C', marginTop: 8, fontWeight: '600' },
  body: { fontSize: 14, color: '#334B3C', lineHeight: 21 },
  section: { fontSize: 17, fontWeight: '700', color: '#14532D', marginTop: 8 },
  reward: { borderBottomWidth: 1, borderBottomColor: '#CADCCE', paddingVertical: 12, gap: 6 },
  rewardHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  milestone: { fontSize: 16, fontWeight: '700', color: '#14532D' },
  rewardStatus: { fontSize: 13, color: '#334B3C' },
  restore: { gap: 10, marginTop: 8 },
  button: { backgroundColor: '#166534', minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 12 },
  secondary: { backgroundColor: '#166534', minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { backgroundColor: '#52685A' },
  error: { color: '#991B1B', fontSize: 14, lineHeight: 21 },
});
