import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { avatarUploadMiddleware } from '../http/uploadMiddleware';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { prisma } from '../prismaClient';
import { apiCache } from '../lib/cache';
import { requireAdminAccess } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { contentBadgeWrite } from '../services/contentBadgeService';

export const adminBadgeRoutes = Router();
adminBadgeRoutes.use(requireAdminAccess);
const specialNames = new Set(['Giveaway Master']);
const payload = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  iconUrl: z.string().trim().url().max(2048).refine(value => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS image URL.'),
  requiredPoints: z.number().int().min(1).max(2147483647),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
});

adminBadgeRoutes.post('/upload', avatarUploadMiddleware.single('image'), errorBoundary(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a badge image to upload.');
  const extension = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const url = await supabaseStorageService.uploadFile(`badges/${randomUUID()}.${extension}`, req.file.path, req.file.mimetype);
  return res.status(201).json({ url });
}));

adminBadgeRoutes.get('/', errorBoundary(async (_req, res) => {
  const items = await prisma.badge.findMany({ orderBy: { requiredPoints: 'asc' }, include: { _count: { select: { users: true } }, lesson: { select: { id: true, title: true } }, challenge: { select: { id: true, title: true } }, event: { select: { id: true, title: true } }, swapListing: { select: { id: true, title: true } } } });
  return res.json({ items });
}));

adminBadgeRoutes.get('/source/:type/:id', errorBoundary(async (req, res) => {
  const field = { lesson: 'lessonId', challenge: 'challengeId', event: 'eventId', exchange: 'swapListingId' }[req.params.type];
  if (!field) throw new HttpError(400, 'Invalid badge source.');
  const badge = await prisma.badge.findFirst({ where: { [field]: req.params.id } });
  return res.json({ badge });
}));

adminBadgeRoutes.put('/source/exchange/:id', errorBoundary(async (req, res) => {
  const listing = await prisma.swapListing.findUnique({ where: { id: req.params.id } });
  if (!listing) throw new HttpError(404, 'Listing not found.');
  try {
    await prisma.swapListing.update({ where: { id: listing.id }, data: { badge: contentBadgeWrite(req.body.badgeReward, 'exchange') } });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new HttpError(409, 'This badge name is already used. Choose a different badge name.');
    throw error;
  }
  apiCache.delete('system_badges_list');
  return res.json({ success: true });
}));

adminBadgeRoutes.post('/', errorBoundary(async (req, res) => {
  const data = payload.parse(req.body);
  if (specialNames.has(data.name)) throw new HttpError(400, 'This name is reserved for a system milestone.');
  try {
    const badge = await prisma.badge.create({ data });
    apiCache.delete('system_badges_list');
    return res.status(201).json(badge);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new HttpError(409, 'A badge with this name already exists.');
    throw error;
  }
}));

adminBadgeRoutes.put('/:id', errorBoundary(async (req, res) => {
  const data = payload.parse(req.body);
  const badge = await prisma.badge.findUnique({ where: { id: req.params.id } });
  if (!badge) throw new HttpError(404, 'Badge not found.');
  if (specialNames.has(badge.name) ? data.name !== badge.name || data.requiredPoints !== badge.requiredPoints : specialNames.has(data.name)) {
    throw new HttpError(400, 'System milestone names and unlock requirements cannot be changed.');
  }
  try {
    const updated = await prisma.badge.update({ where: { id: badge.id }, data: { ...data, requiredPoints: badge.awardType === 'points' ? data.requiredPoints : badge.requiredPoints } });
    apiCache.delete('system_badges_list');
    return res.json(updated);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new HttpError(409, 'A badge with this name already exists.');
    throw error;
  }
}));

adminBadgeRoutes.patch('/:id/active', errorBoundary(async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  const badge = await prisma.badge.update({ where: { id: req.params.id }, data: { active } });
  apiCache.delete('system_badges_list');
  return res.json(badge);
}));

adminBadgeRoutes.delete('/:id', errorBoundary(async (req, res) => {
  const badge = await prisma.badge.findUnique({ where: { id: req.params.id } });
  if (!badge) throw new HttpError(404, 'Badge not found.');
  if (specialNames.has(badge.name)) throw new HttpError(400, 'System milestones cannot be deleted.');
  const result = await prisma.badge.deleteMany({ where: { id: badge.id, users: { none: {} } } });
  if (!result.count) throw new HttpError(409, 'Earned badges cannot be deleted.');
  apiCache.delete('system_badges_list');
  return res.status(204).send();
}));
