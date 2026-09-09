import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  DeviceEventEmitter,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ecobudApi } from '../../shared/api/ecobudApi';
import type { AppNotification, NotificationType } from '../types/notifications';
import type { EcoBudMobileModel } from '../types/home';
import { useTheme } from '../../shared/theme/ecoTheme';
import { homeService } from '../services/homeService';
import { scale, verticalScale, moderateScale, responsiveFontSize } from '../utils/responsive';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../utils/haptics';

const categories = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['challenge', 'Challenges'],
  ['event', 'Events'],
] as const;

const moreCategories = [
  ['verification', 'Verification'],
  ['swap', 'Swap / GGH'],
  ['chat', 'Chat'],
  ['reward', 'Reward'],
  ['learning', 'Learning'],
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

export function NotificationInbox({ model }: { model: EcoBudMobileModel }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const token = model.session?.token;

  const [filter, setFilter] = React.useState<string>('all');
  const [expanded, setExpanded] = React.useState(false);
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [next, setNext] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);
  const [error, setError] = React.useState('');
  const generation = React.useRef(0);

  const load = React.useCallback(
    async (offset = 0) => {
      if (!token) return;
      const g = ++generation.current;
      setBusy(true);
      setError('');
      try {
        const q = filter === 'unread' ? '&unread=true' : filter === 'all' ? '' : `&type=${filter}`;
        const p = await ecobudApi.notifications(token, `?offset=${offset}${q}`);
        if (g === generation.current) {
          setItems((old) =>
            offset ? [...old, ...p.items.filter((n) => !old.some((o) => o.id === n.id))] : p.items,
          );
          setNext(p.nextOffset);
        }
      } catch {
        if (g === generation.current) {
          setError('Unable to load notifications. Pull down to retry.');
        }
      } finally {
        if (g === generation.current) {
          setBusy(false);
        }
      }
    },
    [token, filter],
  );

  React.useEffect(() => {
    setItems([]);
    void load();
    const sub = DeviceEventEmitter.addListener('notificationsInboxRefresh', () => void load());
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
        setItems((old) => old.map((o) => (o.id === n.id ? { ...o, isRead: true } : o)));
        DeviceEventEmitter.emit('notificationsChanged');
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
            Alert.alert('Content unavailable', 'This challenge is no longer available.');
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
        Alert.alert(n.title, n.message);
      }
    } catch {
      Alert.alert('Unable to open notification', 'Please check your connection and try again.');
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
      DeviceEventEmitter.emit('notificationsChanged');
      await load();
    } catch {
      setError('Unable to mark notifications as read. Try again.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const hasUnread = items.some((item) => !item.isRead);

  return (
    <ScrollView
      contentContainerStyle={inboxStyles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} tintColor={c.primary} />}
    >
      {/* Header Row */}
      <View style={inboxStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[inboxStyles.headerTitle, { color: c.textPrimary }]}>Notifications</Text>
          <Text style={[inboxStyles.headerSubtitle, { color: c.textSecondary }]}>
            Stay updated on challenges, rewards, and eco events
          </Text>
        </View>
        {hasUnread && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            onPress={handleMarkAllRead}
            disabled={isMarkingAll}
            style={[inboxStyles.markAllBtn, { backgroundColor: c.card }]}
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
      </View>

      {/* Filter Tabs */}
      <View style={inboxStyles.filtersWrap}>
        <View style={inboxStyles.filtersRow}>
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

          <TouchableOpacity
            accessibilityRole="button"
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
      {!!error && (
        <View style={[inboxStyles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <Text style={inboxStyles.errorText}>{error}</Text>
        </View>
      )}

      {/* Empty State */}
      {!busy && !error && items.length === 0 && (
        <View style={inboxStyles.emptyStateContainer}>
          <View style={[inboxStyles.emptyIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
            <Ionicons name="notifications-outline" size={40} color={c.primary} />
          </View>
          <Text style={[inboxStyles.emptyTitle, { color: c.textPrimary }]}>No notifications yet</Text>
          <Text style={[inboxStyles.emptySubtitle, { color: c.textSecondary }]}>
            {filter === 'unread'
              ? "You're all caught up! No unread notifications."
              : 'Updates about challenges, events, and community activities will show up here.'}
          </Text>
        </View>
      )}

      {/* Notifications List */}
      {items.map((n) => {
        const themeCat =
          categoryThemeColors[n.type as NotificationType] ?? categoryThemeColors.system;
        const iconName =
          iconMap[n.type as NotificationType] ?? 'information-circle';


        return (
          <TouchableOpacity
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={`${n.isRead ? 'Read' : 'Unread'} notification: ${n.title}. ${n.message}`}
            onPress={() => void open(n)}
            activeOpacity={0.75}
            style={[
              inboxStyles.card,
              {
                backgroundColor: n.isRead ? c.card : c.surface,
                borderColor: n.isRead ? c.border : 'rgba(34, 197, 94, 0.4)',
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
        );
      })}

      {/* Busy Spinner */}
      {busy && items.length > 0 && (
        <ActivityIndicator color={c.primary} style={{ marginVertical: 16 }} />
      )}

      {/* Load More Button */}
      {next !== null && !busy && (
        <TouchableOpacity
          onPress={() => void load(next)}
          style={[inboxStyles.loadMoreBtn, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Text style={[inboxStyles.loadMoreText, { color: c.primary }]}>Load older notifications</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const inboxStyles = StyleSheet.create({
  container: {
    paddingHorizontal: scale(18),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(100),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(16),
  },
  headerTitle: {
    fontSize: responsiveFontSize(26),
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
  },
  markAllText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
  },
  filtersWrap: {
    marginBottom: verticalScale(16),
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
