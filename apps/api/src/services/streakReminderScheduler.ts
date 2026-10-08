import { prisma } from '../prismaClient';
import { sendDirectNotification } from './notificationService';
import { STREAK_WARNING_MS, STREAK_WINDOW_MS, streakLastActivity } from '../utils/streakRules';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'streak-warning:';

export async function sendStreakWarnings(now = new Date()) {
  // Manila is UTC+8 with no DST. Hold warnings overnight so the push lands in the daytime.
  const manilaHour = (now.getUTCHours() + 8) % 24;
  if (manilaHour < 8 || manilaHour >= 20) return;

  const openChallenges = await prisma.challenge.count({
    where: {
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gt: now } }] },
      ],
    },
  });
  if (!openChallenges) return;

  const inWarningWindow = {
    gt: new Date(now.getTime() - STREAK_WINDOW_MS),
    lte: new Date(now.getTime() - (STREAK_WINDOW_MS - STREAK_WARNING_MS)),
  };
  const users = await prisma.user.findMany({
    where: {
      role: 'user',
      status: 'active',
      currentStreak: { gte: 3 },
      OR: [{ lastChallengeAt: inWarningWindow }, { streakRestoredAt: inWarningWindow }],
      // A warning for the current 7-day window can only have been created in the last 2 days.
      notifications: { none: { notificationKey: { startsWith: KEY_PREFIX }, createdAt: { gt: new Date(now.getTime() - STREAK_WARNING_MS) } } },
    },
    select: { id: true, currentStreak: true, lastChallengeAt: true, streakRestoredAt: true },
    take: 200,
  });

  for (const user of users) {
    const lastActivity = streakLastActivity(user);
    const remaining = lastActivity + STREAK_WINDOW_MS - now.getTime();
    if (remaining <= 0 || remaining > STREAK_WARNING_MS) continue;
    const days = Math.ceil(remaining / DAY_MS);
    await sendDirectNotification({
      userId: user.id,
      type: 'streak',
      title: `Your streak flame goes out in ${days} ${days === 1 ? 'day' : 'days'}`,
      message: `Complete a challenge to keep your ${user.currentStreak}-challenge streak active.`,
      priority: 'high',
      notificationKey: `${KEY_PREFIX}${lastActivity}`,
    });
  }
}

let timer: NodeJS.Timeout | undefined;
let running = false;
export function startStreakReminderScheduler() {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await sendStreakWarnings(); }
    catch (error) { console.error('Streak reminder tick failed.', error); }
    finally { running = false; }
  };
  void tick();
  timer = setInterval(() => void tick(), CHECK_INTERVAL_MS);
  timer.unref();
}
export function stopStreakReminderScheduler() { if (timer) clearInterval(timer); timer = undefined; }
