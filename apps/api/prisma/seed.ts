import 'dotenv/config';
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
  await prisma.presenceSession.deleteMany();
  await prisma.habitCheckIn.deleteMany();
  await prisma.challengeSubmission.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.userChallenge.deleteMany();
  await prisma.userLessonProgress.deleteMany();
  await prisma.userWeeklyGoal.deleteMany();
  await prisma.userStats.deleteMany();
  await prisma.transparencyLog.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.faq.deleteMany();
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
      name: 'EcoBud Admin',
      email: 'admin@ecobud.app',
      passwordHash: adminPassword,
      role: 'admin',
      status: 'active',
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
      name: 'Mila Green',
      email: 'moderator@ecobud.app',
      passwordHash: moderatorPassword,
      role: 'moderator',
      status: 'active',
      points: 240,
      currentStreak: 3,
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
      name: 'Lanczu',
      email: 'lanczu@ecobud.app',
      passwordHash: memberPassword,
      role: 'user',
      status: 'active',
      points: 120,
      currentStreak: 1,
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

  await prisma.userStats.createMany({
    data: [
      {
        userId: admin.id,
        currentStreak: 0,
        ecoPoints: 0,
        knowledgePoints: 0,
      },
      {
        userId: moderator.id,
        currentStreak: 3,
        ecoPoints: 240,
        knowledgePoints: 35,
      },
      {
        userId: member.id,
        currentStreak: 1,
        ecoPoints: 120,
        knowledgePoints: 60,
      },
    ],
  });

  await prisma.userWeeklyGoal.createMany({
    data: [
      {
        userId: admin.id,
        weeklyGoal: 0,
      },
      {
        userId: moderator.id,
        weeklyGoal: 4,
      },
      {
        userId: member.id,
        weeklyGoal: 5,
      },
    ],
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
        title: 'Waste Management Basics',
        description: 'Learn how to sort, reduce, and handle household waste correctly.',
        content:
          'Waste management starts with separating biodegradable, recyclable, residual, and hazardous waste. Use clearly labelled bins, rinse recyclable containers before disposal, and keep hazardous items like batteries and chemicals away from regular trash. A simple daily routine makes segregation easier and helps keep reusable materials clean enough for recovery.',
        category: 'Waste',
        imageUrl:
          'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80',
        durationMinutes: 6,
        rating: 4.8,
        pointsReward: 15,
        featured: true,
        isPublished: true,
      },
      {
        title: 'Sustainable Living 101',
        description: 'Build everyday habits that lower your environmental impact at home.',
        content:
          'Sustainable living begins with small repeatable actions: carry reusables, choose durable products, reduce energy waste, conserve water, and support local low-impact options when possible. Start with one habit at a time, track what you can maintain each week, and focus on consistency over perfection.',
        category: 'Lifestyle',
        imageUrl:
          'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1200&q=80',
        durationMinutes: 8,
        rating: 4.9,
        pointsReward: 20,
        featured: true,
        isPublished: true,
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

  const habitData = [
    ['used-reusable-water-bottle', 'Used reusable water bottle', 5],
    ['walked-instead-of-using-motorbike', 'Walked instead of using motorbike', 3],
    ['reused-container', 'Reused container', 2],
    ['ate-plant-based-meal', 'Ate plant-based meal', 5],
    ['refused-single-use-plastic', 'Refused single-use plastic', 5],
  ] as const;

  const habits = await Promise.all(
    habitData.map(([slug, title, pointsReward]) =>
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
        managedById: admin.id,
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
        managedById: admin.id,
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
        managedById: moderator.id,
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
        status: 'seen',
        progress: 0,
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

  await prisma.challengeSubmission.createMany({
    data: [
      {
        userId: member.id,
        challengeId: challenges[0].id,
        proofText:
          'Uploaded a daily waste segregation tracker with labeled bins and end-of-day photos.',
        proofUrl: 'https://example.com/proofs/waste-segregation-week.jpg',
        status: 'pending',
      },
      {
        userId: member.id,
        challengeId: challenges[1].id,
        proofText:
          'Submitted meter snapshots and a two-week reduction summary for the energy saver challenge.',
        proofUrl: 'https://example.com/proofs/energy-saver-report.pdf',
        status: 'approved',
        moderatorNotes: 'Evidence is complete and matches the reported reduction.',
        reviewedById: moderator.id,
        reviewedAt: new Date(),
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

  await prisma.faq.createMany({
    data: [
      {
        question: 'Do I need an account to view ECOBUD transparency metrics?',
        answer:
          'No. Guests can browse the landing page, FAQs, and public transparency metrics without signing in.',
        sortOrder: 1,
      },
      {
        question: 'How do challenge proof submissions work?',
        answer:
          'Users can optionally submit proof text or a proof URL for challenges. Moderators and admins can approve, reject, or flag those submissions.',
        sortOrder: 2,
      },
      {
        question: 'Who can create moderators and admins?',
        answer:
          'Only admins can manually create moderator or admin accounts, activate them, or suspend them.',
        sortOrder: 3,
      },
    ],
  });

  await prisma.systemSetting.createMany({
    data: [
      {
        key: 'event.autoAttendanceReward',
        value: 'enabled',
        description: 'Controls whether verified attendance triggers automatic point rewards.',
        updatedById: admin.id,
      },
      {
        key: 'challenge.proofModeration',
        value: 'optional',
        description: 'Defines whether challenge proof moderation is optional, required, or disabled.',
        updatedById: admin.id,
      },
    ],
  });

  console.log('ECOBUD seed complete.');
  console.log('Member login: lanczu@ecobud.app / eco12345');
  console.log('Admin login: admin@ecobud.app / admin12345');
  console.log('Moderator login: moderator@ecobud.app / moderator123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
