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
import { ecoTheme } from '../../shared/theme/ecoTheme';
import type { SwapListing } from './types';
import { CATEGORY_LABELS, MEETUP_LABELS } from './types';

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
          <View style={localStyles.dialog} onStartShouldSetResponder={() => true}>
            <View style={localStyles.iconWrap}>
              <Ionicons name="swap-horizontal" size={28} color="#FFF" />
            </View>

            <Text style={localStyles.title}>Request Swap?</Text>
            <Text style={localStyles.subtitle}>
              Do you want to request this item swap?
            </Text>

            <View style={localStyles.previewCard}>
              <View style={localStyles.previewRow}>
                <Text style={localStyles.previewLabel}>Offering:</Text>
                <Text style={localStyles.previewValue}>
                  {listing.quantity} {listing.title}
                </Text>
              </View>
              <View style={localStyles.previewDivider} />
              <View style={localStyles.previewRow}>
                <Text style={localStyles.previewLabel}>Looking For:</Text>
                <Text style={localStyles.previewValue}>{listing.lookingFor}</Text>
              </View>
              <View style={localStyles.previewDivider} />
              <View style={localStyles.previewRow}>
                <Text style={localStyles.previewLabel}>Meetup:</Text>
                <Text style={localStyles.previewValue}>
                  {MEETUP_LABELS[listing.meetupMethod]}
                </Text>
              </View>
            </View>

            <Text style={localStyles.messageLabel}>Add a message (optional):</Text>
            <TextInput
              style={localStyles.messageInput}
              placeholder="Hi! I'm interested in swapping..."
              placeholderTextColor="#9CA3AF"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={localStyles.actions}>
              <TouchableOpacity
                onPress={onClose}
                style={localStyles.cancelBtn}
                disabled={sending}
              >
                <Text style={localStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                style={[localStyles.confirmBtn, sending && { opacity: 0.7 }]}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={localStyles.confirmBtnText}>Send Request</Text>
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
  if (!listing) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={localStyles.overlay}>
        <TouchableOpacity
          style={localStyles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={localStyles.dialog} onStartShouldSetResponder={() => true}>
            <View style={[localStyles.iconWrap, { backgroundColor: '#059669' }]}>
              <Ionicons name="checkmark-circle" size={32} color="#FFF" />
            </View>

            <Text style={localStyles.title}>Swap Accepted!</Text>
            <Text style={localStyles.subtitle}>
              Both users have agreed to the swap. You can now continue chatting to coordinate the exchange.
            </Text>

            {meetupMethod === 'public' && listing.meetupLocation && (
              <View style={localStyles.infoBox}>
                <Ionicons name="location" size={18} color={ecoTheme.colors.primaryDark} />
                <View style={{ flex: 1 }}>
                  <Text style={localStyles.infoBoxTitle}>Meetup Location</Text>
                  <Text style={localStyles.infoBoxText}>{listing.meetupLocation}</Text>
                  {listing.meetupLandmark && (
                    <Text style={localStyles.infoBoxSubtext}>Landmark: {listing.meetupLandmark}</Text>
                  )}
                </View>
              </View>
            )}

            {meetupMethod === 'pickup' && (
              <View style={localStyles.infoBox}>
                <Ionicons name="arrow-down" size={18} color="#2563EB" />
                <Text style={localStyles.infoBoxText}>
                  Pickup address has been shared in the chat.
                </Text>
              </View>
            )}

            {meetupMethod === 'dropoff' && (
              <View style={localStyles.infoBox}>
                <Ionicons name="arrow-up" size={18} color="#2563EB" />
                <Text style={localStyles.infoBoxText}>
                  Delivery address has been shared in the chat.
                </Text>
              </View>
            )}

            <View style={localStyles.actions}>
              <TouchableOpacity onPress={onClose} style={localStyles.cancelBtn}>
                <Text style={localStyles.cancelBtnText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onChat} style={localStyles.confirmBtn}>
                <Ionicons name="chatbubble" size={16} color="#FFF" />
                <Text style={localStyles.confirmBtnText}>Open Chat</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: ecoTheme.colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: ecoTheme.colors.textSoft,
    textAlign: 'center',
    marginBottom: 18,
  },
  previewCard: {
    width: '100%',
    backgroundColor: '#F7FBF8',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0EFE3',
    marginBottom: 16,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: ecoTheme.colors.text,
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#E0EFE3',
  },
  messageLabel: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '700',
    color: ecoTheme.colors.text,
    marginBottom: 6,
  },
  messageInput: {
    width: '100%',
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 14,
    color: ecoTheme.colors.text,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EEFBF2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D1F5DC',
    marginBottom: 16,
    width: '100%',
  },
  infoBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: ecoTheme.colors.primaryDark,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoBoxText: {
    fontSize: 13,
    lineHeight: 18,
    color: ecoTheme.colors.text,
  },
  infoBoxSubtext: {
    fontSize: 12,
    color: ecoTheme.colors.textSoft,
    marginTop: 2,
  },
});
