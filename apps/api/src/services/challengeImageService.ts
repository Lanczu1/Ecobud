import { z } from 'zod';
import { HttpError } from '../http/errorResponder';

export const AI_TARGETS = ['Plastic Bottle', 'Glass Bottle', 'Plastic Wrapper'] as const;
type AiTarget = typeof AI_TARGETS[number];
const TARGET_DESCRIPTIONS: Record<AiTarget, string> = {
  'Plastic Bottle': 'a bottle whose main container body is rigid plastic, including clear, colored, tinted, or opaque plastic bottles and plastic spray bottles. Caps, labels, triggers, and pumps may be made of another material; classify by the main bottle body, not these accessories. Do not call a bottle plastic from its shape or color alone.',
  'Glass Bottle': 'a bottle whose main container body is glass, including clear, colored, tinted, opaque, or frosted glass bottles, thick glass bottles, and glass spray bottles. The cap, label, trigger, or spray pump may be plastic or metal; classify the bottle by its main body material, not its accessories. Do not call a bottle glass from its shape or color alone.',
  'Plastic Wrapper': 'flexible plastic film or plastic-laminated packaging, including snack and chip wrappers, bread bags, sachets, refill pouches, food pouches, and noodle seasoning packets. It can be empty or contain food/liquid, sealed or open, smooth, crumpled, folded, or partly obscured. Classify the flexible package itself, not its contents or printed images; do not count rigid bottles or containers as wrappers.',
};

function recognitionInstructions(targets: AiTarget[]): string {
  return `Identify ONLY the selected target classes in this photo: ${targets.map(target => `${target} = ${TARGET_DESCRIPTIONS[target]}`).join('; ')}. Judge the physical object by visible material and construction, not printed words or product pictures. For bottles, classify the main container body; ignore the material of caps, labels, triggers, and spray pumps. A glass spray bottle remains Glass Bottle when it has a plastic spray head, and a plastic spray bottle remains Plastic Bottle when it has a metal or glass accessory. Opaque, tinted, or frosted appearance alone does not determine bottle material. A flexible filled pouch remains Plastic Wrapper; classify its flexible package, not its contents. A flat pouch is a wrapper, never a bottle; a bottle label is part of the bottle, not a separate wrapper. Do not infer glass or plastic solely from a bottle's shape, color, or spray head. When the body material cannot be determined from visible evidence, do not claim a confident material class. Distinguish rigid bottles from flexible wrappers and do not assign one physical object to multiple classes. Include small or partly obscured target objects and count distinct items. Return an empty detected array when none of the selected classes is visibly present. Do not add unselected classes or duplicate one item under multiple classes. Use realistic confidence percentages and tight boxes [ymin, xmin, ymax, xmax] in 0-1000 coordinates.`;
}
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
const MAX_CONCURRENT_ANALYSES = 8;
// A healthy scan answers in 2-4 seconds; past this a provider is treated as down so the next one can answer.
const PROVIDER_TIMEOUT_MS = 8_000;
// How long Gemini gets on its own before Mistral is asked alongside it.
const HEDGE_DELAY_MS = 3_000;
const STILL_WAITING = Symbol('still waiting');

// Resolves with the first run that produces a value, or null once every run came back empty.
function firstResult<T>(runs: Promise<T | null>[]): Promise<T | null> {
  return new Promise(resolve => {
    let pending = runs.length;
    for (const run of runs) {
      void run.then(value => {
        pending -= 1;
        if (value) resolve(value);
        else if (pending === 0) resolve(null);
      });
    }
  });
}

/**
 * Sleep helper with jitter to prevent thundering herd during upstream rate limits (429).
 */
