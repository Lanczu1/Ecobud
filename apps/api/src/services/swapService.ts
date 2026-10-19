import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
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

// A listing takes one request at a time. These statuses hold it; a declined or
// cancelled request frees it, and a completed one frees it while items are left.
const OPEN_REQUEST_STATUSES = ['pending', 'accepted'];

// Quantity is stored as text. Listings saved before it became digits-only count as one item.
function itemsLeft(quantity: string) {
  const count = Number.parseInt(quantity, 10);
  return Number.isFinite(count) ? Math.max(0, count) : 1;
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

    const where: any = { isActive: true, approvalStatus: 'approved', quantity: { not: '0' }, requests: { none: { status: { in: OPEN_REQUEST_STATUSES } } } };
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

  async sendSwapRequest(listingId: string, fromUserId: string, message?: string, quantity = 1) {
    const listing = await prisma.swapListing.findUnique({
      where: { id: listingId },
      select: { userId: true, isActive: true },
    });
    if (!listing || !listing.isActive) throw new Error('Listing not found or inactive');
    if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(400, 'Choose how many items you want.');

    if (listing.userId === fromUserId) {
      throw new Error('You cannot send a swap request to your own listing');
    }

    return prisma.$transaction(async tx => {
      // Lock the listing so two people tapping Swap Now together cannot both get in.
      const [locked] = await tx.$queryRaw<{ quantity: string }[]>`SELECT quantity FROM swap_listings WHERE id = ${listingId} FOR UPDATE`;
      const left = itemsLeft(locked?.quantity ?? '0');
      if (left === 0) throw new HttpError(400, 'All items in this listing have been given away.');
      if (quantity > left) throw new HttpError(400, `Only ${left} left in this listing.`);
      const taken = await tx.swapRequest.findFirst({
        where: { listingId, status: { in: OPEN_REQUEST_STATUSES } },
        select: { fromUserId: true },
      });
      if (taken) {
        throw new Error(taken.fromUserId === fromUserId
          ? 'You already sent a request for this listing.'
          : 'This listing already has a request.');
      }

      const request = await tx.swapRequest.create({
        data: {
          listingId,
          fromUserId,
          toUserId: listing.userId,
          status: 'pending',
          message: message ?? null,
          quantity,
        },
      });

      const conversation = await tx.swapConversation.create({
        data: {
          swapRequestId: request.id,
          listingId,
          user1Id: fromUserId,
          user2Id: listing.userId,
          status: 'pending',
        },
      });

      if (message && message.trim()) {
        await tx.swapMessage.create({
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
    });
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
      // Take the handed-over items off the listing. With items left it shows on Browse again.
      const [locked] = await tx.$queryRaw<{ quantity: string }[]>`SELECT quantity FROM swap_listings WHERE id = ${swapReq.listingId} FOR UPDATE`;
      await tx.swapListing.update({
        where: { id: swapReq.listingId },
        data: { quantity: String(Math.max(0, itemsLeft(locked?.quantity ?? '0') - swapReq.quantity)) },
      });
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
    const mine = { OR: [{ user1Id: userId }, { user2Id: userId }] };
    // Two round trips instead of one per nested relation: the member's conversations and unread counts, then everything they point at.
    const [rows, unreadCounts] = await Promise.all([
      prisma.swapConversation.findMany({ where: mine, orderBy: { createdAt: 'desc' } }),
      prisma.swapMessage.groupBy({
        by: ['swapRequestId'],
        where: { conversation: mine, senderId: { not: userId }, read: false },
        _count: { _all: true },
      }),
    ]);
    if (rows.length === 0) return [];

    const conversationIds = rows.map(row => row.id);
    // user1 sent the request and user2 owns the listing, so these are every participant.
    const participantIds = [...new Set(rows.flatMap(row => [row.user1Id, row.user2Id]))];
    const [listings, requests, accounts, profiles, lastMessages] = await Promise.all([
      prisma.swapListing.findMany({ where: { id: { in: [...new Set(rows.map(row => row.listingId))] } } }),
      prisma.swapRequest.findMany({ where: { id: { in: rows.map(row => row.swapRequestId) } }, select: { id: true, quantity: true } }),
      prisma.user.findMany({ where: { id: { in: participantIds } }, select: { id: true, name: true, createdAt: true } }),
      prisma.profile.findMany({ where: { userId: { in: participantIds } }, select: { userId: true, displayName: true, avatarUrl: true } }),
      prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT DISTINCT ON (swap_request_id) id, swap_request_id AS "swapRequestId", sender_id AS "senderId",
          text, image_url AS "imageUrl", timestamp, read, delivered
        FROM swap_messages WHERE swap_request_id IN (${Prisma.join(conversationIds)})
        ORDER BY swap_request_id, timestamp DESC, id DESC`),
    ]);

    const profilesByUser = new Map(profiles.map(profile => [profile.userId, profile]));
    const usersById = new Map<string, any>(accounts.map(user => [user.id, { ...user, profile: profilesByUser.get(user.id) ?? null }]));
    const listingOwners = [...new Set(listings.map(listing => listing.userId))].filter(id => !usersById.has(id));
    if (listingOwners.length) {
      for (const user of await prisma.user.findMany({ where: { id: { in: listingOwners } }, select: userSummarySelect })) usersById.set(user.id, user);
    }
    const listingsById = new Map(listings.map(listing => [listing.id, listing]));
    const requestedQuantityById = new Map(requests.map(request => [request.id, request.quantity]));
    const lastMessageByConversation = new Map(lastMessages.map(message => [message.swapRequestId, message]));
    const unreadByConversation = new Map(unreadCounts.map((item) => [item.swapRequestId, item._count._all]));

    return rows.map((row) => {
      const listingRow = listingsById.get(row.listingId);
      const listing = formatListing({ ...listingRow, user: listingRow ? usersById.get(listingRow.userId) : undefined });
      const otherUser = formatParticipant(usersById.get(row.user1Id === userId ? row.user2Id : row.user1Id));
      const last = lastMessageByConversation.get(row.id);

      return {
        id: row.id,
        swapRequestId: row.swapRequestId,
        listing,
        otherUser,
        lastMessage: last ? formatMessage(last) : undefined,
        unreadCount: unreadByConversation.get(row.id) ?? 0,
        status: row.status,
        meetupMethod: listing.meetupMethod,
        requestedQuantity: requestedQuantityById.get(row.swapRequestId) ?? 1,
      };
    });
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
    // Staff can post without being a member; then nobody is notified, as before.
    const isMember = conv.user1Id === senderId || conv.user2Id === senderId;
    return {
      message: formatMessage(row),
      recipientId: isMember ? (conv.user1Id === senderId ? conv.user2Id : conv.user1Id) : null,
      listingId: conv.listingId,
    };
  },

  // The other member of the conversation, or null when userId is not in it.
  async otherParticipant(conversationOrSwapRequestId: string, userId: string) {
    const conv = await prisma.swapConversation.findFirst({
      where: { OR: [{ id: conversationOrSwapRequestId }, { swapRequestId: conversationOrSwapRequestId }] },
      select: { id: true, user1Id: true, user2Id: true },
    });
    if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) return null;
    return { conversationId: conv.id, userId: conv.user1Id === userId ? conv.user2Id : conv.user1Id };
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

    const updated = await prisma.swapMessage.updateMany({
      where: {
        swapRequestId,
        NOT: { senderId: userId },
        read: false,
      },
      data: { read: true },
    });
    return {
      conversationId: swapRequestId,
      senderId: conv.user1Id === userId ? conv.user2Id : conv.user1Id,
      count: updated.count,
    };
  },

  async fetchMyListings(userId: string) {
    const rows = await prisma.swapListing.findMany({
      where: { userId, OR: [{ isActive: true }, { approvalStatus: 'rejected' }] },
      include: profileInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
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
