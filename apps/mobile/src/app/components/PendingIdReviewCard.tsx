import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';

export function PendingIdReviewCard({ loading, disabled, onRefresh }: {
  loading: boolean;
  disabled: boolean;
  onRefresh: () => void;
}) {
  const { theme, isDark } = useTheme();
  const green = isDark ? '#86DDB0' : '#126027';
  const mutedSurface = isDark ? '#1C362A' : '#EFF8F2';
  return <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
    <View style={styles.topRow}>
      <View style={[styles.iconTile, { backgroundColor: mutedSurface }]} accessible={false}>
        <Ionicons name="card-outline" size={32} color={green} />
        <View style={[styles.clock, { backgroundColor: isDark ? '#4A3515' : '#FFF0CE', borderColor: theme.colors.card }]}>
          <Ionicons name="time-outline" size={16} color={isDark ? '#FFD789' : '#976117'} />
        </View>
      </View>
      <View style={[styles.status, { backgroundColor: isDark ? '#4A3515' : '#FFF5DF' }]}>
        <View style={[styles.dot, { backgroundColor: isDark ? '#FFD789' : '#AC741A' }]} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FFD789' : '#976117' }}>Pending review</Text>
      </View>
    </View>
    <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.textPrimary }]}>Your ID is awaiting review</Text>
    <Text style={[styles.description, { color: theme.colors.textMuted }]}>Your ID has been submitted. Your barangay moderator will review it before you can join Challenges, Eco Events, and Give &amp; Get exchanges.</Text>

    <View style={[styles.reviewStatus, { backgroundColor: mutedSurface }]}>
      <View style={styles.row}>
        <Ionicons name="checkmark-circle" size={22} color={green} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.colors.textPrimary }]}>ID submitted</Text>
          <Text style={[styles.caption, { color: theme.colors.textMuted }]}>No need to upload it again.</Text>
        </View>
      </View>
      <View style={[styles.row, { marginTop: 16 }]}>
        <Ionicons name="notifications-outline" size={22} color={green} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.colors.textPrimary }]}>We'll let you know</Text>
          <Text style={[styles.caption, { color: theme.colors.textMuted }]}>You'll get an in-app and email notification after review.</Text>
        </View>
      </View>
    </View>

    <View style={styles.waitSection}>
      <Text style={[styles.rowTitle, { color: theme.colors.textPrimary }]}>While you wait</Text>
      <View style={styles.row}>
        <Ionicons name="play-circle-outline" size={19} color={green} />
        <Text style={[styles.caption, styles.rowText, { color: theme.colors.textMuted }]}>Watch Learn videos, take quizzes, and earn Learn rewards.</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="compass-outline" size={19} color={green} />
        <Text style={[styles.caption, styles.rowText, { color: theme.colors.textMuted }]}>Browse Challenges, Eco Events, and Give &amp; Get listings.</Text>
      </View>
    </View>

    <TouchableOpacity accessibilityRole="button" accessibilityLabel={loading ? 'Checking ID verification status' : 'Check ID verification status'} disabled={disabled || loading} onPress={onRefresh} activeOpacity={0.75} style={[styles.refresh, { borderColor: isDark ? '#365C45' : '#D3E8DA', backgroundColor: mutedSurface, opacity: disabled || loading ? 0.65 : 1 }]}>
      {loading ? <ActivityIndicator size="small" color={green} /> : <Ionicons name="refresh-outline" size={18} color={green} />}
      <Text style={{ color: green, fontWeight: '700', fontSize: 14 }}>{loading ? 'Checking status…' : 'Check verification status'}</Text>
    </TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  iconTile: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  clock: { position: 'absolute', bottom: -3, right: -3, width: 28, height: 28, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { height: 6, width: 6, borderRadius: 3 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  description: { fontSize: 14, lineHeight: 22 },
  reviewStatus: { borderRadius: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  caption: { fontSize: 13, lineHeight: 20 },
  waitSection: { gap: 10 },
  refresh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, minHeight: 48, padding: 12 },
});