function sleepWithJitter(baseMs: number, factor = 0.5): Promise<void> {
  const jitter = baseMs * factor * (Math.random() - 0.5);
  const ms = Math.max(100, Math.floor(baseMs + jitter));
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalizes raw JSON result from any provider into the strict EcoBud detection format.
 */
function normalizeDetectionResult(parsedJson: any): any {
  if (!parsedJson || typeof parsedJson !== 'object') {
    return { detected: [] };
  }
  const detectedList = Array.isArray(parsedJson.detected) ? parsedJson.detected : [];
  const normalized: any[] = [];
  const seenObjects = new Set<string>();

  for (const item of detectedList) {
    if (!item || typeof item !== 'object') continue;
    const rawObj = String(item.object || '').trim();
    const matchedTarget = AI_TARGETS.find(t => t.toLowerCase() === rawObj.toLowerCase());
    if (!matchedTarget || seenObjects.has(matchedTarget)) continue;
    seenObjects.add(matchedTarget);

    // Some providers answer on a 0-1 scale (0.99) instead of the 0-100 the prompt asks for.
    const rawConfidence = typeof item.confidence === 'number' ? item.confidence : 75;
    const confidence = Math.min(100, Math.max(0, rawConfidence > 0 && rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence));
    const count = typeof item.count === 'number' && item.count >= 1 ? Math.floor(item.count) : 1;
    
    // Normalize bounding box if present
    let box_2d: [number, number, number, number] | undefined = undefined;
    if (Array.isArray(item.box_2d) && item.box_2d.length === 4) {
      box_2d = item.box_2d.map((v: any) => Math.min(1000, Math.max(0, Math.round(Number(v) || 0)))) as [number, number, number, number];
    }

    let boxes: [number, number, number, number][] | undefined = undefined;
    if (Array.isArray(item.boxes)) {
      boxes = item.boxes
        .filter((b: any) => Array.isArray(b) && b.length === 4)
        .map((b: any) => b.map((v: any) => Math.min(1000, Math.max(0, Math.round(Number(v) || 0)))) as [number, number, number, number]);
    }

    normalized.push({
      object: matchedTarget,
      confidence,
      count,
      ...(box_2d ? { box_2d } : {}),
      ...(boxes && boxes.length ? { boxes } : {}),
    });
  }

  return { detected: normalized };
}

/**
 * Call Google Gemini Vision models.
 */
async function callGeminiVision(
  modelName: string,
  key: string,
  mimeType: string,
  base64Data: string,
  targets: AiTarget[],
  timeoutMs = 20_000
): Promise<{ text: string }> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: recognitionInstructions(targets)
        }]
      },
      contents: [{
        role: 'user',
        parts: [
          { text: `Detect only ${targets.join(' or ')} in this photo. Return all distinct matching items with tight bounding boxes.` },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          required: ['detected'],
          properties: {
            detected: {
              type: 'ARRAY',
              maxItems: 10,
              items: {
                type: 'OBJECT',
                required: ['object', 'confidence', 'count'],
                properties: {
                  object: { type: 'STRING', enum: targets },
                  confidence: { type: 'NUMBER' },
                  count: { type: 'INTEGER' },
                  box_2d: { type: 'ARRAY', minItems: 4, maxItems: 4, items: { type: 'INTEGER' } },
                  boxes: { type: 'ARRAY', items: { type: 'ARRAY', minItems: 4, maxItems: 4, items: { type: 'INTEGER' } } },
                }
              }
            },
          }
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const err = new Error(`Gemini ${modelName} returned status ${response.status}: ${errorText.slice(0, 120)}`);
    (err as any).status = response.status;
    throw err;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Gemini returned no response stream');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 64 * 1024) {
      await reader.cancel();
      throw new Error('Gemini response exceeded maximum payload limit');
    }
    chunks.push(value);
  }

  const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') {
    throw new Error(`Gemini finished with reason: ${candidate?.finishReason || 'UNKNOWN'}`);
  }
  const text = candidate.content?.parts?.filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('');
  return { text };
}

/**
 * Cross-provider fallback to Mistral's vision API.
 */
async function callMistralVision(
  key: string,
  mimeType: string,
  base64Data: string,
  targets: AiTarget[],
  timeoutMs = 20_000
): Promise<{ text: string }> {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  const promptText = `${recognitionInstructions(targets)} Return ONLY a JSON object with a "detected" array. Each entry must contain "object" (one of the selected exact class names), "confidence" (a realistic number from 0 to 100), "count" (number of distinct objects of that class), and "box_2d" ([ymin,xmin,ymax,xmax], coordinates 0 to 1000). If none qualify, return {"detected":[]}.`;

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: process.env.MISTRAL_IMAGE_MODEL || 'mistral-medium-2604',
      temperature: 0,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: dataUrl },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const err = new Error(`Mistral Pixtral returned status ${response.status}: ${errorText.slice(0, 120)}`);
    (err as any).status = response.status;
    throw err;
  }

  const resJson = await response.json();
  const content = resJson.choices?.[0]?.message?.content;
  if (!content) throw new Error('Mistral Pixtral returned an empty choice');
  return { text: content };
}

/**
 * Production-grade Challenge Image Recognition
 * Features:
 * - Gemini Flash first; Mistral vision joins when Gemini fails or is slow; Gemini Flash Lite as last resort
 * - Exponential backoff with jitter on HTTP 429 (Rate Limit / Quota Exceeded)
 * - Immediate failover on 500, 502, 503, 504 server errors and network timeouts
 * - Result schema normalization to guarantee valid client verification & token signing
 */
