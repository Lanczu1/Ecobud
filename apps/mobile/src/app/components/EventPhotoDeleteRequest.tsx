import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal, Text, TextInput, TouchableOpacity } from '../../shared/accessibility/primitives';
import { ecobudApi, type EventSubmissionHistoryItem } from '../../shared/api/ecobudApi';
import { useTheme } from '../../shared/theme/ecoTheme';

export function EventPhotoDeleteRequest({ item, token, onRequested }: {
  item: EventSubmissionHistoryItem;
  token?: string;
  onRequested: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  if (item.deletionRequest?.status === 'approved') {
    return <Text style={{ color: theme.colors.textSecondary }}>Attendance photo removed after approval. Your history details are retained.</Text>;
  }
  if (item.deletionRequest?.status === 'pending' || sent) {
    return <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>Photo deletion requested</Text>
      <Text style={{ color: theme.colors.textSecondary }}>Waiting for admin or moderator approval.</Text>
      <Text style={{ color: theme.colors.textSecondary }}>Reason: {item.deletionRequest?.reason ?? reason.trim()}</Text>
    </View>;
  }
  if (!token || !item.attendanceImageUrl) return null;

  const close = () => { if (!submitting) setOpen(false); };
  const submit = async () => {
    if (submitting || reason.trim().length < 5) return;
    setSubmitting(true);
    setError(null);
    try {
      await ecobudApi.requestEventPhotoDeletion(token, item.id, reason.trim(), item.attendanceImageUrl!);
      setSent(true);
      setOpen(false);
      onRequested();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request. Please try again.');
    } finally { setSubmitting(false); }
  };

  return <>
    <TouchableOpacity accessibilityRole="button" onPress={() => { setError(null); setOpen(true); }} style={[requestStyles.button, { borderColor: theme.colors.cardBorder }]}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>Request photo deletion</Text>
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[requestStyles.backdrop, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={requestStyles.scroll}>
          <View accessibilityViewIsModal style={[requestStyles.card, { backgroundColor: theme.colors.card }]}>
            <Text accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Request photo deletion</Text>
            <Text style={{ color: theme.colors.textSecondary }}>{item.event.title}</Text>
            <Text style={{ color: theme.colors.textSecondary }}>Your photo stays visible until approved. Your history details, attendance, and rewards will be kept.</Text>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>Reason (required)</Text>
            <TextInput
              accessibilityLabel="Reason for deleting the attendance photo"
              multiline maxLength={500} editable={!submitting} value={reason} onChangeText={setReason}
              placeholder="Why would you like this photo removed?"
              placeholderTextColor={theme.colors.textSecondary}
              style={[requestStyles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.cardBorder }]}
            />
            <Text style={{ color: theme.colors.textSecondary }}>5 to 500 characters</Text>
            {error && <Text accessibilityRole="alert" style={{ color: theme.colors.textPrimary }}>{error}</Text>}
            <TouchableOpacity accessibilityRole="button" disabled={submitting || reason.trim().length < 5} onPress={() => void submit()} style={[requestStyles.button, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.cardBorder, opacity: submitting || reason.trim().length < 5 ? 0.5 : 1 }]}>
              {submitting && <ActivityIndicator color={theme.colors.primary} />}
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>{submitting ? 'Sending request...' : 'Send request'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={submitting} onPress={close} style={[requestStyles.button, { borderColor: theme.colors.cardBorder }]}>
              <Text style={{ color: theme.colors.textPrimary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const requestStyles = StyleSheet.create({
  button: { minHeight: 44, borderWidth: 1, borderRadius: 8, padding: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 520, padding: 20, borderRadius: 18, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top' },
});
