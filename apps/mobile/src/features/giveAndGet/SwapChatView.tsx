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
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { swapService } from './swapService';
import { PublicProfileModal } from './PublicProfileModal';
import type { SwapChatMessage, SwapConversation, SwapRequestStatus } from './types';
import { MEETUP_LABELS } from './types';

function getValidImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  let cleanUrl = url.replace(/\\/g, '/');
  if (cleanUrl.includes('localhost:3000')) {
    cleanUrl = cleanUrl.replace('http://localhost:3000', ecobudApiOrigin);
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = `${ecobudApiOrigin}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
  }
  return cleanUrl;
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
  if (conversations.length === 0) {
    return (
      <View style={localStyles.emptyState}>
        <Ionicons name="chatbubbles-outline" size={56} color="#A7D5BA" />
        <Text style={localStyles.emptyTitle}>No conversations yet</Text>
        <Text style={localStyles.emptySubtitle}>
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
          style={localStyles.chatItem}
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
              <Text style={localStyles.chatName} numberOfLines={1}>
                {conv.otherUser.displayName}
              </Text>
              {conv.lastMessage && (
                <Text style={localStyles.chatTime}>
                  {formatMessageTime(conv.lastMessage.timestamp)}
                </Text>
              )}
            </View>
            <Text style={localStyles.chatPreview} numberOfLines={1}>
              {conv.listing.title} → {conv.listing.lookingFor}
            </Text>
            <View style={localStyles.chatStatusRow}>
              <View style={[localStyles.statusBadge, { backgroundColor: getStatusColor(conv.status) + '20' }]}>
                <Text style={[localStyles.statusBadgeText, { color: getStatusColor(conv.status) }]}>
                  {getStatusLabel(conv.status)}
                </Text>
              </View>
              <Text style={localStyles.meetupType}>
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
    <SafeAreaView style={localStyles.safeArea}>
      <View style={localStyles.header}>
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

      <View style={localStyles.swapInfoBar}>
        <View style={localStyles.swapInfoItem}>
          <Text style={localStyles.swapInfoLabel}>Offering</Text>
          <Text style={localStyles.swapInfoValue} numberOfLines={1}>
            {conversation.listing.quantity} {conversation.listing.title}
          </Text>
        </View>
        <View style={localStyles.swapInfoDivider} />
        <View style={localStyles.swapInfoItem}>
          <Text style={localStyles.swapInfoLabel}>Looking For</Text>
          <Text style={localStyles.swapInfoValue} numberOfLines={1}>
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
        <View style={localStyles.loadingWrap}>
          <ActivityIndicator size="large" color={ecoTheme.colors.primaryDark} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={localStyles.messagesScroll}
          contentContainerStyle={localStyles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <View
                key={msg.id}
                style={[localStyles.messageBubble, isMine ? localStyles.messageBubbleMine : localStyles.messageBubbleTheirs]}
              >
                {msg.imageUrl && (
                  <Image source={{ uri: msg.imageUrl }} style={localStyles.messageImage} />
                )}
                <Text style={[localStyles.messageText, isMine && localStyles.messageTextMine]}>
                  {msg.text}
                </Text>
                <View style={localStyles.messageFooter}>
                  <Text style={[localStyles.messageTime, isMine && localStyles.messageTimeMine]}>
                    {formatMessageTime(msg.timestamp)}
                  </Text>
                  {isMine && (
                    <Ionicons
                      name={msg.read ? 'checkmark-done' : 'checkmark'}
                      size={14}
                      color={msg.read ? '#4ADE80' : '#9CA3AF'}
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
        <View style={localStyles.inputBar}>
          <TextInput
            style={localStyles.chatInput}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[localStyles.sendBtn, (!inputText.trim() || sending) && { opacity: 0.5 }]}
          >
            <Ionicons name="send" size={18} color="#FFF" />
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
    backgroundColor: ecoTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: ecoTheme.colors.primaryDark,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  headerStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 38,
    height: 38,
  },
  headerAvatarText: {
    fontSize: 14,
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
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  swapInfoLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: ecoTheme.colors.textSoft,
    marginBottom: 2,
  },
  swapInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  swapInfoDivider: {
    width: 1,
    backgroundColor: '#F0F5F2',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F2',
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  completeBtnText: {
    fontSize: 14,
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
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
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
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: ecoTheme.colors.text,
  },
  messageTextMine: {
    color: '#FFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: ecoTheme.colors.textSoft,
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F5F2',
  },
  chatInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderRadius: 20,
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: ecoTheme.colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatList: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
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
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chatAvatarText: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ecoTheme.colors.primaryDark,
    textAlign: 'center',
    lineHeight: 48,
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    overflow: 'hidden',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
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
    marginBottom: 4,
  },
  chatName: {
    fontSize: 15,
    fontWeight: '700',
    color: ecoTheme.colors.text,
    flex: 1,
  },
  chatTime: {
    fontSize: 11,
    color: ecoTheme.colors.textSoft,
  },
  chatPreview: {
    fontSize: 13,
    color: ecoTheme.colors.textSoft,
    marginBottom: 4,
  },
  chatStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  meetupType: {
    fontSize: 11,
    color: ecoTheme.colors.textSoft,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: ecoTheme.colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: ecoTheme.colors.textSoft,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});