export async function recognizeChallengeImage(bytes: Buffer, targets: unknown, minimumConfidence: unknown) {
  // Validate server-owned settings and file bytes before spending any API quota.
  evaluateDetections({ detected: [] }, targets, minimumConfidence);
  const selectedTargets = targets as AiTarget[];
  const mimeType = imageMimeType(bytes);
  const base64Data = bytes.toString('base64');

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();

  if (!geminiKey && !mistralKey) {
    throw new HttpError(503, 'Image recognition is not configured. Contact the administrator.');
  }
  if (inFlight >= MAX_CONCURRENT_ANALYSES) {
    throw new HttpError(503, 'Image recognition server is experiencing high traffic. Please retry in a few seconds.');
  }

  inFlight += 1;
  const primaryModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.5-flash';
  const backupModel = 'gemini-3.1-flash-lite';

  try {
    let lastError: any = null;

    // One Gemini model, with a single retry when it reports a rate limit. Resolves null on failure.
    const tryGemini = async (model: string): Promise<any | null> => {
      if (!geminiKey) return null;
      for (let attemptsLeft = 2; attemptsLeft > 0; attemptsLeft -= 1) {
        try {
          const { text } = await callGeminiVision(model, geminiKey, mimeType, base64Data, selectedTargets, PROVIDER_TIMEOUT_MS);
          return normalizeDetectionResult(JSON.parse(text));
        } catch (err: any) {
          lastError = err;
          if (err?.status === 429 && attemptsLeft > 1) {
            console.warn(`[AI Vision] Gemini ${model} hit 429 rate limit. Backing off before retry...`);
            await sleepWithJitter(800);
            continue;
          }
          console.warn(`[AI Vision] Gemini ${model} failed (status: ${err?.status || 'network/timeout'}).`);
          return null;
        }
      }
      return null;
    };
    const tryMistral = async (): Promise<any | null> => {
      if (!mistralKey) return null;
      try {
        const { text } = await callMistralVision(mistralKey, mimeType, base64Data, selectedTargets, PROVIDER_TIMEOUT_MS);
        return normalizeDetectionResult(JSON.parse(text));
      } catch (err: any) {
        console.error('[AI Vision] Mistral vision failed:', err.message);
        lastError = err;
        return null;
      }
    };

    // Gemini goes first. If it fails, or is still silent after the hedge delay, Mistral runs too and the first answer wins.
    const geminiRun = tryGemini(primaryModel);
    let mistralRun: Promise<any | null> | null = null;
    const early = await Promise.race([
      geminiRun,
      new Promise<typeof STILL_WAITING>(resolve => setTimeout(() => resolve(STILL_WAITING), HEDGE_DELAY_MS)),
    ]);
    let parsedRawResult: any = early === STILL_WAITING ? null : early;
    let answeredByGemini = Boolean(parsedRawResult);

    if (!parsedRawResult) {
      if (mistralKey && geminiKey) console.warn(`[AI Vision] Gemini ${early === STILL_WAITING ? 'is slow' : 'did not return a result'}. Asking Mistral vision...`);
      mistralRun = tryMistral();
      const winner = await firstResult([
        geminiRun.then(result => result && { result, gemini: true }),
        mistralRun.then(result => result && { result, gemini: false }),
      ]);
      parsedRawResult = winner?.result ?? null;
      answeredByGemini = Boolean(winner?.gemini);
    }

    // Last resort, only reached when both the primary Gemini model and Mistral failed.
    if (!parsedRawResult && backupModel !== primaryModel) {
      parsedRawResult = await tryGemini(backupModel);
      answeredByGemini = Boolean(parsedRawResult);
    }

    if (!parsedRawResult) {
      const isRateLimit = lastError?.status === 429;
      if (isRateLimit) {
        throw new HttpError(429, 'Vision AI service is currently experiencing high demand. Please wait a few moments and retry.');
      }
      throw new HttpError(503, 'Image recognition is temporarily unavailable across all providers. Please retry in a moment.');
    }

    let evaluation = evaluateDetections(parsedRawResult, targets, minimumConfidence);
    // Gemini answered but rejected the photo: ask Mistral before failing the user's attempt.
    if (!evaluation.passed && answeredByGemini && mistralKey) {
      console.warn(`[AI Vision] Gemini rejected the photo (${evaluation.reason}) Asking Mistral for a second check...`);
      // Reuses the Mistral call when it was already started alongside a slow Gemini.
      const secondRaw = await (mistralRun ?? tryMistral());
      const second = secondRaw ? evaluateDetections(secondRaw, targets, minimumConfidence) : null;
      if (second) console.warn(`[AI Vision] Mistral second check ${second.passed ? 'passed' : 'also rejected'} the photo (${second.object} ${second.confidence}%).`);
      if (second?.passed) evaluation = second;
    }

    return { ...evaluation, mimeType };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Never leak provider error bodies, credentials, or uploaded image data to client
    throw new HttpError(502, 'Image recognition failed to evaluate this photo. Please take another clear photo.');
  } finally {
    inFlight -= 1;
  }
}
