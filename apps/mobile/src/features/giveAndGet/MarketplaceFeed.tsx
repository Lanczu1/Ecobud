import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Easing,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { SwapListingCard, SwapListingSkeleton } from './SwapListingCard';
import { SwapChatList } from './SwapChatView';
import { swapService } from './swapService';
import type { SwapListing, SwapCategory, MeetupMethod, SwapConversation } from './types';
import { CATEGORY_LABELS, CATEGORY_ICON, MEETUP_LABELS } from './types';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';
import { CoachMarkTarget } from '../../app/components/CoachMarkTarget';
import type { EcoBudMobileModel } from '../../app/types/home';

type SortOption = 'newest' | 'nearest' | 'active';
type FeedTab = 'browse' | 'chats' | 'mylistings';

export function MarketplaceFeed({
  currentUserId,
  onSelectListing,
  onCreateListing,
  onRequestSwap,
  activeTab,
  onTabChange,
  conversations,
  onSelectConversation,
  onRefreshConversations,
  model,
}: {
  currentUserId?: string;
  onSelectListing: (listing: SwapListing) => void;
  onCreateListing: () => void;
  onRequestSwap: (listing: SwapListing) => void;
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  conversations: SwapConversation[];
  onSelectConversation: (conversation: SwapConversation) => void;
  onRefreshConversations?: () => void;
  model?: EcoBudMobileModel;
}) {
  const [listings, setListings] = useState<SwapListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SwapCategory | 'all'>('all');
  const [selectedMeetup, setSelectedMeetup] = useState<MeetupMethod | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [myListings, setMyListings] = useState<SwapListing[]>([]);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const createBtnScale = useRef(new Animated.Value(1)).current;

  const handleCreatePressIn = () => {
    Animated.spring(createBtnScale, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
  };

  const handleCreatePressOut = () => {
    Animated.spring(createBtnScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
  };

  const categories: Array<{ key: SwapCategory | 'all'; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'plastic', label: 'Plastic' },
    { key: 'glass', label: 'Glass' },
    { key: 'metal', label: 'Metal' },
    { key: 'paper', label: 'Paper' },
    { key: 'cardboard', label: 'Cardboard' },
    { key: 'electronics', label: 'Electronics' },
    { key: 'clothing', label: 'Clothing' },
    { key: 'household', label: 'Household' },
    { key: 'plants', label: 'Plants' },
    { key: 'others', label: 'Others' },
  ];

  const meetupOptions: Array<{ key: MeetupMethod | 'all'; label: string; icon: string }> = [
    { key: 'all', label: 'All Meetups', icon: 'options-outline' },
    { key: 'public', label: 'Public Meetup', icon: 'location-outline' },
    { key: 'pickup', label: 'Door Pickup', icon: 'arrow-down-outline' },
    { key: 'dropoff', label: 'Door Drop-off', icon: 'arrow-up-outline' },
  ];

  const loadListings = useCallback(async () => {
    try {
      const data = await swapService.fetchListings({
        search: searchQuery || undefined,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        meetupMethod: selectedMeetup === 'all' ? undefined : selectedMeetup,
        sortBy,
      });
      setListings(data);
    } catch (err) {
      console.error('Failed to load listings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedCategory, selectedMeetup, sortBy]);

  const loadMyListings = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setMyListingsLoading(true);
      const data = await swapService.fetchMyListings(currentUserId);
      setMyListings(data);
    } catch (err) {
      console.error('Failed to load my listings:', err);
    } finally {
      setMyListingsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    if (activeTab === 'mylistings') {
      loadMyListings();
    }
  }, [activeTab, loadMyListings]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'mylistings') {
      loadMyListings();
    } else {
      setRefreshing(true);
      loadListings();
    }
  }, [activeTab, loadMyListings, loadListings]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  return (
    <ScrollView 
      style={localStyles.container}
      contentContainerStyle={{ paddingBottom: verticalScale(96) }}
      stickyHeaderIndices={[1]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        activeTab === 'browse' ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ecoTheme.colors.primaryDark}
          />
        ) : activeTab === 'mylistings' ? (
          <RefreshControl
            refreshing={myListingsLoading}
            onRefresh={loadMyListings}
            tintColor={ecoTheme.colors.primaryDark}
          />
        ) : undefined
      }
    >
      <View>
        {/* Compact page header — TopNavbar in MarketplaceHubView handles profile/logo/events/notifications */}
        <CoachMarkTarget
          name="giveAndGetHero"
          borderRadius={moderateScale(22)}
          active={Boolean(model?.coachMarksVisible && model?.coachMarksCurrentStep === 5)}
          onMeasure={(rect) => {
            model?.setSpotlightTargetRect?.(rect);
          }}
          style={{
            marginHorizontal: scale(16),
            marginTop: verticalScale(10),
            marginBottom: verticalScale(14),
          }}
        >
          <LinearGradient
            colors={['#0D5B2A', '#198A48']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[localStyles.hubHero, { marginHorizontal: 0, marginTop: 0, marginBottom: 0 }]}
          >
            <View style={localStyles.heroGlow} />
            <View style={localStyles.heroIcon}>
              <Ionicons name="swap-horizontal" size={25} color="#D9F99D" />
            </View>
            <Text style={localStyles.heroEyebrow}>COMMUNITY REUSE MARKET</Text>
            <Text style={localStyles.headerTitle}>Give & Get Hub</Text>
            <Text style={localStyles.headerSubtitle}>Find useful items, offer what you no longer need, and keep good things in circulation.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a new listing"
              onPress={onCreateListing}
              onPressIn={handleCreatePressIn}
              onPressOut={handleCreatePressOut}
            >
              <Animated.View style={[localStyles.createButton, { transform: [{ scale: createBtnScale }] }]}>
                <Ionicons name="add-circle" size={19} color="#126027" />
                <Text style={localStyles.createButtonText}>Create a listing</Text>
                <Ionicons name="arrow-forward" size={16} color="#126027" />
              </Animated.View>
            </Pressable>
          </LinearGradient>
        </CoachMarkTarget>

        {/* Search bar */}
        <View style={localStyles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={localStyles.searchInput}
            placeholder="Search items to swap..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            style={localStyles.filterButton}
          >
            <Ionicons name="filter" size={16} color="#FFF" />
            {(selectedCategory !== 'all' || selectedMeetup !== 'all') && (
              <View style={localStyles.filterDot} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={localStyles.categoryScroll}
          contentContainerStyle={localStyles.categoryScrollContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              onPress={() => setSelectedCategory(cat.key)}
              style={[
                localStyles.categoryPill,
                selectedCategory === cat.key && localStyles.categoryPillActive,
              ]}
            >
              <Ionicons
                name={(cat.key === 'all' ? 'apps-outline' : CATEGORY_ICON[cat.key]) as any}
                size={14}
                color={selectedCategory === cat.key ? '#FFFFFF' : '#547060'}
              />
              <Text
                style={[
                  localStyles.categoryPillText,
                  selectedCategory === cat.key && localStyles.categoryPillTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ backgroundColor: ecoTheme.colors.background, zIndex: 10, paddingVertical: 4 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={localStyles.tabScroll}
          contentContainerStyle={localStyles.tabScrollContent}
        >
          <TouchableOpacity
            style={[localStyles.tabPill, activeTab === 'browse' && localStyles.tabPillActive]}
            onPress={() => onTabChange('browse')}
          >
            <Ionicons
              name={activeTab === 'browse' ? 'storefront' : 'storefront-outline'}
              size={16}
              color={activeTab === 'browse' ? '#FFF' : '#6B7A75'}
            />
            <Text style={[localStyles.tabPillText, activeTab === 'browse' && localStyles.tabPillTextActive]}>
              Browse
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[localStyles.tabPill, activeTab === 'chats' && localStyles.tabPillActive]}
            onPress={() => {
              onTabChange('chats');
              onRefreshConversations?.();
            }}
          >
            <View style={localStyles.tabPillIconWrap}>
              <Ionicons
                name={activeTab === 'chats' ? 'chatbubbles' : 'chatbubbles-outline'}
                size={16}
                color={activeTab === 'chats' ? '#FFF' : '#6B7A75'}
              />
              {conversations.length > 0 && (
                <View style={localStyles.tabBadge}>
                  <Text style={localStyles.tabBadgeText}>
                    {conversations.length > 99 ? '99+' : conversations.length}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[localStyles.tabPillText, activeTab === 'chats' && localStyles.tabPillTextActive]}>
              Chats ({conversations.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[localStyles.tabPill, activeTab === 'mylistings' && localStyles.tabPillActive]}
            onPress={() => {
              onTabChange('mylistings');
              loadMyListings();
            }}
          >
            <Ionicons
              name={activeTab === 'mylistings' ? 'clipboard' : 'clipboard-outline'}
              size={16}
              color={activeTab === 'mylistings' ? '#FFF' : '#6B7A75'}
            />
            <Text style={[localStyles.tabPillText, activeTab === 'mylistings' && localStyles.tabPillTextActive]}>
              My Listings
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Animated.View style={[localStyles.feedContent, { opacity: fadeAnim }]}>
        {activeTab === 'browse' ? (
          <>
            {!loading && listings.length > 0 && (
              <View style={localStyles.resultsHeader}>
                <View>
                  <Text style={localStyles.resultsTitle}>{searchQuery ? 'Matches for your search' : 'Fresh from the community'}</Text>
                  <Text style={localStyles.resultsSubtitle}>Browse items ready for a second life.</Text>
                </View>
                <View style={localStyles.resultsCount}>
                  <Text style={localStyles.resultsCountText}>{listings.length}</Text>
                </View>
              </View>
            )}
            {loading ? (
              <>
                <SwapListingSkeleton />
                <SwapListingSkeleton />
                <SwapListingSkeleton />
              </>
            ) : listings.length === 0 ? (
              <View style={localStyles.emptyState}>
                <Ionicons name="leaf-outline" size={64} color="#A7D5BA" />
                <Text style={localStyles.emptyTitle}>No listings found</Text>
                <Text style={localStyles.emptySubtitle}>
                  {searchQuery || selectedCategory !== 'all' || selectedMeetup !== 'all'
                    ? 'Try adjusting your filters or search terms.'
                    : 'Be the first to create a swap listing!'}
                </Text>
                {!searchQuery && selectedCategory === 'all' && selectedMeetup === 'all' && (
                  <TouchableOpacity onPress={onCreateListing} style={localStyles.emptyButton}>
                    <Text style={localStyles.emptyButtonText}>Create Listing</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              listings.map((listing) => {
                return (
                  <View key={listing.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>Available</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {listing.meetupMethod === 'public' ? 'Public Meetup' : listing.meetupMethod === 'pickup' ? 'Door Pickup' : 'Door Drop-off'}
                      </Text>
                    </View>
                    <SwapListingCard
                      listing={listing}
                      isOwnListing={listing.user.id === currentUserId}
                      onPress={() => onSelectListing(listing)}
                      onSwap={
                        listing.user.id !== currentUserId
                          ? () => onRequestSwap(listing)
                          : undefined
                      }
                    />
                  </View>
                );
              })
            )}
          </>
        ) : activeTab === 'chats' ? (
          <SwapChatList
            conversations={conversations}
            currentUserId={currentUserId || ''}
            onSelectConversation={onSelectConversation}
          />
        ) : (
          <>
            {myListingsLoading ? (
              <>
                <SwapListingSkeleton />
                <SwapListingSkeleton />
              </>
            ) : myListings.length === 0 ? (
              <View style={localStyles.emptyState}>
                <Ionicons name="clipboard-outline" size={64} color="#A7D5BA" />
                <Text style={localStyles.emptyTitle}>No listings yet</Text>
                <Text style={localStyles.emptySubtitle}>
                  Create a listing to see it here with its approval status.
                </Text>
                <TouchableOpacity onPress={onCreateListing} style={localStyles.emptyButton}>
                  <Text style={localStyles.emptyButtonText}>Create Listing</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myListings.map((listing) => {
                const status = listing.approvalStatus || 'pending';
                const statusColor = status === 'approved' ? '#10B981' : status === 'rejected' ? '#EF4444' : '#F59E0B';
                const statusLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending Review';
                return (
                  <View key={listing.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                      </View>
                      {status === 'pending' && (
                        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Waiting for admin approval</Text>
                      )}
                      {status === 'rejected' && listing.description && (
                        <Text style={{ fontSize: 11, color: '#EF4444' }} numberOfLines={1}>Reason: {listing.description}</Text>
                      )}
                    </View>
                    <SwapListingCard
                      listing={listing}
                      isOwnListing={true}
                      onPress={() => onSelectListing(listing)}
                    />
                  </View>
                );
              })
            )}
          </>
        )}
      </Animated.View>

      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHandle} />
            <Text style={localStyles.modalTitle}>Filters</Text>

            <Text style={localStyles.filterSectionLabel}>Category</Text>
            <View style={localStyles.filterGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  style={[
                    localStyles.filterChip,
                    selectedCategory === cat.key && localStyles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      localStyles.filterChipText,
                      selectedCategory === cat.key && localStyles.filterChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[localStyles.filterSectionLabel, { marginTop: 18 }]}>Meetup Method</Text>
            <View style={localStyles.filterGrid}>
              {meetupOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setSelectedMeetup(opt.key)}
                  style={[
                    localStyles.filterChip,
                    selectedMeetup === opt.key && localStyles.filterChipActive,
                  ]}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={14}
                    color={selectedMeetup === opt.key ? '#FFF' : ecoTheme.colors.textSoft}
                  />
                  <Text
                    style={[
                      localStyles.filterChipText,
                      selectedMeetup === opt.key && localStyles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={localStyles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedCategory('all');
                  setSelectedMeetup('all');
                }}
                style={localStyles.resetButton}
              >
                <Text style={localStyles.resetButtonText}>Reset All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                style={localStyles.applyButton}
              >
                <Text style={localStyles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  hubHero: {
    marginHorizontal: scale(16),
    marginTop: verticalScale(10),
    marginBottom: verticalScale(14),
    borderRadius: moderateScale(22),
    padding: moderateScale(18),
    overflow: 'hidden',
    shadowColor: '#126027',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  heroGlow: { position: 'absolute', width: scale(180), height: scale(180), borderRadius: scale(90), backgroundColor: 'rgba(217,249,157,0.12)', right: -72, top: -76 },
  heroIcon: { width: scale(42), height: scale(42), borderRadius: moderateScale(14), backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: verticalScale(10) },
  heroEyebrow: { color: '#D9F99D', fontSize: responsiveFontSize(10), fontWeight: '900', letterSpacing: 1.15, marginBottom: verticalScale(4) },
  headerTitle: {
    fontSize: responsiveFontSize(24),
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: responsiveFontSize(12),
    color: '#DCFCE7',
    marginTop: verticalScale(4),
    lineHeight: responsiveFontSize(18),
    maxWidth: '94%',
  },
  createButton: {
    alignSelf: 'flex-start',
    minHeight: verticalScale(40),
    borderRadius: moderateScale(14),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    flexDirection: 'row', 
    gap: scale(6),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(14),
  },
  createButtonText: { color: '#126027', fontSize: responsiveFontSize(13), fontWeight: '900' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(12),
    marginHorizontal: scale(16),
    marginBottom: verticalScale(4),
    minHeight: verticalScale(44),
    gap: scale(8),
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: responsiveFontSize(14),
    color: ecoTheme.colors.text,
  },
  filterButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: scale(7),
    height: scale(7),
    borderRadius: scale(3.5),
    backgroundColor: '#F59E0B',
  },
  categoryScroll: {
    marginTop: verticalScale(8),
    marginBottom: verticalScale(4),
  },
  categoryScrollContent: {
    paddingHorizontal: scale(16),
    gap: scale(8),
  },
  categoryPill: {
    flexDirection: 'row',
    gap: scale(6),
    alignItems: 'center',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(7),
    borderRadius: moderateScale(16),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    justifyContent: 'center',
  },
  categoryPillActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
    borderColor: ecoTheme.colors.primaryDark,
  },
  categoryPillText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
    textAlign: 'center',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  feedScroll: {
    flex: 1,
  },
  feedContent: {
    padding: scale(16),
    paddingBottom: verticalScale(120),
  },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: verticalScale(12) },
  resultsTitle: { color: ecoTheme.colors.text, fontSize: responsiveFontSize(17), fontWeight: '900', letterSpacing: -0.25 },
  resultsSubtitle: { color: ecoTheme.colors.textSoft, fontSize: responsiveFontSize(11), marginTop: 2 },
  resultsCount: { backgroundColor: '#E8F5E9', minWidth: scale(28), height: scale(28), borderRadius: moderateScale(10), alignItems: 'center', justifyContent: 'center' },
  resultsCountText: { color: '#126027', fontSize: responsiveFontSize(12), fontWeight: '900' },
  emptyState: {
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
  emptyButton: {
    marginTop: verticalScale(10),
    backgroundColor: ecoTheme.colors.primaryDark,
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(18),
  },
  emptyButtonText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: moderateScale(26),
    borderTopRightRadius: moderateScale(26),
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(32),
    maxHeight: '80%',
  },
  modalHandle: {
    width: scale(40),
    height: verticalScale(4),
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: verticalScale(14),
  },
  modalTitle: {
    fontSize: responsiveFontSize(20),
    fontWeight: '900',
    color: ecoTheme.colors.text,
    marginBottom: verticalScale(16),
  },
  filterSectionLabel: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: ecoTheme.colors.text,
    marginBottom: verticalScale(8),
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(7),
    borderRadius: moderateScale(14),
    backgroundColor: '#F5FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  filterChipActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
    borderColor: ecoTheme.colors.primaryDark,
  },
  filterChipText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    marginTop: verticalScale(20),
  },
  resetButton: {
    flex: 1,
    minHeight: verticalScale(44),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
  },
  applyButton: {
    flex: 1,
    minHeight: verticalScale(44),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(14),
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabScroll: {
    maxHeight: verticalScale(44),
    marginBottom: verticalScale(6),
  },
  tabScrollContent: {
    paddingHorizontal: scale(16),
    gap: scale(8),
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(7),
    borderRadius: moderateScale(14),
    backgroundColor: '#F5FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  tabPillActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
    borderColor: ecoTheme.colors.primaryDark,
  },
  tabPillIconWrap: {
    position: 'relative',
  },
  tabPillText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
    color: '#6B7A75',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(3),
  },
  tabBadgeText: {
    fontSize: responsiveFontSize(9),
    fontWeight: '800',
    color: '#FFF',
  },
});
