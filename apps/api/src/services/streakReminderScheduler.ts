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

  for (const days of [2, 1] as const) {
    const minimumRemaining = days === 2 ? DAY_MS : 0;
    const maximumRemaining = days === 2 ? STREAK_WARNING_MS : DAY_MS;
    const inWarningWindow = {
      gt: new Date(now.getTime() - STREAK_WINDOW_MS + minimumRemaining),
      lte: new Date(now.getTime() - STREAK_WINDOW_MS + maximumRemaining),
    };
    const prefix = days === 2 ? KEY_PREFIX : `${KEY_PREFIX}1-day:`;
    const users = await prisma.user.findMany({
      where: {
        role: 'user',
        status: 'active',
        currentStreak: { gte: 1 },
        AND: [
          { OR: [{ lastChallengeAt: inWarningWindow }, { streakRestoredAt: inWarningWindow }] },
          { OR: [{ lastChallengeAt: null }, { lastChallengeAt: { lte: inWarningWindow.lte } }] },
          { OR: [{ streakRestoredAt: null }, { streakRestoredAt: { lte: inWarningWindow.lte } }] },
        ],
        notifications: { none: { notificationKey: { startsWith: prefix }, createdAt: { gt: new Date(now.getTime() - STREAK_WARNING_MS) } } },
      },
      select: { id: true, currentStreak: true, lastChallengeAt: true, streakRestoredAt: true },
      take: 200,
    });

    for (const user of users) {
      const lastActivity = streakLastActivity(user);
      const remaining = lastActivity + STREAK_WINDOW_MS - now.getTime();
      if (remaining <= minimumRemaining || remaining > maximumRemaining) continue;
      await sendDirectNotification({
        userId: user.id,
        type: 'streak',
        title: days === 1 ? 'Your streak expires within 24 hours' : 'Your streak expires within 2 days',
        message: `Complete a challenge and claim its reward to keep your ${user.currentStreak}-challenge streak. If time runs out, it resets to 0 until you restore it.`,
        priority: 'high',
        notificationKey: `${prefix}${lastActivity}`,
      });
    }
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
