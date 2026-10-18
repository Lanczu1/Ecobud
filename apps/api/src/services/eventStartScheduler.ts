import { prisma } from '../prismaClient';
import { sendDirectNotification } from './notificationService';

const CHECK_INTERVAL_MS = 60 * 1000;
// An event that started longer ago than this is not announced, so an API restart after downtime
// does not send a burst of late "has started" alerts.
const LATE_LIMIT_MS = 60 * 60 * 1000;
const BATCH = 500;

/** One alert per resident per event: the unique (user, key) pair blocks repeats across ticks and servers. */
export const eventStartKey = (eventId: string) => `event-started:${eventId}`;

const manilaTime = (value: Date) =>
  value.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

/**
 * Tells every resident who joined an event that it is now ongoing, with the step left for them, if any.
 * The alert arrives in the app and as a push notification; tapping it opens the event.
 */
export async function notifyStartedEvents(now = new Date()) {
  const events = await prisma.event.findMany({
    where: {
      isPublished: true,
      startDatetime: { lte: now, gt: new Date(now.getTime() - LATE_LIMIT_MS) },
      endDatetime: { gt: now },
    },
    select: { id: true, title: true, location: true, endDatetime: true },
    orderBy: { startDatetime: 'asc' },
    take: 50,
  });

  for (const event of events) {
    const key = eventStartKey(event.id);
    // Everyone who joined, whatever their attendance stage; the message says what, if anything, is left to do.
    const registrations = await prisma.eventRegistration.findMany({
      where: {
        eventId: event.id,
        status: { in: ['REGISTERED', 'PENDING_APPROVAL', 'ATTENDED', 'REWARD_CLAIMED'] },
        user: { status: 'active', notifications: { none: { notificationKey: key } } },
      },
      select: { userId: true, status: true },
      take: BATCH,
    });
    for (const { userId, status } of registrations) {
      const where = `Your event is happening now at ${event.location}.`;
      const nextStep = status === 'PENDING_APPROVAL'
        ? 'Your attendance photo is waiting for review, so there is nothing more to send.'
        : status === 'ATTENDED'
          ? 'Your attendance is approved. Open the event to claim your reward.'
          : status === 'REWARD_CLAIMED'
            ? 'Your attendance is recorded and your reward is claimed. Thanks for taking part.'
            : `Scan the event QR code and send your attendance photo before it ends at ${manilaTime(event.endDatetime)}.`;
      await sendDirectNotification({
        userId,
        type: 'event',
        title: `${event.title} has started`,
        message: `${where} ${nextStep}`,
        relatedId: event.id,
        relatedType: 'event',
        priority: 'high',
        notificationKey: key,
      });
    }
  }
}

let timer: NodeJS.Timeout | undefined;
let running = false;
export function startEventStartScheduler() {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await notifyStartedEvents(); }
    catch (error) { console.error('Event start notification tick failed.', error); }
    finally { running = false; }
  };
  void tick();
  timer = setInterval(() => void tick(), CHECK_INTERVAL_MS);
  timer.unref();
}
export function stopEventStartScheduler() { if (timer) clearInterval(timer); timer = undefined; }
