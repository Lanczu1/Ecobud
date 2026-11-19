import { randomUUID } from 'crypto';
import { prisma } from '../prismaClient';
import { authCache } from '../lib/cache';

// SECURITY: server side of the web dashboard session. Each web login gets a row, and its token carries
// the row id. Logout or idling ends that row, so a copied token stops working at once instead of at
// its 12-hour expiry. Mobile tokens have no row and are not affected.
const WEB_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
// The browser signs out after 30 idle minutes and tells the server. This server limit is a little
// longer, so it only ends sessions the browser could not end itself, such as a token copied elsewhere.
const WEB_SESSION_IDLE_MS = 35 * 60 * 1000;
// Activity is written at most once a minute per session, not on every request.
const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;
const CACHE_SECONDS = 5;

type SessionRow = { userId: string; lastActivityAt: Date; expiresAt: Date; revokedAt: Date | null };

const cacheKey = (sessionId: string) => `web-session:${sessionId}`;

const loadSession = (sessionId: string) => prisma.webSession.findUnique({
  where: { id: sessionId },
  select: { userId: true, lastActivityAt: true, expiresAt: true, revokedAt: true },
});

export const WebSessionService = {
  async create(userId: string): Promise<string> {
    const now = new Date();
    await prisma.webSession.deleteMany({ where: { expiresAt: { lt: now } } });
    const id = randomUUID();
    await prisma.webSession.create({
      data: { id, userId, createdAt: now, lastActivityAt: now, expiresAt: new Date(now.getTime() + WEB_SESSION_LIFETIME_MS) },
    });
    return id;
  },

  /** True when the session is still open. With touch, a request also counts as activity. */
  async isActive(sessionId: string, userId: string, options: { touch: boolean }): Promise<boolean> {
    const row = await authCache.getOrSet<SessionRow | null>(cacheKey(sessionId), CACHE_SECONDS, () => loadSession(sessionId));
    const now = Date.now();
    if (!row || row.userId !== userId || row.revokedAt || row.expiresAt.getTime() <= now) return false;
    if (now - row.lastActivityAt.getTime() >= WEB_SESSION_IDLE_MS) return false;

    if (options.touch && now - row.lastActivityAt.getTime() >= ACTIVITY_WRITE_INTERVAL_MS) {
      const at = new Date(now);
      authCache.set(cacheKey(sessionId), { ...row, lastActivityAt: at }, CACHE_SECONDS);
      // A failed write only shortens the idle allowance; it must not fail the request.
      prisma.webSession.updateMany({
        where: { id: sessionId, revokedAt: null, lastActivityAt: { lt: at } },
        data: { lastActivityAt: at },
      }).catch(() => undefined);
    }
    return true;
  },

  async revoke(sessionId: string, userId: string): Promise<void> {
    await prisma.webSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    authCache.delete(cacheKey(sessionId));
  },
};
