import React from 'react';
import { ActivityIndicator, Easing, Keyboard, Platform, ScrollView, StyleSheet, View, type KeyboardEvent, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Text, TextInput, TouchableOpacity } from '../../shared/accessibility/primitives';
import { ecobudApi, type EventSubmissionHistoryItem } from '../../shared/api/ecobudApi';
import { useTheme } from '../../shared/theme/ecoTheme';
import { useAccessibility } from '../../shared/accessibility/AccessibilityContext';
import { Animated } from '../../shared/accessibility/animations';

export function EventPhotoDeleteRequest({ item, token, onRequested }: {
  item: EventSubmissionHistoryItem;
  token?: string;
  onRequested: () => void;
}) {
  return <PhotoDeleteRequest title={item.event.title} photoUrl={item.attendanceImageUrl} deletionRequest={item.deletionRequest} onRequested={onRequested}
    sendRequest={token ? reason => ecobudApi.requestEventPhotoDeletion(token, item.id, reason, item.attendanceImageUrl!) : undefined} />;
}

export function ChallengePhotoDeleteRequest({ submissionId, proofUrl, afterProofUrl, title, deletionRequest, token, onRequested }: {
  submissionId: string;
  proofUrl?: string | null;
  afterProofUrl?: string | null;
  title: string;
  deletionRequest?: EventSubmissionHistoryItem['deletionRequest'];
  token?: string;
  onRequested: () => void;
}) {
  return <PhotoDeleteRequest multiple title={title} photoUrl={proofUrl || afterProofUrl} deletionRequest={deletionRequest} onRequested={onRequested}
    sendRequest={token ? reason => ecobudApi.requestChallengePhotosDeletion(token, submissionId, reason, { proofUrl: proofUrl ?? null, afterProofUrl: afterProofUrl ?? null }) : undefined} />;
}

