import { prisma } from '../prismaClient';
import { supabaseStorageService } from './supabaseStorageService';
import path from 'path';
import fs from 'fs';

interface CreateListingInput {
  userId: string;
  title: string;
  category: string;
  quantity: string;
  condition: string;
  description: string;
  lookingFor: string;
  images: { id: string; url: string }[];
  meetupMethod: string;
  meetupLocation?: string;
  meetupLandmark?: string;
  meetupNotes?: string;
  city?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
}

const profileInclude = {
  user: {
    select: {
      id: true,
      name: true,
      profile: {
        select: {
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  },
};

function formatListing(row: any) {
  const user = row.user;
  const profile = user?.profile;
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    quantity: row.quantity,
    condition: row.condition,
    description: row.description,
    lookingFor: row.lookingFor,
    images: row.images ?? [],
    meetupMethod: row.meetupMethod,
    meetupLocation: row.meetupLocation,
    meetupLandmark: row.meetupLandmark,
    meetupNotes: row.meetupNotes,
    city: row.city,
    province: row.province,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceKm: row.distanceKm,
    isActive: row.isActive,
    approvalStatus: row.approvalStatus,
    postedAt: row.createdAt,
    user: {
      id: user?.id ?? row.userId,
      displayName: profile?.displayName ?? user?.name ?? 'Anonymous',
      avatarUrl: profile?.avatarUrl ?? null,
      successfulSwaps: 0,
      rating: 0,
      memberSince: row.createdAt,
      isVerified: false,
    },
  };
}

function formatMessage(row: any) {
  return {
    id: row.id,
    swapRequestId: row.swapRequestId,
    senderId: row.senderId,
    text: row.text,
    imageUrl: row.imageUrl,
    timestamp: row.timestamp,
    read: row.read,
    delivered: row.delivered,
  };
}

export const swapService = {
  async fetchListings(params: {
    search?: string;
    category?: string;
    meetupMethod?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }) {
    const { search, category, meetupMethod, sortBy = 'newest', limit = 20, offset = 0 } = params;

    const where: any = { isActive: true, approvalStatus: 'approved' };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { lookingFor: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category && category !== 'all') {
      where.category = { equals: category, mode: 'insensitive' };
    }
    if (meetupMethod && meetupMethod !== 'all') {
      where.meetupMethod = { equals: meetupMethod, mode: 'insensitive' };
    }

    const orderBy: any =
      sortBy === 'active'
        ? { updatedAt: 'desc' as const }
        : { createdAt: 'desc' as const };

    const rows = await prisma.swapListing.findMany({
      where,
      include: profileInclude,
      orderBy,
      skip: offset,
      take: limit,
    });

    return rows.map(formatListing);
  },

  async fetchListingById(id: string) {
    const row = await prisma.swapListing.findUnique({
      where: { id },
      include: profileInclude,
    });
    if (!row) return null;
    return formatListing(row);
  },

  async createListing(input: CreateListingInput) {
    const row = await prisma.swapListing.create({
      data: {
        userId: input.userId,
        title: input.title,
        category: input.category,
        quantity: input.quantity,
        condition: input.condition,
        description: input.description,
        lookingFor: input.lookingFor,
        images: input.images,
        meetupMethod: input.meetupMethod,
        meetupLocation: input.meetupLocation ?? null,
        meetupLandmark: input.meetupLandmark ?? null,
        meetupNotes: input.meetupNotes ?? null,
        city: input.city ?? null,
        province: input.province ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        isActive: true,
      },
      include: profileInclude,
    });
    return formatListing(row);
  },

  async updateListing(id: string, userId: string, role: string, data: Record<string, unknown>) {
    const listing = await prisma.swapListing.findUnique({ where: { id } });
    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.userId !== userId && role !== 'admin' && role !== 'moderator') {
      throw new Error('You do not have permission to edit this listing');
    }

    // Whitelist allowed user-editable fields to prevent mass assignment
    const allowedFields = [
      'title',
      'category',
      'quantity',
      'condition',
      'description',
      'lookingFor',
      'images',
      'meetupMethod',
      'meetupLocation',
      'meetupLandmark',
      'meetupNotes',
      'city',
      'province',
      'latitude',
      'longitude',
    ];

    const sanitizedData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        sanitizedData[field] = data[field];
      }
    }

    await prisma.swapListing.update({ where: { id }, data: sanitizedData });
  },

  async deleteListing(id: string, userId: string, role: string) {
    const listing = await prisma.swapListing.findUnique({ where: { id } });
    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.userId !== userId && role !== 'admin' && role !== 'moderator') {
      throw new Error('You do not have permission to delete this listing');
    }

    await prisma.swapListing.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async sendSwapRequest(listingId: string, fromUserId: string, message?: string) {
    const listing = await prisma.swapListing.findUnique({
      where: { id: listingId },
      select: { userId: true, isActive: true },
    });
    if (!listing || !listing.isActive) throw new Error('Listing not found or inactive');

    if (listing.userId === fromUserId) {
      throw new Error('You cannot send a swap request to your own listing');
    }

    const request = await prisma.swapRequest.create({
      data: {
        listingId,
        fromUserId,
        toUserId: listing.userId,
        status: 'pending',
        message: message ?? null,
      },
    });

    await prisma.swapConversation.create({
      data: {
        swapRequestId: request.id,
        listingId,
        user1Id: fromUserId,
        user2Id: listing.userId,
        status: 'pending',
      },
    });

    return request;
  },

  async updateSwapRequestStatus(requestId: string, userId: string, role: string, status: string) {
    const swapReq = await prisma.swapRequest.findUnique({ where: { id: requestId } });
    if (!swapReq) throw new Error('Swap request not found');

    if (swapReq.toUserId !== userId && swapReq.fromUserId !== userId && role !== 'admin' && role !== 'moderator') {
      throw new Error('You do not have permission to update this swap request');
    }

    await prisma.swapRequest.update({
      where: { id: requestId },
      data: { status },
    });
    await prisma.swapConversation.updateMany({
      where: { swapRequestId: requestId },
      data: { status },
    });
  },

  async fetchConversations(userId: string) {
    const rows = await prisma.swapConversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        swapRequest: true,
        listing: {
          include: profileInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => {
      const listing = formatListing(row.listing);
      return {
        id: row.id,
        swapRequestId: row.swapRequestId,
        listing,
        otherUser: listing.user,
        unreadCount: row.unreadCount,
        status: row.status,
        meetupMethod: listing.meetupMethod,
      };
    });
  },

  async fetchMessages(conversationOrSwapRequestId: string, userId: string, role: string) {
    // Check conversation ownership
    const conv = await prisma.swapConversation.findFirst({
      where: {
        OR: [
          { id: conversationOrSwapRequestId },
          { swapRequestId: conversationOrSwapRequestId },
        ],
      },
    });

    if (conv && conv.user1Id !== userId && conv.user2Id !== userId && role !== 'admin' && role !== 'moderator') {
      throw new Error('You are not authorized to view this conversation');
    }

    const swapRequestId = conv ? conv.swapRequestId : conversationOrSwapRequestId;
    const rows = await prisma.swapMessage.findMany({
      where: { swapRequestId },
      orderBy: { timestamp: 'asc' },
    });
    return rows.map(formatMessage);
  },

  async sendMessage(conversationOrSwapRequestId: string, senderId: string, role: string, text: string, imageUrl?: string) {
    const conv = await prisma.swapConversation.findFirst({
      where: {
        OR: [
          { id: conversationOrSwapRequestId },
          { swapRequestId: conversationOrSwapRequestId },
        ],
      },
    });

    if (conv && conv.user1Id !== senderId && conv.user2Id !== senderId && role !== 'admin' && role !== 'moderator') {
      throw new Error('You are not authorized to send messages in this conversation');
    }

    const swapRequestId = conv ? conv.swapRequestId : conversationOrSwapRequestId;
    const row = await prisma.swapMessage.create({
      data: {
        swapRequestId,
        senderId,
        text,
        imageUrl: imageUrl ?? null,
        timestamp: new Date(),
        read: false,
        delivered: true,
      },
    });
    return formatMessage(row);
  },

  async markMessagesRead(conversationOrSwapRequestId: string, userId: string) {
    const conv = await prisma.swapConversation.findFirst({
      where: {
        OR: [
          { id: conversationOrSwapRequestId },
          { swapRequestId: conversationOrSwapRequestId },
        ],
      },
    });
    const swapRequestId = conv ? conv.swapRequestId : conversationOrSwapRequestId;

    await prisma.swapMessage.updateMany({
      where: {
        swapRequestId,
        NOT: { senderId: userId },
        read: false,
      },
      data: { read: true },
    });
  },

  async fetchMyListings(userId: string) {
    const rows = await prisma.swapListing.findMany({
      where: { userId, isActive: true },
      include: profileInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(formatListing);
  },

  async uploadImage(userId: string, file: Express.Multer.File) {
    const ext = path.extname(file.originalname) || '.jpg';
    const destinationPath = `swap-images/${userId}/swap-${Date.now()}${ext}`;
    
    try {
      const publicUrl = await supabaseStorageService.uploadFile(
        destinationPath,
        file.path,
        file.mimetype
      );

      // Clean up local temp file
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (e) {
        console.error('Failed to cleanup temp swap image:', e);
      }

      return publicUrl;
    } catch (error: any) {
      if (file && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      throw error;
    }
  },
};
