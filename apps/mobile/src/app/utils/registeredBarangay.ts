import type { ProfileData, SessionPayload } from '../types/home';

export function getRegisteredBarangay(profile: ProfileData | null, session: SessionPayload | null): string {
  if (!session) return '';
  if (profile?.id === session.user.id) return profile.profile?.city?.trim() ?? '';
  const city = session.user.city !== undefined ? session.user.city : session.user.profile?.city;
  return city?.trim() ?? '';
}
