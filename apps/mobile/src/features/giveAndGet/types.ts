export type SwapCategory =
  | 'plastic'
  | 'glass'
  | 'metal'
  | 'paper'
  | 'cardboard'
  | 'electronics'
  | 'clothing'
  | 'household'
  | 'plants'
  | 'others';

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'worn';

export type MeetupMethod = 'public' | 'pickup' | 'dropoff';

export type SwapRequestStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';

export interface SwapImage {
  id: string;
  url: string;
}

export interface SwapListingUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  successfulSwaps: number;
  rating: number;
  memberSince: string;
  isVerified?: boolean;
}

export interface SwapListing {
  id: string;
  title: string;
  category: SwapCategory;
  quantity: string;
  condition: ItemCondition;
  description: string;
  lookingFor: string;
  images: SwapImage[];
  meetupMethod: MeetupMethod;
  meetupLocation?: string;
  meetupLandmark?: string;
  meetupNotes?: string;
  city?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  user: SwapListingUser;
  postedAt: string;
  isActive: boolean;
  approvalStatus?: string;
}

export interface SwapRequest {
  id: string;
  listingId: string;
  fromUserId: string;
  toUserId: string;
  status: SwapRequestStatus;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SwapChatMessage {
  id: string;
  swapRequestId: string;
  senderId: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
  read: boolean;
  delivered: boolean;
}

export interface SwapConversation {
  id: string;
  swapRequestId: string;
  listing: SwapListing;
  otherUser: SwapListingUser;
  lastMessage?: SwapChatMessage;
  unreadCount: number;
  status: SwapRequestStatus;
  meetupMethod: MeetupMethod;
}

export const CATEGORY_LABELS: Record<SwapCategory, string> = {
  plastic: 'Plastic',
  glass: 'Glass',
  metal: 'Metal',
  paper: 'Paper',
  cardboard: 'Cardboard',
  electronics: 'Electronics',
  clothing: 'Clothing',
  household: 'Household Items',
  plants: 'Plants',
  others: 'Others',
};

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  worn: 'Worn',
};

export const MEETUP_LABELS: Record<MeetupMethod, string> = {
  public: 'Public Meetup',
  pickup: 'Door Pickup',
  dropoff: 'Door Drop-off',
};

export const CATEGORY_ICON: Record<SwapCategory, string> = {
  plastic: 'water',
  glass: 'wine',
  metal: 'hardware-sharp',
  paper: 'document-text',
  cardboard: 'cube',
  electronics: 'hardware-chip',
  clothing: 'shirt',
  household: 'home',
  plants: 'leaf',
  others: 'ellipsis-horizontal',
};
