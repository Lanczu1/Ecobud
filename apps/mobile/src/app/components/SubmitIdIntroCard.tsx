import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';

export function SubmitIdIntroCard() {
  const { theme, isDark } = useTheme();
  const green = isDark ? '#86DDB0' : '#126027';
  const surface = isDark ? '#1C362A' : '#EFF8F2';
  return <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
    <View style={styles.headerRow}>
      <View style={[styles.iconTile, { backgroundColor: surface }]} accessible={false}>
        <Ionicons name="card-outline" size={32} color={green} />
        <View style={[styles.shield, { backgroundColor: green, borderColor: theme.colors.card }]}>
          <Ionicons name="shield-checkmark-outline" size={14} color={isDark ? '#153322' : '#FFFFFF'} />
        </View>
      </View>
      <View style={[styles.tag, { backgroundColor: surface }]}>
        <Text style={{ color: green, fontSize: 12, fontWeight: '700' }}>Resident verification</Text>
      </View>
    </View>
    <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.textPrimary }]}>Submit your ID</Text>
    <Text style={[styles.description, { color: theme.colors.textMuted }]}>Get verified to join Challenges, Eco Events, and Give &amp; Get exchanges. Your barangay moderator will review your ID.</Text>
    <View style={[styles.prepare, { backgroundColor: surface }]}>
      <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>What you'll need</Text>
      <View style={styles.row}>
        <Ionicons name="person-outline" size={19} color={green} />
        <Text style={[styles.rowText, { color: theme.colors.textMuted }]}>Your full name as it appears on your ID.</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="camera-outline" size={19} color={green} />
        <Text style={[styles.rowText, { color: theme.colors.textMuted }]}>A clear photo of a government, school, or barangay ID showing your name and photo.</Text>
      </View>
    </View>
    <View style={styles.row}>
      <Ionicons name="lock-closed-outline" size={17} color={green} />
      <Text style={[styles.caption, { color: theme.colors.textMuted }]}>Your ID photo is private and only accessible to moderators assigned to your barangay.</Text>
    </View>
    <View style={[styles.footer, { borderTopColor: theme.colors.cardBorder }]}>
      <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>You can still explore</Text>
      <Text style={[styles.caption, { color: theme.colors.textMuted }]}>Browse Challenges, Eco Events, and Give &amp; Get. Learn videos, quizzes, and Learn rewards stay available.</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 22, borderWidth: 1, borderRadius: 24, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  iconTile: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  shield: { position: 'absolute', bottom: -3, right: -3, width: 28, height: 28, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  tag: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  description: { fontSize: 14, lineHeight: 22 },
  prepare: { borderRadius: 16, padding: 16, gap: 12 },
  heading: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowText: { flex: 1, fontSize: 13, lineHeight: 20 },
  caption: { flexShrink: 1, fontSize: 13, lineHeight: 20 },
  footer: { borderTopWidth: 1, paddingTop: 16, gap: 6 },
});
