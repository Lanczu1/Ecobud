import { HttpError } from '../http/errorResponder';
import type { TokenSession } from '../security/tokenService';
import { BARANGAYS } from '../utils/announcementBarangays';

export function giveAndGetBarangay(auth: Pick<TokenSession, 'role' | 'city'>) {
  if (auth.role === 'admin') return null;
  const barangay = BARANGAYS.find(value => value.toLowerCase() === auth.city?.trim().toLowerCase());
  if (auth.role !== 'moderator' || !barangay) {
    throw new HttpError(403, 'Your moderator account needs a valid assigned barangay.');
  }
  return barangay;
}

export function giveAndGetResidentScope(auth: Pick<TokenSession, 'role' | 'city'>) {
  const barangay = giveAndGetBarangay(auth);
  return barangay ? { user: { profile: { city: { equals: barangay, mode: 'insensitive' as const } } } } : {};
}
