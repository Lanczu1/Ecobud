import { z } from 'zod';
import { prisma } from '../prismaClient';
import { HttpError } from '../http/errorResponder';

export const swapReportNames = ['Fake Listing', 'Misleading Photos', 'Misleading Description', 'Unsafe Item', 'Inappropriate Content', 'Other'] as const;
export const swapReportSchema = z.object({
  reportName: z.enum(swapReportNames).default('Other'),
  reason: z.string().trim().min(5).max(500),
});

export async function submitSwapReport(listingId: string, reporterId: string, input: z.infer<typeof swapReportSchema>, moderator = false) {
  try {
    return await prisma.$transaction(async tx => {
      const listing = await tx.swapListing.findUnique({ where: { id: listingId } });
      if (!listing || listing.approvalStatus === 'deleted' || (!moderator && (!listing.isActive || listing.approvalStatus !== 'approved'))) {
        throw new HttpError(404, 'This listing is no longer available for reporting.');
      }
      if (!moderator && listing.userId === reporterId) throw new HttpError(400, 'You cannot report your own listing.');
      const updated = await tx.swapListing.updateMany({
        where: { id: listingId, ...(moderator ? { approvalStatus: listing.approvalStatus } : { isActive: true, approvalStatus: 'approved' }) },
        data: { isReported: true, reportCount: { increment: 1 }, ...((listing.approvalStatus !== 'rejected') ? { reportReason: input.reason } : {}) },
      });
      if (!updated.count) throw new HttpError(404, 'This listing is no longer available for reporting.');
      await tx.swapListingReport.create({ data: { listingId, reporterId, reportName: input.reportName, reason: input.reason } });
      return { listingId, ownerId: listing.userId };
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') throw new HttpError(409, 'You have already reported this listing. Your report is awaiting review.');
    throw err;
  }
}
