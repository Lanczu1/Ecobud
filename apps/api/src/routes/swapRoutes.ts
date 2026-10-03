import { requireApprovedId } from '../http/idVerificationAccess';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { swapReportSchema } from '../services/swapReportService';
import { errorBoundary } from '../http/errorResponder';
import { parseAdminPagination } from '../utils/adminPagination';
import { authenticateRequest, type AuthenticatedRequest } from '../http/authentication';
import { swapService } from '../services/swapService';
import { supabaseRealtimeService } from '../services/supabaseRealtimeService';
import { sendDirectNotification } from '../services/notificationService';
import { prisma } from '../prismaClient';
import { avatarUploadMiddleware } from '../http/uploadMiddleware';

const router = Router();
const listingReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => (req as AuthenticatedRequest).auth!.userId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reports. Please try again in an hour.' },
});

router.post('/listings/:id/report', authenticateRequest, listingReportLimiter, errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const { reason, reportName } = swapReportSchema.parse(req.body);
  const result = await swapService.reportListing(req.params.id, req.auth!.userId, reason, reportName);
  supabaseRealtimeService.publishSwapEvent({ actorUserId: req.auth!.userId, targetUserId: result.ownerId, eventType: 'listing', listingId: result.listingId }).catch(() => {});
  res.status(201).json({ message: 'Report submitted for moderator review.' });
}));

router.get('/listings/:id/reports', authenticateRequest, errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const listing = await prisma.swapListing.findUnique({ where: { id: req.params.id }, select: { userId: true, isActive: true, approvalStatus: true } });
  if (!listing || listing.approvalStatus === 'deleted' || (!(listing.isActive && listing.approvalStatus === 'approved') && listing.userId !== req.auth!.userId)) {
    return res.status(404).json({ message: 'Listing not available.' });
  }
  const { page, pageSize, skip } = parseAdminPagination(req.query);
  const where = { listingId: req.params.id, resolvedAt: null };
  const [items, total, count] = await Promise.all([
    prisma.swapListingReport.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' }, select: { id: true, reportName: true, reason: true, occurrences: true, createdAt: true } }),
    prisma.swapListingReport.count({ where }),
    prisma.swapListingReport.aggregate({ where, _sum: { occurrences: true } }),
  ]);
  res.json({ items: items.map(report => ({ id: report.id, reportName: report.reportName, reason: report.reason, occurrences: report.occurrences, createdAt: report.createdAt })), activeCount: count._sum.occurrences ?? 0, pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}));

