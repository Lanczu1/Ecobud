import { Router } from 'express';
import { prisma } from '../prismaClient';
import { authenticateRequest, requireModeratorAccess, AuthenticatedRequest } from '../http/authentication';
import { z } from 'zod';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { announcementSchema, destinationKinds, effectiveAnnouncementStatus, storedActionValue } from '../services/announcementRules';
import { assertDestination, findDestinations } from '../services/announcementDestinations';
import { challengeUploadMiddleware } from '../http/uploadMiddleware';
import { AdminController } from '../controllers/adminController';
import { BARANGAYS } from '../utils/announcementBarangays';
import { notificationTick } from '../services/notificationService';

const include = { createdBy: { select: { id: true, name: true, role: true } } };
const serialize = <T extends { status: string; publishAt: Date | null; expiresAt: Date | null }>(item: T) => ({ ...item, status: effectiveAnnouncementStatus(item) });
export const announcementAdminRoutes = Router();
announcementAdminRoutes.use(authenticateRequest, requireModeratorAccess);
announcementAdminRoutes.post('/upload', (req: AuthenticatedRequest, res, next) => {
  if (req.auth!.role === 'moderator' && !assignedBarangay(req)) return res.status(403).json({ message: 'Your moderator account needs an assigned barangay.' });
  next();
}, challengeUploadMiddleware.single('image'), (req, res, next) => {
  if (req.file && req.file.size > 5 * 1024 * 1024) return res.status(400).json({ message: 'Pictures must be 5 MB or smaller.' });
  next();
}, AdminController.uploadImage);
function assignedBarangay(req: AuthenticatedRequest) {
  return BARANGAYS.find(b => b.toLowerCase() === req.auth?.city?.trim().toLowerCase()) ?? null;
}
function canManage(req: AuthenticatedRequest, item: { createdById: string; createdBy: { role: string }; targetAudience: string; barangays: string[] }) {
  if (req.auth!.role === 'admin') return true;
  const barangay = assignedBarangay(req);
  return !!barangay && item.createdById === req.auth!.userId && item.createdBy.role !== 'admin' && item.targetAudience === 'Specific Barangay' && item.barangays.length === 1 && item.barangays[0] === barangay;
}
async function editableAnnouncement(req: AuthenticatedRequest) {
  const item = await prisma.announcement.findUnique({ where: { id: req.params.id }, include });
  if (!item) throw new HttpError(404, 'Announcement not found.');
  if (!canManage(req, item)) throw new HttpError(403, 'You can only manage your own announcements for your assigned barangay.');
  return item;
}
announcementAdminRoutes.get('/barangays', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  res.json({ items: BARANGAYS, assignedBarangay: assignedBarangay(req), canCreate: req.auth!.role === 'admin' || !!assignedBarangay(req) });
}));
// Destinations for the action button, searched by title. A moderator always posts to their own barangay,
// so availability is judged for that audience whatever the request says.
const destinationQuery = z.object({
  type: z.enum(['challenge', 'event', 'lesson']),
  search: z.string().trim().max(100).optional(),
  id: z.string().trim().min(1).max(128).optional(),
  targetAudience: z.enum(['All Residents', 'Specific Barangay', 'Multiple Barangays']).default('All Residents'),
  barangays: z.string().max(5000).optional(),
  publishAt: z.string().datetime().optional(),
});
announcementAdminRoutes.get('/destinations', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const query = destinationQuery.parse(req.query);
  const barangay = assignedBarangay(req);
  if (req.auth!.role === 'moderator' && !barangay) throw new HttpError(403, 'Your moderator account needs an assigned barangay.');
  const audience = req.auth!.role === 'moderator'
    ? { targetAudience: 'Specific Barangay', barangays: [barangay!] }
    : { targetAudience: query.targetAudience, barangays: query.targetAudience === 'All Residents' ? [] : (query.barangays ?? '').split(',').map(b => b.trim()).filter(Boolean) };
  const at = query.publishAt && Date.parse(query.publishAt) > Date.now() ? new Date(query.publishAt) : new Date();
  res.json({ items: await findDestinations(query.type, { search: query.search, id: query.id, audience, at }) });
}));
announcementAdminRoutes.get('/:id', errorBoundary<AuthenticatedRequest>(async (req,res) => {
  const item=await prisma.announcement.findUnique({ where:{ id:req.params.id },include });
  if (!item) throw new HttpError(404,'Announcement is no longer available.');
  if (req.auth!.role==='moderator') {
    const barangay=assignedBarangay(req);
    const relevant=!!barangay && effectiveAnnouncementStatus(item)==='Published' && (item.targetAudience==='All Residents' || item.barangays.includes(barangay));
    if (!canManage(req,item) && !relevant) throw new HttpError(404,'Announcement is outside your assigned barangay.');
  }
  res.json({ ...serialize(item),canManage:canManage(req,item) });
}));
announcementAdminRoutes.get('/', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const barangay = assignedBarangay(req);
  if (req.auth!.role === 'moderator' && !barangay) return res.json({ items: [] });
  const items = await prisma.announcement.findMany({
    where: req.auth!.role === 'moderator' ? {
      createdBy: { role: 'moderator' },
      targetAudience: { in: ['Specific Barangay', 'Multiple Barangays'] },
      barangays: { has: barangay! },
    } : { createdBy: { role: 'admin' } },
    include, orderBy: { createdAt: 'desc' },
  });
  res.json({ items: items.map(item => ({ ...serialize(item), canManage: canManage(req, item) })) });
}));
announcementAdminRoutes.post('/', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const input = announcementSchema.parse(req.body);
  restrictAudience(req, input);
  const data = await prepare(input);
  res.status(201).json(await prisma.announcement.create({ data: { ...data, createdById: req.auth!.userId }, include }));
  if (input.status === 'Published') void notificationTick();
}));
announcementAdminRoutes.put('/:id', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const previous = await editableAnnouncement(req);
  const input = announcementSchema.parse(req.body);
  restrictAudience(req, input);
  const data = await prepare(input);
  if (input.status === 'Published' && effectiveAnnouncementStatus(previous) === 'Published') data.publishAt = previous.publishAt;
  res.json(await prisma.announcement.update({ where: { id: req.params.id }, data, include }));
  if (input.status === 'Published') void notificationTick();
}));
announcementAdminRoutes.patch('/:id/images', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const previous = await editableAnnouncement(req);
  const { images } = z.object({ images: z.array(z.string().url().regex(/^https?:\/\//i)).max(10) }).strict().parse(req.body);
  const uniqueImages = [...new Set(images)];
  res.json(await prisma.announcement.update({ where: { id: previous.id }, data: { images: uniqueImages, image: uniqueImages[0] ?? null }, include }));
}));
announcementAdminRoutes.delete('/:id', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const item = await editableAnnouncement(req);
  if (effectiveAnnouncementStatus(item) === 'Published' && req.query.confirmPublished !== 'true') throw new HttpError(409, 'Confirm deletion of this published announcement.');
  await prisma.announcement.delete({ where: { id: item.id } });
  res.status(204).send();
}));

