import { prisma } from '../prismaClient';
import { Prisma } from '@prisma/client';
import { submitSwapReport, swapReportSchema } from './swapReportService';
import { awardContentBadge } from './contentBadgeService';
import { awardMilestoneBadges } from './badgeMilestoneService';
import { sendDirectNotification } from './notificationService';
import { HttpError } from '../http/errorResponder';
import { decodeCursor, encodeCursor } from '../http/cursorPagination';
import { apiCache } from '../lib/cache';
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

const userSummarySelect = {
  id: true,
  name: true,
  createdAt: true,
  profile: {
    select: {
      displayName: true,
      avatarUrl: true,
    },
  },
};

function formatParticipant(user: any) {
  if (!user) {
    return {
      id: '',
      displayName: 'Anonymous',
      avatarUrl: null,
      successfulSwaps: 0,
      rating: 0,
      memberSince: new Date().toISOString(),
      isVerified: false,
    };
  }
  const profile = user.profile;
  return {
    id: user.id,
    displayName: profile?.displayName || user.name || 'Anonymous',
    avatarUrl: profile?.avatarUrl || null,
    successfulSwaps: 0,
    rating: 0,
    memberSince: user.createdAt || new Date().toISOString(),
    isVerified: false,
  };
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
    isReported: row.isReported ?? false,
    reportCount: row.isReported ? row.reportCount ?? 0 : 0,
    rejectionReason: row.approvalStatus === 'rejected' ? row.reportReason ?? null : null,
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

/** Average stars across each owner's listings, rounded to one decimal. Owners with no ratings are absent. */
export async function ownerRatingAverages(userIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.$queryRaw<{ user_id: string; average: number }[]>`
    SELECT l."user_id", AVG(r."stars")::float AS average
    FROM "swap_listing_ratings" r JOIN "swap_listings" l ON l."id" = r."listing_id"
    WHERE l."user_id" IN (${Prisma.join(ids)}) GROUP BY l."user_id"`;
  return new Map(rows.map(row => [row.user_id, Math.round(row.average * 10) / 10]));
}

async function withOwnerRatings<T extends { user: { id: string; rating: number } }>(listings: T[]): Promise<T[]> {
  const averages = await ownerRatingAverages(listings.map(listing => listing.user.id));
  for (const listing of listings) listing.user.rating = averages.get(listing.user.id) ?? 0;
  return listings;
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
  async reportListing(id: string, reporterId: string, reason: string, reportName = 'Other') {
    return submitSwapReport(id, reporterId, swapReportSchema.parse({ reason, reportName }));
  },

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

    return withOwnerRatings(rows.map(formatListing));
  },

  async fetchListingById(id: string) {
    const row = await prisma.swapListing.findUnique({
      where: { id },
      include: profileInclude,
    });
    if (!row) return null;
    return (await withOwnerRatings([formatListing(row)]))[0];
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
    apiCache.delete(`user_dashboard_${input.userId}`);
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
    apiCache.delete(`user_dashboard_${listing.userId}`);
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
      data: { isActive: false, ...(listing.approvalStatus === 'rejected' ? { approvalStatus: 'deleted' } : {}) },
    });
    apiCache.delete(`user_dashboard_${listing.userId}`);
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

    const conversation = await prisma.swapConversation.create({
      data: {
        swapRequestId: request.id,
        listingId,
        user1Id: fromUserId,
        user2Id: listing.userId,
        status: 'pending',
      },
    });

    if (message && message.trim()) {
      await prisma.swapMessage.create({
        data: {
          swapRequestId: conversation.id,
          senderId: fromUserId,
          text: message.trim(),
          timestamp: new Date(),
          read: false,
          delivered: true,
        },
      });
    }

    return request;
  },

  async updateSwapRequestStatus(requestId: string, userId: string, role: string, status: string) {
    if (!['accepted', 'declined', 'completed', 'cancelled'].includes(status)) throw new HttpError(400, 'Invalid exchange status.');
    const swapReq = await prisma.swapRequest.findUnique({ where: { id: requestId }, include: { listing: true } });
    if (!swapReq) throw new Error('Swap request not found');

    if (swapReq.toUserId !== userId && swapReq.fromUserId !== userId && role !== 'admin' && role !== 'moderator') {
      throw new Error('You do not have permission to update this swap request');
    }

    if (status === 'accepted' && swapReq.toUserId !== userId && role !== 'admin' && role !== 'moderator') throw new HttpError(403, 'Only the owner can accept this exchange.');
    if (swapReq.status === 'completed') {
      if (status === 'completed') return;
      throw new HttpError(400, 'A completed exchange cannot be reopened.');
    }
    if (status === 'completed' && (swapReq.status !== 'accepted' || swapReq.listing.approvalStatus !== 'approved')) throw new HttpError(400, 'Only an accepted exchange on an approved listing can be completed.');
    const awarded = await prisma.$transaction(async tx => {
      if (status === 'completed') {
        for (const participant of [...new Set([swapReq.fromUserId, swapReq.toUserId])].sort()) {
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${participant} FOR UPDATE`;
        }
      }
      const updated = await tx.swapRequest.updateMany({ where: { id: requestId, status: swapReq.status }, data: { status } });
      if (!updated.count) throw new HttpError(409, 'Exchange changed. Refresh and try again.');
      await tx.swapConversation.updateMany({ where: { swapRequestId: requestId }, data: { status } });
      if (status !== 'completed') return [];
      const rewards = await awardContentBadge(tx, 'exchange', swapReq.listingId, [swapReq.fromUserId, swapReq.toUserId]);
      for (const participant of new Set([swapReq.fromUserId, swapReq.toUserId])) {
        const milestone = await awardMilestoneBadges(tx, participant);
        if (milestone.bonusPoints) {
          const user = await tx.user.update({ where: { id: participant }, data: { points: { increment: milestone.bonusPoints } } });
          await tx.userStats.upsert({ where: { userId: participant }, update: { ecoPoints: user.points }, create: { userId: participant, ecoPoints: user.points } });
        }
        rewards.push(...milestone.badges.map(badge => ({ userId: participant, badge })));
      }
      if (swapReq.listing.lookingFor.toLowerCase() === 'giveaway') {
        const count = await tx.swapRequest.count({ where: { toUserId: swapReq.toUserId, status: 'completed', listing: { lookingFor: { equals: 'giveaway', mode: 'insensitive' } } } });
        if (count >= 10) {
          const badge = await tx.badge.findFirst({ where: { name: 'Giveaway Master', active: true } });
          if (badge) {
            const result = await tx.userBadge.createMany({ data: [{ userId: swapReq.toUserId, badgeId: badge.id }], skipDuplicates: true });
            if (result.count) rewards.push({ userId: swapReq.toUserId, badge });
          }
        }
      }
      return rewards;
    }, { maxWait: 10000, timeout: 30000 }).catch(error => {
      if (error?.code === 'P2028') {
        throw new HttpError(503, 'Could not save the exchange status. Please refresh and try again.');
      }
      throw error;
    });
    for (const reward of awarded) {
      apiCache.delete(`user_dashboard_${reward.userId}`);
      void sendDirectNotification({ userId: reward.userId, type: 'badge', title: 'Badge Unlocked!', message: `You earned the "${reward.badge.name}" badge.`, relatedId: reward.badge.id, relatedType: 'badge', priority: 'high', notificationKey: `badge_unlocked:${reward.userId}:${reward.badge.id}` }).catch(() => {});
    }
  },

  async fetchConversations(userId: string) {
    const rows = await prisma.swapConversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        swapRequest: {
          include: {
            fromUser: { select: userSummarySelect },
            toUser: { select: userSummarySelect },
          },
        },
        listing: {
          include: profileInclude,
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const unreadCounts = await prisma.swapMessage.groupBy({
      by: ['swapRequestId'],
      where: {
        swapRequestId: { in: rows.map((row) => row.id) },
        senderId: { not: userId },
        read: false,
      },
      _count: { _all: true },
    });
    const unreadByConversation = new Map(unreadCounts.map((item) => [item.swapRequestId, item._count._all]));

    const results = rows.map((row) => {
        const listing = formatListing(row.listing);
        const otherUserRaw =
          row.user1Id === userId
            ? row.swapRequest?.toUser || row.listing?.user
            : row.swapRequest?.fromUser;
        const otherUser = formatParticipant(otherUserRaw);

        const lastMessage =
          row.messages && row.messages.length > 0
            ? formatMessage(row.messages[0])
            : undefined;

        return {
          id: row.id,
          swapRequestId: row.swapRequestId,
          listing,
          otherUser,
          lastMessage,
          unreadCount: unreadByConversation.get(row.id) ?? 0,
          status: row.status,
          meetupMethod: listing.meetupMethod,
        };
      });

    return results;
  },

  async fetchMessages(conversationOrSwapRequestId: string, userId: string, role: string, page: { limit?: number; before?: string; after?: string } = {}) {
    // Check conversation ownership
    const conv = await prisma.swapConversation.findFirst({
      where: {
        OR: [
          { id: conversationOrSwapRequestId },
          { swapRequestId: conversationOrSwapRequestId },
        ],
      },
    });

    if (!conv) throw new HttpError(404, 'Conversation not found.');
    if (conv.user1Id !== userId && conv.user2Id !== userId && role !== 'admin' && role !== 'moderator') {
      throw new HttpError(403, 'You are not authorized to view this conversation');
    }

    if (page.before && page.after) throw new HttpError(400, 'Choose one paging direction.');
    const cursor = decodeCursor(page.before ?? page.after);
    const limit = Math.min(50, Math.max(1, page.limit ?? 40));
    const forward = Boolean(page.after);
    const swapRequestId = conv.id;
    const rows = await prisma.swapMessage.findMany({
      where: { swapRequestId, ...(cursor ? { OR: [
        { timestamp: { [forward ? 'gt' : 'lt']: new Date(cursor.at) } },
        { timestamp: new Date(cursor.at), id: { [forward ? 'gt' : 'lt']: cursor.id } },
      ] } : {}) },
      orderBy: [{ timestamp: forward ? 'asc' : 'desc' }, { id: forward ? 'asc' : 'desc' }],
      take: limit + 1,
    });
    const items = rows.slice(0, limit);
    const edge = items[items.length - 1];
    const nextCursor = rows.length > limit && edge ? encodeCursor({ id: edge.id, at: edge.timestamp.toISOString() }) : null;
    const chronological = forward ? items : items.reverse();
    const newest = chronological[chronological.length - 1];
    return { items: chronological.map(formatMessage), nextCursor,
      newestCursor: newest ? encodeCursor({ id: newest.id, at: newest.timestamp.toISOString() }) : null };
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

    if (!conv) throw new HttpError(404, 'Conversation not found.');
    if (conv.user1Id !== senderId && conv.user2Id !== senderId && role !== 'admin' && role !== 'moderator') {
      throw new HttpError(403, 'You are not authorized to send messages in this conversation');
    }

    const swapRequestId = conv.id;
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
    if (!conv) throw new HttpError(404, 'Conversation not found.');
    if (conv.user1Id !== userId && conv.user2Id !== userId) throw new HttpError(403, 'You are not authorized to view this conversation');
    const swapRequestId = conv.id;

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
      where: { userId, OR: [{ isActive: true }, { approvalStatus: 'rejected' }] },
      include: profileInclude,
      orderBy: { createdAt: 'desc' },
    });
    return withOwnerRatings(rows.map(formatListing));
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
