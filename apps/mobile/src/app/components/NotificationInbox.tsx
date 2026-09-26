import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  DeviceEventEmitter,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ecobudApi } from '../../shared/api/ecobudApi';
import type { AppNotification, NotificationType } from '../types/notifications';
import type { EcoBudMobileModel } from '../types/home';
import { useTheme } from '../../shared/theme/ecoTheme';
import { homeService } from '../services/homeService';
import { scale, verticalScale, moderateScale, responsiveFontSize } from '../utils/responsive';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { useInAppNotification } from '../../shared/ui/InAppNotification';

const categories = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['learning', 'Learn'],
  ['challenge', 'Challenges'],
  ['event', 'Events'],
] as const;

const moreCategories = [
  ['verification', 'Verification'],
  ['swap', 'Swap / GGH'],
  ['chat', 'Chat'],
  ['reward', 'Reward'],
  ['streak', 'Streak'],
  ['leaderboard', 'Leaderboard'],
  ['system', 'System'],
] as const;

const iconMap: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  challenge: 'trophy',
  verification: 'checkmark-circle',
  swap: 'swap-horizontal',
  chat: 'chatbubble-ellipses',
  event: 'calendar',
  reward: 'gift',
  learning: 'book',
  streak: 'flame',
  leaderboard: 'podium',
  system: 'information-circle',
};

const categoryThemeColors: Record<NotificationType, { lightBg: string; color: string }> = {
  challenge: { lightBg: 'rgba(234, 179, 8, 0.14)', color: '#D97706' },
  verification: { lightBg: 'rgba(34, 197, 94, 0.14)', color: '#16A34A' },
  swap: { lightBg: 'rgba(14, 165, 233, 0.14)', color: '#0284C7' },
  chat: { lightBg: 'rgba(99, 102, 241, 0.14)', color: '#4F46E5' },
  event: { lightBg: 'rgba(168, 85, 247, 0.14)', color: '#9333EA' },
  reward: { lightBg: 'rgba(236, 72, 153, 0.14)', color: '#DB2777' },
  learning: { lightBg: 'rgba(20, 184, 166, 0.14)', color: '#0D9488' },
  streak: { lightBg: 'rgba(249, 115, 22, 0.14)', color: '#EA580C' },
  leaderboard: { lightBg: 'rgba(234, 179, 8, 0.14)', color: '#CA8A04' },
  system: { lightBg: 'rgba(100, 116, 139, 0.14)', color: '#64748B' },
};

export function notificationTime(date: string) {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const notificationDayGroup = (date: string): 'Today' | 'Yesterday' | 'Earlier' => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Earlier';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfValue = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const dayDifference = Math.round((startOfToday.getTime() - startOfValue.getTime()) / 86_400_000);
  if (dayDifference <= 0) return 'Today';
  if (dayDifference === 1) return 'Yesterday';
  return 'Earlier';
};

