import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('../prismaClient', () => ({ prisma: {} }));
vi.mock('./GamificationService', () => ({ GamificationService: class {} }));
vi.mock('./userActivityService', () => ({ UserActivityService: class {} }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: {} }));

import { LearnService } from './LearnService';
import { apiCache } from '../lib/cache';

const credits = { videoCreditsEnabled: true, videoCreditsName: '[Test creator]', videoCreditsUrl: 'https://youtu.be/test-video' };
const lesson = {
  id: 'lesson', title: 'Test lesson', description: '', content: '', category: 'General',
  videoUrl: '/video.mp4', imageUrl: null, transcript: 'Test transcript', isPublished: true,
  featured: false, createdAt: new Date(), pointsReward: 10, durationMinutes: 1,
  progress: [], pages: [], quizQuestions: [], _count: { pages: 0, quizQuestions: 0 }, ...credits,
};

describe('mobile lesson credits payloads', () => {
  beforeEach(() => apiCache.clear());

  it('selects and returns credits in the mobile catalog', async () => {
    const findMany = vi.fn().mockResolvedValue([lesson]);
    const service = new LearnService({ lesson: { findMany } } as unknown as PrismaClient);
    expect((await service.getPublishedLessonCatalog('user'))[0]).toMatchObject(credits);
    expect(findMany.mock.calls[0][0].select).toMatchObject({ videoCreditsEnabled: true, videoCreditsName: true, videoCreditsUrl: true });
  });

  it('reads fresh attribution when a lesson is opened again', async () => {
    const findFirst = vi.fn().mockResolvedValueOnce(lesson).mockResolvedValueOnce({ ...lesson, videoCreditsName: '[Updated creator]' });
    const service = new LearnService({ lesson: { findFirst } } as unknown as PrismaClient);
    expect(await service.getPublishedLesson('user', 'lesson')).toMatchObject(credits);
    expect(await service.getPublishedLesson('user', 'lesson')).toMatchObject({ videoCreditsName: '[Updated creator]' });
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ id: 'lesson', OR: [{ isPublished: true }, { scheduledAt: { lte: expect.any(Date) } }] });
  });

  it('returns disabled credits explicitly so old mobile attribution is cleared', async () => {
    const service = new LearnService({ lesson: { findFirst: vi.fn().mockResolvedValue({ ...lesson, videoCreditsEnabled: false, videoCreditsName: null, videoCreditsUrl: null }) } } as unknown as PrismaClient);
    expect(await service.getPublishedLesson('user', 'lesson')).toMatchObject({ videoCreditsEnabled: false, videoCreditsName: null, videoCreditsUrl: null });
  });
});
