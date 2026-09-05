import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_TARGETS, detectionSettingsSchema, evaluateDetections, imageMimeType, recognizeChallengeImage } from './challengeImageService';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const detection = (object: string, confidence = 95) => ({ object, confidence, count: 1 });

describe('admin class filtering', () => {
  for (const selected of AI_TARGETS) {
    for (const visible of AI_TARGETS) {
      it(`${selected} selection ${selected === visible ? 'accepts' : 'rejects'} ${visible}`, () => {
        const result = evaluateDetections({ detected: [detection(visible)] }, [selected], 80);
        expect(result.passed).toBe(selected === visible);
        expect(result.detectedCount).toBe(selected === visible ? 1 : 0);
      });
    }
  }
  it('counts only selected classes above the threshold in mixed images', () => {
    const result = evaluateDetections({ detected: [detection('Plastic Bottle'), detection('Glass Bottle'), detection('Plastic Wrapper', 79)] }, ['Plastic Bottle', 'Plastic Wrapper'], 80);
    expect(result.detectedCount).toBe(1);
    expect(result.detections.map(d => d.object)).toEqual(['Plastic Bottle']);
  });
  it('does not silently enable classes for empty settings', () => {
    expect(() => evaluateDetections({ detected: [] }, [], 80)).toThrow('admin');
  });
  it.each([0, 101, 80.5, '80', null])('rejects invalid confidence %s', value => {
    expect(detectionSettingsSchema.safeParse({ aiDetectionTargets: ['Plastic Wrapper'], aiMinimumConfidence: value }).success).toBe(false);
  });
  it.each([
    { detected: [detection('bottle')] },
    { detected: [detection('Plastic Bottle', 101)] },
    { detected: [{ ...detection('Plastic Wrapper'), count: 100000 }] },
    { detected: [detection('Plastic Wrapper'), detection('Plastic Wrapper')] },
    { detected: [], passed: true },
  ])('rejects unsafe provider output', value => {
    expect(() => evaluateDetections(value, ['Plastic Bottle'], 80)).toThrow('invalid result');
  });
});

describe('Gemini boundary', () => {
  it('rejects spoofed image content and oversized images', () => {
    expect(() => imageMimeType(Buffer.from('<script>fake png</script>'))).toThrow('Invalid image');
    expect(() => imageMimeType(Buffer.alloc(10 * 1024 * 1024 + 1))).toThrow('10 MB');
  });
  it('sends inline image bytes with a server-side key and accepts a bread bag wrapper', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-secret');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ detected: [detection('Plastic Wrapper')] }) }] } }] })));
    vi.stubGlobal('fetch', fetchMock);
    const result = await recognizeChallengeImage(png, ['Plastic Wrapper'], 80);
    expect(result.passed).toBe(true);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/generativelanguage.googleapis.com\//);
    expect(url).not.toContain('test-secret');
    expect(options.headers['x-goog-api-key']).toBe('test-secret');
    expect(options.redirect).toBe('error');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body).systemInstruction.parts[0].text).toContain('bread bags');
  });
  it('fails closed and hides provider errors and keys', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive provider error test-secret', { status: 403 })));
    await expect(recognizeChallengeImage(png, ['Plastic Wrapper'], 80)).rejects.toMatchObject({ statusCode: 503, message: 'Image recognition is temporarily unavailable. Please retry later.' });
  });
  it('fails closed on malformed and truncated model responses', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }))));
    await expect(recognizeChallengeImage(png, ['Plastic Wrapper'], 80)).rejects.toMatchObject({ statusCode: 502 });
  });
  it('does not call Google when no class is selected', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(recognizeChallengeImage(png, [], 80)).rejects.toMatchObject({ statusCode: 409 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
