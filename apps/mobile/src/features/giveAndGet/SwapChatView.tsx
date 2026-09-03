import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { ecoTheme, useTheme } from '../../shared/theme/ecoTheme';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { swapService } from './swapService';
import { PublicProfileModal } from './PublicProfileModal';
import type { SwapChatMessage, SwapConversation, SwapRequestStatus } from './types';
import { MEETUP_LABELS } from './types';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';
import { resolveMediaUrl } from '../../app/utils/appUtils';

function getValidImageUrl(url: string | null | undefined): string | undefined {
  return resolveMediaUrl(url, ecobudApiOrigin) || undefined;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getStatusColor(status: SwapRequestStatus): string {
  switch (status) {
    case 'pending': return '#D97706';
    case 'accepted': return '#059669';
    case 'declined': return '#DC2626';
    case 'completed': return '#2563EB';
    case 'cancelled': return '#6B7A75';
    default: return '#6B7A75';
  }
}

function getStatusLabel(status: SwapRequestStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'accepted': return 'Accepted';
    case 'declined': return 'Declined';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

export function SwapChatList({
  conversations,
  currentUserId,
  onSelectConversation,
}: {
  conversations: SwapConversation[];
  currentUserId: string;
  onSelectConversation: (conversation: SwapConversation) => void;
}) {
  const { theme, isDark } = useTheme();
  if (conversations.length === 0) {
    return (
      <View style={localStyles.emptyState}>
        <Ionicons name="chatbubbles-outline" size={56} color={isDark ? theme.colors.primary : "#A7D5BA"} />
        <Text style={[localStyles.emptyTitle, { color: theme.colors.textPrimary }]}>No conversations yet</Text>
        <Text style={[localStyles.emptySubtitle, { color: theme.colors.textMuted }]}>
          Start a swap request to begin chatting with other users.
        </Text>
      </View>
    );
  }

  return (
    <View style={localStyles.chatList}>
      {conversations.map((conv) => (
        <TouchableOpacity
          key={conv.id}
          onPress={() => onSelectConversation(conv)}
          style={[localStyles.chatItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}
        >
          <View style={localStyles.chatAvatar}>
            {conv.otherUser.avatarUrl ? (
              <Image
                source={{ uri: getValidImageUrl(conv.otherUser.avatarUrl) }}
                style={localStyles.chatAvatarImage}
              />
            ) : (
              <Text style={localStyles.chatAvatarText}>
                {getInitials(conv.otherUser.displayName)}
              </Text>
            )}
            {conv.unreadCount > 0 && <View style={localStyles.unreadDot} />}
          </View>

          <View style={localStyles.chatContent}>
            <View style={localStyles.chatHeader}>
              <Text style={[localStyles.chatName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                {conv.otherUser.displayName}
              </Text>
              {conv.lastMessage && (
                <Text style={[localStyles.chatTime, { color: theme.colors.textMuted }]}>
                  {formatMessageTime(conv.lastMessage.timestamp)}
                </Text>
              )}
            </View>
            <Text style={[localStyles.chatPreview, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {conv.listing.title} → {conv.listing.lookingFor}
            </Text>
            <View style={localStyles.chatStatusRow}>
              <View style={[localStyles.statusBadge, { backgroundColor: getStatusColor(conv.status) + '20' }]}>
                <Text style={[localStyles.statusBadgeText, { color: getStatusColor(conv.status) }]}>
                  {getStatusLabel(conv.status)}
                </Text>
              </View>
              <Text style={[localStyles.meetupType, { color: theme.colors.textMuted }]}>
                {MEETUP_LABELS[conv.meetupMethod]}
              </Text>
            </View>
          </View>

          {conv.unreadCount > 0 && (
            <View style={localStyles.unreadBadge}>
              <Text style={localStyles.unreadText}>{conv.unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function SwapChatView({
  conversation,
  currentUserId,
  onBack,
  onAcceptSwap,
  onDeclineSwap,
  onMarkCompleted,
}: {
  conversation: SwapConversation;
  currentUserId: string;
  onBack: () => void;
  onAcceptSwap: () => void;
  onDeclineSwap: () => void;
  onMarkCompleted: () => void;
}) {
  const { theme, isDark } = useTheme();
  const [messages, setMessages] = useState<SwapChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = useCallback(async () => {
    try {
      const msgs = await swapService.fetchMessages(conversation.id);
      setMessages(msgs);
      await swapService.markMessagesRead(conversation.id, currentUserId);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversation.id, currentUserId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadMessages();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');
    setSending(true);

    const optimisticMsg: SwapChatMessage = {
      id: `temp_${Date.now()}`,
      swapRequestId: conversation.id,
      senderId: currentUserId,
      text,
      timestamp: new Date().toISOString(),
      read: false,
      delivered: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const realMsg = await swapService.sendMessage(
        conversation.id,
        currentUserId,
        text
      );
      setMessages((prev) => prev.map((m) => (m.id === optimisticMsg.id ? realMsg : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const isOwner = conversation.listing.user.id === currentUserId;
  const status = conversation.status;

  return (
    <SafeAreaView style={[localStyles.safeArea, { backgroundColor: isDark ? theme.colors.background : ecoTheme.colors.primaryDark }]}>
      <View style={[localStyles.header, isDark && { backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={localStyles.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={localStyles.headerInfo}>
          <Text style={localStyles.headerName} numberOfLines={1}>
            {conversation.otherUser.displayName}
          </Text>
          <Text style={localStyles.headerStatus}>
            {getStatusLabel(status)}
          </Text>
        </View>
        <TouchableOpacity style={localStyles.headerAvatar} onPress={() => setShowProfileModal(true)}>
          {conversation.otherUser.avatarUrl ? (
            <Image
              source={{ uri: getValidImageUrl(conversation.otherUser.avatarUrl) }}
              style={localStyles.headerAvatarImage}
            />
          ) : (
            <Text style={localStyles.headerAvatarText}>
              {getInitials(conversation.otherUser.displayName)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={[localStyles.swapInfoBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <View style={localStyles.swapInfoItem}>
          <Text style={[localStyles.swapInfoLabel, { color: theme.colors.textMuted }]}>Offering</Text>
          <Text style={[localStyles.swapInfoValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {conversation.listing.quantity} {conversation.listing.title}
          </Text>
        </View>
        <View style={[localStyles.swapInfoDivider, { backgroundColor: theme.colors.border }]} />
        <View style={localStyles.swapInfoItem}>
          <Text style={[localStyles.swapInfoLabel, { color: theme.colors.textMuted }]}>Looking For</Text>
          <Text style={[localStyles.swapInfoValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {conversation.listing.lookingFor}
          </Text>
        </View>
      </View>

      {status === 'pending' && isOwner && (
        <View style={localStyles.actionBar}>
          <TouchableOpacity onPress={onDeclineSwap} style={localStyles.declineBtn}>
            <Text style={localStyles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onAcceptSwap} style={localStyles.acceptBtn}>
            <Text style={localStyles.acceptBtnText}>
              {conversation.listing.lookingFor?.toLowerCase() === 'giveaway' ? 'Accept' : 'Accept Swap'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'accepted' && (
        <View style={localStyles.actionBar}>
          <TouchableOpacity onPress={onMarkCompleted} style={localStyles.completeBtn}>
            <Ionicons name="checkmark-circle" size={16} color="#FFF" />
            <Text style={localStyles.completeBtnText}>Mark as Completed</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={[localStyles.loadingWrap, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={[localStyles.messagesScroll, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={[localStyles.messagesContent, { backgroundColor: theme.colors.background }]}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <View
                key={msg.id}
                style={[
                  localStyles.messageBubble,
                  isMine
                    ? [localStyles.messageBubbleMine, isDark && { backgroundColor: theme.colors.primary }]
                    : [localStyles.messageBubbleTheirs, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }],
                ]}
              >
                {msg.imageUrl && (
                  <Image source={{ uri: msg.imageUrl }} style={localStyles.messageImage} />
                )}
                <Text style={[localStyles.messageText, isMine ? [localStyles.messageTextMine, isDark && { color: '#0E1512' }] : { color: theme.colors.textPrimary }]}>
                  {msg.text}
                </Text>
                <View style={localStyles.messageFooter}>
                  <Text style={[localStyles.messageTime, isMine ? [localStyles.messageTimeMine, isDark && { color: 'rgba(14,21,18,0.7)' }] : { color: theme.colors.textMuted }]}>
                    {formatMessageTime(msg.timestamp)}
                  </Text>
                  {isMine && (
                    <Ionicons
                      name={msg.read ? 'checkmark-done' : 'checkmark'}
                      size={14}
                      color={isDark ? '#064E3B' : (msg.read ? '#4ADE80' : '#9CA3AF')}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {status !== 'completed' && status !== 'cancelled' && status !== 'declined' && (
        <View style={[localStyles.inputBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
          <TextInput
            style={[localStyles.chatInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[localStyles.sendBtn, isDark && { backgroundColor: theme.colors.primary }, (!inputText.trim() || sending) && { opacity: 0.5 }]}
          >
            <Ionicons name="send" size={18} color={isDark ? '#0E1512' : '#FFF'} />
          </TouchableOpacity>
        </View>
      )}

      <PublicProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={conversation.otherUser}
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ecoTheme.colors.primaryDark,
  },
  container: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    backgroundColor: ecoTheme.colors.primaryDark,
  },
  backBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: responsiveFontSize(15),
    fontWeight: '800',
    color: '#FFF',
    flexShrink: 1,
  },
  headerStatus: {
    fontSize: responsiveFontSize(11),
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  headerAvatar: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: scale(36),
    height: scale(36),
  },
  headerAvatarText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#FFF',
  },
  swapInfoBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F2',
  },
  swapInfoItem: {
    flex: 1,
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
  },
  swapInfoLabel: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: ecoTheme.colors.textSoft,
    marginBottom: 2,
  },
  swapInfoValue: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
    color: ecoTheme.colors.text,
    flexShrink: 1,
  },
  swapInfoDivider: {
    width: 1,
    backgroundColor: '#F0F5F2',
  },
  actionBar: {
    flexDirection: 'row',
    gap: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F2',
  },
  declineBtn: {
    flex: 1,
    minHeight: verticalScale(38),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: '#DC2626',
  },
  acceptBtn: {
    flex: 1,
    minHeight: verticalScale(38),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(12),
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: '#FFF',
  },
  completeBtn: {
    flex: 1,
    minHeight: verticalScale(38),
    flexDirection: 'row',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(12),
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
  },
  completeBtnText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: '#FFF',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: scale(14),
    paddingBottom: verticalScale(8),
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: ecoTheme.colors.primaryDark,
    borderBottomRightRadius: 4,
  },
  messageBubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E4F0E8',
  },
  messageImage: {
    width: scale(180),
    height: verticalScale(135),
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(6),
  },
  messageText: {
    fontSize: responsiveFontSize(14),
    lineHeight: responsiveFontSize(20),
    color: ecoTheme.colors.text,
  },
  messageTextMine: {
    color: '#FFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: verticalScale(4),
  },
  messageTime: {
    fontSize: responsiveFontSize(10),
    color: ecoTheme.colors.textSoft,
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    paddingBottom: verticalScale(12),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F5F2',
  },
  chatInput: {
    flex: 1,
    minHeight: verticalScale(40),
    maxHeight: verticalScale(90),
    borderRadius: moderateScale(20),
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(8),
    fontSize: responsiveFontSize(14),
    color: ecoTheme.colors.text,
  },
  sendBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatList: {
    padding: scale(14),
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: moderateScale(12),
    marginBottom: verticalScale(10),
    borderWidth: 1,
    borderColor: '#E4F0E8',
    shadowColor: ecoTheme.colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  chatAvatar: {
    position: 'relative',
  },
  chatAvatarImage: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
  },
  chatAvatarText: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: ecoTheme.colors.primaryDark,
    textAlign: 'center',
    lineHeight: scale(44),
    fontSize: responsiveFontSize(15),
    fontWeight: '800',
    color: '#FFF',
    overflow: 'hidden',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(2),
  },
  chatName: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: ecoTheme.colors.text,
    flex: 1,
    flexShrink: 1,
  },
  chatTime: {
    fontSize: responsiveFontSize(11),
    color: ecoTheme.colors.textSoft,
  },
  chatPreview: {
    fontSize: responsiveFontSize(12),
    color: ecoTheme.colors.textSoft,
    marginBottom: verticalScale(4),
  },
  chatStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  statusBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(8),
  },
  statusBadgeText: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  meetupType: {
    fontSize: responsiveFontSize(11),
    color: ecoTheme.colors.textSoft,
  },
  unreadBadge: {
    minWidth: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(5),
  },
  unreadText: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#FFF',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(40),
    gap: verticalScale(8),
  },
  emptyTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: '800',
    color: ecoTheme.colors.text,
  },
  emptySubtitle: {
    fontSize: responsiveFontSize(13),
    color: ecoTheme.colors.textSoft,
    textAlign: 'center',
    paddingHorizontal: scale(30),
    lineHeight: responsiveFontSize(19),
  },
});
