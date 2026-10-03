import { Router } from 'express';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, requireRoles, type AuthenticatedRequest } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { avatarUploadMiddleware } from '../http/uploadMiddleware';
import { idDocumentStorage } from '../services/idDocumentStorage';

export const idVerificationRoutes = Router();
idVerificationRoutes.use(authenticateRequest, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
const submissionSchema = z.object({ legalName: z.string().trim().min(2).max(120), idType: z.enum(['government', 'school', 'barangay']), consent: z.literal('true') });
const reviewSchema = z.object({ status: z.enum(['approved', 'rejected']), reason: z.string().trim().max(500).optional() })
  .refine(value => value.status !== 'rejected' || Boolean(value.reason), { message: 'A rejection reason is required.', path: ['reason'] });
const submissionLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, keyGenerator: (req: AuthenticatedRequest) => req.auth!.userId, standardHeaders: true, legacyHeaders: false });
const publicSubmission = { id: true, legalName: true, idType: true, status: true, reason: true, submittedAt: true, reviewedAt: true } as const;

idVerificationRoutes.get('/me', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const [user, submission] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId }, select: { idVerificationStatus: true } }),
    prisma.idVerificationSubmission.findFirst({ where: { userId: req.auth!.userId }, orderBy: { submittedAt: 'desc' }, select: publicSubmission }),
  ]);
  return res.json({ status: user.idVerificationStatus, submission });
}));

idVerificationRoutes.post('/me', requireRoles('user'), submissionLimiter, avatarUploadMiddleware.single('image'), errorBoundary(async (req: AuthenticatedRequest, res) => {
  const payload = submissionSchema.parse(req.body);
  if (!req.file) throw new HttpError(400, 'Please upload a clear photo of your ID.');
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId }, select: { idVerificationStatus: true, profile: { select: { city: true } } } });
  if (['pending', 'approved'].includes(user.idVerificationStatus)) throw new HttpError(409, 'Your ID is already pending review or approved.');
  if (!user.profile?.city?.trim()) throw new HttpError(400, 'Please select your barangay in your profile first.');
  const key = `${req.auth!.userId}/${randomUUID()}`;
  await idDocumentStorage.upload(key, req.file.path, req.file.mimetype);
  try {
    const submission = await prisma.$transaction(async tx => {
      const changed = await tx.user.updateMany({ where: { id: req.auth!.userId, idVerificationStatus: { in: ['not_submitted', 'rejected'] } }, data: { idVerificationStatus: 'pending' } });
      if (changed.count !== 1) throw new HttpError(409, 'Your ID is already pending review or approved.');
      return tx.idVerificationSubmission.create({ data: { userId: req.auth!.userId, legalName: payload.legalName, idType: payload.idType, barangay: user.profile!.city!.trim(), documentPath: key }, select: publicSubmission });
    });
    return res.status(201).json({ status: 'pending', submission });
  } catch (error) {
    await idDocumentStorage.remove(key).catch(() => console.error('ID upload rollback cleanup failed'));
    throw error;
  }
}));

idVerificationRoutes.use('/review', requireRoles('moderator'));
function assignedBarangay(req: AuthenticatedRequest) {
  const city = req.auth!.city?.trim();
  if (!city) throw new HttpError(403, 'A barangay assignment is required to review IDs.');
  return city;
}

idVerificationRoutes.get('/review', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const status = z.enum(['pending', 'approved', 'rejected']).default('pending').parse(req.query.status);
  const page = z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);
  const where = { barangay: assignedBarangay(req), status };
  const [items, total] = await Promise.all([
    prisma.idVerificationSubmission.findMany({ where, orderBy: { submittedAt: 'asc' }, skip: (page - 1) * 20, take: 20, select: { ...publicSubmission, barangay: true, user: { select: { name: true, email: true } }, reviewer: { select: { name: true } } } }),
    prisma.idVerificationSubmission.count({ where }),
  ]);
  return res.json({ items, total, page });
}));

idVerificationRoutes.get('/review/:id/document', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const submission = await prisma.idVerificationSubmission.findFirst({ where: { id: req.params.id, barangay: assignedBarangay(req) } });
  if (!submission?.documentPath) throw new HttpError(404, 'ID photo not found.');
  const document = await idDocumentStorage.download(submission.documentPath);
  res.setHeader('Content-Type', document.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  return res.send(document.bytes);
}));

idVerificationRoutes.patch('/review/:id', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const payload = reviewSchema.parse(req.body);
  const city = assignedBarangay(req);
  const submission = await prisma.$transaction(async tx => {
    const row = await tx.idVerificationSubmission.findFirst({ where: { id: req.params.id, barangay: city } });
    if (!row) throw new HttpError(404, 'Submission not found.');
    if (row.userId === req.auth!.userId) throw new HttpError(403, 'You cannot review your own ID.');
    const changed = await tx.idVerificationSubmission.updateMany({ where: { id: row.id, status: 'pending' }, data: { status: payload.status, reason: payload.status === 'rejected' ? payload.reason : null, reviewerId: req.auth!.userId, reviewedAt: new Date() } });
    if (changed.count !== 1) throw new HttpError(409, 'This submission has already been reviewed.');
    await tx.user.update({ where: { id: row.userId }, data: { idVerificationStatus: payload.status } });
    const approved = payload.status === 'approved';
    const notification = await tx.notification.create({ data: {
      userId: row.userId, type: 'verification', relatedType: 'id_verification', relatedId: row.id,
      notificationKey: `id_review:${row.id}`, priority: 'high',
      title: approved ? 'ID approved' : 'ID needs resubmission',
      message: approved ? 'Your ID was approved. You can now participate in Challenges, Eco Events, and Give & Get Hub.' : `Your ID was rejected. Reason: ${payload.reason}. Open ID verification to resubmit.`,
    } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: row.userId }, select: { email: true, sessionVersion: true } });
    await tx.$executeRaw`INSERT INTO notification_deliveries(id, notification_id, channel, destination) VALUES (${`rt_${notification.id}`}, ${notification.id}, 'realtime', ${row.userId}), (${`email_${notification.id}`}, ${notification.id}, 'email', ${user.email}) ON CONFLICT DO NOTHING`;
    await tx.$executeRaw`INSERT INTO notification_deliveries(id, notification_id, channel, destination) SELECT ${`push_${notification.id}_`} || token, ${notification.id}, 'push', token FROM notification_devices WHERE user_id=${row.userId} AND session_version=${user.sessionVersion} ON CONFLICT DO NOTHING`;
    return tx.idVerificationSubmission.findUniqueOrThrow({ where: { id: row.id }, select: publicSubmission });
  });
  return res.json(submission);
}));
