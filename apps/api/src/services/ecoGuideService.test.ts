/**
 * EcoGuide Service — Core Test Coverage
 *
 * Tests cover:
 * 1. Successful Mistral response returned as-is
 * 2. Mistral timeout triggers fallback (fake timers)
 * 3. Mistral API error (500) triggers fallback
 * 4. Missing MISTRAL_API_KEY triggers fallback
 * 5. Rate limiter blocks excess requests
 * 6. Unauthenticated request returns 401
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEcoGuideReply } from './ecoGuideService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal Mistral-shaped success response. */
function mistralSuccessResponse(content: string, totalTokens = 120) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: totalTokens },
    }),
    text: async () => '',
  } as unknown as Response;
}

/** Builds a Mistral-shaped error response. */
function mistralErrorResponse(status: number, body = 'Internal Server Error') {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Unit tests for getEcoGuideReply
// ---------------------------------------------------------------------------

describe('getEcoGuideReply', () => {
  const originalApiKey = process.env.MISTRAL_API_KEY;

  beforeEach(() => {
    process.env.MISTRAL_API_KEY = 'test-api-key';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore original key
    if (originalApiKey !== undefined) {
      process.env.MISTRAL_API_KEY = originalApiKey;
    } else {
      delete process.env.MISTRAL_API_KEY;
    }
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Test 1: Successful Mistral response is returned as-is
  // -------------------------------------------------------------------------
  it('returns the Mistral response when the API call succeeds', async () => {
    const mockContent = 'Rinse your containers before recycling them!';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mistralSuccessResponse(mockContent),
    );

    const result = await getEcoGuideReply('How do I recycle?');

    expect(result.reply).toBe(mockContent);
    expect(result.quickReplies).toBeDefined();
    expect(result.quickReplies.length).toBeGreaterThan(0);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Test 2: Mistral timeout triggers the fallback path (fake timers)
  // -------------------------------------------------------------------------
  it('falls back when the Mistral request times out', async () => {
    vi.useFakeTimers();

    // fetch returns a promise that never resolves — simulating a hung request.
    // The AbortController will fire after MISTRAL_TIMEOUT_MS (10 000 ms).
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          // Listen for the abort signal so we behave like a real fetch
          const signal = (init as RequestInit | undefined)?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
        }),
    );

    // Start the call but don't await yet
    const resultPromise = getEcoGuideReply('How do I compost?');

    // Fast-forward past the 10-second timeout
    await vi.advanceTimersByTimeAsync(11_000);

    const result = await resultPromise;

    // Should have used the keyword fallback, not the Mistral response
    expect(result.reply).toContain('composting');
    expect(result.quickReplies).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Test 3: Mistral API error (e.g. 500) triggers the fallback path
  // -------------------------------------------------------------------------
  it('falls back when the Mistral API returns an error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mistralErrorResponse(500),
    );

    const result = await getEcoGuideReply('Tell me about recycling');

    // Should get a fallback reply, not throw
    expect(result.reply).toBeTruthy();
    expect(result.reply).toContain('recycl'); // fallback mentions recycling
  });

  // -------------------------------------------------------------------------
  // Test 4: Missing MISTRAL_API_KEY triggers the fallback path
  // -------------------------------------------------------------------------
  it('falls back when MISTRAL_API_KEY is not set', async () => {
    delete process.env.MISTRAL_API_KEY;

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await getEcoGuideReply('How do I compost?');

    // fetch should NOT have been called — we bail before the network request
    expect(fetchSpy).not.toHaveBeenCalled();
    // Should get a fallback reply
    expect(result.reply).toBeTruthy();
    expect(result.reply).toContain('composting');
  });
});

// ---------------------------------------------------------------------------
// Integration tests (rate limiter + auth)
// ---------------------------------------------------------------------------

describe('Chat endpoint integration', () => {
  // Dynamic imports to avoid pulling in express/prisma at module scope
  // when only unit tests are being run.

  /**
   * Build a lightweight Express app that mirrors the real routing stack
   * but stubs out Prisma (auth lookup) so we can test middleware behaviour
   * without a database.
   */
  async function buildTestApp() {
    const express = (await import('express')).default;
    const { chatRateLimiter } = await import('../http/chatRateLimiter');
    const { errorBoundary } = await import('../http/errorResponder');
    const { getEcoGuideReply } = await import('./ecoGuideService');
    const jwt = (await import('jsonwebtoken')).default;

    const app = express();
    app.use(express.json());

    // Minimal auth middleware that mirrors authenticateRequest's contract
    // but skips the DB lookup — we just need req.auth populated.
    const fakeAuth: import('express').RequestHandler = (req: any, res, next) => {
      const authorization = req.headers.authorization;
      if (!authorization?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'A bearer token is required.' });
      }

      try {
        const token = authorization.replace('Bearer ', '').trim();
        const secret = process.env.JWT_SECRET || 'ecobud-local-development-secret';
        const payload = jwt.verify(token, secret) as any;
        req.auth = payload;
        return next();
      } catch {
        return res.status(401).json({ message: 'The access token is invalid or expired.' });
      }
    };

    // Mirrors requireUserAccess — just checks req.auth exists
    const fakeRequireUser: import('express').RequestHandler = (req: any, res, next) => {
      if (!req.auth) {
        return res.status(403).json({ message: 'You do not have access to this resource.' });
      }
      return next();
    };

    app.post(
      '/api/experience/assistant/chat',
      fakeAuth,
      fakeRequireUser,
      chatRateLimiter,
      errorBoundary(async (req: any, res) => {
        const message = typeof req.body?.message === 'string' ? req.body.message : '';
        const result = await getEcoGuideReply(message, [], req.auth.userId);
        return res.json(result);
      }),
    );

    // Generate a valid JWT for testing
    const secret = process.env.JWT_SECRET || 'ecobud-local-development-secret';
    const testToken = jwt.sign(
      {
        userId: 'test-user-123',
        name: 'Test User',
        email: 'test@ecobud.com',
        role: 'user',
        status: 'active',
      },
      secret,
      { expiresIn: '1h' },
    );

    return { app, testToken };
  }

  // -------------------------------------------------------------------------
  // Test 5: Rate limiter blocks a user exceeding the configured threshold
  // -------------------------------------------------------------------------
  it('returns 429 when a user exceeds the chat rate limit', async () => {
    const supertest = (await import('supertest')).default;
    const { CHAT_RATE_LIMIT_MAX } = await import('../http/chatRateLimiter');

    // Stub fetch so Mistral calls don't go to the network
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mistralSuccessResponse('Test response'),
    );
    process.env.MISTRAL_API_KEY = 'test-api-key';

    const { app, testToken } = await buildTestApp();

    // Fire CHAT_RATE_LIMIT_MAX requests — all should succeed
    for (let i = 0; i < CHAT_RATE_LIMIT_MAX; i++) {
      const res = await supertest(app)
        .post('/api/experience/assistant/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: 'hello' });

      expect(res.status).toBe(200);
    }

    // The next request should be rate-limited
    const blocked = await supertest(app)
      .post('/api/experience/assistant/chat')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ message: 'one more' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain('too many messages');
  });

  // -------------------------------------------------------------------------
  // Test 6: Unauthenticated request returns 401
  // -------------------------------------------------------------------------
  it('returns 401 when no Bearer token is provided', async () => {
    const supertest = (await import('supertest')).default;

    const { app } = await buildTestApp();

    const res = await supertest(app)
      .post('/api/experience/assistant/chat')
      .send({ message: 'hello' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBeDefined();
  });
});
