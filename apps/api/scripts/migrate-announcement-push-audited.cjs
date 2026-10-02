require('dotenv').config({quiet:true});
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const migration='20261002020000_announcement_notifications';
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const inventorySql=`SELECT jsonb_build_object(
'columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name,ordinal_position) FROM information_schema.columns c WHERE table_schema='public'),
'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conrelid::regclass::text,c.conname) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'),
'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY tablename,indexname) FROM pg_indexes i WHERE schemaname='public' AND indexname NOT IN ('notification_events_ready','announcements_barangays_gin','announcements_feed_order')),
'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname<>'notification_announcement'),
'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public'),
'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'acl',c.relacl) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')),
'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p') AND p.proname<>'ecobud_announcement_notification')
) AS inventory`;
async function snapshot(){
 const [schema,announcements,history]=await Promise.all([
 db.$queryRawUnsafe(inventorySql),
 db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5(row_to_json(a)::text),'' ORDER BY a.id),'')) AS fingerprint FROM announcements a`),
 db.$queryRawUnsafe(`SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" WHERE migration_name<>$1 ORDER BY migration_name`,migration)
 ]);
 return {schemaHash:hash(schema[0].inventory),announcements:announcements[0],existingMigrationHistoryHash:hash(history)};
}
(async()=>{
 const local=fs.readdirSync('prisma/migrations').filter(x=>fs.existsSync(path.join('prisma/migrations',x,'migration.sql')));
 const applied=await db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at FROM "_prisma_migrations"');
 const failures=applied.filter(x=>!x.finished_at&&!x.rolled_back_at);
 const done=new Set(applied.filter(x=>x.finished_at&&!x.rolled_back_at).map(x=>x.migration_name));
 const pending=local.filter(x=>!done.has(x));
 if(failures.length || pending.length!==1 || pending[0]!==migration) throw new Error('Migration preflight rejected: pending history differs from the reviewed scope.');
 const pre=await snapshot();
 const dir=path.resolve('../../docs');
 fs.writeFileSync(path.join(dir,'announcement-push-migration-before.json'),JSON.stringify({checkedAt:new Date().toISOString(),migration,pending,snapshot:pre},null,2));
 console.log('Preflight passed. Only the reviewed announcement migration is pending.');
 const sql=fs.readFileSync(path.join('prisma/migrations',migration,'migration.sql'),'utf8');
 if(!sql.includes('DISABLE TRIGGER notification_announcement')||!sql.trim().endsWith('COMMIT;')) throw new Error('Migration does not match the dormant transactional rollout.');
 const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','npx prisma migrate deploy'],{stdio:'inherit',env:process.env});
 if(result.status!==0) throw new Error('Prisma migration failed. Inspect its transactional result before retrying.');
 const post=await snapshot();
 const triggers=await db.$queryRawUnsafe("SELECT tgname,tgenabled FROM pg_trigger WHERE tgname='notification_announcement' AND tgrelid='public.announcements'::regclass");
 const indexes=await db.$queryRawUnsafe("SELECT tablename,indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('notification_events_ready','announcements_barangays_gin','announcements_feed_order') ORDER BY indexname");
 const queues=await db.$queryRawUnsafe("SELECT count(*)::int AS pending FROM notification_events WHERE type='announcement' AND NOT completed");
 const row=await db.$queryRawUnsafe('SELECT finished_at,rolled_back_at,checksum FROM "_prisma_migrations" WHERE migration_name=$1',migration);
 const verified={unrelatedSchemaUnchanged:pre.schemaHash===post.schemaHash,announcementRowsUnchanged:JSON.stringify(pre.announcements)===JSON.stringify(post.announcements),previousMigrationHistoryUnchanged:pre.existingMigrationHistoryHash===post.existingMigrationHistoryHash,triggerDisabled:triggers.length===1&&triggers[0].tgenabled==='D',expectedIndexesPresent:indexes.length===3,noPendingAnnouncementPush:queues[0].pending===0,migrationFinished:!!row[0]?.finished_at&&!row[0]?.rolled_back_at,migrationChecksumMatches:row[0]?.checksum===crypto.createHash('sha256').update(fs.readFileSync(path.join('prisma/migrations',migration,'migration.sql'))).digest('hex')};
 const report={checkedAt:new Date().toISOString(),migration,before:pre,after:post,verified,indexes,trigger:triggers[0],pendingAnnouncementPush:queues[0].pending};
 fs.writeFileSync(path.join(dir,'announcement-push-migration-audit.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({verified,announcementCount:post.announcements.count,pendingAnnouncementPush:queues[0].pending}));
 if(Object.values(verified).some(x=>!x)) throw new Error('Post-migration verification needs review. See the audit file; no automatic rollback was attempted.');
})().catch(error=>{console.error('Migration audit:',error.code||error.message);process.exitCode=1}).finally(()=>db.$disconnect());

