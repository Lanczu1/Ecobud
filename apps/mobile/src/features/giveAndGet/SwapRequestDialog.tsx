import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ecoTheme, useTheme } from '../../shared/theme/ecoTheme';
import type { SwapListing } from './types';
import { CATEGORY_LABELS, MEETUP_LABELS } from './types';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';

export function SwapRequestDialog({
  visible,
  listing,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  listing: SwapListing | null;
  onClose: () => void;
  onConfirm: (message: string) => Promise<void>;
}) {
  const { theme, isDark } = useTheme();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!listing) return null;

  const handleConfirm = async () => {
    setSending(true);
    try {
      await onConfirm(message);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={localStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={localStyles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={[localStyles.dialog, { backgroundColor: theme.colors.card }]} onStartShouldSetResponder={() => true}>
            <View style={localStyles.iconWrap}>
              <Ionicons name="swap-horizontal" size={28} color="#FFF" />
            </View>

            <Text style={[localStyles.title, { color: theme.colors.textPrimary }]}>Request Swap?</Text>
            <Text style={[localStyles.subtitle, { color: theme.colors.textMuted }]}>
              Do you want to request this item swap?
            </Text>

            <View style={[localStyles.previewCard, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
              <View style={localStyles.previewRow}>
                <Text style={[localStyles.previewLabel, { color: theme.colors.textMuted }]}>Offering:</Text>
                <Text style={[localStyles.previewValue, { color: theme.colors.textPrimary }]}>
                  {listing.quantity} {listing.title}
                </Text>
              </View>
              <View style={[localStyles.previewDivider, { backgroundColor: theme.colors.border }]} />
              <View style={localStyles.previewRow}>
                <Text style={[localStyles.previewLabel, { color: theme.colors.textMuted }]}>Looking For:</Text>
                <Text style={[localStyles.previewValue, { color: theme.colors.textPrimary }]}>{listing.lookingFor}</Text>
              </View>
              <View style={[localStyles.previewDivider, { backgroundColor: theme.colors.border }]} />
              <View style={localStyles.previewRow}>
                <Text style={[localStyles.previewLabel, { color: theme.colors.textMuted }]}>Meetup:</Text>
                <Text style={[localStyles.previewValue, { color: theme.colors.textPrimary }]}>
                  {MEETUP_LABELS[listing.meetupMethod]}
                </Text>
              </View>
            </View>

            <Text style={[localStyles.messageLabel, { color: theme.colors.textPrimary }]}>Add a message (optional):</Text>
            <TextInput
              style={[localStyles.messageInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
              placeholder="Hi! I'm interested in swapping..."
              placeholderTextColor={theme.colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={localStyles.actions}>
              <TouchableOpacity
                onPress={onClose}
                style={[localStyles.cancelBtn, { borderColor: theme.colors.border }]}
                disabled={sending}
              >
                <Text style={[localStyles.cancelBtnText, { color: theme.colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                style={[localStyles.confirmBtn, isDark && { backgroundColor: theme.colors.primary }, sending && { opacity: 0.7 }]}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color={isDark ? '#0E1512' : '#FFF'} size="small" />
                ) : (
                  <Text style={[localStyles.confirmBtnText, isDark && { color: '#0E1512' }]}>Send Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SwapAcceptedDialog({
  visible,
  listing,
  meetupMethod,
  onClose,
  onChat,
}: {
  visible: boolean;
  listing: SwapListing | null;
  meetupMethod: string;
  onClose: () => void;
  onChat: () => void;
}) {
  const { theme, isDark } = useTheme();
  if (!listing) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={localStyles.overlay}>
        <TouchableOpacity
          style={localStyles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={[localStyles.dialog, { backgroundColor: theme.colors.card }]} onStartShouldSetResponder={() => true}>
            <View style={[localStyles.iconWrap, { backgroundColor: '#059669' }]}>
              <Ionicons name="checkmark-circle" size={32} color="#FFF" />
            </View>

            <Text style={[localStyles.title, { color: theme.colors.textPrimary }]}>Swap Accepted!</Text>
            <Text style={[localStyles.subtitle, { color: theme.colors.textMuted }]}>
              Both users have agreed to the swap. You can now continue chatting to coordinate the exchange.
            </Text>

            {meetupMethod === 'public' && listing.meetupLocation && (
              <View style={[localStyles.infoBox, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                <Ionicons name="location" size={18} color={isDark ? theme.colors.primary : ecoTheme.colors.primaryDark} />
                <View style={{ flex: 1 }}>
                  <Text style={[localStyles.infoBoxTitle, isDark && { color: theme.colors.primary }]}>Meetup Location</Text>
                  <Text style={[localStyles.infoBoxText, { color: theme.colors.textPrimary }]}>{listing.meetupLocation}</Text>
                  {listing.meetupLandmark && (
                    <Text style={[localStyles.infoBoxSubtext, { color: theme.colors.textMuted }]}>Landmark: {listing.meetupLandmark}</Text>
                  )}
                </View>
              </View>
            )}

            {meetupMethod === 'pickup' && (
              <View style={[localStyles.infoBox, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                <Ionicons name="arrow-down" size={18} color="#2563EB" />
                <Text style={[localStyles.infoBoxText, { color: theme.colors.textPrimary }]}>
                  Pickup address has been shared in the chat.
                </Text>
              </View>
            )}

            {meetupMethod === 'dropoff' && (
              <View style={[localStyles.infoBox, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                <Ionicons name="arrow-up" size={18} color="#2563EB" />
                <Text style={[localStyles.infoBoxText, { color: theme.colors.textPrimary }]}>
                  Delivery address has been shared in the chat.
                </Text>
              </View>
            )}

            <View style={localStyles.actions}>
              <TouchableOpacity onPress={onClose} style={[localStyles.cancelBtn, { borderColor: theme.colors.border }]}>
                <Text style={[localStyles.cancelBtnText, { color: theme.colors.textMuted }]}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onChat} style={[localStyles.confirmBtn, isDark && { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="chatbubble" size={16} color={isDark ? '#0E1512' : '#FFF'} />
                <Text style={[localStyles.confirmBtnText, isDark && { color: '#0E1512' }]}>Open Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  dialog: {
    width: '100%',
    maxWidth: scale(380),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(24),
    padding: moderateScale(20),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: verticalScale(10) },
    elevation: 10,
  },
  iconWrap: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(14),
  },
  title: {
    fontSize: responsiveFontSize(20),
    fontWeight: '900',
    color: ecoTheme.colors.text,
    marginBottom: verticalScale(4),
    textAlign: 'center',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: responsiveFontSize(13),
    lineHeight: responsiveFontSize(19),
    color: ecoTheme.colors.textSoft,
    textAlign: 'center',
    marginBottom: verticalScale(16),
    flexShrink: 1,
  },
  previewCard: {
    width: '100%',
    backgroundColor: '#F7FBF8',
    borderRadius: moderateScale(16),
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: '#E0EFE3',
    marginBottom: verticalScale(14),
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(5),
  },
  previewLabel: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  previewValue: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: ecoTheme.colors.text,
    flex: 1,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: scale(10),
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#E0EFE3',
  },
  messageLabel: {
    alignSelf: 'flex-start',
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: ecoTheme.colors.text,
    marginBottom: verticalScale(6),
  },
  messageInput: {
    width: '100%',
    minHeight: verticalScale(68),
    borderRadius: moderateScale(14),
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    paddingHorizontal: scale(12),
    paddingTop: verticalScale(10),
    fontSize: responsiveFontSize(13),
    color: ecoTheme.colors.text,
    marginBottom: verticalScale(16),
  },
  actions: {
    flexDirection: 'row',
    gap: scale(10),
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    minHeight: verticalScale(46),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
  },
  confirmBtn: {
    flex: 1,
    minHeight: verticalScale(46),
    flexDirection: 'row',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(14),
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
  },
  confirmBtnText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoBox: {
    flexDirection: 'row',
    gap: scale(10),
    backgroundColor: '#EEFBF2',
    borderRadius: moderateScale(14),
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: '#D1F5DC',
    marginBottom: verticalScale(14),
    width: '100%',
  },
  infoBoxTitle: {
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    color: ecoTheme.colors.primaryDark,
    textTransform: 'uppercase',
    marginBottom: verticalScale(2),
  },
  infoBoxText: {
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(17),
    color: ecoTheme.colors.text,
    flexShrink: 1,
  },
  infoBoxSubtext: {
    fontSize: responsiveFontSize(11),
    color: ecoTheme.colors.textSoft,
    marginTop: verticalScale(2),
    flexShrink: 1,
  },
});
