import React, { useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter, ScrollView, StyleSheet, View } from 'react-native';
import { Modal, Pressable, Text } from '../../shared/accessibility/primitives';
import { Animated } from '../../shared/accessibility/animations';
import { useTheme } from '../../shared/theme/ecoTheme';
import { swapService } from './swapService';
import type { ListingReportPage } from './types';

export function ListingReportsSection({ listingId }: { listingId: string }) {
  const { theme, isDark } = useTheme();
  const [data, setData] = useState<ListingReportPage | null>(null);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    let requestId = 0;
    async function load(background = false) {
      const id = ++requestId;
      if (!background) setLoading(true);
      try {
        const result = await swapService.fetchListingReports(listingId, page);
        if (alive && id === requestId) { setData(result); setError(''); }
      } catch (err) {
        if (alive && id === requestId) setError(err instanceof Error ? err.message : 'Could not load listing reports.');
      } finally { if (alive && id === requestId) setLoading(false); }
    }
    void load();
    const event = DeviceEventEmitter.addListener('giveAndGetListingsChanged', () => void load(true));
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void load(true); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(true); }, 15_000);
    return () => { alive = false; clearInterval(timer); event.remove(); foreground.remove(); };
  }, [listingId, page, retry]);
  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 240, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [visible, progress]);
  function close() {
    if (closing) return;
    setClosing(true);
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) { setVisible(false); setClosing(false); setPage(1); }
    });
  }
  function open() { setPage(1); setRetry(value => value + 1); setVisible(true); }
  const accent = isDark ? '#FDA4AF' : '#BE123C';
  if (!data && loading) return <Text style={{ color: theme.colors.textMuted, paddingVertical: 12 }}>Checking listing reports…</Text>;
  if (!data && error) return <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={{ paddingVertical: 12 }}><Text style={{ color: accent }}>Could not load reports. Tap to retry.</Text></Pressable>;
  if (!data?.activeCount && !visible) return null;
  return <>
    {!!data?.activeCount && <View style={[styles.notice, { backgroundColor: isDark ? '#32161F' : '#FFF1F2', borderColor: isDark ? '#881337' : '#FECDD3' }]}>
      <Text style={{ color: accent, fontWeight: '700' }}>Moderation Notice</Text>
      <Text style={{ color: theme.colors.textPrimary }}>{data.activeCount} active {data.activeCount === 1 ? 'report' : 'reports'} awaiting review.</Text>
      {error && <Text style={{ color: accent }}>Reports may be outdated. Open to retry.</Text>}
      <Pressable accessibilityRole="button" onPress={open} style={[styles.button, { borderColor: accent }]}><Text style={{ color: accent, fontWeight: '700' }}>View Reports</Text></Pressable>
    </View>}
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.overlay, { opacity: progress }]}>
        <Pressable accessibilityLabel="Close listing reports" onPress={close} style={StyleSheet.absoluteFill} />
        <Animated.View accessibilityViewIsModal style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary }}>Listing Reports</Text>
            <Pressable accessibilityRole="button" onPress={close} disabled={closing} style={styles.button}><Text style={{ color: theme.colors.textPrimary }}>Close</Text></Pressable>
          </View>
          <Text style={{ color: theme.colors.textSecondary }}>{data?.activeCount ?? 0} active reports · Awaiting moderator review</Text>
          <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 16 }}>
            {loading ? <Text style={{ color: theme.colors.textMuted }}>Loading reports…</Text> : error ? <View><Text accessibilityRole="alert" style={{ color: accent }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={styles.button}><Text style={{ color: theme.colors.textPrimary }}>Try again</Text></Pressable></View> : data?.items.length ? data.items.map(report => <View key={report.id} style={[styles.report, { borderColor: theme.colors.cardBorder }]}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Report Name: {report.reportName}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>Reason: {report.reason}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{new Date(report.createdAt).toLocaleString()}</Text>
              {report.occurrences > 1 && <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{report.occurrences} earlier reports recorded together.</Text>}
            </View>) : <Text style={{ color: theme.colors.textMuted }}>No active reports. Earlier reports were resolved.</Text>}
          </ScrollView>
          {(data?.pagination.totalPages ?? 0) > 1 && <View style={styles.header}>
            <Pressable accessibilityRole="button" disabled={loading || page <= 1 || closing} onPress={() => setPage(value => value - 1)} style={styles.button}><Text style={{ color: theme.colors.textPrimary, opacity: page <= 1 ? 0.4 : 1 }}>Previous</Text></Pressable>
            <Text style={{ color: theme.colors.textSecondary }}>Page {page} / {data?.pagination.totalPages}</Text>
            <Pressable accessibilityRole="button" disabled={loading || page >= (data?.pagination.totalPages ?? 1) || closing} onPress={() => setPage(value => value + 1)} style={styles.button}><Text style={{ color: theme.colors.textPrimary, opacity: page >= (data?.pagination.totalPages ?? 1) ? 0.4 : 1 }}>Next</Text></Pressable>
          </View>}
        </Animated.View>
      </Animated.View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8, marginTop: 16 },
  button: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 480, maxHeight: '85%', borderRadius: 20, borderWidth: 1, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  report: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
});
