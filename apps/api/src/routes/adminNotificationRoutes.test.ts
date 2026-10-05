import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { Prisma } from '@prisma/client';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { notificationFixtureSql, adminNotificationMigration } from '../../tests/adminNotificationDb';

const store=vi.hoisted(()=>({ db:null as PGlite | null }));
vi.mock('../prismaClient',()=>({ prisma:{
  $queryRaw:async (first:TemplateStringsArray | Prisma.Sql,...values:unknown[]) => {
    const q=Array.isArray(first) ? Prisma.sql(first as TemplateStringsArray,...values) : first as Prisma.Sql;
    return (await store.db!.query(q.text,q.values)).rows;
  },
  $executeRaw:async (first:TemplateStringsArray | Prisma.Sql,...values:unknown[]) => {
    const q=Array.isArray(first) ? Prisma.sql(first as TemplateStringsArray,...values) : first as Prisma.Sql;
    const result=await store.db!.query(q.text,q.values);
    return result.affectedRows ?? 0;
  },
} }));
vi.mock('../http/authentication',()=>({
  authenticateRequest:(req:any,res:any,next:any) => {
    const id=req.headers.authorization?.replace('Bearer ','');
    if (!id) return res.status(401).json({ message:'Sign in.' });
    req.auth={ userId:id,role:id==='admin' ? 'admin' : id.startsWith('mod-') ? 'moderator' : 'user',
      city:id==='mod-a' ? 'Alibungbungan' : id==='mod-b' ? 'Alumbrado' : null,sessionVersion:0,authTime:Math.floor(Date.now()/1000) };
    next();
  },
  requireModeratorAccess:(req:any,res:any,next:any) => ['admin','moderator'].includes(req.auth.role) ? next() : res.status(403).json({ message:'Restricted.' }),
}));
import { adminNotificationRoutes } from './adminNotificationRoutes';
import { errorResponder } from '../http/errorResponder';
const app=express(); app.use(express.json()); app.use('/notifications',adminNotificationRoutes); app.use(errorResponder);
beforeAll(async()=>{
  store.db=new PGlite({ parsers:{ 1114:value=>new Date(`${value.replace(' ','T')}Z`) } }); await store.db.exec(notificationFixtureSql); await store.db.exec(adminNotificationMigration);
  await store.db.exec(`INSERT INTO id_verification_submissions(id,user_id,barangay,status) VALUES('id-b','resident-b','Alumbrado','pending');
    INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,available_at)
      SELECT 'pagination-'||n,'event','Fixture update','Test only','event','event-'||n,ARRAY['Alibungbungan'],now()-n*interval '1 minute' FROM generate_series(1,33) n;`);
},30000);
afterAll(()=>store.db?.close());
describe.sequential('scoped admin inbox API',()=>{
  let aId:string; let bId:string;
  it('requires sign-in and staff roles',async()=>{
    expect((await request(app).get('/notifications')).status).toBe(401);
    expect((await request(app).get('/notifications').set('Authorization','Bearer resident-a')).status).toBe(403);
  });
  it('returns each moderator only their barangay, with server unread counts',async()=>{
    const a=await request(app).get('/notifications?category=verification').set('Authorization','Bearer mod-a');
    const b=await request(app).get('/notifications').set('Authorization','Bearer mod-b');
    expect(a.status).toBe(200); expect(a.body.items.map((r:any)=>r.recordId)).toEqual(['existing']);
    expect(b.body.items.map((r:any)=>r.recordId)).toEqual(['id-b']);
    expect(b.body.unreadCount).toBe(1); aId=a.body.items[0].id; bId=b.body.items[0].id;
    const unassigned=await request(app).get('/notifications').set('Authorization','Bearer mod-unassigned');
    expect(unassigned.body.items).toEqual([]); expect(unassigned.body.unreadCount).toBe(0);
  });
  it('rejects detail and mark-read for another barangay, and parameterizes untrusted ids',async()=>{
    expect((await request(app).get(`/notifications/${bId}`).set('Authorization','Bearer mod-a')).status).toBe(404);
    expect((await request(app).patch(`/notifications/${bId}/read`).set('Authorization','Bearer mod-a')).status).toBe(404);
    expect((await request(app).get(`/notifications/${encodeURIComponent("' OR 1=1 --")}`).set('Authorization','Bearer mod-a')).status).toBe(404);
  });
  it('marks all read only within current scope and preserves needs-action status',async()=>{
    expect((await request(app).patch('/notifications/read-all').set('Authorization','Bearer mod-a')).status).toBe(200);
    const a=await request(app).get('/notifications?filter=action').set('Authorization','Bearer mod-a');
    expect(a.body.items.find((r:any)=>r.id===aId).isRead).toBe(true);
    expect(a.body.items.find((r:any)=>r.id===aId).resolvedAt).toBeNull();
    expect((await request(app).get('/notifications').set('Authorization','Bearer mod-b')).body.unreadCount).toBe(1);
    expect((await request(app).get('/notifications?filter=unread').set('Authorization','Bearer mod-a')).body.items).toEqual([]);
  });
  it('uses stable cursor pagination without duplicates',async()=>{
    const first=await request(app).get('/notifications').set('Authorization','Bearer admin');
    const second=await request(app).get(`/notifications?${new URLSearchParams(first.body.next)}`).set('Authorization','Bearer admin');
    expect(second.status).toBe(200); expect(first.body.next).not.toBeNull();
    expect(first.body.items).toHaveLength(30); expect(second.body.items.length).toBeGreaterThan(0);
    const ids=[...first.body.items,...second.body.items].map((r:any)=>r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('validates settings and keeps preferences private',async()=>{
    const bad=await request(app).put('/notifications/preferences').set('Authorization','Bearer mod-a').send({ pushCategories:['system'],quietStart:25,quietEnd:7 });
    expect(bad.status).toBe(400);
    const saved=await request(app).put('/notifications/preferences').set('Authorization','Bearer mod-a').send({ pushCategories:['verification','system'],quietStart:22,quietEnd:7 });
    expect(saved.status).toBe(200);
    expect((await request(app).get('/notifications/preferences').set('Authorization','Bearer mod-a')).body.pushCategories).toEqual(['verification']);
    expect((await request(app).get('/notifications/preferences').set('Authorization','Bearer mod-b')).body.pushCategories).toEqual([]);
  });
});
