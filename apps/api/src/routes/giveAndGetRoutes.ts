import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest, requireModeratorAccess } from '../http/authentication';

const router = Router();
const prisma = new PrismaClient();

// Get all give and get items (admin view)
router.get('/', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const items = await prisma.giveAndGetItem.findMany({
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Map data for frontend to match expected format
    const formattedItems = items.map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      condition: item.condition,
      wantedFor: item.wantedFor || 'N/A',
      postedBy: item.user.name,
      date: item.createdAt.toISOString().split('T')[0],
      status: item.status,
      image: item.imageUrl || '📦',
      description: item.description,
    }));

    res.json(formattedItems);
  } catch (error) {
    console.error('Error fetching give and get items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete an item
router.delete('/:id', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.giveAndGetItem.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting give and get item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update item status
router.patch('/:id/status', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const updatedItem = await prisma.giveAndGetItem.update({
      where: { id },
      data: { status },
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating give and get item status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Swap Listings (Manage Listings) ─────────────────────────────────────────

// Get all swap listings (admin view)
router.get('/swap-listings', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { status, reported } = req.query;
    const where: any = {};
    if (status && status !== 'all') where.approvalStatus = status;
    if (reported === 'true') where.isReported = true;

    const listings = await prisma.swapListing.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = listings.map(listing => ({
      id: listing.id,
      title: listing.title,
      category: listing.category,
      condition: listing.condition,
      lookingFor: listing.lookingFor,
      postedBy: listing.user.name,
      postedByEmail: listing.user.email,
      userId: listing.userId,
      date: listing.createdAt.toISOString().split('T')[0],
      approvalStatus: listing.approvalStatus,
      isActive: listing.isActive,
      isReported: listing.isReported,
      reportCount: listing.reportCount,
      reportReason: listing.reportReason,
      images: listing.images,
      meetupMethod: listing.meetupMethod,
      city: listing.city,
      province: listing.province,
      description: listing.description,
      quantity: listing.quantity,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching swap listings for admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Approve a swap listing
router.patch('/swap-listings/:id/approve', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const listing = await prisma.swapListing.update({
      where: { id: req.params.id },
      data: { approvalStatus: 'approved', isReported: false, reportCount: 0, reportReason: null },
    });
    res.json(listing);
  } catch (error) {
    console.error('Error approving swap listing:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reject a swap listing
router.patch('/swap-listings/:id/reject', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { reason } = req.body;
    const listing = await prisma.swapListing.update({
      where: { id: req.params.id },
      data: { approvalStatus: 'rejected', isActive: false, reportReason: reason || null },
    });
    res.json(listing);
  } catch (error) {
    console.error('Error rejecting swap listing:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Report a swap listing (user-facing, but routed through admin for moderation)
router.patch('/swap-listings/:id/report', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { reason } = req.body;
    const listing = await prisma.swapListing.update({
      where: { id: req.params.id },
      data: {
        isReported: true,
        reportCount: { increment: 1 },
        reportReason: reason || 'Reported by user',
      },
    });
    res.json(listing);
  } catch (error) {
    console.error('Error reporting swap listing:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a swap listing (admin)
router.delete('/swap-listings/:id', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    await prisma.swapListing.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting swap listing:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get swap listing stats
router.get('/swap-listings/stats', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const [total, pending, approved, rejected, reported] = await Promise.all([
      prisma.swapListing.count(),
      prisma.swapListing.count({ where: { approvalStatus: 'pending' } }),
      prisma.swapListing.count({ where: { approvalStatus: 'approved' } }),
      prisma.swapListing.count({ where: { approvalStatus: 'rejected' } }),
      prisma.swapListing.count({ where: { isReported: true } }),
    ]);
    res.json({ total, pending, approved, rejected, reported });
  } catch (error) {
    console.error('Error fetching swap listing stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
