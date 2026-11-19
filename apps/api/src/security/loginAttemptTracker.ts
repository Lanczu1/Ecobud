/**
 * Login attempt tracker against account-targeted brute force.
 * 5 failures within 15 minutes lock the email for a fixed 5 minutes.
 *
 * SECURITY: counts live in the login_attempts table, so restarting or redeploying the API does not
 * clear a lock, and every API instance sees the same counts.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;
// Failures older than this no longer count toward a lock.
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const normalize = (email: string) => email.trim().toLowerCase();

// Rows that are not locked and whose failures are outside the window have no effect, so remove them.
setInterval(() => {
  const now = new Date();
  prisma.loginAttempt.deleteMany({
    where: {
      firstAttemptAt: { lt: new Date(now.getTime() - FAILURE_WINDOW_MS) },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
  }).catch(() => undefined);
}, 10 * 60 * 1000).unref();

export const LoginAttemptTracker = {
  async isLocked(email: string): Promise<{ locked: boolean; remainingSeconds?: number }> {
    const record = await prisma.loginAttempt.findUnique({ where: { email: normalize(email) } });
    const now = Date.now();
    if (!record?.lockedUntil || record.lockedUntil.getTime() <= now) return { locked: false };
    return { locked: true, remainingSeconds: Math.ceil((record.lockedUntil.getTime() - now) / 1000) };
  },

  async recordFailure(email: string): Promise<{ locked: boolean; remainingAttempts: number; remainingSeconds?: number }> {
    const now = new Date();
    const lockUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
    const windowStart = new Date(now.getTime() - FAILURE_WINDOW_MS);
    // Start counting again after a lock has ended or when the earlier failures are outside the window.
    const restart = Prisma.sql`(("login_attempts"."locked_until" IS NOT NULL AND "login_attempts"."locked_until" <= ${now})
      OR ("login_attempts"."locked_until" IS NULL AND "login_attempts"."first_attempt_at" <= ${windowStart}))`;
    // One statement, so two wrong passwords sent at the same moment are both counted.
    const rows = await prisma.$queryRaw<{ count: number; locked_until: Date | null }[]>`
      INSERT INTO "login_attempts" ("email", "count", "first_attempt_at", "locked_until")
      VALUES (${normalize(email)}, 1, ${now}, NULL)
      ON CONFLICT ("email") DO UPDATE SET
        "count" = CASE WHEN ${restart} THEN 1 ELSE "login_attempts"."count" + 1 END,
        "first_attempt_at" = CASE WHEN ${restart} THEN ${now} ELSE "login_attempts"."first_attempt_at" END,
        "locked_until" = CASE
          WHEN ${restart} THEN NULL
          WHEN "login_attempts"."locked_until" > ${now} THEN "login_attempts"."locked_until"
          WHEN "login_attempts"."count" + 1 >= ${MAX_FAILED_ATTEMPTS} THEN ${lockUntil}
          ELSE NULL
        END
      RETURNING "count", "locked_until"`;
    const row = rows[0];
    const lockedUntil = row?.locked_until ? new Date(row.locked_until).getTime() : 0;
    if (lockedUntil > now.getTime()) {
      return { locked: true, remainingAttempts: 0, remainingSeconds: Math.ceil((lockedUntil - now.getTime()) / 1000) };
    }
    return { locked: false, remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - Number(row?.count ?? 1)) };
  },

  async recordSuccess(email: string): Promise<void> {
    await prisma.loginAttempt.deleteMany({ where: { email: normalize(email) } });
  },
};
