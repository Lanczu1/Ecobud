import { describe, it, expect } from 'vitest';
import { welcomeEmail } from './welcomeEmail';
describe('separate welcome template', () => {
    it('uses existing brand colors and contains onboarding terminology without a code', () => { const e = welcomeEmail('https://ecobud.example/start'); for (const word of ['successfully verified', 'Learn', 'Challenges', 'Eco Events', 'Give &amp; Get Hub', 'EXP', 'Eco-Coins', 'Get Started', '#1f6f4a', '#f3f8f4'])
        expect(e.html).toContain(word); expect(e.html).not.toContain('expires'); });
    it('rejects executable CTA URLs', () => expect(() => welcomeEmail('javascript:alert(1)')).toThrow());
});
