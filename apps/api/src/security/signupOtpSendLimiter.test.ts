import { describe, expect, it } from 'vitest';
import { SignupOtpSendLimiter } from './signupOtpSendLimiter';
describe('signup OTP email delivery limit', () => {
  it('allows another delivery after the fifteen-minute window expires', () => {
    const limiter = new SignupOtpSendLimiter();
    for (let i = 0; i < 3; i++) limiter.recordSend('email@gmail.com', 1000 + i);
    expect(limiter.retryAfterSeconds('email@gmail.com', 2000)).toBe(899);
    expect(limiter.retryAfterSeconds('other@gmail.com', 2000)).toBe(0);
    expect(limiter.retryAfterSeconds('email@gmail.com', 901000)).toBe(0);
  });
});
