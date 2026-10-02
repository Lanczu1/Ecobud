import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../http/authentication';
import { prisma } from '../prismaClient';
import { BARANGAYS } from '../utils/announcementBarangays';

export function eventBarangay(city?: string | null) {
  return BARANGAYS.find(b => b.toLowerCase() === city?.trim().toLowerCase()) ?? null;
}

export function canManageEvent(auth: { role: string; userId: string; city?: string | null }, event: { managedById: string; barangay: string | null; managedBy: { role: string } }) {
  if (auth.role === 'admin') return true;
  const barangay = eventBarangay(auth.city);
  return auth.role === 'moderator' && !!barangay && event.managedById === auth.userId && event.managedBy.role !== 'admin' && event.barangay === barangay;
}

export async function authorizeEventWrite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.params.id || req.params.eventId) {
      const event = await prisma.event.findUnique({ where: { id: req.params.id || req.params.eventId }, include: { managedBy: { select: { role: true } } } });
      if (!event) return res.status(404).json({ message: 'Event not found.' });
      if (!canManageEvent(req.auth!, event)) return res.status(403).json({ message: 'You can only manage your own events for your assigned barangay.' });
    } else if (req.auth!.role === 'moderator' && !eventBarangay(req.auth!.city)) {
      return res.status(403).json({ message: 'Your moderator account needs an assigned barangay.' });
    }
    next();
  } catch (error) { next(error); }
}

export function validateEventAudience(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  for (const field of ['officialName', 'officialPosition']) {
    const value = req.body[field];
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.trim().length > 120)) return res.status(400).json({ message: 'Official name and position must be text of at most 120 characters.' });
    if (value !== undefined) req.body[field] = value?.trim() || null;
  }
  if ((req.body.officialName !== undefined || req.body.officialPosition !== undefined) && Boolean(req.body.officialName) !== Boolean(req.body.officialPosition)) return res.status(400).json({ message: 'Provide both the assigned official name and position, or leave both blank.' });
  if (req.body.targetAudience !== undefined && !['Residents', 'SK', 'Barangay Officials', 'Others'].includes(req.body.targetAudience)) {
    return res.status(400).json({ message: 'Choose a valid event target audience.' });
  }
  const requested = req.body.barangay;
  if (requested !== undefined && requested !== null && requested !== '' && !BARANGAYS.includes(requested)) return res.status(400).json({ message: 'Choose a valid Nagcarlan barangay.' });
  if (req.auth!.role === 'moderator') {
    const assigned = eventBarangay(req.auth!.city);
    if (!assigned || (requested && requested !== assigned)) return res.status(403).json({ message: 'Moderators can only post for their assigned barangay.' });
    req.body.barangay = assigned;
  } else if (requested === '') req.body.barangay = null;
  const fields = new Set(['title', 'description', 'location', 'startDatetime', 'endDatetime', 'capacity', 'pointsReward', 'coinReward', 'imageUrl', 'latitude', 'longitude', 'isFeatured', 'isPublished', 'barangay', 'targetAudience', 'officialName', 'officialPosition']);
  for (const key of Object.keys(req.body)) if (!fields.has(key)) delete req.body[key];
  next();
}