function restrictAudience(req: AuthenticatedRequest, input: ReturnType<typeof announcementSchema.parse>) {
  if (req.auth!.role === 'admin') return;
  const barangay = assignedBarangay(req);
  if (!barangay) throw new HttpError(403, 'Your moderator account needs an assigned barangay.');
  if (input.targetAudience !== 'Specific Barangay' || input.barangays.length !== 1 || input.barangays[0] !== barangay) throw new HttpError(403, 'Moderators can only post for their assigned barangay.');
}

async function prepare(input: ReturnType<typeof announcementSchema.parse>) {
  const barangays = input.targetAudience === 'All Residents' ? [] : [...new Set(input.barangays)];
  if (barangays.length) {
    if (barangays.some(b => !BARANGAYS.some(known => known === b))) throw new HttpError(400, 'Choose a valid Nagcarlan barangay.');
  }
  const publishAt = input.status === 'Published' ? new Date() : input.publishAt ? new Date(input.publishAt) : null;
  const kind = destinationKinds[input.ctaType as keyof typeof destinationKinds];
  if (kind) {
    // Residents first see the button when the announcement goes live; drafts only need the record to exist.
    const liveAt = input.status === 'Published' || input.status === 'Scheduled' ? publishAt ?? new Date() : null;
    await assertDestination(kind, input.ctaValue!, { targetAudience: input.targetAudience, barangays }, liveAt);
  }
  const images = [...new Set(input.images ?? (input.image ? [input.image] : []))];
  return { ...input, images, image: images[0] ?? null, barangays, publishAt,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    ctaLabel: input.ctaType === 'No Action' ? null : input.ctaLabel, ctaValue: storedActionValue(input.ctaType, input.ctaValue) };
}

export const announcementResidentRoutes = Router();
announcementResidentRoutes.use(authenticateRequest);
announcementResidentRoutes.get('/', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const { id } = z.object({ id: z.string().min(1).max(100).optional() }).parse(req.query);
  const now = new Date();
  const barangay = assignedBarangay(req);
  const audience = [
    { targetAudience: 'All Residents' },
    ...(barangay ? [{ targetAudience: { in: ['Specific Barangay', 'Multiple Barangays'] }, barangays: { has: barangay } }] : []),
  ];
  const items = await prisma.announcement.findMany({ where: {
    ...(id ? { id } : {}),
    OR: [{ status: 'Published' }, { status: 'Scheduled', publishAt: { lte: now } }],
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: audience }],
  }, orderBy: [{ priority: 'asc' }, { publishAt: 'desc' }], take: 100 });
  res.json({ items: items.map(serialize) });
}));
