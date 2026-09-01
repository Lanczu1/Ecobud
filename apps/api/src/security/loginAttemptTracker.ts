/**
 * In-memory Login Attempt Tracker to prevent account-targeted brute force attacks.
 * Tracks failed login attempts per email with exponential/progressive lockout.
 */

interface AttemptRecord {
  count: number;
  lockedUntil: number;
  firstAttemptAt: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

const attempts = new Map<string, AttemptRecord>();

// Cleanup stale records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of attempts.entries()) {
    if (now > record.lockedUntil && now - record.firstAttemptAt > LOCKOUT_DURATION_MS) {
      attempts.delete(email);
    }
  }
}, 10 * 60 * 1000);

export const LoginAttemptTracker = {
  isLocked(email: string): { locked: boolean; remainingSeconds?: number } {
    const normalizedEmail = email.trim().toLowerCase();
    const record = attempts.get(normalizedEmail);
    if (!record) return { locked: false };

    const now = Date.now();
    if (now < record.lockedUntil) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { locked: true, remainingSeconds };
    }

    // Lockout expired, reset if needed
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      attempts.delete(normalizedEmail);
    }

    return { locked: false };
  },

  recordFailure(email: string): { locked: boolean; remainingAttempts: number; remainingSeconds?: number } {
    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();
    const record = attempts.get(normalizedEmail) || {
      count: 0,
      lockedUntil: 0,
      firstAttemptAt: now,
    };

    record.count += 1;

    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      attempts.set(normalizedEmail, record);
      const remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
      return { locked: true, remainingAttempts: 0, remainingSeconds };
    }

    attempts.set(normalizedEmail, record);
    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - record.count };
  },

  recordSuccess(email: string): void {
    const normalizedEmail = email.trim().toLowerCase();
    attempts.delete(normalizedEmail);
  },
};
