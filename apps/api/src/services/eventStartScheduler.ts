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
 * Tells residents who joined an event, and have not recorded their attendance yet, that it is now ongoing.
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
    // REGISTERED residents have joined but not sent attendance; anyone further along needs no reminder.
    const registrations = await prisma.eventRegistration.findMany({
      where: {
        eventId: event.id,
        status: 'REGISTERED',
        user: { status: 'active', notifications: { none: { notificationKey: key } } },
      },
      select: { userId: true },
      take: BATCH,
    });
    for (const { userId } of registrations) {
      await sendDirectNotification({
        userId,
        type: 'event',
        title: `${event.title} has started`,
        message: `Your event is happening now at ${event.location}. Scan the event QR code and send your attendance photo before it ends at ${manilaTime(event.endDatetime)}.`,
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
