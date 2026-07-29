import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { PublicProfileModal } from './PublicProfileModal';
import type { SwapListing } from './types';
import { CATEGORY_LABELS, CONDITION_LABELS, MEETUP_LABELS } from './types';

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

export function SwapListingCard({
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const mainImage = listing.images.length > 0 ? getValidImageUrl(listing.images[0].url) : undefined;
  const user = listing.user;

  return (
    <>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        localStyles.card,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
      ]}
    >
      {mainImage ? (
        <Image source={{ uri: mainImage }} style={localStyles.cardImage} resizeMode="cover" />
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
          <Text style={localStyles.timeText}>{getTimeAgo(listing.postedAt)}</Text>
        </View>

        <Text style={localStyles.cardTitle} numberOfLines={1}>
          {listing.title}
        </Text>

        <View style={localStyles.offerLookingRow}>
          <View style={localStyles.offerBadge}>
            <Text style={localStyles.offerBadgeLabel}>Offering</Text>
            <Text style={localStyles.offerBadgeValue} numberOfLines={1}>
              {listing.quantity} {listing.title}
            </Text>
          </View>
          <Ionicons name="swap-horizontal" size={18} color={ecoTheme.colors.primaryDark} style={{ marginHorizontal: 4 }} />
          <View style={localStyles.lookingBadge}>
            <Text style={localStyles.lookingBadgeLabel}>Looking For</Text>
            <Text style={localStyles.lookingBadgeValue} numberOfLines={1}>
              {listing.lookingFor}
            </Text>
          </View>
        </View>

        <View style={localStyles.metaRow}>
          <View style={localStyles.conditionBadge}>
            <Text style={[localStyles.conditionText, { color: getConditionColor(listing.condition) }]}>
              {CONDITION_LABELS[listing.condition]}
            </Text>
          </View>
          <View style={localStyles.meetupBadge}>
            <Ionicons name={getMeetupIcon(listing.meetupMethod) as any} size={12} color={ecoTheme.colors.textSoft} />
            <Text style={localStyles.meetupText}>
              {MEETUP_LABELS[listing.meetupMethod]}
            </Text>
          </View>
          {listing.city && (
            <View style={localStyles.locationBadge}>
              <Ionicons name="location-sharp" size={11} color={ecoTheme.colors.textSoft} />
              <Text style={localStyles.locationText} numberOfLines={1}>
                {listing.city}
                {listing.province ? `, ${listing.province}` : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={localStyles.userRow}>
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
              <Text style={localStyles.userName} numberOfLines={1}>{user.displayName}</Text>
              <View style={localStyles.userStatsRow}>
                <Ionicons name="star" size={11} color="#F59E0B" />
                <Text style={localStyles.userRating}>{user.rating.toFixed(1)}</Text>
                <Text style={localStyles.userSwaps}>{user.successfulSwaps} swaps</Text>
              </View>
            </View>
          </TouchableOpacity>
          {!isOwnListing && onSwap && (
            <TouchableOpacity style={localStyles.swapButton} onPress={onSwap}>
              <Text style={localStyles.swapButtonText}>
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
  cardImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#E4E9E6',
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
    fontSize: 11,
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 12,
    color: ecoTheme.colors.textSoft,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ecoTheme.colors.text,
    marginBottom: 10,
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
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  offerBadgeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  lookingBadge: {
    flex: 1,
    backgroundColor: '#FEF9EE',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDECC8',
  },
  lookingBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  lookingBadgeValue: {
    fontSize: 13,
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
    fontSize: 11,
    fontWeight: '700',
  },
  meetupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5FBF8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0EFE3',
  },
  meetupText: {
    fontSize: 11,
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5FBF8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0EFE3',
  },
  locationText: {
    fontSize: 11,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 36,
    height: 36,
  },
  userAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  userStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  userRating: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  userSwaps: {
    fontSize: 11,
    color: ecoTheme.colors.textSoft,
  },
  swapButton: {
    backgroundColor: ecoTheme.colors.primaryDark,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#13917B',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  swapButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ownListingBadge: {
    backgroundColor: '#E4F0E8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C8E0D0',
  },
  ownListingText: {
    fontSize: 12,
    fontWeight: '700',
    color: ecoTheme.colors.primaryDark,
  },
});
