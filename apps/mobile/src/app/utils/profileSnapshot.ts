import type { ProfileData } from '../types/home';

export const profileSnapshotKey = (userId: string) => `ecobud.mobile.profile.${userId}`;

export function decodeProfileSnapshot(raw: string | null, userId: string): ProfileData | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || value.id !== userId || typeof value.email !== 'string' ||
        !Array.isArray(value.badges) || !Array.isArray(value.eventHistory) ||
        !Array.isArray(value.recentLogs) || !value.progress ||
        !(value.profile === null || typeof value.profile?.displayName === 'string')) return null;
    return value;
  } catch { return null; }
}