export function NotificationInbox({ model }: { model: EcoBudMobileModel }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showNotification } = useInAppNotification();
  const c = theme.colors;
  const token = model.session?.token;

  const [filter, setFilter] = React.useState<string>('all');
  const [expanded, setExpanded] = React.useState(false);
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(model.notificationCount);
  const [next, setNext] = React.useState<number | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);
  const [isClearingAll, setIsClearingAll] = React.useState(false);
  const [error, setError] = React.useState('');
  const [failedOffset, setFailedOffset] = React.useState<number | null>(null);
  const generation = React.useRef(0);

  const load = React.useCallback(
    async (offset = 0, mode: 'initial' | 'refresh' | 'more' = 'initial') => {
      if (!token) return;
      const g = ++generation.current;
      if (mode === 'initial') setInitialLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      setError('');
      setFailedOffset(null);
      try {
        const q = filter === 'unread' ? '&unread=true' : filter === 'all' ? '' : `&type=${filter}`;
        const p = await ecobudApi.notifications(token, `?offset=${offset}${q}`);
        if (g === generation.current) {
          setItems((old) => offset
            ? [...old, ...p.items.filter((n) => !old.some((o) => o.id === n.id))]
            : p.items);
          setNext(p.nextOffset);
          setUnreadCount(p.unreadCount);
        }
      } catch {
        if (g === generation.current) {
          setError(mode === 'more' ? 'Could not load older notifications.' : 'Unable to load notifications. Pull down to retry.');
          setFailedOffset(mode === 'more' ? offset : null);
        }
      } finally {
        if (g === generation.current) {
          setInitialLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [token, filter],
  );

  React.useEffect(() => {
    setItems([]);
    setNext(null);
    setInitialLoading(true);
    void load(0, 'initial');
    const sub = DeviceEventEmitter.addListener('notificationsInboxRefresh', () => void load(0, 'refresh'));
    return () => {
      generation.current++;
      sub.remove();
    };
  }, [load]);

  const open = async (n: AppNotification) => {
    if (!token) return;
    try {
      triggerSelectionHaptic();
      if (!n.isRead) {
        await ecobudApi.readNotification(token, n.id);
        setItems((old) => filter === 'unread'
          ? old.filter((o) => o.id !== n.id)
          : old.map((o) => (o.id === n.id ? { ...o, isRead: true } : o)));
        setUnreadCount((count) => Math.max(0, count - 1));
        DeviceEventEmitter.emit('notificationsChanged');
        if (filter === 'unread') void load(0, 'refresh');
      }

      const id = n.relatedId;
      if (n.type === 'learning' && id) {
        await model.refreshEverything();
        await model.openLesson(id);
      } else if (n.type === 'challenge' && id) {
        let challenges = await homeService.getChallenges(token).catch(() => ({ items: [] }));
        let mission = challenges.items?.find((x: any) => x.id === id || x.cycle?.instanceId === id);
        if (!mission && model.challenges) {
          mission = model.challenges.find((x: any) => x.id === id || x.cycle?.instanceId === id);
        }
        if (mission) {
          model.openChallengeMission(mission);
        } else {
          await model.refreshEverything();
          const refreshed = model.challenges.find((x: any) => x.id === id || x.cycle?.instanceId === id);
          if (refreshed) {
            model.openChallengeMission(refreshed);
          } else {
            showNotification({
              title: 'Content unavailable',
              message: 'This challenge is no longer available.',
              tone: 'warning',
            });
          }
        }
      } else if (n.type === 'event' && id) {
        model.setActiveOverlay(null);
        model.setFocusedEventId(id);
        model.setActiveOverlay('events');
      } else if (n.type === 'verification') {
        model.setActiveOverlay(null);
        model.setActiveTab('profile');
      } else if (n.type === 'leaderboard') {
        model.setActiveOverlay(null);
        model.setActiveOverlay('leaderboard');
      } else if (n.type === 'reward') {
        model.setActiveOverlay(null);
        model.setActiveOverlay('redeemPoints');
      } else if (n.type === 'swap' || n.type === 'chat') {
        if (id) {
          model.setNotificationDestination({ type: n.relatedType ?? n.type, id });
        }
        model.setActiveOverlay(null);
        model.setActiveTab('marketplace');
      } else {
        showNotification({
          title: n.title,
          message: n.message,
          tone: 'info',
          durationMs: 7000,
        });
      }
    } catch {
      showNotification({
        title: 'Unable to open notification',
        message: 'Please check your connection and try again.',
        tone: 'error',
      });
    }
  };

  React.useEffect(() => {
    if (!token || !model.pendingNotificationId) return;
    const id = model.pendingNotificationId;
    model.setPendingNotificationId(null);
    void ecobudApi
      .notification(token, id)
      .then(open)
      .catch(() => setError('This notification is no longer available.'));
  }, [token, model.pendingNotificationId]);

  const handleMarkAllRead = async () => {
    if (!token || isMarkingAll) return;
    try {
      setIsMarkingAll(true);
      triggerSuccessHaptic();
      await ecobudApi.readAllNotifications(token);
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      DeviceEventEmitter.emit('notificationsChanged');
      await load(0, 'refresh');
      showNotification({ title: 'Notifications updated', message: 'All notifications are marked as read.', tone: 'success' });
    } catch {
      showNotification({ title: 'Could not mark notifications as read', message: 'Please try again.', tone: 'error' });
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleClearAll = async () => {
    if (!token || !items.length || isClearingAll) return;
    const previousUnreadCount = unreadCount;
    generation.current++;
    setIsClearingAll(true);
    setItems([]);
    setNext(null);
    setUnreadCount(0);
    setError('');
    try {
      await ecobudApi.clearAllNotifications(token);
      DeviceEventEmitter.emit('notificationsChanged');
      showNotification({ title: 'Notifications cleared', message: 'Your notification history was cleared.', tone: 'success' });
    } catch {
      setUnreadCount(previousUnreadCount);
      await load(0, 'refresh');
      showNotification({ title: 'Could not clear notifications', message: 'Please try again.', tone: 'error' });
    } finally {
      setIsClearingAll(false);
    }
  };

  const hasUnread = unreadCount > 0;
  const groupedInAll = filter === 'all';
  const groupChallengesInAll = groupedInAll;
  const dayGroups = React.useMemo(() => items.map((item, index) => ({
    current: notificationDayGroup(item.createdAt),
    previous: index > 0 ? notificationDayGroup(items[index - 1].createdAt) : null,
  })), [items]);

  return (
    <FlatList
      style={{ flex: 1 }}
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[inboxStyles.container, { paddingBottom: insets.bottom + verticalScale(24) }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(0, 'refresh')} tintColor={c.primary} />}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      ListHeaderComponent={<>
      <LinearGradient colors={['#0F6B3A', '#16A34A', '#34D399']} style={inboxStyles.hero}>
        <View style={inboxStyles.heroIcon}>
          <Ionicons name="notifications" size={24} color="#FFFFFF" />
          {hasUnread && <View style={inboxStyles.heroDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={inboxStyles.heroEyebrow}>ECOBUD UPDATES</Text>
          <Text style={inboxStyles.heroTitle}>
            {initialLoading ? 'Checking updates...' : hasUnread ? `${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'}` : 'You’re all caught up'}
          </Text>
        </View>
      </LinearGradient>

      <View style={inboxStyles.headerRow}>
        <Text style={[inboxStyles.headerTitle, { color: c.textPrimary }]}>Your activity</Text>
      </View>
      {(hasUnread || ((items.length > 0 || isClearingAll) && !initialLoading)) && (
        <View style={inboxStyles.actionsRow}>
          {hasUnread && !initialLoading && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
              onPress={handleMarkAllRead}
              disabled={isMarkingAll || isClearingAll}
              style={[inboxStyles.markAllBtn, { backgroundColor: c.card, borderColor: c.border }]}
            >
              {isMarkingAll ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={16} color={c.primary} />
                  <Text style={[inboxStyles.markAllText, { color: c.primary }]}>Mark all read</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {(items.length > 0 || isClearingAll) && !initialLoading && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
              onPress={() => void handleClearAll()}
              disabled={isClearingAll || isMarkingAll}
              style={[inboxStyles.markAllBtn, inboxStyles.clearAllBtn, { backgroundColor: c.card, borderColor: c.border }]}
            >
              {isClearingAll ? (
                <ActivityIndicator size="small" color={c.error} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={15} color={c.error} />
                  <Text style={[inboxStyles.markAllText, { color: c.error }]}>Clear all</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter Tabs */}
      <View style={inboxStyles.filtersWrap}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ScrollView horizontal style={{ flex: 1 }} showsHorizontalScrollIndicator={false} contentContainerStyle={inboxStyles.filtersRow} keyboardShouldPersistTaps="handled">
          {categories.map(([key, label]) => {
            const selected = filter === key;
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  triggerSelectionHaptic();
                  setFilter(key);
                }}
                style={[
                  inboxStyles.filterChip,
                  selected
                    ? { backgroundColor: c.primary }
                    : { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 },
                ]}
              >
                <Text
                  style={[
                    inboxStyles.filterChipText,
                    { color: selected ? '#FFFFFF' : c.textSecondary },
                    selected && { fontWeight: '700' },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}

        </ScrollView>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Show fewer notification categories' : 'Show more notification categories'}
            onPress={() => {
              triggerSelectionHaptic();
              setExpanded((prev) => !prev);
            }}
            style={[
              inboxStyles.filterChip,
              inboxStyles.moreChip,
              { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 },
            ]}
          >
            <Text style={[inboxStyles.filterChipText, { color: c.primary, fontWeight: '700' }]}>
              {expanded ? 'Less' : 'More'}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={c.primary}
              style={{ marginLeft: 3 }}
            />
          </TouchableOpacity>
        </View>

        {/* Expanded categories */}
        {expanded && (
          <View style={inboxStyles.expandedRow}>
            {moreCategories.map(([key, label]) => {
              const selected = filter === key;
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setFilter(key);
                  }}
                  style={[
                    inboxStyles.filterChip,
                    selected
                      ? { backgroundColor: c.primary }
                      : { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 },
                  ]}
                >
                  <Text
                    style={[
                      inboxStyles.filterChipText,
                      { color: selected ? '#FFFFFF' : c.textSecondary },
                      selected && { fontWeight: '700' },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Error alert */}
      {!!error && failedOffset === null && (
        <View style={[inboxStyles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <Text style={inboxStyles.errorText}>{error}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry loading notifications"
            disabled={initialLoading || refreshing || loadingMore}
            onPress={() => void load(0, items.length ? 'refresh' : 'initial')}
            style={[inboxStyles.retryButton, { borderColor: c.error }]}
          >
            {initialLoading || refreshing ? (
              <ActivityIndicator size="small" color={c.error} />
            ) : (
              <Text style={[inboxStyles.retryButtonText, { color: c.error }]}>Retry</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      </>}
      ListEmptyComponent={initialLoading ? (
        <View style={{ gap: 10 }}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={[inboxStyles.card, { backgroundColor: c.card, borderColor: c.border, opacity: 0.78 }]}>
              <View style={[inboxStyles.iconBadge, { backgroundColor: c.surfaceMuted }]} />
              <View style={{ flex: 1, gap: 9 }}>
                <View style={{ width: '52%', height: 13, borderRadius: 7, backgroundColor: c.surfaceMuted }} />
                <View style={{ width: '92%', height: 11, borderRadius: 6, backgroundColor: c.surfaceMuted }} />
                <View style={{ width: '68%', height: 11, borderRadius: 6, backgroundColor: c.surfaceMuted }} />
              </View>
            </View>
          ))}
        </View>
      ) : !error ? (
        <View style={inboxStyles.emptyStateContainer}>
          <View style={[inboxStyles.emptyIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
            <Ionicons name="notifications-outline" size={40} color={c.primary} />
          </View>
          <Text style={[inboxStyles.emptyTitle, { color: c.textPrimary }]}>
            {filter === 'all' ? 'No notifications yet' : filter === 'unread' ? 'All caught up' : 'No updates in this category'}
          </Text>
          <Text style={[inboxStyles.emptySubtitle, { color: c.textSecondary }]}>
            {filter === 'unread'
              ? 'You have no unread notifications.'
              : filter === 'all'
                ? 'Updates about challenges, events, and community activities will show up here.'
                : 'Try another category or check back later.'}
          </Text>
        </View>
      ) : null}
      renderItem={({ item: n, index }) => {
        const themeCat =
          categoryThemeColors[n.type as NotificationType] ?? categoryThemeColors.system;
        const iconName =
          iconMap[n.type as NotificationType] ?? 'information-circle';
        const isChallenge = n.type === 'challenge';
        const previousIsChallenge = index > 0 && items[index - 1].type === 'challenge' && notificationDayGroup(items[index - 1].createdAt) === notificationDayGroup(n.createdAt);
        const nextIsChallenge = index < items.length - 1 && items[index + 1].type === 'challenge' && notificationDayGroup(items[index + 1].createdAt) === notificationDayGroup(n.createdAt);
        const inChallengeGroup = groupChallengesInAll && isChallenge;
        const continuesChallengeGroup = inChallengeGroup && previousIsChallenge;
        const endsChallengeGroup = inChallengeGroup && !nextIsChallenge;
        const dayGroup = dayGroups[index];


        return <React.Fragment key={n.id}>
          {dayGroup?.previous !== dayGroup?.current && (
            <View style={inboxStyles.dayGroupHeader}>
              <Text style={[inboxStyles.dayGroupLabel, { color: c.textSecondary }]}>{dayGroup?.current}</Text>
              <View style={[inboxStyles.dayGroupRule, { backgroundColor: c.border }]} />
            </View>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${n.isRead ? 'Read' : 'New'} notification: ${n.title}. ${n.message}`}
            onPress={() => void open(n)}
            activeOpacity={0.75}
            style={[
              inboxStyles.card,
              {
                backgroundColor: n.isRead ? c.card : c.surface,
                borderColor: n.isRead ? c.border : 'rgba(34, 197, 94, 0.4)',
                marginBottom: inChallengeGroup ? (endsChallengeGroup ? verticalScale(10) : 0) : verticalScale(10),
                borderTopWidth: continuesChallengeGroup ? 0 : 1,
                borderBottomWidth: inChallengeGroup && !endsChallengeGroup ? StyleSheet.hairlineWidth : 1,
                borderTopLeftRadius: continuesChallengeGroup ? 0 : moderateScale(18),
                borderTopRightRadius: continuesChallengeGroup ? 0 : moderateScale(18),
                borderBottomLeftRadius: inChallengeGroup && !endsChallengeGroup ? 0 : moderateScale(18),
                borderBottomRightRadius: inChallengeGroup && !endsChallengeGroup ? 0 : moderateScale(18),
              },
            ]}
          >
            {/* Category Icon Badge */}
            <View style={[inboxStyles.iconBadge, { backgroundColor: themeCat.lightBg }]}>
              <Ionicons name={iconName} size={22} color={themeCat.color} />
            </View>

            {/* Notification Body */}
            <View style={inboxStyles.cardBody}>
              <View style={inboxStyles.cardHeader}>
                <Text
                  style={[
                    inboxStyles.cardTitle,
                    {
                      color: c.textPrimary,
                      fontWeight: n.isRead ? '600' : '800',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {n.title}
                </Text>
                {!n.isRead && (
                  <View style={inboxStyles.newBadge}>
                    <Text style={inboxStyles.newBadgeText}>NEW</Text>
                  </View>
                )}
                <Text style={[inboxStyles.cardTime, { color: c.textMuted }]}>
                  {notificationTime(n.createdAt)}
                </Text>
              </View>

              <Text
                style={[
                  inboxStyles.cardMessage,
                  { color: n.isRead ? c.textSecondary : c.textPrimary },
                ]}
                numberOfLines={3}
              >
                {n.message}
              </Text>
            </View>

            {/* Unread Status Dot */}
            {!n.isRead && (
              <View style={[inboxStyles.unreadDot, { backgroundColor: c.primary }]} />
            )}
          </TouchableOpacity>
        </React.Fragment>;
      }}
      ListFooterComponent={failedOffset !== null ? (
        <View style={[inboxStyles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
          <Ionicons name="alert-circle" size={18} color={c.error} />
          <Text style={inboxStyles.errorText}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading older notifications" onPress={() => void load(failedOffset, 'more')} style={[inboxStyles.retryButton, { borderColor: c.error }]}>
            <Text style={[inboxStyles.retryButtonText, { color: c.error }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loadingMore ? (
        <ActivityIndicator color={c.primary} style={{ marginVertical: 16 }} />
      ) : next !== null && !initialLoading ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Load older notifications"
          onPress={() => void load(next, 'more')}
          style={[inboxStyles.loadMoreBtn, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Text style={[inboxStyles.loadMoreText, { color: c.primary }]}>Load older notifications</Text>
        </TouchableOpacity>
      ) : null}
    />
  );
}

const inboxStyles = StyleSheet.create({
  container: {
    paddingHorizontal: scale(18),
    paddingTop: verticalScale(12),
  },
  dayGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  dayGroupLabel: {
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dayGroupRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  newBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    alignSelf: 'center',
  },
  newBadgeText: {
    color: '#15803D',
    fontSize: responsiveFontSize(9),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  hero: {
    minHeight: verticalScale(82),
    borderRadius: moderateScale(18),
    padding: moderateScale(14),
    marginBottom: verticalScale(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
  },
  heroIcon: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDot: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FDE047',
    borderWidth: 2,
    borderColor: '#16A34A',
  },
  heroEyebrow: { color: 'rgba(255,255,255,0.76)', fontSize: responsiveFontSize(10), fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontSize: responsiveFontSize(18), fontWeight: '800', marginTop: 2 },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: responsiveFontSize(12), lineHeight: 17, marginTop: 4 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(12),
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(-6),
    marginBottom: verticalScale(10),
  },
  headerTitle: {
    fontSize: responsiveFontSize(20),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: responsiveFontSize(13),
    marginTop: verticalScale(3),
    maxWidth: scale(240),
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    gap: 4,
    minHeight: 40,
  },
  markAllText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
  },
  clearAllBtn: {
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  filtersWrap: {
    marginBottom: verticalScale(12),
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 2,
  },
  expandedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: verticalScale(8),
    paddingTop: verticalScale(8),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  filterChip: {
    paddingVertical: verticalScale(7),
    paddingHorizontal: scale(14),
    minHeight: 40,
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChipText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(12),
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(14),
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: responsiveFontSize(13),
    flex: 1,
    fontWeight: '600',
  },
  retryButton: {
    minWidth: scale(58),
    minHeight: verticalScale(44),
    borderWidth: 1,
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(10),
  },
  retryButtonText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(60),
    paddingHorizontal: scale(20),
  },
  emptyIconCircle: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
  },
  emptyTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: '700',
    marginBottom: verticalScale(6),
  },
  emptySubtitle: {
    fontSize: responsiveFontSize(14),
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: scale(260),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: moderateScale(14),
    borderRadius: moderateScale(18),
    marginBottom: verticalScale(10),
    borderWidth: 1,
  },
  iconBadge: {
    width: scale(42),
    height: scale(42),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: verticalScale(4),
  },
  cardTitle: {
    fontSize: responsiveFontSize(15),
    flex: 1,
    marginRight: scale(8),
  },
  cardTime: {
    fontSize: responsiveFontSize(11),
    fontWeight: '500',
  },
  cardMessage: {
    fontSize: responsiveFontSize(13),
    lineHeight: 18,
  },
  unreadDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    marginLeft: scale(8),
    marginTop: verticalScale(4),
  },
  loadMoreBtn: {
    marginTop: verticalScale(8),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
  },
});
