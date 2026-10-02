const OTP_DURATION_MS = 5 * 60 * 1000;

export function getOtpDeadline(response: { expiresAt: string; serverTime: string }, now: number): number {
  const remaining = Date.parse(response.expiresAt) - Date.parse(response.serverTime);
  return now + (Number.isFinite(remaining) ? Math.max(0, Math.min(OTP_DURATION_MS, remaining)) : 0);
}

export function getOtpCountdown(deadline: number | null, now: number) {
  const remaining = deadline === null ? 0 : Math.max(0, Math.min(OTP_DURATION_MS, deadline - now));
  const seconds = Math.ceil(remaining / 1000);
  return {
    seconds,
    expired: remaining === 0,
    progress: remaining / OTP_DURATION_MS,
    label: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
  };
}
