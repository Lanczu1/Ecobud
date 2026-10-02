const activationSql = [
  "SET LOCAL lock_timeout = '5s'",
  "SET LOCAL statement_timeout = '30s'",
  'LOCK TABLE public.announcements IN SHARE ROW EXCLUSIVE MODE',
  `INSERT INTO notification_events(key,type,related_id,title,message,available_at,completed)
   SELECT 'announcement_published:'||id,'announcement',id,'New announcement',title,COALESCE("publishAt",CURRENT_TIMESTAMP),true
   FROM announcements WHERE status='Published' OR (status='Scheduled' AND "publishAt"<=CURRENT_TIMESTAMP)
   ON CONFLICT DO NOTHING`,
  `INSERT INTO notification_events(key,type,related_id,title,message,available_at,completed)
   SELECT 'announcement_published:'||a.id,'announcement',a.id,'New announcement',a.title,a."publishAt",false
   FROM announcements a
   WHERE a.status='Scheduled' AND a."publishAt">CURRENT_TIMESTAMP
     AND (a."expiresAt" IS NULL OR a."expiresAt">a."publishAt")
     AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.notification_key='announcement_published:'||a.id)
   ON CONFLICT(key) DO UPDATE SET title=EXCLUDED.title,message=EXCLUDED.message,available_at=EXCLUDED.available_at,completed=false
     WHERE notification_events.completed AND notification_events.cursor IS NULL`,
  'ALTER TABLE public.announcements ENABLE TRIGGER notification_announcement',
];
module.exports = { activationSql };
if (require.main === module) {
  if (!process.argv.includes('--workers-stopped')) {
    console.error('Stop every OLD API worker first. Then run: node scripts/activate-announcement-push.cjs --workers-stopped');
    process.exitCode = 1;
  } else {
    require('dotenv').config({ quiet: true });
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    db.$transaction(async tx => {
      for (const sql of activationSql) await tx.$executeRawUnsafe(sql);
    }, { timeout: 30000 }).then(() => {
      console.log('Announcement push trigger enabled. Future schedules queued; existing publications remain baselined. Start only the UPDATED API workers.');
    }).catch(error => {
      console.error('Announcement push activation failed; transaction rolled back:', error.code || error.name);
      process.exitCode = 1;
    }).finally(() => db.$disconnect());
  }
}