// Fetch marketplace listings
router.get('/listings', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, category, meetupMethod, sortBy, limit, offset } = req.query;
    const listings = await swapService.fetchListings({
      search: search as string | undefined,
      category: category as string | undefined,
      meetupMethod: meetupMethod as string | undefined,
      sortBy: sortBy as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
    res.json(listings);
  } catch (error) {
    console.error('Error fetching swap listings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch single listing
router.get('/listings/:id', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const listing = await swapService.fetchListingById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json(listing);
  } catch (error) {
    console.error('Error fetching swap listing:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create listing
router.post('/listings', authenticateRequest, requireApprovedId, async (req: AuthenticatedRequest, res) => {
  try {
    const listing = await swapService.createListing({
      ...req.body,
      userId: req.auth!.userId,
    });
    supabaseRealtimeService.publishSwapEvent({
      actorUserId: req.auth!.userId,
      targetUserId: req.auth!.userId,
      eventType: 'listing',
      listingId: listing.id,
    }).catch(() => {});
    res.status(201).json(listing);
  } catch (error: any) {
    console.error('Error creating swap listing:', error);
    res.status(400).json({ message: error.message || 'Internal server error' });
  }
});

// Update listing (with IDOR protection)
router.patch('/listings/:id', authenticateRequest, requireApprovedId, async (req: AuthenticatedRequest, res) => {
  try {
    const listing = await prisma.swapListing.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    await swapService.updateListing(req.params.id, req.auth!.userId, req.auth!.role, req.body);
    if (listing?.userId) {
      supabaseRealtimeService.publishSwapEvent({
        actorUserId: req.auth!.userId,
        targetUserId: listing.userId,
        eventType: 'listing',
        listingId: req.params.id,
      }).catch(() => {});
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating swap listing:', error);
    const status = error.message?.includes('permission') ? 403 : error.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ message: error.message || 'Internal server error' });
  }
});

// Delete listing (with IDOR protection)
router.delete('/listings/:id', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const listing = await prisma.swapListing.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    await swapService.deleteListing(req.params.id, req.auth!.userId, req.auth!.role);
    if (listing?.userId) {
      supabaseRealtimeService.publishSwapEvent({
        actorUserId: req.auth!.userId,
        targetUserId: listing.userId,
        eventType: 'listing',
        listingId: req.params.id,
      }).catch(() => {});
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting swap listing:', error);
    const status = error.message?.includes('permission') ? 403 : error.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ message: error.message || 'Internal server error' });
  }
});

// Upload listing image
router.post('/upload-image', authenticateRequest, requireApprovedId, avatarUploadMiddleware.single('image'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    const url = await swapService.uploadImage(req.auth!.userId, req.file);
    res.json({ url });
  } catch (error) {
    console.error('Error uploading swap image:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Send swap request
router.post('/requests', authenticateRequest, requireApprovedId, async (req: AuthenticatedRequest, res) => {
  try {
    const { listingId, message } = req.body;
    const request = await swapService.sendSwapRequest(listingId, req.auth!.userId, message);
    const listing = await swapService.fetchListingById(listingId);
    if (listing?.user?.id) {
      supabaseRealtimeService.publishSwapEvent({
        actorUserId: req.auth!.userId,
        targetUserId: listing.user.id,
        eventType: 'request',
        listingId,
        swapRequestId: request.id,
      }).catch(() => {});
      const requester = await prisma.user.findUnique({
        where: { id: req.auth!.userId },
        select: { name: true, profile: { select: { displayName: true } } },
      });
      const requesterName = requester?.profile?.displayName || requester?.name || 'Someone';
      void sendDirectNotification({
        userId: listing.user.id,
        type: 'swap',
        title: 'New Give & Get request',
        message: `${requesterName} wants to request “${listing.title}”.`,
        relatedId: request.id,
        relatedType: 'swap_request',
        priority: 'high',
        notificationKey: `swap_request_created:${request.id}`,
      });
    }
    res.status(201).json(request);
  } catch (error: any) {
    console.error('Error sending swap request:', error);
    res.status(400).json({ message: error.message || 'Internal server error' });
  }
});

// Update swap request status (accept/decline/complete)
router.patch('/requests/:id/status', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required' });
    await swapService.updateSwapRequestStatus(req.params.id, req.auth!.userId, req.auth!.role, status);
    const conversations = await swapService.fetchConversations(req.auth!.userId);
    const conv = conversations.find((c) => c.swapRequestId === req.params.id);
    if (conv) {
      const targetUserId = conv.otherUser.id;
      if (targetUserId && targetUserId !== req.auth!.userId) {
        supabaseRealtimeService.publishSwapEvent({
          actorUserId: req.auth!.userId,
          targetUserId,
          eventType: 'status',
          swapRequestId: req.params.id,
        }).catch(() => {});
        const actor = await prisma.user.findUnique({
          where: { id: req.auth!.userId },
          select: { name: true, profile: { select: { displayName: true } } },
        });
        const actorName = actor?.profile?.displayName || actor?.name || 'The other member';
        const statusCopy: Record<string, { title: string; message: string }> = {
          accepted: {
            title: conv.listing.lookingFor?.trim().toLowerCase() === 'giveaway' ? 'Request Accepted' : 'Swap request accepted',
            message: conv.listing.lookingFor?.trim().toLowerCase() === 'giveaway'
              ? `${actorName} accepted your giveaway request.`
              : `${actorName} accepted your Give & Get request.`,
          },
          declined: { title: 'Swap request declined', message: `${actorName} declined your Give & Get request.` },
          completed: { title: 'Exchange completed', message: `${actorName} marked your Give & Get exchange as complete.` },
          cancelled: { title: 'Swap request cancelled', message: `${actorName} cancelled the Give & Get request.` },
        };
        const copy = statusCopy[status];
        if (copy) {
          void sendDirectNotification({
            userId: targetUserId,
            type: 'swap',
            title: copy.title,
            message: copy.message,
            relatedId: req.params.id,
            relatedType: 'swap_request',
            priority: 'high',
            notificationKey: `swap_request_status:${req.params.id}:${status}`,
          });
        }
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating swap request status:', error);
    const statusCode = error.statusCode || (error.message?.includes('permission') ? 403 : error.message?.includes('not found') ? 404 : 500);
    res.status(statusCode).json({ message: error.message || 'Internal server error' });
  }
});

// Fetch conversations
router.get('/conversations', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const conversations = await swapService.fetchConversations(req.auth!.userId);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch messages for a conversation (with IDOR protection)
router.get('/conversations/:conversationId/messages', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const messages = await swapService.fetchMessages(req.params.conversationId, req.auth!.userId, req.auth!.role);
    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    const status = error.message?.includes('authorized') ? 403 : 500;
    res.status(status).json({ message: error.message || 'Internal server error' });
  }
});

// Send message (with IDOR protection)
router.post('/conversations/:conversationId/messages', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, imageUrl } = req.body;
    const { conversationId } = req.params;
    const message = await swapService.sendMessage(
      conversationId,
      req.auth!.userId,
      req.auth!.role,
      text,
      imageUrl,
    );
    const conversations = await swapService.fetchConversations(req.auth!.userId);
    const conv = conversations.find((c) => c.id === req.params.conversationId);
    if (conv) {
      const targetUserId = conv.otherUser.id;
      if (targetUserId && targetUserId !== req.auth!.userId) {
        // Realtime UI update (in-app)
        supabaseRealtimeService.publishSwapEvent({
          actorUserId: req.auth!.userId,
          targetUserId,
          eventType: 'message',
          swapRequestId: req.params.conversationId,
        }).catch(() => {});

        // Push notification for the recipient
        const sender = await prisma.user.findUnique({
          where: { id: req.auth!.userId },
          select: { name: true, profile: { select: { displayName: true } } },
        });
        const senderName = sender?.profile?.displayName || sender?.name || 'Someone';
        const listingTitle = conv.listing?.title || 'Give & Get';
        const preview = text ? (text.length > 60 ? text.slice(0, 57) + '…' : text) : '📷 Image';
        void sendDirectNotification({
          userId: targetUserId,
          type: 'swap',
          title: `${senderName} sent you a message`,
          message: `${listingTitle}: ${preview}`,
          relatedId: conv.swapRequestId || conversationId,
          relatedType: 'swap',
          priority: 'high',
          notificationKey: `swap_chat_msg:${message.id}`,
        });
      }
    }
    res.status(201).json(message);
  } catch (error: any) {
    console.error('Error sending message:', error);
    const status = error.message?.includes('authorized') ? 403 : 500;
    res.status(status).json({ message: error.message || 'Internal server error' });
  }
});

// Mark messages read
router.patch('/conversations/:conversationId/read', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    await swapService.markMessagesRead(req.params.conversationId, req.auth!.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages read:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch user's own listings
router.get('/my-listings', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const listings = await swapService.fetchMyListings(req.auth!.userId);
    res.json(listings);
  } catch (error) {
    console.error('Error fetching my listings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
