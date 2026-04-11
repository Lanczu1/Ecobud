import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../src/security/passwordService';
import { TransparencyHasher } from '../src/utils/transparencyHasher';

const prisma = new PrismaClient();

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const createLogRecord = (
  previousHash: string,
  userId: string,
  actionType: string,
  pointsAwarded: number,
  timestamp: Date,
) => {
  const currentHash = TransparencyHasher.generateBlockHash(
    {
      userId,
      actionType,
      pointsAwarded,
      metadata: JSON.stringify({ seeded: true }),
      timestamp: timestamp.toISOString(),
    },
    previousHash,
  );

  return {
    userId,
    actionType,
    publicLabel: TransparencyHasher.anonymizeUserForPublicBoard(userId),
    pointsAwarded,
    metadata: JSON.stringify({ seeded: true }),
    previousHash,
    currentHash,
    timestamp,
  };
};

async function main() {
  await prisma.habitCheckIn.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.userChallenge.deleteMany();
  await prisma.userLessonProgress.deleteMany();
  await prisma.transparencyLog.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.habit.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const [adminPassword, memberPassword, moderatorPassword] = await Promise.all([
    PasswordService.hash('admin12345'),
    PasswordService.hash('eco12345'),
    PasswordService.hash('moderator123'),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@ecobud.app',
      passwordHash: adminPassword,
      role: 'ADMIN',
      profile: {
        create: {
          displayName: 'EcoBud Admin',
          headline: 'Keeping the platform green and verified.',
          city: 'Manila',
        },
      },
    },
  });

  const moderator = await prisma.user.create({
    data: {
      email: 'moderator@ecobud.app',
      passwordHash: moderatorPassword,
      role: 'MODERATOR',
      points: 410,
      currentStreak: 9,
      highestStreak: 15,
      lastActionDate: new Date(),
      profile: {
        create: {
          displayName: 'Mila Green',
          headline: 'Community event moderator.',
          city: 'Quezon City',
        },
      },
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'lanczu@ecobud.app',
      passwordHash: memberPassword,
      role: 'USER',
      points: 530,
      currentStreak: 12,
      highestStreak: 12,
      lastActionDate: new Date(),
      profile: {
        create: {
          displayName: 'Lanczu',
          headline: 'Turning daily habits into measurable impact.',
          city: 'Manila',
          preferencesJson: JSON.stringify({
            reminders: true,
            theme: 'eco-light',
          }),
        },
      },
    },
  });

  const badgeData = [
    ['Waste Warrior', 'Unlock for reducing daily waste.', 'https://cdn-icons-png.flaticon.com/512/2909/2909762.png', 150, '#22C55E'],
    ['Energy Saver', 'Complete energy-saving activities.', 'https://cdn-icons-png.flaticon.com/512/159/159604.png', 200, '#FACC15'],
    ['Water Wise', 'Build mindful water-use habits.', 'https://cdn-icons-png.flaticon.com/512/3105/3105807.png', 180, '#38BDF8'],
    ['Carbon Champion', 'Finish multiple low-carbon actions.', 'https://cdn-icons-png.flaticon.com/512/4814/4814306.png', 220, '#16A34A'],
    ['Tree Hugger', 'Reach the next impact tier.', 'https://cdn-icons-png.flaticon.com/512/628/628324.png', 300, '#84CC16'],
    ['Recycle Pro', 'Show long-term recycling consistency.', 'https://cdn-icons-png.flaticon.com/512/5014/5014050.png', 350, '#22C55E'],
    ['Sustainability Star', 'Earn top-tier eco credibility.', 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png', 400, '#EAB308'],
  ] as const;

  const badges = await Promise.all(
    badgeData.map(([name, description, iconUrl, requiredPoints, accentColor]) =>
      prisma.badge.create({
        data: { name, description, iconUrl, requiredPoints, accentColor },
      }),
    ),
  );

  const lessons = await Promise.all(
    [
      {
        title: 'Introduction to Composting',
        summary: 'Learn how kitchen scraps can become nutrient-rich compost.',
        content:
          'Composting starts with a healthy balance of green materials like peels and coffee grounds, and brown materials like dry leaves or cardboard. Keep the pile slightly moist and turn it once a week for airflow.',
        category: 'Composting',
        imageUrl:
          'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=80',
        durationMinutes: 8,
        rating: 4.8,
        pointsReward: 20,
        featured: true,
      },
      {
        title: 'Waste Management Basics',
        summary: 'Sort waste better and understand the difference between recyclable and residual materials.',
        content:
          'Start by separating biodegradable, recyclable, residual, and hazardous waste. Clear labels and small family routines help reduce contamination and improve recycling outcomes.',
        category: 'Waste',
        imageUrl:
          'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80',
        durationMinutes: 6,
        rating: 4.7,
        pointsReward: 15,
        featured: true,
      },
      {
        title: 'Solar Energy for Beginners',
        summary: 'Discover the basics of rooftop solar and community solar benefits.',
        content:
          'Solar panels convert sunlight into electricity through photovoltaic cells. Even if you cannot install a full system, small solar habits and community programs can reduce your footprint.',
        category: 'Energy',
        imageUrl:
          'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
        durationMinutes: 10,
        rating: 4.9,
        pointsReward: 18,
        featured: true,
      },
      {
        title: 'Blockchain for Sustainability',
        summary: 'See how transparent ledgers can verify positive environmental actions.',
        content:
          'ECOBUD uses a blockchain-inspired chain of hashes to make every verified reward auditable. Each entry links to the previous record so tampering becomes easy to detect.',
        category: 'Transparency',
        imageUrl:
          'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
        durationMinutes: 9,
        rating: 4.6,
        pointsReward: 15,
        featured: false,
      },
    ].map((lesson) => prisma.lesson.create({ data: lesson })),
  );

  const challenges = await Promise.all(
    [
      {
        title: '7-Day Waste Segregation Challenge',
        description: 'Segregate waste daily and upload proof or tick the daily checklist.',
        difficulty: 'EASY',
        category: 'Waste',
        durationDays: 7,
        pointsReward: 20,
        imageUrl:
          'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80',
        badgeLabel: 'Clean Start',
      },
      {
        title: 'Energy Saver Challenge',
        description: 'Track your energy use and reduce it by 10 percent over two weeks.',
        difficulty: 'MEDIUM',
        category: 'Energy',
        durationDays: 14,
        pointsReward: 50,
        imageUrl:
          'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
        badgeLabel: 'Power Down',
      },
      {
        title: 'Plant-Based Meal Week',
        description: 'Eat plant-based meals for seven days and reflect on your footprint.',
        difficulty: 'HARD',
        category: 'Food',
        durationDays: 7,
        pointsReward: 30,
        imageUrl:
          'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
        badgeLabel: 'Green Plate',
      },
    ].map((challenge) => prisma.challenge.create({ data: challenge })),
  );

  const habits = await Promise.all(
    [
      ['used-reusable-water-bottle', 'Used reusable water bottle', 5],
      ['walked-instead-of-using-motorbike', 'Walked instead of using motorbike', 3],
      ['reused-container', 'Reused container', 2],
      ['ate-plant-based-meal', 'Ate plant-based meal', 5],
      ['refused-single-use-plastic', 'Refused single-use plastic', 5],
    ].map(([slug, title, pointsReward]) =>
      prisma.habit.create({
        data: {
          slug,
          title,
          pointsReward,
        },
      }),
    ),
  );

  const events = await Promise.all(
    [
      {
        title: 'City Park Clean-up Drive',
        description: 'Join volunteers to restore a busy urban park and collect recyclable waste.',
        location: 'Central Park, Manila',
        date: addDays(5),
        capacity: 120,
        pointsReward: 40,
        adminId: admin.id,
        imageUrl:
          'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
        latitude: 14.5995,
        longitude: 120.9842,
      },
      {
        title: 'Community Tree Planting',
        description: 'Plant native tree seedlings and learn how to care for them after the event.',
        location: 'Riverside Park',
        date: addDays(12),
        capacity: 80,
        pointsReward: 35,
        adminId: admin.id,
        imageUrl:
          'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=80',
        latitude: 14.6091,
        longitude: 121.0223,
      },
      {
        title: 'Beach Cleanup & Recycling Workshop',
        description: 'Help clean the shoreline, then sort and classify collected waste with the ECOBUD team.',
        location: 'Ocean Beach, Batangas',
        date: addDays(18),
        capacity: 140,
        pointsReward: 50,
        adminId: moderator.id,
        imageUrl:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        latitude: 13.7565,
        longitude: 121.0583,
      },
    ].map((event) => prisma.event.create({ data: event })),
  );

  await prisma.userLessonProgress.createMany({
    data: [
      {
        userId: member.id,
        lessonId: lessons[0].id,
        status: 'COMPLETED',
        completedAt: addDays(-6),
      },
      {
        userId: member.id,
        lessonId: lessons[1].id,
        status: 'COMPLETED',
        completedAt: addDays(-5),
      },
      {
        userId: member.id,
        lessonId: lessons[2].id,
        status: 'STARTED',
      },
    ],
  });

  await prisma.userChallenge.createMany({
    data: [
      {
        userId: member.id,
        challengeId: challenges[0].id,
        progressPercentage: 43,
        status: 'IN_PROGRESS',
        expirationDate: addDays(2),
      },
      {
        userId: member.id,
        challengeId: challenges[1].id,
        progressPercentage: 20,
        status: 'IN_PROGRESS',
        expirationDate: addDays(10),
      },
      {
        userId: member.id,
        challengeId: challenges[2].id,
        progressPercentage: 100,
        status: 'COMPLETED',
        completedAt: addDays(-3),
        expirationDate: addDays(1),
      },
    ],
  });

  await prisma.userBadge.createMany({
    data: badges.slice(0, 4).map((badge) => ({
      userId: member.id,
      badgeId: badge.id,
    })),
  });

  await prisma.eventRegistration.createMany({
    data: [
      {
        userId: member.id,
        eventId: events[0].id,
        status: 'REGISTERED',
      },
      {
        userId: member.id,
        eventId: events[1].id,
        status: 'ATTENDED',
        attendedAt: addDays(-2),
      },
    ],
  });

  const recentHabitDays = ['2026-04-04', '2026-04-05', '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09'];
  const checkInData = recentHabitDays.flatMap((dateKey, index) =>
    habits
      .filter((_habit, habitIndex) => habitIndex <= (index % 3) + 1)
      .map((habit) => ({
        userId: member.id,
        habitId: habit.id,
        dateKey,
        pointsAwarded: habit.pointsReward,
      })),
  );

  await prisma.habitCheckIn.createMany({ data: checkInData });

  const logA = createLogRecord(
    'GENESIS_HASH_ECOBUD',
    member.id,
    'Daily habit completed: Used reusable water bottle',
    5,
    addDays(-2),
  );
  const logB = createLogRecord(
    logA.currentHash,
    member.id,
    'Challenge completed: Plant-Based Meal Week',
    30,
    addDays(-1),
  );
  const logC = createLogRecord(
    logB.currentHash,
    moderator.id,
    'Event attended: Community Tree Planting',
    35,
    new Date(),
  );

  await prisma.transparencyLog.createMany({
    data: [logA, logB, logC],
  });

  console.log('ECOBUD seed complete.');
  console.log('Member login: lanczu@ecobud.app / eco12345');
  console.log('Admin login: admin@ecobud.app / admin12345');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
