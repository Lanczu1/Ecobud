import React, { useRef, useState, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ecoTheme, useTheme } from '../../shared/theme/ecoTheme';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { PublicProfileModal } from './PublicProfileModal';
import type { SwapListing } from './types';
import { CATEGORY_LABELS, CONDITION_LABELS, MEETUP_LABELS } from './types';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';

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

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function getConditionColor(condition: string): string {
  switch (condition) {
    case 'new':
    case 'like_new':
      return '#059669';
    case 'good':
      return '#126027';
    case 'fair':
      return '#D97706';
    case 'worn':
      return '#DC2626';
    default:
      return '#6B7A75';
  }
}

function getMeetupIcon(method: string): string {
  switch (method) {
    case 'public':
      return 'location-outline';
    case 'pickup':
      return 'arrow-down-outline';
    case 'dropoff':
      return 'arrow-up-outline';
    default:
      return 'location-outline';
  }
}

function SwapListingCardComponent({
  listing,
  onPress,
  onSwap,
  isOwnListing,
}: {
  listing: SwapListing;
  onPress: () => void;
  onSwap?: () => void;
  isOwnListing?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeCardImage, setActiveCardImage] = useState(0);
  const images = listing.images.length > 0
    ? listing.images.map((img) => getValidImageUrl(img.url)).filter(Boolean) as string[]
    : [];
  const mainImage = images[0];
  const user = listing.user;
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
  };

  return (
    <>
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[localStyles.card, { transform: [{ scale: scaleValue }], backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
      {images.length > 0 ? (
        <View style={localStyles.cardImageWrapper}>
          <Image
            source={{ uri: images[activeCardImage] || mainImage }}
            style={localStyles.cardImage}
            resizeMode="cover"
          />
          {images.length > 1 && (
            <View style={localStyles.cardImageCounter}>
              <Ionicons name="images" size={11} color="#FFF" />
              <Text style={localStyles.cardImageCounterText}>
                {activeCardImage + 1}/{images.length}
              </Text>
            </View>
          )}

          {/* Mini Thumbnail Strip to preview other pictures */}
          {images.length > 1 && (
            <View style={localStyles.cardThumbStripContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={localStyles.cardThumbStrip}
              >
                {images.map((imgUri, idx) => {
                  const isActive = idx === activeCardImage;
                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.8}
                      onPress={(e) => {
                        e.stopPropagation();
                        setActiveCardImage(idx);
                      }}
                      style={[
                        localStyles.cardThumbItem,
                        isActive && localStyles.cardThumbItemActive,
                      ]}
                    >
                      <Image source={{ uri: imgUri }} style={localStyles.cardThumbImage} resizeMode="cover" />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      ) : (
        <View style={[localStyles.cardImage, localStyles.cardImageFallback]}>
          <Ionicons name="image-outline" size={40} color="#A7D5BA" />
        </View>
      )}

      <View style={localStyles.cardBody}>
        <View style={localStyles.cardHeader}>
          <View style={localStyles.categoryTag}>
            <Text style={localStyles.categoryTagText}>
              {CATEGORY_LABELS[listing.category] || listing.category}
            </Text>
          </View>
          <Text style={[localStyles.timeText, { color: theme.colors.textMuted }]}>{getTimeAgo(listing.postedAt)}</Text>
        </View>

        <Text style={[localStyles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {listing.title}
        </Text>

        <View style={localStyles.offerLookingRow}>
          <View style={[localStyles.offerBadge, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            <Text style={[localStyles.offerBadgeLabel, { color: theme.colors.textMuted }]}>Offering</Text>
            <Text style={[localStyles.offerBadgeValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {listing.quantity} {listing.title}
            </Text>
          </View>
          <Ionicons name="swap-horizontal" size={18} color={isDark ? theme.colors.primary : ecoTheme.colors.primaryDark} style={{ marginHorizontal: 4 }} />
          <View style={[localStyles.lookingBadge, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            <Text style={[localStyles.lookingBadgeLabel, { color: theme.colors.textMuted }]}>Looking For</Text>
            <Text style={[localStyles.lookingBadgeValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {listing.lookingFor}
            </Text>
          </View>
        </View>

        <View style={localStyles.metaRow}>
          <View style={[localStyles.conditionBadge, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            <Text style={[localStyles.conditionText, { color: getConditionColor(listing.condition) }]}>
              {CONDITION_LABELS[listing.condition]}
            </Text>
          </View>
          <View style={[localStyles.meetupBadge, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            <Ionicons name={getMeetupIcon(listing.meetupMethod) as any} size={12} color={theme.colors.textMuted} />
            <Text style={[localStyles.meetupText, { color: theme.colors.textMuted }]}>
              {MEETUP_LABELS[listing.meetupMethod]}
            </Text>
          </View>
          {listing.city && (
            <View style={[localStyles.locationBadge, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
              <Ionicons name="location-sharp" size={11} color={theme.colors.textMuted} />
              <Text style={[localStyles.locationText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {listing.city}
                {listing.province ? `, ${listing.province}` : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={[localStyles.userRow, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity 
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} 
            onPress={(e) => {
              e.stopPropagation();
              setShowProfileModal(true);
            }}
          >
            <View style={localStyles.userAvatar}>
              {user.avatarUrl ? (
                <Image
                  source={{ uri: getValidImageUrl(user.avatarUrl) }}
                  style={localStyles.userAvatarImage}
                />
              ) : (
                <Text style={localStyles.userAvatarText}>{getInitials(user.displayName)}</Text>
              )}
            </View>
            <View style={localStyles.userInfo}>
              <Text style={[localStyles.userName, { color: theme.colors.textPrimary }]} numberOfLines={1}>{user.displayName}</Text>
              <View style={localStyles.userStatsRow}>
                <Ionicons name="star" size={11} color="#F59E0B" />
                <Text style={localStyles.userRating}>{user.rating.toFixed(1)}</Text>
                <Text style={[localStyles.userSwaps, { color: theme.colors.textMuted }]}>{user.successfulSwaps} swaps</Text>
              </View>
            </View>
          </TouchableOpacity>
          {!isOwnListing && onSwap && (
            <TouchableOpacity style={[localStyles.swapButton, isDark && { backgroundColor: theme.colors.primary }]} onPress={onSwap}>
              <Text style={[localStyles.swapButtonText, isDark && { color: '#0E1512' }]}>
                {listing.lookingFor?.toLowerCase() === 'giveaway' ? 'Request' : 'Swap Now'}
              </Text>
            </TouchableOpacity>
          )}
          {isOwnListing && (
            <View style={localStyles.ownListingBadge}>
              {(listing as any).approvalStatus && (listing as any).approvalStatus !== 'approved' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: (listing as any).approvalStatus === 'rejected' ? '#EF4444' : '#F59E0B',
                  }} />
                  <Text style={[localStyles.ownListingText, {
                    color: (listing as any).approvalStatus === 'rejected' ? '#EF4444' : '#F59E0B',
                  }]}>
                    {(listing as any).approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}
                  </Text>
                </View>
              ) : (
                <Text style={localStyles.ownListingText}>Your Listing</Text>
              )}
            </View>
          )}
        </View>
      </View>
      </Animated.View>
      </Pressable>
      <PublicProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
      />
    </>
  );
}

export function SwapListingSkeleton() {
  return (
    <View style={[localStyles.card, { opacity: 0.6 }]}>
      <View style={[localStyles.cardImage, { backgroundColor: '#E4E9E6' }]} />
      <View style={localStyles.cardBody}>
        <View style={{ height: 14, width: 60, borderRadius: 7, backgroundColor: '#E4E9E6', marginBottom: 8 }} />
        <View style={{ height: 18, width: '70%', borderRadius: 9, backgroundColor: '#E4E9E6', marginBottom: 10 }} />
        <View style={{ height: 14, width: '90%', borderRadius: 7, backgroundColor: '#E4E9E6', marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ height: 28, width: 80, borderRadius: 14, backgroundColor: '#E4E9E6' }} />
          <View style={{ height: 28, width: 80, borderRadius: 14, backgroundColor: '#E4E9E6' }} />
        </View>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ecoTheme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E4F0E8',
    shadowColor: ecoTheme.colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: 16,
  },
  cardImageWrapper: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#E4E9E6',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E4E9E6',
  },
  cardImageCounter: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cardImageCounterText: {
    color: '#FFF',
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
  },
  cardThumbStripContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  cardThumbStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
  },
  cardThumbItem: {
    width: scale(38),
    height: scale(38),
    borderRadius: moderateScale(8),
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cardThumbItemActive: {
    borderColor: '#4ADE80',
    borderWidth: 2,
  },
  cardThumbImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTag: {
    backgroundColor: ecoTheme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  categoryTagText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: responsiveFontSize(12),
    color: ecoTheme.colors.textSoft,
  },
  cardTitle: {
    fontSize: responsiveFontSize(17),
    fontWeight: '800',
    color: ecoTheme.colors.text,
    marginBottom: verticalScale(8),
    flexShrink: 1,
  },
  offerLookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  offerBadge: {
    flex: 1,
    backgroundColor: '#EEFBF2',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D1F5DC',
  },
  offerBadgeLabel: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: verticalScale(2),
  },
  offerBadgeValue: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  lookingBadge: {
    flex: 1,
    backgroundColor: '#FEF9EE',
    borderRadius: moderateScale(12),
    padding: moderateScale(8),
    borderWidth: 1,
    borderColor: '#FDECC8',
  },
  lookingBadgeLabel: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#D97706',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: verticalScale(2),
  },
  lookingBadgeValue: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  conditionBadge: {
    backgroundColor: '#F5FBF8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0EFE3',
  },
  conditionText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
  },
  meetupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5FBF8',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#E0EFE3',
  },
  meetupText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5FBF8',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#E0EFE3',
  },
  locationText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F5F2',
    paddingTop: 12,
  },
  userAvatar: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: scale(36),
    height: scale(36),
  },
  userAvatarText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: ecoTheme.colors.text,
    flexShrink: 1,
  },
  userStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: verticalScale(2),
  },
  userRating: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
    color: '#D97706',
  },
  userSwaps: {
    fontSize: responsiveFontSize(11),
    color: ecoTheme.colors.textSoft,
  },
  swapButton: {
    backgroundColor: ecoTheme.colors.primaryDark,
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(20),
    shadowColor: '#13917B',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 3,
  },
  swapButtonText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ownListingBadge: {
    backgroundColor: '#E4F0E8',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: '#C8E0D0',
  },
  ownListingText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
  },
});

export const SwapListingCard = memo(
  SwapListingCardComponent,
  (prevProps, nextProps) =>
    prevProps.listing.id === nextProps.listing.id &&
    prevProps.listing.title === nextProps.listing.title &&
    prevProps.listing.isActive === nextProps.listing.isActive &&
    prevProps.listing.approvalStatus === nextProps.listing.approvalStatus &&
    prevProps.isOwnListing === nextProps.isOwnListing &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onSwap === nextProps.onSwap
);

