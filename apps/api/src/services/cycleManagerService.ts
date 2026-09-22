import { startOfWeek, addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TIMEZONE = 'Asia/Manila';

/**
 * Gets the current time in UTC, standard JS Date.
 */
export function getCurrentTime(): Date {
  return new Date();
}

/**
 * Calculates the start and end date of the current weekly cycle.
 * Cycle runs from Monday 00:00:00 to Friday 23:59:59 strictly in Asia/Manila.
 */
export function getCurrentCycleDates(): { startDate: Date; endDate: Date } {
  const now = new Date();
  
  // Convert current UTC time to Manila's local values for date manipulation
  const manilaTime = toZonedTime(now, TIMEZONE);

  // startOfWeek with weekStartsOn: 1 (Monday) using Manila's local values
  const mondayManila = startOfWeek(manilaTime, { weekStartsOn: 1 });
  
  // Set to 00:00:00.000 (Manila time)
  const startDateManila = setMilliseconds(setSeconds(setMinutes(setHours(mondayManila, 0), 0), 0), 0);

  // Friday is 4 days after Monday
  const fridayManila = addDays(startDateManila, 4);
  
  // Set to 23:59:59.999 (Manila time)
  const endDateManila = setMilliseconds(setSeconds(setMinutes(setHours(fridayManila, 23), 59), 59), 999);

  // Convert back to absolute UTC Date objects
  const startDate = fromZonedTime(startDateManila, TIMEZONE);
  const endDate = fromZonedTime(endDateManila, TIMEZONE);

  return { startDate, endDate };
}

/**
 * Determines if the current time is within the cycle window (Mon-Fri).
 */
export function isCycleActive(): boolean {
  const now = getCurrentTime();
  const { startDate, endDate } = getCurrentCycleDates();
  
  return now >= startDate && now <= endDate;
}

/**
 * Determines the status based on current time and cycle dates.
 */
export function determineStatus(startDate: Date, endDate: Date): 'UPCOMING' | 'OPEN' | 'CLOSED' {
  const now = getCurrentTime();
  if (now < startDate) {
    return 'UPCOMING';
  } else if (now >= startDate && now <= endDate) {
    return 'OPEN';
  } else {
    return 'CLOSED';
  }
}

import { prisma } from '../prismaClient';

/**
 * Returns a unique weekly cycle identifier, e.g., "2026-W33" based on Asia/Manila Monday start.
 */
export function getCurrentCycleKey(): string {
  const { startDate } = getCurrentCycleDates();
  const manilaStart = toZonedTime(startDate, TIMEZONE);
  const year = manilaStart.getFullYear();
  // Get ISO week number roughly or using date format YYYY-MM-DD of Monday
  const month = String(manilaStart.getMonth() + 1).padStart(2, '0');
  const day = String(manilaStart.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if the weekly +50 increment has been applied to this challenge for the current cycle.
 * If not, increases availableQuantity by weeklyIncrementQuantity atomically and records lastCycleKey.
 */
export async function checkAndApplyWeeklyQuantityIncrement(challengeId: string) {
  const currentKey = getCurrentCycleKey();
  
  return await prisma.$transaction(async (tx) => {
    const challenge = await tx.challenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) return null;

    if (challenge.lastCycleKey !== currentKey) {
      const incrementBy = challenge.weeklyIncrementQuantity || 50;
      const updated = await tx.challenge.update({
        where: { id: challengeId },
        data: {
          availableQuantity: { increment: incrementBy },
          lastCycleKey: currentKey,
        }
      });
      return updated;
    }

    return challenge;
  });
}

// Cache for active challenge instances for current cycle: key -> instance
const instanceCache = new Map<string, { instance: any; expiresAt: number }>();

export function invalidateActiveInstanceCache(challengeId?: string) {
  if (challengeId) {
    for (const key of instanceCache.keys()) {
      if (key.startsWith(`${challengeId}:`)) {
        instanceCache.delete(key);
      }
    }
  } else {
    instanceCache.clear();
  }
}

/**
 * Gets or creates the active challenge instance for a given challenge ID for the current week.
 * Also ensures weekly quantity increment is evaluated.
 */
export async function getOrCreateActiveInstance(challengeId: string) {
  const { startDate, endDate } = getCurrentCycleDates();
  const cacheKey = `${challengeId}:${startDate.getTime()}:${endDate.getTime()}`;
  const now = Date.now();

  const cached = instanceCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.instance;
  }

  // Ensure weekly quantity rollover addition has executed for this challenge
  await checkAndApplyWeeklyQuantityIncrement(challengeId);

  // Find an existing instance for this week
  let instance = await prisma.challengeInstance.findFirst({
    where: {
      challengeId,
      startDate,
      endDate,
    }
  });

  // If it doesn't exist, create it
  if (!instance) {
    instance = await prisma.challengeInstance.create({
      data: {
        challengeId,
        startDate,
        endDate,
        status: determineStatus(startDate, endDate)
      }
    });
  } else {
    // Update status if it changed (e.g. OPEN to CLOSED)
    const currentStatus = determineStatus(instance.startDate, instance.endDate);
    if (instance.status !== currentStatus) {
      instance = await prisma.challengeInstance.update({
        where: { id: instance.id },
        data: { status: currentStatus }
      });
    }
  }

  // Cache instance for 60 seconds
  instanceCache.set(cacheKey, { instance, expiresAt: now + 60 * 1000 });

  return instance;
}

/**
 * Optimized Batch Resolver:
 * Resolves or creates active challenge instances for multiple challenges in 1-2 batch queries
 * instead of looping through each challenge template with individual transactions.
 */
export async function getOrCreateActiveInstancesBatch(challenges: { id: string; lastCycleKey?: string | null; weeklyIncrementQuantity?: number }[]) {
  if (!challenges || challenges.length === 0) return [];

  const { startDate, endDate } = getCurrentCycleDates();
  const currentKey = getCurrentCycleKey();
  const now = Date.now();
  const status = determineStatus(startDate, endDate);

  // 1. Check in-memory cache first
  const missingChallengeIds: string[] = [];
  const results: { challengeId: string; instance: any }[] = [];

  for (const c of challenges) {
    const cacheKey = `${c.id}:${startDate.getTime()}:${endDate.getTime()}`;
    const cached = instanceCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      results.push({ challengeId: c.id, instance: cached.instance });
    } else {
      missingChallengeIds.push(c.id);
    }
  }

  if (missingChallengeIds.length === 0) {
    return results;
  }

  // 2. Batch check weekly increment for challenges that haven't had rollover yet
  const needsIncrement = challenges.filter(
    c => missingChallengeIds.includes(c.id) && c.lastCycleKey !== currentKey
  );

  if (needsIncrement.length > 0) {
    await prisma.$transaction(
      needsIncrement.map(c =>
        prisma.challenge.update({
          where: { id: c.id },
          data: {
            availableQuantity: { increment: c.weeklyIncrementQuantity || 50 },
            lastCycleKey: currentKey,
          },
        })
      )
    );
  }

  // 3. Find existing instances in a single batch query
  const existingInstances = await prisma.challengeInstance.findMany({
    where: {
      challengeId: { in: missingChallengeIds },
      startDate,
      endDate,
    },
  });

  const existingMap = new Map(existingInstances.map(inst => [inst.challengeId, inst]));
  const toCreateIds = missingChallengeIds.filter(id => !existingMap.has(id));

  // 4. If any instances need creation, create them
  let createdInstances: any[] = [];
  if (toCreateIds.length > 0) {
    await prisma.challengeInstance.createMany({
      data: toCreateIds.map(challengeId => ({
        challengeId,
        startDate,
        endDate,
        status,
      })),
      skipDuplicates: true,
    });

    createdInstances = await prisma.challengeInstance.findMany({
      where: {
        challengeId: { in: toCreateIds },
        startDate,
        endDate,
      },
    });
  }

  // 5. Combine and update in-memory cache
  const allInstances = [...existingInstances, ...createdInstances];
  for (const inst of allInstances) {
    const cacheKey = `${inst.challengeId}:${startDate.getTime()}:${endDate.getTime()}`;
    instanceCache.set(cacheKey, { instance: inst, expiresAt: now + 60 * 1000 });
    results.push({ challengeId: inst.challengeId, instance: inst });
  }

  return results;
}

