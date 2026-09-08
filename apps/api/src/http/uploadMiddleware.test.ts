import { describe, expect, it } from 'vitest';
import { matchesMediaSignature } from './uploadMiddleware';
describe('upload contents', () => {
  it('rejects scripts disguised as images or videos', () => {
    for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'video/mp4']) {
      expect(matchesMediaSignature(Buffer.from('<script>alert(1)</script>'), mime)).toBe(false);
    }
  });
});
