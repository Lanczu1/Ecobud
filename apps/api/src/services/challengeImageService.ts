import { z } from 'zod';
import { HttpError } from '../http/errorResponder';

export const AI_TARGETS = ['Plastic Bottle', 'Glass Bottle', 'Plastic Wrapper'] as const;
export const detectionSettingsSchema = z.object({
  aiDetectionTargets: z.array(z.enum(AI_TARGETS)).min(1).max(3)
    .refine(values => new Set(values).size === values.length, 'Select each class only once.'),
  aiMinimumConfidence: z.number().int().min(1).max(100),
});

const box2dSchema = z.tuple([
  z.number().min(0).max(1000),
  z.number().min(0).max(1000),
  z.number().min(0).max(1000),
  z.number().min(0).max(1000),
]);

export interface DetectedBox {
  object: typeof AI_TARGETS[number];
  box_2d: [number, number, number, number];
}

const detectionSchema = z.object({
  detected: z.array(z.object({
    object: z.enum(AI_TARGETS),
    confidence: z.number().min(0).max(100),
    count: z.number().int().min(1).max(100),
    box_2d: box2dSchema.optional(),
    boxes: z.array(box2dSchema).optional(),
  }).strict()).max(3),
}).strict().refine(value => new Set(value.detected.map(d => d.object)).size === value.detected.length);

export function imageMimeType(bytes: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new HttpError(400, 'Image must be between 1 byte and 10 MB.');
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new HttpError(400, 'Invalid image content. Upload a JPEG, PNG, or WebP photo.');
}

export function evaluateDetections(raw: unknown, targets: unknown, minimumConfidence: unknown) {
  const settings = detectionSettingsSchema.safeParse({ aiDetectionTargets: targets, aiMinimumConfidence: minimumConfidence });
  if (!settings.success) throw new HttpError(409, 'The admin must select valid detection classes and confidence settings.');
  const parsed = detectionSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(502, 'Image recognition returned an invalid result. Please retry.');
  const selected = parsed.data.detected.filter(d => settings.data.aiDetectionTargets.includes(d.object));
  const accepted = selected.filter(d => d.confidence >= settings.data.aiMinimumConfidence);
  const best = [...(accepted.length ? accepted : selected)].sort((a, b) => b.confidence - a.confidence)[0];

  // Collect all boxes across accepted detections
  const allBoxes: DetectedBox[] = [];
  for (const item of accepted) {
    if (item.boxes && Array.isArray(item.boxes)) {
      for (const b of item.boxes) {
        allBoxes.push({ object: item.object, box_2d: b });
      }
    } else if (item.box_2d) {
      allBoxes.push({ object: item.object, box_2d: item.box_2d });
    }
  }

  return {
    passed: accepted.length > 0,
    object: best?.object ?? 'Unknown',
    confidence: Math.round(best?.confidence ?? 0),
    detectedCount: accepted.reduce((sum, d) => sum + d.count, 0),
    box_2d: best?.box_2d ?? (allBoxes[0]?.box_2d ?? null),
    boxes: allBoxes,
    detections: accepted,
    reason: accepted.length ? '' : selected.length
      ? `Detection confidence is below the required ${settings.data.aiMinimumConfidence}%.`
      : `No ${settings.data.aiDetectionTargets.join(' or ')} detected in the image.`,
  };
}

let inFlight = 0;
export async function recognizeChallengeImage(bytes: Buffer, targets: unknown, minimumConfidence: unknown) {
  // Validate server-owned settings and file bytes before spending any API quota.
  evaluateDetections({ detected: [] }, targets, minimumConfidence);
  const mimeType = imageMimeType(bytes);
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.6-flash';
  if (!key || !/^gemini-[a-z0-9.-]+$/.test(model)) throw new HttpError(503, 'Image recognition is not configured. Contact the administrator.');
  if (inFlight >= 4) throw new HttpError(503, 'Image recognition is busy. Please retry shortly.');
  inFlight += 1;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are an environmental assistant classifying waste and recyclable objects in user photos for an eco challenge. Identify any: "Plastic Bottle" (including any plastic drink bottle, mineral water bottle, soft drink bottle, plastic flask/tumbler, or plastic jug/container), "Glass Bottle" (including glass drink bottles, condiment bottles, jars, or glass beverage containers), or "Plastic Wrapper" (including plastic snack wrappers, food packaging, bread bags, plastic bags, sachets, grocery bags, or cellophane wrappers). If the photo shows any of these items or anything resembling them, classify it accordingly. If there are multiple items (e.g. 2 or 3 bottles), detect ALL of them and provide tight bounding box coordinates in boxes array (each box as [ymin, xmin, ymax, xmax] 0-1000) tightly enclosing each individual detected item. Provide an estimated confidence percentage from 50 to 100, the count, and tight bounding boxes for each item.' }] },
        contents: [{ role: 'user', parts: [{ text: 'Analyze this photo and detect any Plastic Bottle, Glass Bottle, or Plastic Wrapper. Detect all items visible and return precise tight bounding box coordinates for each individual item.' }, { inlineData: { mimeType, data: bytes.toString('base64') } }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: { type: 'OBJECT', required: ['detected'], properties: {
            detected: { type: 'ARRAY', maxItems: 10, items: { type: 'OBJECT', required: ['object', 'confidence', 'count'], properties: {
              object: { type: 'STRING', enum: [...AI_TARGETS] },
              confidence: { type: 'NUMBER' },
              count: { type: 'INTEGER' },
              box_2d: { type: 'ARRAY', minItems: 4, maxItems: 4, items: { type: 'INTEGER' } },
              boxes: { type: 'ARRAY', items: { type: 'ARRAY', minItems: 4, maxItems: 4, items: { type: 'INTEGER' } } },
            } } },
          } },
        },
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(503, 'Image recognition is temporarily unavailable. Please retry later.');
    }
    // Bound provider output independently of its declared Content-Length.
    const reader = response.body?.getReader();
    if (!reader) throw new HttpError(502, 'Image recognition returned no result.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) { await reader.cancel(); throw new HttpError(502, 'Image recognition returned an invalid result.'); }
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new HttpError(502, 'Image recognition could not evaluate this photo. Please try another.');
    const text = candidate.content?.parts?.filter((part: any) => typeof part.text === 'string' && !part.thought).map((part: any) => part.text).join('');
    return { ...evaluateDetections(JSON.parse(text), targets, minimumConfidence), mimeType };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Never return provider error bodies, credentials, or uploaded image data.
    throw new HttpError(502, 'Image recognition failed or timed out. Please retry.');
  } finally {
    inFlight -= 1;
  }
}
