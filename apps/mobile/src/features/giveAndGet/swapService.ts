import { ecobudApi } from '../../shared/api/ecobudApi';
import type {
  SwapListing,
  SwapRequest,
  SwapChatMessage,
  SwapConversation,
  SwapCategory,
  MeetupMethod,
  SwapRequestStatus,
} from './types';

let authToken = '';

function setAuthToken(token: string) {
  authToken = token;
}

function formatListing(row: any): SwapListing {
  return {
    id: row.id,
    title: row.title || '',
    category: row.category || 'others',
    quantity: row.quantity || '1',
    condition: row.condition || 'good',
    description: row.description || '',
    lookingFor: row.lookingFor || row.looking_for || '',
    images: Array.isArray(row.images) ? row.images : [],
    meetupMethod: row.meetupMethod || row.meetup_method || 'public',
    meetupLocation: row.meetupLocation || row.meetup_location || undefined,
    meetupLandmark: row.meetupLandmark || row.meetup_landmark || undefined,
    meetupNotes: row.meetupNotes || row.meetup_notes || undefined,
    city: row.city || undefined,
    province: row.province || undefined,
    latitude: row.latitude || undefined,
    longitude: row.longitude || undefined,
    distanceKm: row.distanceKm || row.distance_km || undefined,
    user: row.user || {
      id: row.user_id || row.userId,
      displayName: 'Anonymous',
      avatarUrl: undefined,
      successfulSwaps: 0,
      rating: 0,
      memberSince: new Date().toISOString(),
      isVerified: false,
    },
    postedAt: row.postedAt || row.created_at || new Date().toISOString(),
    isActive: row.isActive ?? row.is_active ?? true,
    approvalStatus: row.approvalStatus ?? row.approval_status ?? 'pending',
  };
}

function formatMessage(row: any): SwapChatMessage {
  return {
    id: row.id,
    swapRequestId: row.swapRequestId || row.swap_request_id,
    senderId: row.senderId || row.sender_id,
    text: row.text || '',
    imageUrl: row.imageUrl || row.image_url || undefined,
    timestamp: row.timestamp,
    read: row.read || false,
    delivered: row.delivered || false,
  };
}

function formatRequest(row: any): SwapRequest {
  return {
    id: row.id,
    listingId: row.listingId || row.listing_id,
    fromUserId: row.fromUserId || row.from_user_id,
    toUserId: row.toUserId || row.to_user_id,
    status: row.status,
    message: row.message || undefined,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

export const swapService = {
  init(token: string) {
    setAuthToken(token);
  },

  async fetchListings(params: {
    search?: string;
    category?: SwapCategory;
    meetupMethod?: MeetupMethod;
    sortBy?: 'newest' | 'nearest' | 'active';
    limit?: number;
    offset?: number;
  }): Promise<SwapListing[]> {
    const data = await ecobudApi.fetchSwapListings(authToken, params);
    return (data || []).map(formatListing);
  },

  async fetchListingById(id: string): Promise<SwapListing | null> {
    try {
      const data = await ecobudApi.fetchSwapListingById(authToken, id);
      return formatListing(data);
    } catch {
      return null;
    }
  },

  async createListing(input: {
    title: string;
    category: SwapCategory;
    quantity: string;
    condition: string;
    description: string;
    lookingFor: string;
    imageUrls: string[];
    meetupMethod: MeetupMethod;
    meetupLocation?: string;
    meetupLandmark?: string;
    meetupNotes?: string;
    city?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
    userId: string;
  }): Promise<SwapListing> {
    const data = await ecobudApi.createSwapListing(authToken, {
      title: input.title,
      category: input.category,
      quantity: input.quantity,
      condition: input.condition,
      description: input.description,
      lookingFor: input.lookingFor,
      images: input.imageUrls.map((url, i) => ({ id: `img_${Date.now()}_${i}`, url })),
      meetupMethod: input.meetupMethod,
      meetupLocation: input.meetupLocation,
      meetupLandmark: input.meetupLandmark,
      meetupNotes: input.meetupNotes,
      city: input.city,
      province: input.province,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    return formatListing(data);
  },

  async updateListing(id: string, updates: Partial<SwapListing>): Promise<void> {
    const body: Record<string, unknown> = {};
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.category !== undefined) body.category = updates.category;
    if (updates.quantity !== undefined) body.quantity = updates.quantity;
    if (updates.condition !== undefined) body.condition = updates.condition;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.lookingFor !== undefined) body.lookingFor = updates.lookingFor;
    if (updates.meetupMethod !== undefined) body.meetupMethod = updates.meetupMethod;
    await ecobudApi.updateSwapListing(authToken, id, body);
  },

  async deleteListing(id: string): Promise<void> {
    await ecobudApi.deleteSwapListing(authToken, id);
  },

  async sendSwapRequest(listingId: string, fromUserId: string, message?: string): Promise<SwapRequest> {
    const data = await ecobudApi.sendSwapRequest(authToken, { listingId, message });
    return formatRequest(data);
  },

  async updateSwapRequestStatus(requestId: string, status: SwapRequestStatus): Promise<void> {
    await ecobudApi.updateSwapRequestStatus(authToken, requestId, status);
  },

  async fetchConversations(userId: string): Promise<SwapConversation[]> {
    const data = await ecobudApi.fetchSwapConversations(authToken);
    return (data || []).map((row: any) => ({
      id: row.id,
      swapRequestId: row.swapRequestId || row.swap_request_id,
      listing: formatListing(row.listing),
      otherUser: row.otherUser || row.listing?.user || {
        id: '',
        displayName: 'Anonymous',
        avatarUrl: undefined,
        successfulSwaps: 0,
        rating: 0,
        memberSince: new Date().toISOString(),
        isVerified: false,
      },
      unreadCount: row.unreadCount || row.unread_count || 0,
      status: row.status || 'pending',
      meetupMethod: row.meetupMethod || row.meetup_method || 'public',
    }));
  },

  async fetchMessages(swapRequestId: string): Promise<SwapChatMessage[]> {
    const data = await ecobudApi.fetchSwapMessages(authToken, swapRequestId);
    return (data || []).map(formatMessage);
  },

  async sendMessage(
    swapRequestId: string,
    senderId: string,
    text: string,
    imageUrl?: string
  ): Promise<SwapChatMessage> {
    const data = await ecobudApi.sendSwapMessage(authToken, swapRequestId, text, imageUrl);
    return formatMessage(data);
  },

  async markMessagesRead(swapRequestId: string, userId: string): Promise<void> {
    await ecobudApi.markSwapMessagesRead(authToken, swapRequestId);
  },

  async uploadImage(uri: string, userId: string): Promise<string> {
    return ecobudApi.uploadSwapImage(authToken, uri);
  },

  async fetchMyListings(userId: string): Promise<SwapListing[]> {
    const data = await ecobudApi.fetchMySwapListings(authToken);
    return (data || []).map(formatListing);
  },

  async fetchMySwapRequests(userId: string): Promise<SwapRequest[]> {
    return [];
  },

  async fetchUserSwapStats(userId: string) {
    return {
      successfulSwaps: 0,
      rating: 0,
      activeListings: 0,
      pendingRequests: 0,
    };
  },
};
