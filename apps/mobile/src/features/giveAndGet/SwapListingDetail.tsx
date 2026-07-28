import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { swapService } from './swapService';
import type { SwapListing } from './types';
import { CATEGORY_LABELS, CONDITION_LABELS, MEETUP_LABELS } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

export function SwapListingDetail({
  listing,
  currentUserId,
  onBack,
  onRequestSwap,
  onDelete,
  onReport,
}: {
  listing: SwapListing;
  currentUserId?: string;
  onBack: () => void;
  onRequestSwap: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const isOwnListing = listing.user.id === currentUserId;
  const scrollRef = useRef<ScrollView>(null);

  const images = listing.images.length > 0
    ? listing.images.map((img) => getValidImageUrl(img.url)).filter(Boolean) as string[]
    : [];

  const handleDelete = () => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await swapService.deleteListing(listing.id);
              onDelete?.();
            } catch {
              Alert.alert('Error', 'Failed to delete listing');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={localStyles.safeArea}>
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onBack} style={localStyles.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={localStyles.headerTitle}>Listing Details</Text>
        <TouchableOpacity onPress={() => setShowActions(true)} style={localStyles.moreBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={localStyles.scroll}
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {images.length > 0 ? (
          <View style={localStyles.imageContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
              }}
            >
              {images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={localStyles.galleryImage} resizeMode="cover" />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={localStyles.pagination}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[localStyles.paginationDot, i === activeImageIndex && localStyles.paginationDotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[localStyles.imageContainer, localStyles.imageContainerFallback]}>
            <Ionicons name="image-outline" size={60} color="#A7D5BA" />
          </View>
        )}

        <View style={localStyles.content}>
          <View style={localStyles.titleRow}>
            <View style={localStyles.categoryTag}>
              <Text style={localStyles.categoryTagText}>
                {CATEGORY_LABELS[listing.category]}
              </Text>
            </View>
            <Text style={localStyles.timeText}>{getTimeAgo(listing.postedAt)}</Text>
          </View>

          <Text style={localStyles.title}>{listing.title}</Text>

          {isOwnListing && listing.approvalStatus && listing.approvalStatus !== 'approved' && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              backgroundColor: listing.approvalStatus === 'rejected' ? '#FEF2F2' : '#FFFBEB',
              borderWidth: 1,
              borderColor: listing.approvalStatus === 'rejected' ? '#FECACA' : '#FDE68A',
            }}>
              <View style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: listing.approvalStatus === 'rejected' ? '#EF4444' : '#F59E0B',
              }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: listing.approvalStatus === 'rejected' ? '#DC2626' : '#D97706' }}>
                  {listing.approvalStatus === 'rejected' ? 'Listing Rejected' : 'Pending Approval'}
                </Text>
                <Text style={{ fontSize: 11, color: listing.approvalStatus === 'rejected' ? '#991B1B' : '#92400E', marginTop: 2 }}>
                  {listing.approvalStatus === 'rejected'
                    ? 'This listing was not approved by the admin. Please review and edit.'
                    : 'Your listing is being reviewed by the admin. It will be visible once approved.'}
                </Text>
              </View>
            </View>
          )}

          <View style={localStyles.offerLookingCard}>
            <View style={localStyles.offerSection}>
              <Text style={localStyles.sectionLabel}>Offering</Text>
              <Text style={localStyles.sectionValue}>
                {listing.quantity} {listing.title}
              </Text>
            </View>
            <View style={localStyles.dividerVertical} />
            <View style={localStyles.lookingSection}>
              <Text style={localStyles.sectionLabel}>Looking For</Text>
              <Text style={localStyles.sectionValue}>{listing.lookingFor}</Text>
            </View>
          </View>

          <View style={localStyles.metaGrid}>
            <View style={localStyles.metaItem}>
              <Ionicons name="fitness-outline" size={16} color={ecoTheme.colors.primaryDark} />
              <Text style={localStyles.metaLabel}>Condition</Text>
              <Text style={localStyles.metaValue}>{CONDITION_LABELS[listing.condition]}</Text>
            </View>
            <View style={localStyles.metaItem}>
              <Ionicons name="location-outline" size={16} color={ecoTheme.colors.primaryDark} />
              <Text style={localStyles.metaLabel}>Meetup</Text>
              <Text style={localStyles.metaValue}>{MEETUP_LABELS[listing.meetupMethod]}</Text>
            </View>
            {listing.city && (
              <View style={localStyles.metaItem}>
                <Ionicons name="map-outline" size={16} color={ecoTheme.colors.primaryDark} />
                <Text style={localStyles.metaLabel}>Location</Text>
                <Text style={localStyles.metaValue}>
                  {listing.city}{listing.province ? `, ${listing.province}` : ''}
                </Text>
              </View>
            )}
            {listing.distanceKm != null && (
              <View style={localStyles.metaItem}>
                <Ionicons name="navigate-outline" size={16} color={ecoTheme.colors.primaryDark} />
                <Text style={localStyles.metaLabel}>Distance</Text>
                <Text style={localStyles.metaValue}>{listing.distanceKm.toFixed(1)} km</Text>
              </View>
            )}
          </View>

          {listing.meetupMethod === 'public' && listing.meetupLocation && (
            <View style={localStyles.meetupInfoCard}>
              <Ionicons name="location" size={18} color={ecoTheme.colors.primaryDark} />
              <View style={{ flex: 1 }}>
                <Text style={localStyles.meetupInfoTitle}>{listing.meetupLocation}</Text>
                {listing.meetupLandmark && (
                  <Text style={localStyles.meetupInfoSubtitle}>Landmark: {listing.meetupLandmark}</Text>
                )}
              </View>
            </View>
          )}

          {listing.meetupMethod === 'pickup' && (
            <View style={localStyles.meetupInfoCard}>
              <Ionicons name="information-circle" size={18} color="#2563EB" />
              <Text style={localStyles.meetupInfoText}>
                Pickup address will be shared after both users confirm the swap.
              </Text>
            </View>
          )}

          {listing.meetupMethod === 'dropoff' && (
            <View style={localStyles.meetupInfoCard}>
              <Ionicons name="information-circle" size={18} color="#2563EB" />
              <Text style={localStyles.meetupInfoText}>
                Delivery address will be shared after both users confirm the swap.
              </Text>
            </View>
          )}

          {listing.description ? (
            <>
              <Text style={localStyles.sectionTitle}>Description</Text>
              <Text style={localStyles.descriptionText}>{listing.description}</Text>
            </>
          ) : null}

          {listing.meetupNotes ? (
            <>
              <Text style={localStyles.sectionTitle}>Meetup Notes</Text>
              <Text style={localStyles.descriptionText}>{listing.meetupNotes}</Text>
            </>
          ) : null}

          <Text style={localStyles.sectionTitle}>Posted By</Text>
          <View style={localStyles.userCard}>
            <View style={localStyles.userAvatar}>
              {listing.user.avatarUrl ? (
                <Image
                  source={{ uri: getValidImageUrl(listing.user.avatarUrl) }}
                  style={localStyles.userAvatarImage}
                />
              ) : (
                <Text style={localStyles.userAvatarText}>
                  {getInitials(listing.user.displayName)}
                </Text>
              )}
            </View>
            <View style={localStyles.userInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={localStyles.userName}>{listing.user.displayName}</Text>
                {listing.user.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color="#2563EB" />
                )}
              </View>
              <View style={localStyles.userStats}>
                <View style={localStyles.userStat}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={localStyles.userStatText}>{listing.user.rating.toFixed(1)}</Text>
                </View>
                <View style={localStyles.userStat}>
                  <Ionicons name="swap-horizontal" size={12} color={ecoTheme.colors.primaryDark} />
                  <Text style={localStyles.userStatText}>{listing.user.successfulSwaps} swaps</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {!isOwnListing && (
        <View style={localStyles.bottomBar}>
          <TouchableOpacity onPress={onRequestSwap} style={localStyles.swapBtn}>
            <LinearGradient
              colors={['#0B5F58', '#169070', '#69CDA8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.swapBtnGradient}
            >
              <Ionicons name="swap-horizontal" size={20} color="#FFF" />
              <Text style={localStyles.swapBtnText}>Request Swap</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity
          style={localStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActions(false)}
        >
          <View style={localStyles.actionSheet}>
            <View style={localStyles.actionHandle} />
            {isOwnListing ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setShowActions(false);
                    handleDelete();
                  }}
                  style={localStyles.actionItem}
                >
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  <Text style={[localStyles.actionText, { color: '#DC2626' }]}>Delete Listing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowActions(false)}
                  style={localStyles.actionItem}
                >
                  <Ionicons name="create-outline" size={20} color={ecoTheme.colors.text} />
                  <Text style={localStyles.actionText}>Edit Listing</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setShowActions(false);
                    onReport?.();
                  }}
                  style={localStyles.actionItem}
                >
                  <Ionicons name="flag-outline" size={20} color="#DC2626" />
                  <Text style={[localStyles.actionText, { color: '#DC2626' }]}>Report Listing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowActions(false)}
                  style={localStyles.actionItem}
                >
                  <Ionicons name="person-remove-outline" size={20} color="#DC2626" />
                  <Text style={[localStyles.actionText, { color: '#DC2626' }]}>Block User</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              onPress={() => setShowActions(false)}
              style={[localStyles.actionItem, { borderBottomWidth: 0 }]}
            >
              <Text style={localStyles.actionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: ecoTheme.colors.primaryDark,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  moreBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: 280,
    backgroundColor: '#E4E9E6',
  },
  imageContainerFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: 280,
  },
  pagination: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#FFF',
  },
  content: {
    padding: 18,
  },
  titleRow: {
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
  },
  timeText: {
    fontSize: 12,
    color: ecoTheme.colors.textSoft,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: ecoTheme.colors.text,
    marginBottom: 16,
  },
  offerLookingCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4F0E8',
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: ecoTheme.colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  offerSection: {
    flex: 1,
    padding: 14,
    backgroundColor: '#EEFBF2',
  },
  lookingSection: {
    flex: 1,
    padding: 14,
    backgroundColor: '#FEF9EE',
  },
  dividerVertical: {
    width: 1,
    backgroundColor: '#E4F0E8',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: ecoTheme.colors.textSoft,
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 15,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5FBF8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0EFE3',
  },
  metaLabel: {
    fontSize: 11,
    color: ecoTheme.colors.textSoft,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  meetupInfoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EEFBF2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D1F5DC',
    marginBottom: 16,
    alignItems: 'center',
  },
  meetupInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  meetupInfoSubtitle: {
    fontSize: 12,
    color: ecoTheme.colors.textSoft,
    marginTop: 2,
  },
  meetupInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#1E40AF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: ecoTheme.colors.text,
    marginBottom: 8,
    marginTop: 10,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: ecoTheme.colors.textSoft,
    marginBottom: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E4F0E8',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 48,
    height: 48,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  userStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  userStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userStatText: {
    fontSize: 13,
    color: ecoTheme.colors.textSoft,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingVertical: 14,
    paddingBottom: 30,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F5F2',
  },
  swapBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#13917B',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  swapBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  swapBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
  },
  actionHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F2',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: ecoTheme.colors.text,
  },
  actionCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
    textAlign: 'center',
    width: '100%',
  },
});
