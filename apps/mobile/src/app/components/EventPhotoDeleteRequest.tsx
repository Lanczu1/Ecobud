import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Text, TextInput, TouchableOpacity } from '../../shared/accessibility/primitives';
import { ecobudApi, type EventSubmissionHistoryItem } from '../../shared/api/ecobudApi';
import { useTheme } from '../../shared/theme/ecoTheme';

export function EventPhotoDeleteRequest({ item, token, onRequested }: {
  item: EventSubmissionHistoryItem;
  token?: string;
  onRequested: () => void;
}) {
  return <PhotoDeleteRequest title={item.event.title} photoUrl={item.attendanceImageUrl} deletionRequest={item.deletionRequest} onRequested={onRequested}
    sendRequest={token ? reason => ecobudApi.requestEventPhotoDeletion(token, item.id, reason, item.attendanceImageUrl!) : undefined} />;
}

export function ChallengePhotoDeleteRequest({ submissionId, photoField, photoUrl, title, deletionRequest, token, onRequested }: {
  submissionId: string;
  photoField: 'proofUrl' | 'afterProofUrl';
  photoUrl?: string | null;
  title: string;
  deletionRequest?: EventSubmissionHistoryItem['deletionRequest'];
  token?: string;
  onRequested: () => void;
}) {
  return <PhotoDeleteRequest title={title} photoUrl={photoUrl} deletionRequest={deletionRequest} onRequested={onRequested}
    sendRequest={token ? reason => ecobudApi.requestChallengePhotoDeletion(token, submissionId, photoField, reason, photoUrl!) : undefined} />;
}

function PhotoDeleteRequest({ title, photoUrl, deletionRequest, sendRequest, onRequested }: {
  title: string;
  photoUrl?: string | null;
  deletionRequest?: EventSubmissionHistoryItem['deletionRequest'];
  sendRequest?: (reason: string) => Promise<unknown>;
  onRequested: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  if (deletionRequest?.status === 'approved') {
    return <View style={[requestStyles.statusRow, { backgroundColor: theme.colors.surfaceMuted }]}>
      <Ionicons name="image-outline" size={18} color={theme.colors.textSecondary} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>Photo removed</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Deletion approved. Your history details are retained.</Text>
      </View>
    </View>;
  }
  if (deletionRequest?.status === 'pending' || sent) {
    return <View accessibilityLiveRegion="polite" style={[requestStyles.statusRow, { backgroundColor: theme.colors.surfaceMuted }]}>
      <Ionicons name="time-outline" size={18} color={theme.colors.textSecondary} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>Photo deletion requested</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Waiting for admin or moderator approval.</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Reason: {deletionRequest?.reason ?? reason.trim()}</Text>
      </View>
    </View>;
  }
  if (!sendRequest || !photoUrl) return null;

  const close = () => { if (!submitting) setOpen(false); };
  const submit = async () => {
    if (submitting || reason.trim().length < 5) return;
    setSubmitting(true);
    setError(null);
    try {
      await sendRequest(reason.trim());
      setSent(true);
      setOpen(false);
      onRequested();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request. Please try again.');
    } finally { setSubmitting(false); }
  };

  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityHint="Opens a form to request removal of this photo" onPress={() => { setError(null); setOpen(true); }} style={requestStyles.requestAction}>
      <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
      <Text style={{ flexShrink: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>Request photo deletion</Text>
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[requestStyles.backdrop, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={requestStyles.scroll}>
          <View accessibilityViewIsModal style={[requestStyles.card, { backgroundColor: theme.colors.card }]}>
            <Text accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Request photo deletion</Text>
            <Text style={{ color: theme.colors.textSecondary }}>{title}</Text>
            <Text style={{ color: theme.colors.textSecondary }}>Your photo stays visible until approved. Your history details and rewards will be kept.</Text>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>Reason (required)</Text>
            <TextInput
              accessibilityLabel="Reason for deleting this photo"
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
  requestAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12, borderRadius: 12, backgroundColor: '#B91C1C' },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, marginTop: 8, borderRadius: 12, gap: 9 },
  button: { minHeight: 44, borderWidth: 1, borderRadius: 8, padding: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 520, padding: 20, borderRadius: 18, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top' },
});
