import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../shared/accessibility/primitives';
import type { EventSubmissionHistoryItem } from '../../shared/api/ecobudApi';
import { useTheme } from '../../shared/theme/ecoTheme';
import { formatLongDate } from '../utils/appUtils';
import { EventHistoryPhoto } from './EventHistoryPhoto';
import { EventPhotoDeleteRequest } from './EventPhotoDeleteRequest';

export function EventSubmissionHistoryCard({ item, token, onRequested }: {
  item: EventSubmissionHistoryItem;
  token?: string;
  onRequested: () => void;
}) {
  const { theme, isDark } = useTheme();
  const status = item.status === 'approved'
    ? { label: 'Approved', icon: 'checkmark-circle' as const, color: isDark ? '#A7E8B5' : '#126027', background: isDark ? '#163523' : '#EAF5ED' }
    : item.status === 'rejected'
      ? { label: 'Rejected', icon: 'close-circle' as const, color: isDark ? '#FCA5A5' : '#B91C1C', background: isDark ? '#3A1414' : '#FEF2F2' }
      : { label: 'Awaiting approval', icon: 'time' as const, color: isDark ? '#FDE68A' : '#92400E', background: isDark ? '#3D2C0C' : '#FFFBEB' };
  const submittedTime = new Date(item.submittedAt).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

  return <View style={[cardStyles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
    <View style={cardStyles.heading}>
      <View style={cardStyles.topLine}>
        <View style={cardStyles.identity}>
          <Ionicons name="leaf-outline" size={15} color={theme.colors.textSecondary} />
          <Text style={[cardStyles.eyebrow, { color: theme.colors.textSecondary }]}>Eco Event</Text>
        </View>
        <View style={[cardStyles.status, { backgroundColor: status.background }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[cardStyles.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <Text accessibilityRole="header" style={[cardStyles.title, { color: theme.colors.textPrimary }]}>{item.event.title}</Text>
    </View>

    <View style={[cardStyles.details, { backgroundColor: theme.colors.surfaceMuted }]}>
      <View style={cardStyles.detailRow}>
        <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} style={cardStyles.detailIcon} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[cardStyles.detailLabel, { color: theme.colors.textSecondary }]}>Submitted</Text>
          <Text style={[cardStyles.detailText, { color: theme.colors.textPrimary }]}>{formatLongDate(item.submittedAt)} · {submittedTime}</Text>
        </View>
      </View>
      {!!item.event.location && <View style={cardStyles.detailRow}>
        <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} style={cardStyles.detailIcon} />
        <Text style={[cardStyles.detailText, { flex: 1, color: theme.colors.textSecondary }]}>{item.event.location}</Text>
      </View>}
    </View>

    {item.status === 'rejected' && !!item.rejectionReason && <View style={[cardStyles.reviewNote, { borderColor: theme.colors.cardBorder }]}>
      <Text style={[cardStyles.detailLabel, { color: theme.colors.textPrimary, fontWeight: '600' }]}>Review note</Text>
      <Text style={[cardStyles.detailText, { color: theme.colors.textSecondary }]}>{item.rejectionReason}</Text>
    </View>}

    {item.deletionRequest?.status !== 'approved' && <EventHistoryPhoto key={item.attendanceImageUrl ?? 'missing-photo'} imageUrl={item.attendanceImageUrl} eventTitle={item.event.title} />}
    <View style={[cardStyles.footer, { borderColor: theme.colors.cardBorder }]}>
      <EventPhotoDeleteRequest item={item} token={token} onRequested={onRequested} />
    </View>
  </View>;
}

const cardStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 16, gap: 16 },
  heading: { gap: 12 },
  topLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 20, lineHeight: 27, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, flexShrink: 1 },
  statusLabel: { fontSize: 11, lineHeight: 15, fontWeight: '700', flexShrink: 1 },
  details: { padding: 12, borderRadius: 12, gap: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  detailIcon: { marginTop: 2 },
  detailLabel: { fontSize: 11, lineHeight: 16 },
  detailText: { fontSize: 13, lineHeight: 20 },
  reviewNote: { borderLeftWidth: 2, paddingLeft: 12, gap: 4 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
});
