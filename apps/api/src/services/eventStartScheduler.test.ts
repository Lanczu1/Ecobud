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
    vi.mocked(prisma.eventRegistration.findMany).mockReset().mockResolvedValue([
      { userId: 'u1', status: 'REGISTERED' },
      { userId: 'u2', status: 'PENDING_APPROVAL' },
      { userId: 'u3', status: 'ATTENDED' },
      { userId: 'u4', status: 'REWARD_CLAIMED' },
    ] as any);
    vi.mocked(sendDirectNotification).mockReset();
  });

  it('looks only at published events that started within the last hour and have not ended', async () => {
    await notifyStartedEvents(now);
    const where = vi.mocked(prisma.event.findMany).mock.calls[0][0]!.where as any;
    expect(where.isPublished).toBe(true);
    expect(where.startDatetime).toEqual({ lte: now, gt: new Date(now.getTime() - 60 * minute) });
    expect(where.endDatetime).toEqual({ gt: now });
  });

  it('alerts every resident who joined, at any attendance stage, once each', async () => {
    await notifyStartedEvents(now);
    const where = vi.mocked(prisma.eventRegistration.findMany).mock.calls[0][0]!.where as any;
    expect(where).toEqual({
      eventId: 'e1',
      status: { in: ['REGISTERED', 'PENDING_APPROVAL', 'ATTENDED', 'REWARD_CLAIMED'] },
      user: { status: 'active', notifications: { none: { notificationKey: eventStartKey('e1') } } },
    });
    expect(sendDirectNotification).toHaveBeenCalledTimes(4);
    expect(sendDirectNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', type: 'event', relatedId: 'e1', relatedType: 'event', priority: 'high', notificationKey: 'event-started:e1',
      title: 'River cleanup has started',
      message: expect.stringMatching(/Bucal river bank.*Scan the event QR code/),
    }));
  });

  it('tells a resident whose photo awaits review that there is nothing more to send', async () => {
    await notifyStartedEvents(now);
    expect(sendDirectNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u2', notificationKey: 'event-started:e1',
      message: expect.stringMatching(/waiting for review/),
    }));
    expect(vi.mocked(sendDirectNotification).mock.calls[1][0].message).not.toMatch(/Scan the event QR code/);
  });

  it('tells approved residents to claim their reward, and those who claimed it that they are done', async () => {
    await notifyStartedEvents(now);
    const messages = Object.fromEntries(vi.mocked(sendDirectNotification).mock.calls.map(([call]) => [call.userId, call.message]));
    expect(messages.u3).toMatch(/approved\. Open the event to claim your reward/);
    expect(messages.u4).toMatch(/reward is claimed/);
    for (const id of ['u3', 'u4']) expect(messages[id]).not.toMatch(/Scan the event QR code/);
  });

  it('sends nothing when no event has just started', async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    await notifyStartedEvents(now);
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });
});
