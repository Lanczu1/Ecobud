/**
 * Chat-specific rate limiter — limits per authenticated user, not per IP.
 *
 * This is separate from the general auth rate limiter in authRoutes.ts
 * because each chat message incurs real per-message cost via the Mistral API.
 *
 * Configurable constants are declared at the top for easy tuning.
 */

import rateLimit from 'express-rate-limit';
import type { AuthenticatedRequest } from './authentication';

// ---------------------------------------------------------------------------
// Configurable limits — tune these without digging into middleware logic
// ---------------------------------------------------------------------------

/** Maximum chat messages allowed per user within the rate window. */
export const CHAT_RATE_LIMIT_MAX = 20;

/** Rate window duration in milliseconds (default: 10 minutes). */
export const CHAT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export const chatRateLimiter = rateLimit({
  windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
  limit: CHAT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,

  /**
   * Key by authenticated userId (populated by authenticateRequest, which
   * runs earlier in the middleware chain).  Falls back to IP if auth is
   * somehow missing — defensive only, should never happen in practice
   * because authenticateRequest rejects unauthenticated requests before
   * this middleware runs.
   */
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.auth?.userId ?? 'unknown';
  },

  /** Return a friendly JSON message instead of a raw 429. */
  handler: (_req, res) => {
    res.status(429).json({
      message:
        "You've sent too many messages. Please wait a few minutes before trying again.",
    });
  },
});
