import { Router } from 'express';
import { authenticateRequest, type AuthenticatedRequest } from '../http/authentication';
import { swapService } from '../services/swapService';
import { supabaseRealtimeService } from '../services/supabaseRealtimeService';
import { prisma } from '../prismaClient';
import { avatarUploadMiddleware } from '../http/uploadMiddleware';

const router = Router();

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
router.post('/listings', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const listing = await swapService.createListing({
      userId: req.auth!.userId,
      ...req.body,
    });
    res.status(201).json(listing);
  } catch (error: any) {
    console.error('Error creating swap listing:', error);
    res.status(400).json({ message: error.message || 'Internal server error' });
  }
});

// Update listing (with IDOR protection)
router.patch('/listings/:id', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    await swapService.updateListing(req.params.id, req.auth!.userId, req.auth!.role, req.body);
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
    await swapService.deleteListing(req.params.id, req.auth!.userId, req.auth!.role);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting swap listing:', error);
    const status = error.message?.includes('permission') ? 403 : error.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ message: error.message || 'Internal server error' });
  }
});

// Upload listing image
router.post('/upload-image', authenticateRequest, avatarUploadMiddleware.single('image'), async (req: AuthenticatedRequest, res) => {
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
router.post('/requests', authenticateRequest, async (req: AuthenticatedRequest, res) => {
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
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating swap request status:', error);
    const statusCode = error.message?.includes('permission') ? 403 : error.message?.includes('not found') ? 404 : 500;
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
        supabaseRealtimeService.publishSwapEvent({
          actorUserId: req.auth!.userId,
          targetUserId,
          eventType: 'message',
          swapRequestId: req.params.conversationId,
        }).catch(() => {});
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
