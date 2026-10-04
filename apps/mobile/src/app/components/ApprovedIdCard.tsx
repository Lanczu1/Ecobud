import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';

export function ApprovedIdCard({ onPress, status = 'approved', reason }: { onPress: () => void; status?: 'approved' | 'rejected'; reason?: string | null }) {
  const { theme, isDark } = useTheme();
  const rejected = status === 'rejected';
  const outline = rejected ? (isDark ? '#FCA5A5' : '#A32929') : (isDark ? '#63C995' : '#126027');
  const tint = rejected ? (isDark ? '#482828' : '#FBE9E7') : (isDark ? '#234B35' : '#E0F3D9');
  const cardColor = isDark ? theme.colors.card : rejected ? '#FFF8F7' : '#F4FCF6';
  return <View style={[localStyles.cardBase, { backgroundColor: rejected ? (isDark ? '#482828' : '#EBCBC7') : (isDark ? '#163C2A' : '#CFE7D7') }]}>
    <View style={[localStyles.card, { backgroundColor: cardColor, borderColor: outline }]}>
      <View style={localStyles.headingRow}>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[localStyles.seal, { backgroundColor: tint, borderColor: outline }]}>
          <Ionicons name="card-outline" size={36} color={outline} />
          <View style={[localStyles.checkStamp, { borderColor: cardColor, backgroundColor: rejected ? '#A32929' : '#15834F' }]}><Ionicons name={rejected ? 'close' : 'checkmark'} size={17} color="#FFFFFF" /></View>
        </View>
        <View style={localStyles.headingText}>
          <View style={[localStyles.verifiedTag, { backgroundColor: tint }]}><Ionicons name={rejected ? 'alert-circle-outline' : 'leaf'} size={11} color={outline} /><Text style={[localStyles.tagText, { color: outline }]}>{rejected ? 'RESUBMISSION REQUIRED' : 'VERIFIED RESIDENT'}</Text></View>
          <Text accessibilityRole="header" style={[localStyles.title, { color: theme.colors.textPrimary }]}>{rejected ? 'ID rejected' : 'ID approved'}</Text>
        </View>
      </View>
      <Text style={[localStyles.description, { color: theme.colors.textMuted }]}>{rejected ? 'Review your barangay’s note and resubmit your ID. ID approval is required to join Challenges and Eco Events, and create listings or requests. Learn remains available.' : "You're verified! You can now join Challenges and Eco Events, and create listings or requests in Give & Get."}</Text>
      {rejected ? <View style={[localStyles.note, { backgroundColor: tint, borderColor: outline }]}>
        <Text style={{ color: outline, fontSize: 13, fontWeight: '800' }}>Barangay’s note</Text>
        <Text style={[localStyles.description, { color: theme.colors.textPrimary }]}>{reason?.trim() || 'No reason was provided by your barangay.'}</Text>
      </View> : <View style={localStyles.features}>
        {([
          ['trophy-outline', 'Challenges'], ['calendar-outline', 'Eco Events'], ['swap-horizontal-outline', 'Give & Get'],
        ] as const).map(([icon, label]) => <View key={label} style={[localStyles.feature, { borderColor: isDark ? '#365C45' : '#C6DFCD', backgroundColor: isDark ? '#1C3627' : '#FFFFFF' }]}>
          <Ionicons name={icon} size={14} color={outline} /><Text style={[localStyles.featureText, { color: isDark ? '#CDEBD6' : '#285C39' }]}>{label}</Text>
        </View>)}
      </View>}
      <View style={[localStyles.buttonBase, { backgroundColor: isDark ? '#082919' : '#084620' }]}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={rejected ? 'Resubmit ID' : 'View ID verification'} style={[localStyles.button, { borderColor: isDark ? '#5CAB7B' : '#0B5127' }]}>
          <LinearGradient colors={['#126027', '#17A07E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={localStyles.buttonContent}>
            <Text style={localStyles.buttonText}>{rejected ? 'Resubmit ID' : 'View ID verification'}</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  </View>;
}

const localStyles = StyleSheet.create({
  cardBase: { borderRadius: 26, paddingBottom: 5 },
  card: { borderWidth: 2, borderRadius: 26, padding: 18, gap: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  seal: { width: 64, height: 64, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  checkStamp: { position: 'absolute', right: -5, bottom: -5, width: 28, height: 28, borderRadius: 14, borderWidth: 3, backgroundColor: '#15834F', alignItems: 'center', justifyContent: 'center' },
  headingText: { flex: 1, gap: 6 },
  verifiedTag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, flexWrap: 'wrap' },
  tagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, flexShrink: 1 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '800' },
  description: { fontSize: 13, lineHeight: 20 },
  note: { padding: 12, gap: 6, borderRadius: 12, borderWidth: 1 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  featureText: { fontSize: 10, fontWeight: '700', flexShrink: 1 },
  buttonBase: { borderRadius: 18, paddingBottom: 3, marginTop: 2 },
  button: { borderRadius: 18, borderWidth: 2, overflow: 'hidden' },
  buttonContent: { paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flexShrink: 1 },
});