/**
 * Automatically fails/expires submissions that were preliminarily approved but exceeded
 * the 1-week grace period without completing after-photo or QR verification.
 * Refunds reserved quantity back to the challenge.
 */
export async function expireStaleSubmissions(): Promise<number> {
  const GRACE_PERIOD_DAYS = 7;
  const cutoffDate = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const staleSubmissions = await prisma.challengeSubmission.findMany({
    where: {
      status: { in: ['approved_collection', 'final_review'] },
      adminPreliminaryApproved: true,
      adminPreliminaryApprovedAt: {
        lte: cutoffDate
      }
    },
    include: {
      challengeInstance: { include: { challenge: true } }
    }
  });

  let expiredCount = 0;

  for (const sub of staleSubmissions) {
    const reserved = sub.reservedQuantity || 0;
    const challengeId = sub.challengeInstance?.challengeId;

    await prisma.$transaction(async (tx) => {
      if (reserved > 0 && challengeId) {
        await tx.challenge.update({
          where: { id: challengeId },
          data: {
            availableQuantity: { increment: reserved }
          }
        });
      }

      await tx.challengeSubmission.update({
        where: { id: sub.id },
        data: {
          status: 'rejected',
          moderatorNotes: 'Failed: 1-week grace period expired without completing After Photo or QR verification.',
          reservedQuantity: 0,
        }
      });
    });

    expiredCount++;
  }

  return expiredCount;
}
