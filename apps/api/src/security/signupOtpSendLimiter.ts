export class SignupOtpSendLimiter {
  private readonly sends = new Map<string, number[]>();
  private readonly windowMs = 15 * 60 * 1000;

  retryAfterSeconds(email: string, now = Date.now()): number {
    for (const [address, timestamps] of this.sends) {
      const recent = timestamps.filter((time) => time > now - this.windowMs);
      if (recent.length) this.sends.set(address, recent);
      else this.sends.delete(address);
    }
    const recent = this.sends.get(email) ?? [];
    return recent.length >= 3 ? Math.ceil((recent[0] + this.windowMs - now) / 1000) : 0;
  }

  recordSend(email: string, now = Date.now()): void {
    this.sends.set(email, [...(this.sends.get(email) ?? []), now]);
  }
}
