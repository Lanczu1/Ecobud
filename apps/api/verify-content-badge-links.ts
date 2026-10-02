import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from './src/prismaClient';
import { contentBadgeWrite, awardContentBadge } from './src/services/contentBadgeService';

const rollback = new Error('ROLLBACK_BADGE_VERIFICATION');
async function verify() {
  const suffix = randomUUID();
  try {
    await prisma.$transaction(async tx => {
      const user = await tx.user.findFirst({ select: { id: true } });
      assert(user, 'A test participant is required.');
      const reward = (type: string) => ({ enabled: true, name: `Verification ${type} ${suffix}`, description: 'Temporary verification reward', iconUrl: 'https://example.com/badge.png', accentColor: '#16A34A' });
      const lesson = await tx.lesson.create({ data: { title: 'Badge verification', description: 'Temporary', content: 'Temporary', category: 'General', badge: contentBadgeWrite(reward('lesson'), 'lesson', true) }, include: { badge: true } });
      assert(lesson.badge);
      const edited = await tx.lesson.update({ where: { id: lesson.id }, data: { badge: contentBadgeWrite({ ...reward('lesson'), description: 'Updated description' }, 'lesson') }, include: { badge: true } });
      assert.equal(edited.badge?.id, lesson.badge.id);
      assert.equal((await awardContentBadge(tx, 'lesson', lesson.id, [user.id])).length, 1);
      assert.equal((await awardContentBadge(tx, 'lesson', lesson.id, [user.id])).length, 0);
      await tx.lesson.update({ where: { id: lesson.id }, data: { badge: contentBadgeWrite({ ...reward('lesson'), enabled: false }, 'lesson') } });
      assert.equal(await tx.userBadge.count({ where: { userId: user.id, badgeId: lesson.badge.id } }), 1);
      assert.equal((await awardContentBadge(tx, 'lesson', lesson.id, [user.id])).length, 0);
      const challenge = await tx.challenge.create({ data: { title: 'Badge verification', description: 'Temporary', difficulty: 'Easy', aiDetectionTargets: [], badge: contentBadgeWrite(reward('challenge'), 'challenge', true) } });
      const event = await tx.event.create({ data: { title: 'Badge verification', description: 'Temporary', location: 'Temporary', startDatetime: new Date(), endDatetime: new Date(), capacity: 1, managedById: user.id, badge: contentBadgeWrite(reward('event'), 'event', true) } });
      const exchange = await tx.swapListing.create({ data: { title: 'Badge verification', userId: user.id, category: 'others', quantity: '1', condition: 'good', lookingFor: 'giveaway', meetupMethod: 'public', badge: contentBadgeWrite(reward('exchange'), 'exchange', true) } });
      for (const [type, id] of [['challenge', challenge.id], ['event', event.id], ['exchange', exchange.id]]) assert.equal((await awardContentBadge(tx, type, id, [user.id])).length, 1);
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log('PASS: all four links, same badge on edit, single award per user, disabled rewards, and preserved earned history. Test writes rolled back.');
}
verify().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
