import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useListPerformance } from '../../shared/ui/useListPerformance';
import {
  View,
  ScrollView,
  FlatList,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  AppState,
  DeviceEventEmitter,
} from 'react-native';
import { Modal } from '../../shared/accessibility/primitives';
import { Text, TextInput, TouchableOpacity } from '../../shared/accessibility/primitives';
import { Animated } from '../../shared/accessibility/animations';
import { Ionicons, Feather } from '@expo/vector-icons';
import { ecoTheme, useTheme } from '../../shared/theme/ecoTheme';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { swapService } from './swapService';
import { mergeMessages } from './messagePaging';
import { PublicProfileModal } from './PublicProfileModal';
import type { SwapChatMessage, SwapConversation, SwapRequestStatus } from './types';
import { MEETUP_LABELS } from './types';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';
import { resolveMediaUrl } from '../../app/utils/appUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  const day = `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day}, ${date.getFullYear()}`;
}

function formatListTime(dateStr: string): string {
  return isSameDay(new Date(dateStr), new Date()) ? formatMessageTime(dateStr) : formatDayLabel(dateStr);
}

function getClosedNotice(status: SwapRequestStatus): string {
  switch (status) {
    case 'completed': return 'This request is completed. Messaging is closed.';
    case 'declined': return 'This request was declined. Messaging is closed.';
    default: return 'This request was cancelled. Messaging is closed.';
  }
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
  loading = false,
  error = false,
  onRetry,
  currentUserId,
  onSelectConversation,
}: {
  conversations: SwapConversation[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  currentUserId: string;
  onSelectConversation: (conversation: SwapConversation) => void;
}) {
  const { theme, isDark } = useTheme();
  if (loading) return <SwapChatListSkeleton />;
  if (error && conversations.length === 0) {
    return (
      <View style={localStyles.emptyState}>
        <Ionicons name="chatbubbles-outline" size={56} color={isDark ? theme.colors.primary : '#A7D5BA'} />
        <Text style={[localStyles.emptyTitle, { color: theme.colors.textPrimary }]}>Couldn’t load chats</Text>
        <Text style={[localStyles.emptySubtitle, { color: theme.colors.textMuted }]}>Check your connection and try again.</Text>
        <TouchableOpacity onPress={onRetry} accessibilityRole="button" style={[localStyles.retryButton, { backgroundColor: theme.colors.primary }]}>
          <Text style={[localStyles.retryButtonText, { color: theme.colors.background }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
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
      {conversations.map((conv, index) => (
        <TouchableOpacity
          key={conv.id}
          onPress={() => onSelectConversation(conv)}
          style={[localStyles.chatItem, index === conversations.length - 1 && { marginBottom: 0 }, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}
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
                  {formatListTime(conv.lastMessage.timestamp)}
                </Text>
              )}
            </View>
            {conv.lastMessage && (
              <Text
                style={[localStyles.chatLastMessage, { color: conv.unreadCount > 0 ? theme.colors.textPrimary : theme.colors.textMuted }, conv.unreadCount > 0 && { fontWeight: '700' }]}
                numberOfLines={1}
              >
                {String(conv.lastMessage.senderId) === String(currentUserId) ? 'You: ' : ''}
                {conv.lastMessage.text || (conv.lastMessage.imageUrl ? 'Photo' : '')}
              </Text>
            )}
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

function SwapChatListSkeleton() {
  const { theme, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.55)).current;
  const boneColor = isDark ? theme.colors.surfaceMuted : '#E4E9E6';

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.55, duration: 750, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[localStyles.chatList, { opacity }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading conversations"
    >
      {[0, 1, 2].map((index) => (
        <View key={index} style={[localStyles.chatItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={{ width: scale(44), height: scale(44), borderRadius: scale(22), backgroundColor: boneColor }} />
          <View style={localStyles.chatContent}>
            <View style={localStyles.chatHeader}>
              <View style={{ width: '48%', height: verticalScale(14), borderRadius: moderateScale(7), backgroundColor: boneColor }} />
              <View style={{ width: '18%', height: verticalScale(10), borderRadius: moderateScale(5), backgroundColor: boneColor }} />
            </View>
            <View style={{ width: '82%', height: verticalScale(12), borderRadius: moderateScale(6), backgroundColor: boneColor, marginBottom: verticalScale(4) }} />
            <View style={localStyles.chatStatusRow}>
              <View style={{ width: scale(68), height: verticalScale(18), borderRadius: moderateScale(8), backgroundColor: boneColor }} />
              <View style={{ width: scale(82), height: verticalScale(10), borderRadius: moderateScale(5), backgroundColor: boneColor }} />
            </View>
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

export function SwapChatView({
  conversation,
  currentUserId,
  onBack,
  onAcceptSwap,
  onDeclineSwap,
  onMarkCompleted,
  completing = false,
}: {
  conversation: SwapConversation;
  currentUserId: string;
  onBack: () => void;
  onAcceptSwap: () => void;
  onDeclineSwap: () => void;
  onMarkCompleted: () => void;
  completing?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [messages, setMessages] = useState<SwapChatMessage[]>([]);
  const listPerformance = useListPerformance();
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const scrollRef = useRef<FlatList<SwapChatMessage>>(null);
  const chatRootRef = useRef<View>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const keyboardMeasureFrame = useRef<number | null>(null);
  const keyboardSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const messagesRequestRef = useRef<Promise<void> | null>(null);
  const pendingRealtimeRefreshRef = useRef(false);
  const lastMessagesLoadedAtRef = useRef(0);
  const mountedRef = useRef(true);
  const scopeRef = useRef('');
  const scope = `${conversation.id}:${currentUserId}`;
  scopeRef.current = scope;
  const olderCursorRef = useRef<string | null>(null);
  const newestCursorRef = useRef<string | null>(null);
  const hasInitialPageRef = useRef(false);
  const olderRequestRef = useRef(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const failedPageRef = useRef<'latest' | 'older'>('latest');
  const nearBottomRef = useRef(true);
  const initialScrollRef = useRef(true);
  const allowOlderRef = useRef(false);

  const updateKeyboardOverlap = useCallback(() => {
    if (Platform.OS !== 'android' || keyboardTopRef.current === null) return;
    if (keyboardMeasureFrame.current !== null) cancelAnimationFrame(keyboardMeasureFrame.current);
    keyboardMeasureFrame.current = requestAnimationFrame(() => {
      keyboardMeasureFrame.current = null;
      chatRootRef.current?.measureInWindow((_x, y, _width, height) => {
        const keyboardTop = keyboardTopRef.current;
        if (keyboardTop === null) return;
        const overlap = Math.max(0, y + height - keyboardTop);
        setKeyboardOverlap((previous) => Math.abs(previous - overlap) > 1 ? overlap : previous);
      });
    });
  }, []);

  const loadMessages = useCallback((): Promise<void> => {
    if (messagesRequestRef.current) return messagesRequestRef.current;
    const request = Promise.resolve().then(async () => {
      const after = newestCursorRef.current;
      const page = await swapService.fetchMessagePage(conversation.id, after ? { after } : {});
      if (!mountedRef.current || scopeRef.current !== scope) return;
      let msgs = page.items;
      if (!hasInitialPageRef.current) {
        olderCursorRef.current = page.nextCursor;
        setHasOlder(Boolean(page.nextCursor));
        hasInitialPageRef.current = true;
      } else if (page.nextCursor) {
        pendingRealtimeRefreshRef.current = true;
      } else {
        const recent = await swapService.fetchMessagePage(conversation.id);
        if (!mountedRef.current || scopeRef.current !== scope) return;
        msgs = mergeMessages(msgs, recent.items);
      }
      if (page.newestCursor) newestCursorRef.current = page.newestCursor;
      setMessages(previous => mergeMessages(previous, msgs));
      setMessagesError(null);
      if (!initialScrollRef.current && nearBottomRef.current && page.items.length > 0) {
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      }
      lastMessagesLoadedAtRef.current = Date.now();
      if (msgs.some((message) => !message.read && String(message.senderId) !== String(currentUserId))) {
        await swapService.markMessagesRead(conversation.id, currentUserId).catch(() => {});
      }
    }).catch(() => {
      if (mountedRef.current && scopeRef.current === scope) {
        failedPageRef.current = 'latest';
        setMessagesError('Unable to load messages. Tap to try again.');
      }
    }).finally(() => {
      if (messagesRequestRef.current === request) messagesRequestRef.current = null;
      if (mountedRef.current && scopeRef.current === scope) setLoading(false);
      if (pendingRealtimeRefreshRef.current && mountedRef.current && scopeRef.current === scope && AppState.currentState === 'active') {
        pendingRealtimeRefreshRef.current = false;
        void loadMessages();
      }
    });
    messagesRequestRef.current = request;
    return request;
  }, [conversation.id, currentUserId, scope]);

  const loadOlderMessages = useCallback(async () => {
    const before = olderCursorRef.current;
    if (!before || olderRequestRef.current || !hasInitialPageRef.current) return;
    olderRequestRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await swapService.fetchMessagePage(conversation.id, { before });
      if (!mountedRef.current || scopeRef.current !== scope) return;
      setMessages(previous => mergeMessages(previous, page.items));
      olderCursorRef.current = page.nextCursor;
      setHasOlder(Boolean(page.nextCursor));
      setMessagesError(null);
    } catch {
      if (mountedRef.current && scopeRef.current === scope) {
        failedPageRef.current = 'older';
        setMessagesError('Unable to load older messages. Tap to try again.');
      }
    } finally {
      if (scopeRef.current === scope) { olderRequestRef.current = false; setLoadingOlder(false); }
    }
  }, [conversation.id, scope]);

  useEffect(() => {
    mountedRef.current = true;
    messagesRequestRef.current = null;
    olderCursorRef.current = null;
    newestCursorRef.current = null;
    hasInitialPageRef.current = false;
    olderRequestRef.current = false;
    initialScrollRef.current = true;
    allowOlderRef.current = false;
    nearBottomRef.current = true;
    setMessages([]);
    setHasOlder(false);
    setLoadingOlder(false);
    setMessagesError(null);
    setLoading(true);
    void loadMessages();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void loadMessages();
    }, 30000);
    const changed = DeviceEventEmitter.addListener('swapChatChanged', (conversationId: string) => {
      if (conversationId !== conversation.id || AppState.currentState !== 'active') return;
      if (messagesRequestRef.current) {
        pendingRealtimeRefreshRef.current = true;
      } else {
        void loadMessages();
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastMessagesLoadedAtRef.current > 5000) void loadMessages();
    });
    return () => {
      mountedRef.current = false;
      pendingRealtimeRefreshRef.current = false;
      clearInterval(interval);
      changed.remove();
      appState.remove();
    };
  }, [conversation.id, loadMessages]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        if (Platform.OS === 'android') {
          keyboardTopRef.current = event.endCoordinates.screenY;
          updateKeyboardOverlap();
          if (keyboardSettleTimer.current !== null) clearTimeout(keyboardSettleTimer.current);
          keyboardSettleTimer.current = setTimeout(() => {
            keyboardSettleTimer.current = null;
            updateKeyboardOverlap();
          }, 80);
        }
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardTopRef.current = null;
        setKeyboardVisible(false);
        setKeyboardOverlap(0);
        if (keyboardSettleTimer.current !== null) clearTimeout(keyboardSettleTimer.current);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
      if (keyboardMeasureFrame.current !== null) cancelAnimationFrame(keyboardMeasureFrame.current);
      if (keyboardSettleTimer.current !== null) clearTimeout(keyboardSettleTimer.current);
    };
  }, [updateKeyboardOverlap]);

  const sendMessage = async (text: string, retryId?: string) => {
    if (sending) return;
    setSending(true);

    const tempId = retryId ?? `temp_${Date.now()}`;
    if (retryId) {
      setMessages((prev) => prev.map((m) => m.id === retryId ? { ...m, failed: false } : m));
    } else {
      const optimisticMsg: SwapChatMessage = {
        id: tempId,
        swapRequestId: conversation.id,
        senderId: currentUserId,
        text,
        timestamp: new Date().toISOString(),
        read: false,
        delivered: true,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }

    try {
      const realMsg = await swapService.sendMessage(
        conversation.id,
        currentUserId,
        text
      );
      if (scopeRef.current === scope) setMessages(prev => mergeMessages(prev.filter(m => m.id !== tempId), [realMsg]));
    } catch {
      if (scopeRef.current !== scope) return;
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, failed: true } : m));
    } finally {
      if (scopeRef.current === scope) setSending(false);
    }
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    void sendMessage(text);
  };

  const bottomInset = keyboardVisible ? 0 : insets.bottom;

  const isOwner = conversation.listing.user.id === currentUserId;
  const status = conversation.status;

  return (
    <View
      ref={chatRootRef}
      onLayout={updateKeyboardOverlap}
      style={[localStyles.safeArea, { backgroundColor: theme.colors.background, paddingBottom: keyboardOverlap }]}
    >
      {/* Header */}
      <View style={[localStyles.header, { backgroundColor: isDark ? theme.colors.card : theme.colors.primaryDark, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to chats"
          style={[localStyles.backBtn, { backgroundColor: isDark ? theme.colors.surfaceMuted : 'rgba(255,255,255,0.16)' }]}
        >
          <Feather name="arrow-left" size={22} color={isDark ? theme.colors.textPrimary : '#FFFFFF'} />
        </TouchableOpacity>
        <View style={localStyles.headerInfo}>
          <Text style={[localStyles.headerName, { color: isDark ? theme.colors.textPrimary : theme.colors.surface }]} numberOfLines={1}>
            {conversation.otherUser.displayName}
          </Text>
          <View style={[localStyles.headerStatusPill, { backgroundColor: isDark ? theme.colors.surfaceMuted : 'rgba(255,255,255,0.12)' }]}>
            <View style={[localStyles.headerStatusDot, { backgroundColor: isDark ? getStatusColor(status) : status === 'completed' ? '#93C5FD' : status === 'pending' ? '#FCD34D' : status === 'accepted' ? '#6EE7B7' : '#FCA5A5' }]} />
            <Text style={[localStyles.headerStatus, { color: isDark ? theme.colors.textPrimary : '#FFFFFF' }]}>
              {getStatusLabel(status)}
            </Text>
          </View>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${conversation.otherUser.displayName}'s profile`} style={[localStyles.headerAvatar, { backgroundColor: theme.colors.surfaceMuted, borderColor: isDark ? theme.colors.border : 'rgba(255,255,255,0.4)' }]} onPress={() => setShowProfileModal(true)}>
          {conversation.otherUser.avatarUrl ? (
            <Image
              source={{ uri: getValidImageUrl(conversation.otherUser.avatarUrl) }}
              style={localStyles.headerAvatarImage}
            />
          ) : (
            <Text style={[localStyles.headerAvatarText, { color: isDark ? theme.colors.textPrimary : theme.colors.primaryDark }]}>
              {getInitials(conversation.otherUser.displayName)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Keyboard-aware body: messages + input bar lift above keyboard */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[localStyles.swapInfoBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <View style={[localStyles.swapInfoItem, { backgroundColor: isDark ? theme.colors.card : '#F3FAF6' }]}>
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
          <View style={[localStyles.actionBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity
              onPress={onDeclineSwap}
              style={[localStyles.declineBtn, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.error }]}
            >
              <Ionicons name="close-circle-outline" size={18} color={theme.colors.error} />
              <Text style={[localStyles.declineBtnText, { color: theme.colors.error }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAcceptSwap}
              style={[localStyles.acceptBtn, { backgroundColor: theme.colors.primary }]}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.background} />
              <Text style={[localStyles.acceptBtnText, { color: theme.colors.background }]}>
                {conversation.listing.lookingFor?.toLowerCase() === 'giveaway' ? 'Accept' : 'Accept Swap'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'accepted' && (
          <View style={[localStyles.actionBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity
              onPress={onMarkCompleted}
              disabled={completing}
              style={[localStyles.completeBtn, { backgroundColor: theme.colors.primary }]}
            >
              {completing ? <ActivityIndicator size="small" color={theme.colors.background} /> : <Ionicons name="checkmark-done-circle-outline" size={18} color={theme.colors.background} />}
              <Text style={[localStyles.completeBtnText, { color: theme.colors.background }]}>Mark as Completed</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={[localStyles.loadingWrap, { backgroundColor: theme.colors.background }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={scrollRef}
            data={messages}
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            onContentSizeChange={() => {
              if (initialScrollRef.current && messages.length > 0) {
                initialScrollRef.current = false;
                scrollRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onScrollBeginDrag={() => { allowOlderRef.current = true; }}
            onScroll={({ nativeEvent }) => {
              const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
              nearBottomRef.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100;
              if (allowOlderRef.current && contentOffset.y < 80 && !messagesError) void loadOlderMessages();
            }}
            scrollEventThrottle={100}
            ListHeaderComponent={loadingOlder ? <ActivityIndicator color={theme.colors.primary} /> : (hasOlder || messagesError) ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => void (messagesError && failedPageRef.current === 'latest' ? loadMessages() : hasInitialPageRef.current && hasOlder ? loadOlderMessages() : loadMessages())} style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.primary }}>{messagesError ?? 'Load older messages'}</Text>
              </TouchableOpacity>
            ) : null}
            keyExtractor={(msg) => msg.id}
            initialNumToRender={16}
            maxToRenderPerBatch={12}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            {...listPerformance}
            removeClippedSubviews={Platform.OS === 'android'}
            style={[localStyles.messagesScroll, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={[localStyles.messagesContent, { backgroundColor: theme.colors.background }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: msg, index }) => {
              const isMine = String(msg.senderId).trim() === String(currentUserId).trim();
              const previous = messages[index - 1];
              const startsDay = !previous || !isSameDay(new Date(previous.timestamp), new Date(msg.timestamp));
              const isUnsent = msg.id.startsWith('temp_');
              return (
                <View>
                  {startsDay && (
                    <View style={[localStyles.daySeparator, { backgroundColor: theme.colors.surfaceMuted }]}>
                      <Text style={[localStyles.daySeparatorText, { color: theme.colors.textMuted }]}>
                        {formatDayLabel(msg.timestamp)}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      localStyles.messageBubble,
                      isMine
                        ? [localStyles.messageBubbleMine, { backgroundColor: theme.colors.primary }]
                        : [localStyles.messageBubbleTheirs, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }],
                      msg.failed && localStyles.messageBubbleFailed,
                    ]}
                  >
                    {msg.imageUrl && (
                      <Image source={{ uri: msg.imageUrl }} style={localStyles.messageImage} />
                    )}
                    <Text style={[localStyles.messageText, { color: isMine ? '#FFFFFF' : theme.colors.textPrimary }]}>
                      {msg.text}
                    </Text>
                    <View style={localStyles.messageFooter}>
                      <Text style={[localStyles.messageTime, { color: isMine ? 'rgba(255,255,255,0.75)' : theme.colors.textMuted }]}>
                        {formatMessageTime(msg.timestamp)}
                      </Text>
                      {isMine && (
                        <Ionicons
                          name={msg.failed ? 'alert-circle' : isUnsent ? 'time-outline' : msg.read ? 'checkmark-done' : 'checkmark'}
                          size={14}
                          color={msg.read || msg.failed ? '#FFFFFF' : 'rgba(255,255,255,0.7)'}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                  </View>
                  {msg.failed && (
                    <TouchableOpacity
                      onPress={() => void sendMessage(msg.text, msg.id)}
                      disabled={sending}
                      accessibilityRole="button"
                      accessibilityLabel="Message not sent. Tap to retry"
                      style={localStyles.retryRow}
                    >
                      <Text style={[localStyles.retryRowText, { color: theme.colors.error }]}>Not sent. Tap to retry.</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        )}

        {status === 'completed' || status === 'cancelled' || status === 'declined' ? (
          <View style={[localStyles.closedBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border, paddingBottom: verticalScale(12) + bottomInset }]}>
            <Ionicons name="lock-closed-outline" size={15} color={theme.colors.textMuted} />
            <Text style={[localStyles.closedBarText, { color: theme.colors.textMuted }]}>{getClosedNotice(status)}</Text>
          </View>
        ) : (
          <View style={[localStyles.inputBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border, paddingBottom: verticalScale(10) + bottomInset }]}>
            <TextInput
              style={[localStyles.chatInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel="Message"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !inputText.trim() || sending }}
              style={[localStyles.sendBtn, { backgroundColor: inputText.trim() && !sending ? theme.colors.primary : theme.colors.surfaceMuted }]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={theme.colors.textMuted} />
              ) : (
                <Ionicons name="send" size={19} color={inputText.trim() ? '#FFFFFF' : theme.colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <PublicProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={conversation.otherUser}
      />
    </View>
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
    paddingVertical: verticalScale(11),
    backgroundColor: ecoTheme.colors.primaryDark,
  },
  backBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: responsiveFontSize(15),
    fontWeight: '800',
    color: '#FFF',
    flexShrink: 1,
  },
  headerStatus: {
    fontSize: responsiveFontSize(11),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  headerStatusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(8),
    marginTop: verticalScale(3),
  },
  headerStatusDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(3),
  },
  headerAvatar: {
    borderWidth: 2,
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
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
    minWidth: 0,
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(14),
  },
  swapInfoLabel: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ecoTheme.colors.textSoft,
    marginBottom: verticalScale(4),
  },
  swapInfoValue: {
    fontSize: responsiveFontSize(13),
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
    gap: scale(10),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F2',
  },
  declineBtn: {
    flex: 1,
    minHeight: scale(44),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
  },
  declineBtnText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: '#DC2626',
  },
  acceptBtn: {
    flex: 1,
    minHeight: scale(44),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(12),
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
  },
  acceptBtnText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: '#FFF',
  },
  completeBtn: {
    flex: 1,
    minHeight: scale(44),
    flexDirection: 'row',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(12),
    backgroundColor: ecoTheme.colors.primaryDark,
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
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(16),
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: moderateScale(18),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    marginBottom: verticalScale(10),
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
  messageBubbleFailed: {
    opacity: 0.7,
    marginBottom: verticalScale(4),
  },
  retryRow: {
    alignSelf: 'flex-end',
    paddingVertical: verticalScale(4),
    marginBottom: verticalScale(8),
  },
  retryRowText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
  },
  daySeparator: {
    alignSelf: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(10),
    marginTop: verticalScale(4),
    marginBottom: verticalScale(12),
  },
  daySeparatorText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
  },
  closedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
  },
  closedBarText: {
    flexShrink: 1,
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
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
    gap: scale(10),
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(10),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F5F2',
  },
  chatInput: {
    flex: 1,
    minHeight: scale(44),
    maxHeight: verticalScale(104),
    borderRadius: moderateScale(16),
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(10),
    fontSize: responsiveFontSize(14),
    lineHeight: responsiveFontSize(20),
    color: ecoTheme.colors.text,
  },
  sendBtn: {
    width: scale(44),
    height: scale(44),
    borderRadius: moderateScale(16),
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
  chatLastMessage: {
    fontSize: responsiveFontSize(13),
    marginBottom: verticalScale(2),
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
  retryButton: {
    marginTop: verticalScale(8),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(12),
  },
  retryButtonText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
  },
});
