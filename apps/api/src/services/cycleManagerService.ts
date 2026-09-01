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
      const updated = await tx.challenge.update({
        where: { id: challengeId },
        data: {
          lastCycleKey: currentKey,
        }
      });
      return updated;
    }

    return challenge;
  });
}

/**
 * Gets or creates the active challenge instance for a given challenge ID for the current week.
 * Also ensures weekly quantity increment is evaluated.
 */
export async function getOrCreateActiveInstance(challengeId: string) {
  const { startDate, endDate } = getCurrentCycleDates();
  
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

  return instance;
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
    await prisma.challengeSubmission.update({
      where: { id: sub.id },
      data: {
        status: 'rejected',
        moderatorNotes: 'Failed: 1-week grace period expired without completing After Photo or QR verification.',
        reservedQuantity: 0,
      }
    });

    expiredCount++;
  }

  return expiredCount;
}
