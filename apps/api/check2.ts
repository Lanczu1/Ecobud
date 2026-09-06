import { PrismaClient } from '@prisma/client';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { startOfWeek, addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function test() {
  const now = new Date();
  const challengeTemplates = await prisma.challenge.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gt: now } }] }
      ]
    }
  });

  console.log('Templates found:', challengeTemplates.length);
  
  for (const challenge of challengeTemplates) {
    console.log('Processing:', challenge.title);
    
    const manilaTime = toZonedTime(now, TIMEZONE);
    const mondayManila = startOfWeek(manilaTime, { weekStartsOn: 1 });
    const startDateManila = setMilliseconds(setSeconds(setMinutes(setHours(mondayManila, 0), 0), 0), 0);
    const fridayManila = addDays(startDateManila, 4);
    const endDateManila = setMilliseconds(setSeconds(setMinutes(setHours(fridayManila, 23), 59), 59), 999);
    
    const startDate = fromZonedTime(startDateManila, TIMEZONE);
    const endDate = fromZonedTime(endDateManila, TIMEZONE);
    
    console.log('Cycle dates:', { startDate, endDate });

    // Try finding or creating instance
    let instance = await prisma.challengeInstance.findFirst({
      where: { challengeId: challenge.id, startDate, endDate }
    });
    
    if (!instance) {
      console.log('Creating instance...');
      instance = await prisma.challengeInstance.create({
        data: {
          challengeId: challenge.id,
          startDate,
          endDate,
          status: 'OPEN'
        }
      });
      console.log('Created instance:', instance.id);
    } else {
      console.log('Found instance:', instance.id);
    }
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
