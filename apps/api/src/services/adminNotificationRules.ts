import { Prisma } from '@prisma/client';
import type { TokenSession } from '../security/tokenService';
import { BARANGAYS } from '../utils/announcementBarangays';

export const adminNotificationCategories = ['verification', 'challenge', 'event', 'swap', 'reward', 'learning', 'announcement', 'system'] as const;
export function assignedNotificationBarangay(city?: string | null) {
  return BARANGAYS.find(value => value.toLowerCase() === city?.trim().toLowerCase()) ?? null;
}
export function notificationScope(auth: Pick<TokenSession, 'role' | 'city' | 'authTime'>) {
  if (auth.role === 'admin') return Prisma.sql`e.audience IN ('both','admin')`;
  const barangay = assignedNotificationBarangay(auth.city);
  if (auth.role !== 'moderator' || !barangay) return Prisma.sql`FALSE`;
  return Prisma.sql`e.audience IN ('both','moderator') AND (
    EXISTS(SELECT 1 FROM unnest(e.barangays) b WHERE lower(b)=lower(${barangay}))
    OR (cardinality(e.barangays)=0 AND NOT e.action_required AND e.record_type IN ('announcement','challenge','event'))
  )`;
}
export function isQuietHour(start: number | null, end: number | null, at = new Date()) {
  if (start === null || end === null || start === end) return false;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' }).format(at));
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
export function validPushEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      (u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com' ||
       u.hostname === 'web.push.apple.com' || u.hostname === 'wns2-par02p.notify.windows.com' ||
       u.hostname.endsWith('.notify.windows.com'));
  } catch { return false; }
}
