import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../http/errorResponder';

const rewardSchema = z.object({
  enabled: z.boolean(), name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  iconUrl: z.string().trim().url().max(2048).refine(value => /^https?:\/\//i.test(value)),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export function contentBadgeWrite(raw: unknown, awardType: string, create = false) {
  if (raw === undefined) return undefined;
  let value: any = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid badge reward.'); }
  }
  if (!value || typeof value.enabled !== 'boolean') throw new HttpError(400, 'Invalid badge reward.');
  if (!value.enabled && !value.name) return undefined;
  const parsed = rewardSchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'Badge name, image, description, and color are required when a badge is enabled.');
  if (parsed.data.name === 'Giveaway Master') throw new HttpError(400, 'Giveaway Master is reserved for the giveaway milestone.');
  const { enabled, ...artwork } = parsed.data;
  const data = { ...artwork, awardType, active: enabled, requiredPoints: 2147483647 };
  return create ? { create: data } : { upsert: { create: data, update: data } };
}

export async function awardContentBadge(tx: Prisma.TransactionClient, type: string, sourceId: string, userIds: string[]) {
  const field = { lesson: 'lessonId', challenge: 'challengeId', event: 'eventId', exchange: 'swapListingId' }[type];
  if (!field) return [];
  const badge = await tx.badge.findFirst({ where: { [field]: sourceId, awardType: type, active: true } });
  if (!badge) return [];
  const awarded = [];
  for (const userId of new Set(userIds)) {
    const result = await tx.userBadge.createMany({ data: [{ userId, badgeId: badge.id }], skipDuplicates: true });
    if (result.count) awarded.push({ userId, badge });
  }
  return awarded;
}
