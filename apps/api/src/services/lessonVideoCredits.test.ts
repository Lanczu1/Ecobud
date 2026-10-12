import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { parseLessonVideoCredits } from './lessonVideoCredits';

describe('lesson video credits', () => {
  it('preserves credits for updates from older clients that omit the fields', () => {
    expect(parseLessonVideoCredits({ title: 'Lesson' })).toEqual({});
  });

  it('clears credits when disabled', () => {
    expect(parseLessonVideoCredits({ videoCreditsEnabled: 'false', videoCreditsName: 'Old', videoCreditsUrl: 'invalid' }))
      .toEqual({ videoCreditsEnabled: false, videoCreditsName: null, videoCreditsUrl: null });
  });

  it.each(['https://www.youtube.com/watch?v=abc', 'https://youtu.be/abc', 'https://m.youtube.com/watch?v=abc'])('accepts YouTube attribution: %s', url => {
    expect(parseLessonVideoCredits({ videoCreditsEnabled: 'true', videoCreditsName: ' Creator ', videoCreditsUrl: url }))
      .toEqual({ videoCreditsEnabled: true, videoCreditsName: 'Creator', videoCreditsUrl: url });
  });

  it.each(['javascript:alert(1)', 'https://youtube.com.evil.test/abc', 'https://evil.test/youtube.com', 'https://youtube.com@evil.test/', 'not a url', 'https://user:secret@youtube.com/abc'])('rejects invalid attribution URLs: %s', url => {
    expect(() => parseLessonVideoCredits({ videoCreditsEnabled: true, videoCreditsName: 'Creator', videoCreditsUrl: url })).toThrow('valid YouTube link');
  });

  it('rejects enabled credits without a name', () => {
    expect(() => parseLessonVideoCredits({ videoCreditsEnabled: true, videoCreditsName: ' ', videoCreditsUrl: 'https://youtu.be/abc' })).toThrow('credit name');
  });

  it('adds columns without changing existing lesson content or other tables', async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE lessons (id TEXT PRIMARY KEY, transcript TEXT);
        INSERT INTO lessons VALUES ('existing', 'Original transcript');
        CREATE TABLE unrelated (id TEXT PRIMARY KEY);
        INSERT INTO unrelated VALUES ('keep');`);
      await db.exec(readFileSync('prisma/migrations/20261013000000_lesson_video_credits/migration.sql', 'utf8'));
      const lessons = await db.query('SELECT * FROM lessons');
      expect(lessons.rows).toEqual([{ id: 'existing', transcript: 'Original transcript', video_credits_enabled: false, video_credits_name: null, video_credits_url: null }]);
      expect((await db.query('SELECT * FROM unrelated')).rows).toEqual([{ id: 'keep' }]);
    } finally { await db.close(); }
  }, 20000);
});
