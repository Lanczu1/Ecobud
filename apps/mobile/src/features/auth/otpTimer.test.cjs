const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getOtpDeadline, getOtpCountdown } = require('./otpTimer.ts');

const serverTime = '2026-10-02T00:00:12.000Z';
const expiresAt = '2026-10-02T00:05:00.000Z';

test('uses server time even when the phone clock is ahead or behind', () => {
  for (const now of [0, Date.parse(serverTime) + 3600000, Date.parse(serverTime) - 3600000]) {
    const deadline = getOtpDeadline({ serverTime, expiresAt }, now);
    assert.equal(getOtpCountdown(deadline, now).label, '04:48');
    assert.equal(getOtpCountdown(deadline, now).progress, 288 / 300);
  }
});

test('catches up after time spent in the background and expires at the deadline', () => {
  const deadline = getOtpDeadline({ serverTime, expiresAt }, 1000000);
  assert.equal(getOtpCountdown(deadline, 1000000 + 180000).label, '01:48');
  assert.equal(getOtpCountdown(deadline, deadline - 1).expired, false);
  assert.deepEqual(getOtpCountdown(deadline, deadline), { seconds: 0, expired: true, progress: 0, label: '00:00' });
  assert.equal(getOtpCountdown(deadline, deadline + 60000).progress, 0);
});

test('a successful resend replaces the expired countdown with a full five minutes', () => {
  const now = 1000000;
  const deadline = getOtpDeadline({ serverTime: '2026-10-02T00:05:00.000Z', expiresAt: '2026-10-02T00:10:00.000Z' }, now);
  assert.deepEqual(getOtpCountdown(deadline, now), { seconds: 300, expired: false, progress: 1, label: '05:00' });
});

test('invalid or expired timing cannot extend the verification window', () => {
  const now = 1000000;
  for (const timing of [{ serverTime, expiresAt: 'invalid' }, { serverTime, expiresAt: '2026-10-02T00:00:00.000Z' }]) {
    assert.equal(getOtpCountdown(getOtpDeadline(timing, now), now).expired, true);
  }
  assert.equal(getOtpCountdown(null, now).expired, true);
});
