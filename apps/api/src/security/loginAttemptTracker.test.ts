import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginAttemptTracker } from './loginAttemptTracker';

describe('login attempt limits', () => {
  afterEach(() => vi.useRealTimers());

  it('locks the same normalized email on failure five and unlocks after five minutes', () => {
    vi.useFakeTimers();
    const email = 'five-minute-lock@example.com';
    LoginAttemptTracker.recordSuccess(email);
    for (let count = 1; count < 5; count++) {
      expect(LoginAttemptTracker.recordFailure(email)).toEqual({ locked: false, remainingAttempts: 5 - count });
    }
    expect(LoginAttemptTracker.recordFailure(` ${email.toUpperCase()} `)).toEqual({ locked: true, remainingAttempts: 0, remainingSeconds: 300 });
    vi.advanceTimersByTime(299_000);
    expect(LoginAttemptTracker.isLocked(email)).toEqual({ locked: true, remainingSeconds: 1 });
    vi.advanceTimersByTime(1_000);
    expect(LoginAttemptTracker.isLocked(email)).toEqual({ locked: false });
    expect(LoginAttemptTracker.recordFailure(email).remainingAttempts).toBe(4);
    LoginAttemptTracker.recordSuccess(email);
  });

  it('keeps failures separate by email and clears them on success', () => {
    const first = 'first-login@example.com';
    const second = 'second-login@example.com';
    LoginAttemptTracker.recordSuccess(first);
    LoginAttemptTracker.recordSuccess(second);
    LoginAttemptTracker.recordFailure(first);
    expect(LoginAttemptTracker.recordFailure(second).remainingAttempts).toBe(4);
    LoginAttemptTracker.recordSuccess(first);
    expect(LoginAttemptTracker.recordFailure(first).remainingAttempts).toBe(4);
    LoginAttemptTracker.recordSuccess(first);
    LoginAttemptTracker.recordSuccess(second);
  });
});
