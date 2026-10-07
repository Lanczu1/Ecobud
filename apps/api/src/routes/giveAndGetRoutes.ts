import { Router } from 'express';
import { submitSwapReport, swapReportSchema } from '../services/swapReportService';
import { errorBoundary } from '../http/errorResponder';
import { parseAdminPagination } from '../utils/adminPagination';
import { prisma } from '../prismaClient';
import { authenticateRequest, requireModeratorAccess, type AuthenticatedRequest } from '../http/authentication';
import { sendDirectNotification } from '../services/notificationService';
import { supabaseRealtimeService } from '../services/supabaseRealtimeService';

const router = Router();

// Get all give and get items (admin view)
router.get('/', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const { skip, pageSize } = parseAdminPagination(req.query);
    const items = await prisma.giveAndGetItem.findMany({
      skip,
      take: pageSize,
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
router.get('/swap-listings', authenticateRequest, requireModeratorAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, reported } = req.query;
    const { page, pageSize, skip } = parseAdminPagination(req.query);
    const where: any = { approvalStatus: { not: 'deleted' } };
    if (typeof req.query.recordId==='string') {
      where.id=req.query.recordId;
      if (req.auth!.role==='moderator') where.city={ equals:req.auth!.city?.trim() || '__unassigned__',mode:'insensitive' };
    }
    if (status && status !== 'all') where.approvalStatus = status;
    if (reported === 'true') where.isReported = true;
    if (typeof req.query.search === 'string' && req.query.search.trim()) where.title = { contains: req.query.search.trim().slice(0, 100), mode: 'insensitive' };

    const [listings, total] = await Promise.all([prisma.swapListing.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }), prisma.swapListing.count({ where })]);

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
      meetupLocation: listing.meetupLocation,
      meetupLandmark: listing.meetupLandmark,
      meetupNotes: listing.meetupNotes,
      city: listing.city,
      province: listing.province,
      description: listing.description,
      quantity: listing.quantity,
    }));

    res.json({ items: formatted, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (error) {
    console.error('Error fetching swap listings for admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Approve a swap listing
router.get('/swap-listings/:id/reports', authenticateRequest, requireModeratorAccess, errorBoundary(async (req, res) => {
  const listing = await prisma.swapListing.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!listing) return res.status(404).json({ message: 'Listing not found.' });
  const { page, pageSize, skip } = parseAdminPagination(req.query);
  const where = { listingId: req.params.id };
  const [items, total, active, history] = await Promise.all([
    prisma.swapListingReport.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' }, include: { reporter: { select: { name: true, email: true } } } }),
    prisma.swapListingReport.count({ where }),
    prisma.swapListingReport.aggregate({ where: { ...where, resolvedAt: null }, _sum: { occurrences: true } }),
    prisma.swapListingReport.aggregate({ where, _sum: { occurrences: true } }),
  ]);
  res.json({
    items: items.map(report => ({ id: report.id, account: report.reporter ? `${report.reporter.name} (${report.reporter.email})` : 'Account unavailable', reportName: report.reportName, reason: report.reason, occurrences: report.occurrences, createdAt: report.createdAt, resolvedAt: report.resolvedAt })),
    activeCount: active._sum.occurrences ?? 0,
    totalReports: history._sum.occurrences ?? 0,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}));

router.patch('/swap-listings/:id/approve', authenticateRequest, requireModeratorAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const listing = await prisma.$transaction(async tx => {
      const approved = await tx.swapListing.update({
        where: { id: req.params.id },
        data: { approvalStatus: 'approved', isActive: true, isReported: false, reportCount: 0, reportReason: null },
      });
      await tx.swapListingReport.updateMany({ where: { listingId: req.params.id, resolvedAt: null }, data: { resolvedAt: new Date() } });
      return approved;
    });

    await supabaseRealtimeService.publishUserNotice(listing.userId, {
      level: 'success',
      message: `Your item listing "${listing.title}" was approved and is now live in Give & Get!`,
      scope: 'moderation',
      title: 'Listing Approved',
    });
    supabaseRealtimeService.publishSwapEvent({
      actorUserId: req.auth!.userId,
      targetUserId: listing.userId,
      eventType: 'listing',
      listingId: listing.id,
    }).catch(() => {});

    void sendDirectNotification({
      userId: listing.userId,
      type: 'swap',
      title: 'Listing Approved',
      message: `Your item listing "${listing.title}" was approved and is now live in Give & Get!`,
      relatedId: listing.id,
      relatedType: 'swap',
      priority: 'high',
      notificationKey: `swap_listing_approved:${listing.id}`,
    });

    res.json(listing);
  } catch (error) {
    console.error('Error approving swap listing:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reject a swap listing
router.patch('/swap-listings/:id/reject', authenticateRequest, requireModeratorAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;
    const listing = await prisma.swapListing.update({
      where: { id: req.params.id },
      data: { approvalStatus: 'rejected', isActive: false, reportReason: reason || null },
    });

    await supabaseRealtimeService.publishUserNotice(listing.userId, {
      level: 'warning',
      message: `Your item listing "${listing.title}" was rejected.${reason ? ` Reason: ${reason}` : ''}`,
      scope: 'moderation',
      title: 'Listing Rejected',
    });
    supabaseRealtimeService.publishSwapEvent({
      actorUserId: req.auth!.userId,
      targetUserId: listing.userId,
      eventType: 'listing',
      listingId: listing.id,
    }).catch(() => {});

    void sendDirectNotification({
      userId: listing.userId,
      type: 'swap',
      title: 'Listing Rejected',
      message: `Your item listing "${listing.title}" was rejected.${reason ? ` Reason: ${reason}` : ''}`,
      relatedId: listing.id,
      relatedType: 'swap',
      priority: 'high',
      notificationKey: `swap_listing_rejected:${listing.id}`,
    });

    res.json(listing);
  } catch (error) {
    console.error('Error rejecting swap listing:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Report a swap listing (user-facing, but routed through admin for moderation)
router.patch('/swap-listings/:id/report', authenticateRequest, requireModeratorAccess, errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const result = await submitSwapReport(req.params.id, req.auth!.userId, swapReportSchema.parse(req.body), true);
  supabaseRealtimeService.publishSwapEvent({ actorUserId: req.auth!.userId, targetUserId: result.ownerId, eventType: 'listing', listingId: result.listingId }).catch(() => {});
  res.json({ message: 'Listing flagged for review.' });
}));

// Delete a swap listing (admin)
router.delete('/swap-listings/:id', authenticateRequest, requireModeratorAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const listing = await prisma.swapListing.delete({ where: { id: req.params.id }, select: { userId: true } });
    supabaseRealtimeService.publishSwapEvent({
      actorUserId: req.auth!.userId,
      targetUserId: listing.userId,
      eventType: 'listing',
      listingId: req.params.id,
    }).catch(() => {});
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
      prisma.swapListing.count({ where: { approvalStatus: { not: 'deleted' } } }),
      prisma.swapListing.count({ where: { approvalStatus: 'pending' } }),
      prisma.swapListing.count({ where: { approvalStatus: 'approved' } }),
      prisma.swapListing.count({ where: { approvalStatus: 'rejected' } }),
      prisma.swapListing.count({ where: { isReported: true, approvalStatus: { not: 'deleted' } } }),
    ]);
    res.json({ total, pending, approved, rejected, reported });
  } catch (error) {
    console.error('Error fetching swap listing stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
