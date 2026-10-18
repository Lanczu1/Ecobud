import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../prismaClient', () => ({ prisma: { event: { findMany: vi.fn() }, eventRegistration: { findMany: vi.fn() } } }));
vi.mock('./notificationService', () => ({ sendDirectNotification: vi.fn() }));

import { prisma } from '../prismaClient';
import { sendDirectNotification } from './notificationService';
import { eventStartKey, notifyStartedEvents } from './eventStartScheduler';

const now = new Date('2026-10-20T01:00:00Z');
const minute = 60_000;
const cleanup = { id: 'e1', title: 'River cleanup', location: 'Bucal river bank', endDatetime: new Date(now.getTime() + 120 * minute) };

describe('event start notifications', () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findMany).mockReset().mockResolvedValue([cleanup] as any);
    vi.mocked(prisma.eventRegistration.findMany).mockReset().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }] as any);
    vi.mocked(sendDirectNotification).mockReset();
  });

  it('looks only at published events that started within the last hour and have not ended', async () => {
    await notifyStartedEvents(now);
    const where = vi.mocked(prisma.event.findMany).mock.calls[0][0]!.where as any;
    expect(where.isPublished).toBe(true);
    expect(where.startDatetime).toEqual({ lte: now, gt: new Date(now.getTime() - 60 * minute) });
    expect(where.endDatetime).toEqual({ gt: now });
  });

  it('alerts joined residents who have not recorded attendance and were not alerted already', async () => {
    await notifyStartedEvents(now);
    const where = vi.mocked(prisma.eventRegistration.findMany).mock.calls[0][0]!.where as any;
    expect(where).toEqual({ eventId: 'e1', status: 'REGISTERED', user: { status: 'active', notifications: { none: { notificationKey: eventStartKey('e1') } } } });
    expect(sendDirectNotification).toHaveBeenCalledTimes(2);
    expect(sendDirectNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', type: 'event', relatedId: 'e1', relatedType: 'event', priority: 'high', notificationKey: 'event-started:e1',
      title: 'River cleanup has started',
      message: expect.stringContaining('Bucal river bank'),
    }));
  });

  it('sends nothing when no event has just started', async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    await notifyStartedEvents(now);
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });
});
