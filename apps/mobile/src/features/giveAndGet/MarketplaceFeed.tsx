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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { SwapListingCard, SwapListingSkeleton } from './SwapListingCard';
import { SwapChatList } from './SwapChatView';
import { swapService } from './swapService';
import type { SwapListing, SwapCategory, MeetupMethod, SwapConversation } from './types';
import { CATEGORY_LABELS, CATEGORY_ICON, MEETUP_LABELS } from './types';

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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadListings();
  }, [loadListings]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  return (
    <View style={localStyles.container}>
      {/* Compact page header — TopNavbar in MarketplaceHubView handles profile/logo/events/notifications */}
      <View style={localStyles.pageHeader}>
        <View>
          <Text style={localStyles.headerTitle}>Give & Get Hub</Text>
          <Text style={localStyles.headerSubtitle}>Swap, trade, and reuse together</Text>
        </View>
        <TouchableOpacity onPress={onCreateListing} style={localStyles.createButton}>
          <Ionicons name="add" size={24} color={ecoTheme.colors.primaryDark} />
        </TouchableOpacity>
      </View>

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

      <View style={localStyles.sortRow}>
        <Text style={localStyles.sortLabel}>Sort by:</Text>
        {(['newest', 'nearest', 'active'] as SortOption[]).map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => setSortBy(opt)}
            style={[
              localStyles.sortPill,
              sortBy === opt && localStyles.sortPillActive,
            ]}
          >
            <Text
              style={[
                localStyles.sortPillText,
                sortBy === opt && localStyles.sortPillTextActive,
              ]}
            >
              {opt === 'newest' ? 'Newest' : opt === 'nearest' ? 'Nearest' : 'Most Active'}
            </Text>
          </TouchableOpacity>
        ))}
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

      {activeTab === 'browse' ? (
        <Animated.ScrollView
          style={[localStyles.feedScroll, { opacity: fadeAnim }]}
          contentContainerStyle={localStyles.feedContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={ecoTheme.colors.primaryDark}
            />
          }
          showsVerticalScrollIndicator={false}
        >
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
            listings.map((listing) => (
              <SwapListingCard
                key={listing.id}
                listing={listing}
                isOwnListing={listing.user.id === currentUserId}
                onPress={() => onSelectListing(listing)}
                onSwap={
                  listing.user.id !== currentUserId
                    ? () => onRequestSwap(listing)
                    : undefined
                }
              />
            ))
          )}
        </Animated.ScrollView>
      ) : activeTab === 'chats' ? (
        <SwapChatList
          conversations={conversations}
          currentUserId={currentUserId || ''}
          onSelectConversation={onSelectConversation}
        />
      ) : (
        <Animated.ScrollView
          style={[localStyles.feedScroll, { opacity: fadeAnim }]}
          contentContainerStyle={localStyles.feedContent}
          refreshControl={
            <RefreshControl
              refreshing={myListingsLoading}
              onRefresh={loadMyListings}
              tintColor={ecoTheme.colors.primaryDark}
            />
          }
          showsVerticalScrollIndicator={false}
        >
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
        </Animated.ScrollView>
      )}

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
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: ecoTheme.colors.background,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: ecoTheme.colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: ecoTheme.colors.textSoft,
    marginTop: 2,
  },
  createButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginHorizontal: 18,
    marginBottom: 4,
    height: 48,
    gap: 8,
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: ecoTheme.colors.text,
  },
  filterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F59E0B',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sortLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  sortPillActive: {
    backgroundColor: ecoTheme.colors.surfaceMuted,
    borderColor: ecoTheme.colors.primaryDark,
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  sortPillTextActive: {
    color: ecoTheme.colors.primaryDark,
    fontWeight: '700',
  },
  categoryScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  categoryScrollContent: {
    paddingHorizontal: 18,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  categoryPillActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
    borderColor: ecoTheme.colors.primaryDark,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  feedScroll: {
    flex: 1,
  },
  feedContent: {
    padding: 18,
    paddingBottom: 120,
  },
  emptyState: {
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
  emptyButton: {
    marginTop: 12,
    backgroundColor: ecoTheme.colors.primaryDark,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    fontSize: 15,
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: ecoTheme.colors.text,
    marginBottom: 18,
  },
  filterSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: ecoTheme.colors.text,
    marginBottom: 10,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  filterChipActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
    borderColor: ecoTheme.colors.primaryDark,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabScroll: {
    maxHeight: 44,
    marginBottom: 6,
  },
  tabScrollContent: {
    paddingHorizontal: 18,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
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
    fontSize: 13,
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
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
});
