import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from './src/prismaClient';
import { awardMilestoneBadges, badgeMilestoneProgress } from './src/services/badgeMilestoneService';

async function verify() {
  const rules = await prisma.badge.findMany({ where: { name: { in: ['Eco Learning Explorer', 'Eco Knowledge Builder', 'Eco Action Achiever', 'Community Regular', 'Swap Partner'] } }, select: { name: true, awardType: true, targetCount: true, bonusPoints: true } });
  console.log('Configured milestones:', rules);
  const rollback = new Error('ROLLBACK_MILESTONE_VERIFICATION');
  try {
    await prisma.$transaction(async tx => {
      const user = await tx.user.findFirst({ select: { id: true } });
      assert(user);
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      const start = await badgeMilestoneProgress(tx, user.id);
      const badge = await tx.badge.create({ data: { name: `Verification ${randomUUID()}`, description: 'Temporary', iconUrl: 'https://example.com/badge.png', requiredPoints: 2147483647, awardType: 'lessons_completed', targetCount: start.lessons_completed + 5, bonusPoints: 50 } });
      for (let i = 1; i <= 5; i++) {
        const lesson = await tx.lesson.create({ data: { title: 'Temporary verification lesson', description: 'Temporary', content: 'Temporary', category: 'General' } });
        await tx.userLessonProgress.create({ data: { userId: user.id, lessonId: lesson.id, status: 'completed', progress: 100, completedAt: new Date() } });
        const awarded = await awardMilestoneBadges(tx, user.id);
        assert.equal(awarded.badges.some(item => item.id === badge.id), i === 5);
      }
      assert.equal((await awardMilestoneBadges(tx, user.id)).badges.some(item => item.id === badge.id), false);
      assert.equal(await tx.userBadge.count({ where: { userId: user.id, badgeId: badge.id } }), 1);
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log('PASS: real database counts, fifth-lesson award, no duplicate award. All verification writes rolled back.');
}
verify().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
