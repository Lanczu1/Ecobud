/**
 * EcoGuide AI Service
 *
 * Powers the EcoBud assistant chatbot using the Mistral AI API.
 * The full EcoGuide system prompt is sent on EVERY request so the model
 * never "forgets" its role, even in long conversations.
 *
 * Fallback: if the Mistral call fails for any reason (bad key, network,
 * rate-limit, timeout) the service returns a friendly, helpful reply
 * using the legacy keyword-matching logic — the user never sees a raw error.
 *
 * QuickReplies: generated server-side by scanning keywords in the AI's
 * reply text.  This avoids relying on Mistral to produce structured JSON
 * and keeps suggestions snappy even when the fallback path is used.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MistralChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralChoice {
  message: { role: string; content: string };
}

interface MistralChatResponse {
  choices?: MistralChoice[];
}

interface EcoGuideReply {
  reply: string;
  quickReplies: string[];
}

// ---------------------------------------------------------------------------
// System prompt — sent as the `system` role on every single request
// ---------------------------------------------------------------------------

const ECOGUIDE_SYSTEM_PROMPT = `You are EcoGuide, the friendly AI assistant inside the ECOBUD app — an environmental conservation platform that helps residents build sustainable habits through education, challenges, and community events.

## Your Role
You help users:
1. Understand proper waste segregation (recyclables, compostables, general waste, hazardous waste)
2. Learn sustainable practices for reducing waste at home and in their community
3. Navigate local waste disposal guidelines and schedules
4. Answer municipality-specific questions when local data is provided to you
5. Explain ECOBUD features like eco-points, challenges, streaks, lessons, and community events

## Response Guidelines
- Keep answers clear, practical, and actionable — assume the user wants to do the right thing but may not know how.
- When explaining segregation, use simple categories (e.g., "This goes in your GREEN bin" or "This is hazardous waste, drop it off at a hazardous-waste facility").
- If a user describes an item, tell them: (1) what category it falls under, (2) how to prepare it (rinse, flatten, remove caps, etc.), and (3) where it goes.
- For sustainability questions, prioritize practical, low-effort changes before advanced ones.
- If you don't have municipality-specific data for the user's location, say so clearly and give general best-practice guidance instead of guessing.
- Never assume a fact about local rules (pickup days, accepted materials, fines) — only state these if provided in your context.

## Tone
Warm, encouraging, non-judgmental. Avoid shaming language around past waste habits — focus on "here's how to do it better going forward."

## Structure for Answers
- Use short paragraphs or bullet points, not long blocks of text.
- For "how do I dispose of X" questions, follow this structure:
  1. Category (recyclable / compost / general / hazardous)
  2. Prep steps (if any)
  3. Where it goes (bin color, drop-off point, or special collection)
- For educational questions (e.g., "why should I compost?"), give a brief explanation (2-4 sentences) plus 1-2 concrete next steps.

## Boundaries
- If asked about topics unrelated to waste management, sustainability, the environment, or ECOBUD features, politely redirect: "I'm focused on helping with waste, recycling, and sustainability questions — is there something in that area I can help with?"
- If a user asks about disposing of genuinely hazardous materials (chemicals, batteries, medical waste, etc.), always recommend proper hazardous waste facilities/programs rather than general disposal, and never suggest unsafe DIY handling.
- Do not provide legal advice on waste violations/fines — direct users to contact their local waste authority for official rulings.
- Keep replies concise (ideally under 150 words) unless the user asks for more detail.

## Municipality Data
No municipality-specific data is currently loaded. Provide general best-practice guidance and let the user know you don't have their specific local rules.`;

// ---------------------------------------------------------------------------
// Keyword-based fallback (legacy logic) — used when Mistral is unavailable
// ---------------------------------------------------------------------------

function buildFallbackReply(message: string): string {
  const n = message.toLowerCase();

  if (n.includes('compost'))
    return "Sorry, I'm having a little trouble connecting right now — but here's what I can tell you: start composting with fruit scraps, vegetable peels, dry leaves, and a breathable bin. Keep the mix balanced between green (wet/nitrogen-rich) and brown (dry/carbon-rich) materials. I'll be fully back soon!";

  if (n.includes('recycle') || n.includes('recycling'))
    return "I'm experiencing a brief hiccup, but here's a quick tip: rinse containers, flatten cardboard, and remove caps before recycling. Check your local guidelines for what's accepted — not all plastics are recyclable everywhere.";

  if (n.includes('event'))
    return "I'm having a small connection issue, but you can browse upcoming ECOBUD community events from the Events section in the app. Tree planting and clean-up drives are popular options!";

  if (n.includes('points') || n.includes('eco'))
    return "I'm running into a temporary issue, but here's the gist: you earn ECO Points by finishing lessons, completing challenges, checking in daily habits, and attending verified community events. Keep up the great work!";

  if (n.includes('battery') || n.includes('batteries'))
    return "I'm briefly unavailable for detailed advice, but batteries are hazardous waste — never throw them in your regular bin. Drop them off at a designated hazardous-waste collection point or electronics store that accepts them.";

  if (n.includes('plastic'))
    return "I'm having a brief connection issue, but here's a quick guide: check the recycling number on the bottom of plastic items. #1 (PET) and #2 (HDPE) are widely accepted. Rinse them out before recycling. Soft plastics (bags, wrappers) usually need a separate drop-off.";

  return "I'm having a little trouble connecting to my full knowledge base right now, but I'm still here to help! I can assist with composting, recycling, eco-friendly habits, ECOBUD challenges, and community events. Try asking me about any of those topics!";
}

// ---------------------------------------------------------------------------
// Quick-reply generation — keyword scan on the AI's actual reply text
// ---------------------------------------------------------------------------

const QUICK_REPLY_RULES: { pattern: RegExp; suggestions: string[] }[] = [
  { pattern: /compost/i,       suggestions: ['What can I compost?', 'How do I start a compost bin?'] },
  { pattern: /recycl/i,        suggestions: ['What plastics are recyclable?', 'How do I prepare items for recycling?'] },
  { pattern: /hazardous|batter|chemical|medical/i, suggestions: ['Where do I drop off hazardous waste?', 'Are batteries hazardous?'] },
  { pattern: /event|community|clean.?up/i,  suggestions: ['Any upcoming events?', 'How do I join an event?'] },
  { pattern: /point|streak|badge/i,         suggestions: ['How do I earn eco-points?', 'What are streaks?'] },
  { pattern: /plastic|bag|wrapper/i,        suggestions: ['Can I recycle soft plastics?', 'What do recycling numbers mean?'] },
  { pattern: /food|kitchen|scrap/i,         suggestions: ['How to reduce food waste?', 'Can I compost cooked food?'] },
  { pattern: /challenge/i,                  suggestions: ['Show me today\'s challenge', 'What challenges are available?'] },
  { pattern: /lesson|learn/i,               suggestions: ['What lessons are available?', 'How do I earn knowledge points?'] },
];

const DEFAULT_QUICK_REPLIES = [
  'How to compost?',
  'What goes in recycling?',
  'Tips for reducing waste',
  'Tell me about eco-points',
];

function generateQuickReplies(replyText: string): string[] {
  const matched: string[] = [];

  for (const rule of QUICK_REPLY_RULES) {
    if (rule.pattern.test(replyText)) {
      for (const s of rule.suggestions) {
        if (!matched.includes(s)) matched.push(s);
      }
    }
    if (matched.length >= 4) break;
  }

  if (matched.length === 0) return DEFAULT_QUICK_REPLIES;

  // Pad to 4 with defaults that aren't already included
  for (const d of DEFAULT_QUICK_REPLIES) {
    if (matched.length >= 4) break;
    if (!matched.includes(d)) matched.push(d);
  }

  return matched.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Mistral API call
// ---------------------------------------------------------------------------

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';
const MISTRAL_TIMEOUT_MS = 15_000;

async function callMistral(messages: MistralChatMessage[]): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MISTRAL_TIMEOUT_MS);

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages,
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Mistral API ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as MistralChatResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Mistral');
    }

    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an EcoGuide assistant reply.
 *
 * - The full system prompt is prepended on **every** request.
 * - Up to `history` recent messages provide conversational context.
 * - If the Mistral call fails, the user gets a friendly keyword-based
 *   fallback — never a raw error or crash.
 */
export async function getEcoGuideReply(
  userMessage: string,
  history: ChatHistoryMessage[] = [],
): Promise<EcoGuideReply> {
  // Build the messages array — system prompt is ALWAYS first
  const messages: MistralChatMessage[] = [
    { role: 'system', content: ECOGUIDE_SYSTEM_PROMPT },
  ];

  // Append conversation history (already capped to last 10 on the client)
  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Append the current user message
  messages.push({ role: 'user', content: userMessage });

  let replyText: string;

  try {
    replyText = await callMistral(messages);
  } catch (error) {
    // Log for server-side observability, but NEVER expose to the user
    console.error('[EcoGuide] Mistral call failed, using fallback:', error);
    replyText = buildFallbackReply(userMessage);
  }

  return {
    reply: replyText,
    quickReplies: generateQuickReplies(replyText),
  };
}
