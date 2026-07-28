import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest, requireModeratorAccess, requireUserAccess, type AuthenticatedRequest } from '../http/authentication';
import { redeemUploadMiddleware } from '../http/uploadMiddleware';

const router = Router();
const prisma = new PrismaClient();

// ─── Public Endpoints (for mobile app) — MUST be before /:id routes ────────

// Get active redeem items (public)
router.get('/items', async (req, res) => {
  try {
    const items = await prisma.redeemItem.findMany({
      where: { isActive: true, stock: { not: 0 } },
      orderBy: { coinCost: 'asc' },
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching active redeem items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Submit a redeem request (coins deducted upfront, pending admin approval)
router.post('/redeem', authenticateRequest, requireUserAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const { itemId } = req.body;
    const userId = req.auth!.userId;

    if (!itemId) return res.status(400).json({ message: 'Item ID is required' });

    const item = await prisma.redeemItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (!item.isActive) return res.status(400).json({ message: 'Item is no longer available' });
    if (item.stock === 0) return res.status(400).json({ message: 'Item is out of stock' });

    const userStats = await prisma.userStats.findUnique({ where: { userId } });
    if (!userStats) return res.status(400).json({ message: 'User stats not found' });
    if (userStats.ecoCoins < item.coinCost) {
      return res.status(400).json({ message: 'Not enough coins' });
    }

    // Check for duplicate pending request
    const existing = await prisma.redeemRequest.findFirst({
      where: { userId, itemId, status: 'pending' },
    });
    if (existing) {
      return res.status(400).json({ message: 'You already have a pending request for this item' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    // Deduct coins, decrement stock, create request in a transaction
    const [request] = await prisma.$transaction([
      prisma.redeemRequest.create({
        data: {
          userId,
          itemId,
          coinCost: item.coinCost,
          status: 'pending',
          userName: user?.name || '',
          itemTitle: item.title,
          itemImage: item.imageUrl,
        },
      }),
      prisma.userStats.update({
        where: { userId },
        data: { ecoCoins: { decrement: item.coinCost } },
      }),
      ...(item.stock > 0 ? [
        prisma.redeemItem.update({
          where: { id: itemId },
          data: { stock: { decrement: 1 } },
        }),
      ] : []),
      prisma.rewardTransaction.create({
        data: {
          userId,
          type: 'eco_coins',
          amount: -item.coinCost,
        },
      }),
    ]);

    res.status(201).json({ success: true, request, message: 'Redemption request submitted. Awaiting admin approval.' });
  } catch (error) {
    console.error('Error creating redeem request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get my redeem requests (user)
router.get('/my-requests', authenticateRequest, requireUserAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const requests = await prisma.redeemRequest.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching user redeem requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Upload image for redeem item
router.post('/upload', authenticateRequest, requireModeratorAccess, redeemUploadMiddleware.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = `/uploads/Redeem/${req.file.filename}`;
    res.status(201).json({ url });
  } catch (error) {
    console.error('Error uploading redeem image:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Admin Endpoints ───────────────────────────────────────────────────────

// Get all redeem items (admin view)
router.get('/', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const items = await prisma.redeemItem.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching redeem items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get redeem items stats
router.get('/stats', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const [total, active, inactive, outOfStock] = await Promise.all([
      prisma.redeemItem.count(),
      prisma.redeemItem.count({ where: { isActive: true } }),
      prisma.redeemItem.count({ where: { isActive: false } }),
      prisma.redeemItem.count({ where: { stock: 0 } }),
    ]);
    res.json({ total, active, inactive, outOfStock });
  } catch (error) {
    console.error('Error fetching redeem stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all redemption requests (admin)
router.get('/requests', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status && status !== 'all') where.status = status;

    const requests = await prisma.redeemRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching redeem requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get redemption request stats (admin)
router.get('/requests/stats', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const [total, pending, approved, rejected, readyToClaim, claimed] = await Promise.all([
      prisma.redeemRequest.count(),
      prisma.redeemRequest.count({ where: { status: 'pending' } }),
      prisma.redeemRequest.count({ where: { status: 'approved' } }),
      prisma.redeemRequest.count({ where: { status: 'rejected' } }),
      prisma.redeemRequest.count({ where: { status: 'ready_to_claim' } }),
      prisma.redeemRequest.count({ where: { status: 'claimed' } }),
    ]);
    res.json({ total, pending, approved, rejected, readyToClaim, claimed });
  } catch (error) {
    console.error('Error fetching redeem request stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Approve a redemption request → status becomes ready_to_claim
router.patch('/requests/:id/approve', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { claimLocation } = req.body;
    const request = await prisma.redeemRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Cannot approve a request with status "${request.status}"` });
    }

    // Generate claim code: ECO-XXXXXX
    const code = 'ECO-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Claim valid for 7 days
    const claimUntil = new Date();
    claimUntil.setDate(claimUntil.getDate() + 7);

    const instructions = [
      'Present this claim code.',
      'Bring one valid ID.',
      `Claim within the given period (until ${claimUntil.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}).`,
    ].join('\n');

    const updated = await prisma.redeemRequest.update({
      where: { id },
      data: {
        status: 'ready_to_claim',
        claimCode: code,
        claimLocation: claimLocation || 'Barangay San Isidro Hall',
        claimUntil,
        claimInstructions: instructions,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error('Error approving redeem request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reject a redemption request → refund ecoCoins
router.patch('/requests/:id/reject', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const request = await prisma.redeemRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Cannot reject a request with status "${request.status}"` });
    }

    const item = await prisma.redeemItem.findUnique({ where: { id: request.itemId } });

    const transaction: any[] = [
      prisma.redeemRequest.update({
        where: { id },
        data: { status: 'rejected', rejectReason: reason || null },
      }),
      prisma.userStats.update({
        where: { userId: request.userId },
        data: { ecoCoins: { increment: request.coinCost } },
      }),
      prisma.rewardTransaction.create({
        data: {
          userId: request.userId,
          type: 'eco_coins',
          amount: request.coinCost,
        },
      }),
    ];

    if (item && item.stock !== -1) {
      transaction.push(
        prisma.redeemItem.update({
          where: { id: request.itemId },
          data: { stock: { increment: 1 } },
        })
      );
    }

    // Refund coins and restore stock in a transaction
    await prisma.$transaction(transaction);

    res.json({ success: true, message: 'Request rejected and coins refunded' });
  } catch (error) {
    console.error('Error rejecting redeem request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// User marks as claimed after pickup
router.patch('/requests/:id/claim', authenticateRequest, requireUserAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.redeemRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.userId !== req.auth!.userId) {
      return res.status(403).json({ message: 'Not your request' });
    }
    if (request.status !== 'ready_to_claim') {
      return res.status(400).json({ message: `Cannot claim a request with status "${request.status}"` });
    }

    const updated = await prisma.redeemRequest.update({
      where: { id },
      data: { status: 'claimed' },
    });
    res.json(updated);
  } catch (error) {
    console.error('Error claiming redeem request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a redeem item
router.post('/', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { title, description, coinCost, imageUrl, category, stock } = req.body;
    if (!title || coinCost == null) {
      return res.status(400).json({ message: 'Title and coin cost are required' });
    }
    const item = await prisma.redeemItem.create({
      data: {
        title,
        description: description || '',
        coinCost: Number(coinCost),
        imageUrl: imageUrl || null,
        category: category || 'general',
        stock: stock != null ? Number(stock) : -1,
      },
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating redeem item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update a redeem item
router.patch('/:id', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const data: any = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.coinCost !== undefined) data.coinCost = Number(req.body.coinCost);
    if (req.body.imageUrl !== undefined) data.imageUrl = req.body.imageUrl || null;
    if (req.body.category !== undefined) data.category = req.body.category;
    if (req.body.stock !== undefined) data.stock = Number(req.body.stock);
    if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);

    const item = await prisma.redeemItem.update({ where: { id }, data });
    res.json(item);
  } catch (error) {
    console.error('Error updating redeem item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Toggle active status
router.patch('/:id/toggle', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.redeemItem.findUnique({ where: { id }, select: { isActive: true } });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    const updated = await prisma.redeemItem.update({ where: { id }, data: { isActive: !item.isActive } });
    res.json(updated);
  } catch (error) {
    console.error('Error toggling redeem item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a redeem item
router.delete('/:id', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    await prisma.redeemItem.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting redeem item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