function PhotoDeleteRequest({ title, photoUrl, deletionRequest, sendRequest, onRequested, multiple = false }: {
  title: string;
  photoUrl?: string | null;
  deletionRequest?: EventSubmissionHistoryItem['deletionRequest'];
  sendRequest?: (reason: string) => Promise<unknown>;
  onRequested: () => void;
  multiple?: boolean;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const { preferences } = useAccessibility();
  // The card only ever moves by a native-driven translate, so the keyboard never triggers a
  // layout pass mid-animation (the source of the old jump-then-correct glitch).
  const lift = React.useRef(new Animated.Value(0)).current;
  const layout = React.useRef({ screen: 0, fullScreen: 0, cardY: 0, cardHeight: 0 });
  const keyboardHeight = React.useRef(0);
  const topGap = Math.max(insets.top, 16);

  const moveAboveKeyboard = React.useCallback((height: number, duration: number) => {
    keyboardHeight.current = height;
    const { screen, fullScreen, cardY, cardHeight } = layout.current;
    // If the system already shrank the window for the keyboard, only the rest is still covered.
    const covered = Math.max(0, height - (fullScreen - screen));
    // Lift just enough to clear the keyboard, but never past the top of the screen.
    const overlap = covered > 0 && screen > 0 ? cardY + cardHeight + KEYBOARD_GAP - (screen - covered) : 0;
    const target = -Math.max(0, Math.min(overlap, cardY - topGap));
    lift.stopAnimation();
    if (preferences.performance || duration <= 0) { lift.setValue(target); return; }
    Animated.timing(lift, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [lift, preferences.performance, topGap]);

  React.useEffect(() => {
    if (!open) {
      keyboardHeight.current = 0;
      lift.stopAnimation();
      lift.setValue(0);
      return;
    }
    // iOS reports the keyboard before it moves, with its duration, so the card rides along with it.
    // Android only reports once the keyboard is up; by then onFocus has already started the lift
    // from the last known height, so this is a small correction rather than a jump.
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event: KeyboardEvent) => {
      lastKeyboardHeight = event.endCoordinates.height;
      moveAboveKeyboard(event.endCoordinates.height, Platform.OS === 'ios' ? event.duration || 250 : 160);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', (event: KeyboardEvent) => {
      moveAboveKeyboard(0, Platform.OS === 'ios' ? event.duration || 250 : 200);
    });
    return () => { show.remove(); hide.remove(); lift.stopAnimation(); };
  }, [open, lift, moveAboveKeyboard]);

  const onReasonFocus = () => {
    if (Platform.OS !== 'android' || keyboardHeight.current > 0) return;
    moveAboveKeyboard(lastKeyboardHeight || layout.current.fullScreen * 0.4, 250);
  };
  const onCardLayout = (event: LayoutChangeEvent) => {
    layout.current.cardY = event.nativeEvent.layout.y;
    layout.current.cardHeight = event.nativeEvent.layout.height;
    // An error line can grow the card while the keyboard is up; keep its buttons clear.
    if (keyboardHeight.current > 0) moveAboveKeyboard(keyboardHeight.current, 120);
  };
  if (deletionRequest?.status === 'approved') {
    return <View style={[requestStyles.statusRow, { backgroundColor: theme.colors.surfaceMuted }]}>
      <Ionicons name="image-outline" size={18} color={theme.colors.textSecondary} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{multiple ? 'Photos removed' : 'Photo removed'}</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Deletion approved. Your history details are retained.</Text>
      </View>
    </View>;
  }
  if (deletionRequest?.status === 'pending' || sent) {
    return <View accessibilityLiveRegion="polite" style={[requestStyles.statusRow, { backgroundColor: theme.colors.surfaceMuted }]}>
      <Ionicons name="time-outline" size={18} color={theme.colors.textSecondary} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{multiple ? 'Proof and after photo deletion requested' : 'Photo deletion requested'}</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Waiting for admin or moderator approval.</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Reason: {deletionRequest?.reason ?? reason.trim()}</Text>
      </View>
    </View>;
  }
  if (!sendRequest || !photoUrl) return null;

  const close = () => { if (!submitting) { Keyboard.dismiss(); setOpen(false); } };
  const submit = async () => {
    if (submitting || reason.trim().length < 5) return;
    setSubmitting(true);
    setError(null);
    try {
      await sendRequest(reason.trim());
      Keyboard.dismiss();
      setSent(true);
      setOpen(false);
      onRequested();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request. Please try again.');
    } finally { setSubmitting(false); }
  };

  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityHint={multiple ? 'Requests removal of both the proof and after photo' : 'Opens a form to request removal of this photo'} onPress={() => { setError(null); setOpen(true); }} style={requestStyles.requestAction}>
      <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
      <Text style={{ flexShrink: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>Request photo deletion</Text>
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View onLayout={event => {
        const height = event.nativeEvent.layout.height;
        layout.current.screen = height;
        layout.current.fullScreen = Math.max(layout.current.fullScreen, height);
      }} style={[requestStyles.backdrop, { paddingTop: topGap, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Animated.View onLayout={onCardLayout} accessibilityViewIsModal style={[requestStyles.card, { backgroundColor: theme.colors.card, transform: [{ translateY: lift }] }]}>
          <ScrollView
            style={requestStyles.formScroll}
            contentContainerStyle={requestStyles.formContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <Text accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Request photo deletion</Text>
            <Text style={{ color: theme.colors.textSecondary }}>{title}</Text>
            <Text style={{ color: theme.colors.textSecondary }}>{multiple ? 'This request removes both your proof photo and after photo when approved. Your history details and rewards will be kept.' : 'Your photo stays visible until approved. Your history details and rewards will be kept.'}</Text>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>Reason (required)</Text>
            <TextInput
              accessibilityLabel="Reason for deleting this photo"
              multiline maxLength={500} editable={!submitting} value={reason} onChangeText={setReason}
              onFocus={onReasonFocus}
              placeholder="Why would you like this photo removed?"
              placeholderTextColor={theme.colors.textSecondary}
              style={[requestStyles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.cardBorder }]}
            />
            <Text style={{ color: theme.colors.textSecondary }}>5 to 500 characters</Text>
            {error && <Text accessibilityRole="alert" style={{ color: theme.colors.textPrimary }}>{error}</Text>}
          </ScrollView>
          <View style={[requestStyles.actions, { borderColor: theme.colors.cardBorder }]}>
            <TouchableOpacity accessibilityRole="button" disabled={submitting || reason.trim().length < 5} onPress={() => void submit()} style={[requestStyles.button, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.cardBorder, opacity: submitting || reason.trim().length < 5 ? 0.5 : 1 }]}>
              {submitting && <ActivityIndicator color={theme.colors.primary} />}
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>{submitting ? 'Sending request...' : 'Send request'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={submitting} onPress={close} style={[requestStyles.button, { borderColor: theme.colors.cardBorder }]}>
              <Text style={{ color: theme.colors.textPrimary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  </>;
}

// Space kept between the card's bottom edge and the top of the keyboard.
const KEYBOARD_GAP = 12;
// Remembered across opens so Android can start lifting on focus, before the keyboard reports its size.
let lastKeyboardHeight = 0;

const requestStyles = StyleSheet.create({
  requestAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12, borderRadius: 12, backgroundColor: '#B91C1C' },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, marginTop: 8, borderRadius: 12, gap: 9 },
  button: { minHeight: 44, borderWidth: 1, borderRadius: 8, padding: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 520, maxHeight: '100%', flexShrink: 1, borderRadius: 18, overflow: 'hidden' },
  formScroll: { flexGrow: 0, flexShrink: 1 },
  formContent: { padding: 20, gap: 12 },
  actions: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top' },
});
