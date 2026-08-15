import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { swapService } from './swapService';
import { PublicProfileModal } from './PublicProfileModal';
import type { SwapListing } from './types';
import { CATEGORY_LABELS, CONDITION_LABELS, MEETUP_LABELS } from './types';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';

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
  listing: initialListing,
  currentUserId,
  onBack,
  onRequestSwap,
  onDelete,
  onReport,
  onUpdated,
}: {
  listing: SwapListing;
  currentUserId?: string;
  onBack: () => void;
  onRequestSwap: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onUpdated?: (updated: SwapListing) => void;
}) {
  const [listing, setListing] = useState<SwapListing>(initialListing);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit form states
  const [editTitle, setEditTitle] = useState(listing.title);
  const [editQuantity, setEditQuantity] = useState(listing.quantity);
  const [editLookingFor, setEditLookingFor] = useState(listing.lookingFor);
  const [editDescription, setEditDescription] = useState(listing.description);
  const [editMeetupLocation, setEditMeetupLocation] = useState(listing.meetupLocation || '');
  const [editMeetupLandmark, setEditMeetupLandmark] = useState(listing.meetupLandmark || '');
  const [editMeetupNotes, setEditMeetupNotes] = useState(listing.meetupNotes || '');
  const isOwnListing = listing.user.id === currentUserId;
  const isApproved = listing.approvalStatus === 'approved' || (listing as any).approvalStatus === undefined;
  const scrollRef = useRef<ScrollView>(null);
  const mainImageScrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  React.useEffect(() => {
    setListing(initialListing);
    setEditTitle(initialListing.title);
    setEditQuantity(initialListing.quantity);
    setEditLookingFor(initialListing.lookingFor);
    setEditDescription(initialListing.description);
    setEditMeetupLocation(initialListing.meetupLocation || '');
    setEditMeetupLandmark(initialListing.meetupLandmark || '');
    setEditMeetupNotes(initialListing.meetupNotes || '');
  }, [initialListing]);

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const images = listing.images.length > 0
    ? listing.images.map((img) => getValidImageUrl(img.url)).filter(Boolean) as string[]
    : [];

  const handleSelectThumbnail = (index: number) => {
    setActiveImageIndex(index);
    mainImageScrollRef.current?.scrollTo({
      x: index * SCREEN_WIDTH,
      animated: true,
    });
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editQuantity.trim()) {
      Alert.alert('Validation Error', 'Please enter a title and quantity');
      return;
    }
    try {
      setSavingEdit(true);
      await swapService.updateListing(listing.id, {
        title: editTitle.trim(),
        quantity: editQuantity.trim(),
        lookingFor: editLookingFor.trim(),
        description: editDescription.trim(),
        meetupLocation: editMeetupLocation.trim() || undefined,
        meetupLandmark: editMeetupLandmark.trim() || undefined,
        meetupNotes: editMeetupNotes.trim() || undefined,
      });
      const updatedListing: SwapListing = {
        ...listing,
        title: editTitle.trim(),
        quantity: editQuantity.trim(),
        lookingFor: editLookingFor.trim(),
        description: editDescription.trim(),
        meetupLocation: editMeetupLocation.trim() || undefined,
        meetupLandmark: editMeetupLandmark.trim() || undefined,
        meetupNotes: editMeetupNotes.trim() || undefined,
      };
      setListing(updatedListing);
      onUpdated?.(updatedListing);
      setShowEditModal(false);
      Alert.alert('Success', 'Listing details updated successfully!');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update listing');
    } finally {
      setSavingEdit(false);
    }
  };

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
    <Animated.View style={[localStyles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={localStyles.safeArea} edges={['top']}>
        {/* Header Bar */}
        <View style={localStyles.header}>
          <TouchableOpacity onPress={handleBack} style={localStyles.backBtn} activeOpacity={0.7}>
            <Feather name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={localStyles.headerTitle}>Listing Details</Text>
          <TouchableOpacity onPress={() => setShowActions(true)} style={localStyles.moreBtn} activeOpacity={0.7}>
            <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={localStyles.scroll}
          contentContainerStyle={localStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Gallery Carousel */}
          {images.length > 0 ? (
            <View style={localStyles.imageSection}>
              <View style={localStyles.imageContainer}>
                <ScrollView
                  ref={mainImageScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const nextIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setActiveImageIndex(nextIndex);
                  }}
                >
                  {images.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={localStyles.galleryImage} resizeMode="cover" />
                  ))}
                </ScrollView>

                {/* Counter Pill Badge */}
                <View style={localStyles.imageCounterBadge}>
                  <Ionicons name="images" size={12} color="#FFF" />
                  <Text style={localStyles.imageCounterText}>
                    {activeImageIndex + 1} / {images.length}
                  </Text>
                </View>

                {/* Pagination Dots */}
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

              {/* Thumbnails Row for fast browsing all photos */}
              {images.length > 1 && (
                <View style={localStyles.thumbnailContainer}>
                  <Text style={localStyles.thumbnailHeaderTitle}>
                    Photos ({images.length})
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={localStyles.thumbnailScrollContent}
                  >
                    {images.map((uri, idx) => {
                      const isActive = idx === activeImageIndex;
                      return (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.8}
                          onPress={() => handleSelectThumbnail(idx)}
                          style={[
                            localStyles.thumbnailWrapper,
                            isActive && localStyles.thumbnailWrapperActive,
                          ]}
                        >
                          <Image source={{ uri }} style={localStyles.thumbnailImage} resizeMode="cover" />
                          {isActive && (
                            <View style={localStyles.thumbnailActiveBadge}>
                              <Ionicons name="checkmark-circle" size={14} color="#126027" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : (
            <View style={[localStyles.imageContainer, localStyles.imageContainerFallback]}>
              <Ionicons name="image-outline" size={60} color="#A7D5BA" />
              <Text style={{ color: ecoTheme.colors.textSoft, fontSize: responsiveFontSize(13), marginTop: 8 }}>
                No photos available
              </Text>
            </View>
          )}

          {/* Details Card Content */}
          <View style={localStyles.content}>
            <View style={localStyles.cardBox}>
              <View style={localStyles.titleRow}>
                <View style={localStyles.categoryTag}>
                  <Ionicons name="pricetag-outline" size={13} color={ecoTheme.colors.primaryDark} />
                  <Text style={localStyles.categoryTagText}>
                    {CATEGORY_LABELS[listing.category] || listing.category}
                  </Text>
                </View>
                <View style={localStyles.timeBadge}>
                  <Ionicons name="time-outline" size={13} color={ecoTheme.colors.textSoft} />
                  <Text style={localStyles.timeText}>{getTimeAgo(listing.postedAt)}</Text>
                </View>
              </View>

              <Text style={localStyles.title}>{listing.title}</Text>

              {/* Status Banner */}
              {isOwnListing && listing.approvalStatus && listing.approvalStatus !== 'approved' && (
                <View style={[
                  localStyles.statusBanner,
                  listing.approvalStatus === 'rejected' ? localStyles.statusBannerRejected : localStyles.statusBannerPending
                ]}>
                  <View style={[
                    localStyles.statusDot,
                    { backgroundColor: listing.approvalStatus === 'rejected' ? '#EF4444' : '#F59E0B' }
                  ]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      localStyles.statusTitle,
                      { color: listing.approvalStatus === 'rejected' ? '#DC2626' : '#D97706' }
                    ]}>
                      {listing.approvalStatus === 'rejected' ? 'Listing Rejected' : 'Pending Approval'}
                    </Text>
                    <Text style={[
                      localStyles.statusSubtext,
                      { color: listing.approvalStatus === 'rejected' ? '#991B1B' : '#92400E' }
                    ]}>
                      {listing.approvalStatus === 'rejected'
                        ? 'This listing was not approved by the admin. Please review and edit.'
                        : 'Your listing is being reviewed by the admin. It will be visible once approved.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Offering vs Looking For */}
              <View style={localStyles.offerLookingCard}>
                <View style={localStyles.offerSection}>
                  <Text style={localStyles.sectionLabel}>Offering</Text>
                  <Text style={localStyles.sectionValue} numberOfLines={2}>
                    {listing.quantity} {listing.title}
                  </Text>
                </View>
                <View style={localStyles.offerDivider}>
                  <Ionicons name="swap-horizontal" size={18} color={ecoTheme.colors.primaryDark} />
                </View>
                <View style={localStyles.lookingSection}>
                  <Text style={localStyles.sectionLabel}>Looking For</Text>
                  <Text style={localStyles.sectionValue} numberOfLines={2}>{listing.lookingFor}</Text>
                </View>
              </View>

              {/* Badges / Meta Grid */}
              <View style={localStyles.metaGrid}>
                <View style={localStyles.metaItem}>
                  <Ionicons name="fitness-outline" size={15} color={ecoTheme.colors.primaryDark} />
                  <Text style={localStyles.metaLabel}>Condition:</Text>
                  <Text style={localStyles.metaValue}>{CONDITION_LABELS[listing.condition] || listing.condition}</Text>
                </View>
                <View style={localStyles.metaItem}>
                  <Ionicons name="location-outline" size={15} color={ecoTheme.colors.primaryDark} />
                  <Text style={localStyles.metaLabel}>Meetup:</Text>
                  <Text style={localStyles.metaValue}>{MEETUP_LABELS[listing.meetupMethod] || listing.meetupMethod}</Text>
                </View>
                {listing.city && (
                  <View style={localStyles.metaItem}>
                    <Ionicons name="map-outline" size={15} color={ecoTheme.colors.primaryDark} />
                    <Text style={localStyles.metaLabel}>Location:</Text>
                    <Text style={localStyles.metaValue}>
                      {listing.city}{listing.province ? `, ${listing.province}` : ''}
                    </Text>
                  </View>
                )}
                {listing.distanceKm != null && (
                  <View style={localStyles.metaItem}>
                    <Ionicons name="navigate-outline" size={15} color={ecoTheme.colors.primaryDark} />
                    <Text style={localStyles.metaLabel}>Distance:</Text>
                    <Text style={localStyles.metaValue}>{listing.distanceKm.toFixed(1)} km</Text>
                  </View>
                )}
              </View>

              {/* Meetup Information Card */}
              {listing.meetupMethod === 'public' && listing.meetupLocation && (
                <View style={localStyles.meetupInfoCard}>
                  <Ionicons name="location" size={20} color={ecoTheme.colors.primaryDark} />
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
                  <Ionicons name="information-circle" size={20} color="#2563EB" />
                  <Text style={localStyles.meetupInfoText}>
                    Pickup address will be shared after both users confirm the swap.
                  </Text>
                </View>
              )}

              {listing.meetupMethod === 'dropoff' && (
                <View style={localStyles.meetupInfoCard}>
                  <Ionicons name="information-circle" size={20} color="#2563EB" />
                  <Text style={localStyles.meetupInfoText}>
                    Delivery address will be shared after both users confirm the swap.
                  </Text>
                </View>
              )}

              {/* Description */}
              {listing.description ? (
                <View style={localStyles.sectionWrapper}>
                  <Text style={localStyles.sectionTitle}>Description</Text>
                  <Text style={localStyles.descriptionText}>{listing.description}</Text>
                </View>
              ) : null}

              {/* Meetup Notes */}
              {listing.meetupNotes ? (
                <View style={localStyles.sectionWrapper}>
                  <Text style={localStyles.sectionTitle}>Meetup Notes</Text>
                  <Text style={localStyles.descriptionText}>{listing.meetupNotes}</Text>
                </View>
              ) : null}
            </View>

            {/* Poster Info Card */}
            <Text style={[localStyles.sectionTitle, { marginLeft: scale(4), marginBottom: verticalScale(8) }]}>
              Posted By
            </Text>
            <TouchableOpacity
              style={localStyles.userCard}
              activeOpacity={0.8}
              onPress={() => setShowProfileModal(true)}
            >
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
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text style={localStyles.userStatText}>{listing.user.rating.toFixed(1)}</Text>
                  </View>
                  <View style={localStyles.userStatDivider} />
                  <View style={localStyles.userStat}>
                    <Ionicons name="swap-horizontal" size={13} color={ecoTheme.colors.primaryDark} />
                    <Text style={localStyles.userStatText}>{listing.user.successfulSwaps} swaps</Text>
                  </View>
                </View>
              </View>
              <View style={localStyles.profileArrow}>
                <Ionicons name="chevron-forward" size={18} color="#6B7A75" />
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom CTA for Requesting Swap or Editing own Listing */}
        {!isOwnListing ? (
          <View style={localStyles.bottomBar}>
            <TouchableOpacity onPress={onRequestSwap} style={localStyles.swapBtn} activeOpacity={0.85}>
              <LinearGradient
                colors={['#0B5F58', '#126027', '#169070']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={localStyles.swapBtnGradient}
              >
                <Ionicons
                  name={listing.lookingFor?.toLowerCase() === 'giveaway' ? 'gift' : 'swap-horizontal'}
                  size={20}
                  color="#FFF"
                />
                <Text style={localStyles.swapBtnText}>
                  {listing.lookingFor?.toLowerCase() === 'giveaway' ? 'Request Item' : 'Request Swap'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : isApproved ? (
          <View style={localStyles.bottomBar}>
            <TouchableOpacity
              onPress={() => setShowEditModal(true)}
              style={localStyles.swapBtn}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#0D5B2A', '#198A48', '#22C55E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={localStyles.swapBtnGradient}
              >
                <Ionicons name="create-outline" size={20} color="#FFF" />
                <Text style={localStyles.swapBtnText}>Edit Listing Details</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Action Sheet Modal */}
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
                  {isApproved && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowActions(false);
                        setShowEditModal(true);
                      }}
                      style={localStyles.actionItem}
                    >
                      <Ionicons name="create-outline" size={20} color="#126027" />
                      <Text style={[localStyles.actionText, { color: '#126027' }]}>Edit Listing Details</Text>
                    </TouchableOpacity>
                  )}
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
                style={[localStyles.actionItem, { borderBottomWidth: 0, justifyContent: 'center' }]}
              >
                <Text style={localStyles.actionCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Edit Listing Details Modal */}
        <Modal
          visible={showEditModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={localStyles.editModalOverlay}>
            <View style={localStyles.editModalContent}>
              <View style={localStyles.editModalHeader}>
                <Text style={localStyles.editModalTitle}>Edit Listing Details</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={localStyles.editModalClose}>
                  <Ionicons name="close" size={22} color="#1A211D" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }}>
                <Text style={localStyles.editFieldLabel}>Item Title *</Text>
                <TextInput
                  style={localStyles.editInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Listing title"
                />

                <Text style={localStyles.editFieldLabel}>Quantity *</Text>
                <TextInput
                  style={localStyles.editInput}
                  value={editQuantity}
                  onChangeText={setEditQuantity}
                  placeholder="e.g. 10 pcs"
                />

                <Text style={localStyles.editFieldLabel}>Looking For *</Text>
                <TextInput
                  style={localStyles.editInput}
                  value={editLookingFor}
                  onChangeText={setEditLookingFor}
                  placeholder="What you want in exchange"
                />

                <Text style={localStyles.editFieldLabel}>Description</Text>
                <TextInput
                  style={[localStyles.editInput, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={4}
                  placeholder="Detailed description"
                />

                <Text style={localStyles.editFieldLabel}>Meetup Location</Text>
                <TextInput
                  style={localStyles.editInput}
                  value={editMeetupLocation}
                  onChangeText={setEditMeetupLocation}
                  placeholder="e.g. SM City Calamba"
                />

                <Text style={localStyles.editFieldLabel}>Landmark</Text>
                <TextInput
                  style={localStyles.editInput}
                  value={editMeetupLandmark}
                  onChangeText={setEditMeetupLandmark}
                  placeholder="e.g. Near Entrance"
                />

                <Text style={localStyles.editFieldLabel}>Additional Notes</Text>
                <TextInput
                  style={[localStyles.editInput, { height: 75, textAlignVertical: 'top', paddingTop: 10 }]}
                  value={editMeetupNotes}
                  onChangeText={setEditMeetupNotes}
                  multiline
                  numberOfLines={3}
                  placeholder="Extra instructions"
                />

                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                  style={localStyles.saveEditButton}
                >
                  {savingEdit ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={localStyles.saveEditButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <PublicProfileModal
          visible={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          user={listing.user}
        />
      </SafeAreaView>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D5B2A',
  },
  container: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    backgroundColor: '#0D5B2A',
  },
  backBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: '900',
    color: '#FFF',
    flexShrink: 1,
    letterSpacing: -0.3,
  },
  moreBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  scrollContent: {
    paddingBottom: verticalScale(110),
  },
  imageSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  imageContainer: {
    width: '100%',
    height: verticalScale(270),
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  imageContainerFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(30),
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: verticalScale(270),
  },
  imageCounterBadge: {
    position: 'absolute',
    top: verticalScale(14),
    right: scale(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(14),
  },
  imageCounterText: {
    color: '#FFF',
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
  },
  pagination: {
    position: 'absolute',
    bottom: verticalScale(12),
    flexDirection: 'row',
    gap: scale(6),
    alignSelf: 'center',
  },
  paginationDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(3.5),
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  paginationDotActive: {
    width: scale(20),
    backgroundColor: '#FFFFFF',
  },
  thumbnailContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(16),
  },
  thumbnailHeaderTitle: {
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
    color: ecoTheme.colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: verticalScale(8),
  },
  thumbnailScrollContent: {
    gap: scale(10),
  },
  thumbnailWrapper: {
    width: scale(66),
    height: scale(66),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailWrapperActive: {
    borderColor: '#126027',
    shadowColor: '#126027',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailActiveBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  content: {
    padding: scale(16),
    gap: verticalScale(14),
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    padding: moderateScale(18),
    borderWidth: 1,
    borderColor: '#E4F0E8',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: '#EDF6F1',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: '#D2E8DA',
  },
  categoryTagText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    color: '#126027',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  timeText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '500',
    color: ecoTheme.colors.textSoft,
  },
  title: {
    fontSize: responsiveFontSize(22),
    fontWeight: '900',
    color: '#1A211D',
    marginBottom: verticalScale(12),
    letterSpacing: -0.4,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(10),
    marginBottom: verticalScale(14),
    padding: moderateScale(12),
    borderRadius: moderateScale(14),
    borderWidth: 1,
  },
  statusBannerPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBannerRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    marginTop: verticalScale(4),
  },
  statusTitle: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
  },
  statusSubtext: {
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(17),
    marginTop: verticalScale(2),
  },
  offerLookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAF9',
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: '#E2ECE5',
    marginBottom: verticalScale(14),
    overflow: 'hidden',
  },
  offerSection: {
    flex: 1,
    padding: moderateScale(12),
    backgroundColor: '#F0FAF3',
  },
  lookingSection: {
    flex: 1,
    padding: moderateScale(12),
    backgroundColor: '#FEF9EC',
  },
  offerDivider: {
    paddingHorizontal: scale(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: responsiveFontSize(10),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: ecoTheme.colors.textSoft,
    marginBottom: verticalScale(4),
  },
  sectionValue: {
    fontSize: responsiveFontSize(14),
    fontWeight: '800',
    color: '#1A211D',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: verticalScale(14),
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: '#F3FAF5',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: '#DFEFE4',
  },
  metaLabel: {
    fontSize: responsiveFontSize(11),
    color: ecoTheme.colors.textSoft,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
    color: '#1A211D',
  },
  meetupInfoCard: {
    flexDirection: 'row',
    gap: scale(10),
    backgroundColor: '#F0FAF3',
    borderRadius: moderateScale(14),
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: '#D4EFE0',
    marginBottom: verticalScale(14),
    alignItems: 'center',
  },
  meetupInfoTitle: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#1A211D',
  },
  meetupInfoSubtitle: {
    fontSize: responsiveFontSize(11),
    color: ecoTheme.colors.textSoft,
    marginTop: verticalScale(2),
  },
  meetupInfoText: {
    flex: 1,
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(18),
    color: '#1E40AF',
    fontWeight: '500',
  },
  sectionWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#F0F4F1',
    paddingTop: verticalScale(12),
    marginTop: verticalScale(8),
  },
  sectionTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: verticalScale(6),
  },
  descriptionText: {
    fontSize: responsiveFontSize(13),
    lineHeight: responsiveFontSize(20),
    color: '#4B5563',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(18),
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: '#E4F0E8',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  userAvatar: {
    width: scale(46),
    height: scale(46),
    borderRadius: scale(23),
    backgroundColor: '#126027',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: scale(46),
    height: scale(46),
  },
  userAvatarText: {
    fontSize: responsiveFontSize(16),
    fontWeight: '900',
    color: '#FFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: responsiveFontSize(15),
    fontWeight: '800',
    color: '#1A211D',
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(4),
  },
  userStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  userStatDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  userStatText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  profileArrow: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: '#F3FAF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    paddingBottom: verticalScale(28),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAEFEA',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  swapBtn: {
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    shadowColor: '#126027',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  swapBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    minHeight: verticalScale(48),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
  },
  swapBtnText: {
    fontSize: responsiveFontSize(16),
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingBottom: verticalScale(32),
    paddingTop: verticalScale(8),
  },
  actionHandle: {
    width: scale(40),
    height: verticalScale(4),
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginVertical: verticalScale(8),
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(14),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F2',
  },
  actionText: {
    fontSize: responsiveFontSize(15),
    fontWeight: '700',
    color: '#1A211D',
  },
  actionCancelText: {
    fontSize: responsiveFontSize(15),
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(32),
    maxHeight: '90%',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  editModalTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: '900',
    color: '#1A211D',
  },
  editModalClose: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: '#F3FAF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editFieldLabel: {
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: verticalScale(6),
    marginTop: verticalScale(10),
  },
  editInput: {
    minHeight: verticalScale(44),
    borderRadius: moderateScale(12),
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: '#D2E8DA',
    paddingHorizontal: scale(12),
    fontSize: responsiveFontSize(14),
    color: '#1A211D',
  },
  saveEditButton: {
    backgroundColor: '#126027',
    borderRadius: moderateScale(14),
    minHeight: verticalScale(46),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(20),
    marginBottom: verticalScale(10),
  },
  saveEditButtonText: {
    fontSize: responsiveFontSize(15),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
