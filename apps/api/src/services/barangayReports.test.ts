import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import ExcelJS from 'exceljs';

const db = vi.hoisted(() => {
  const count = () => ({ count: vi.fn().mockResolvedValue(0) });
  return {
    user: count(), announcement: { ...count(), findMany: vi.fn().mockResolvedValue([]) },
    challengeSubmission: count(), userChallenge: count(), event: { ...count(), findUnique: vi.fn() },
    eventRegistration: count(), eventSubmission: count(), userLessonProgress: count(),
    rewardTransaction: { groupBy: vi.fn().mockResolvedValue([]) }, userBadge: count(), swapListing: count(), swapRequest: count(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
});
vi.mock('../prismaClient', () => ({ prisma: db }));
import { authorizeEventReport, getBarangayReport, reportPeriod, reportScope } from './barangayReports';
import { BARANGAYS } from '../utils/announcementBarangays';
import { barangayReportRoutes } from '../routes/barangayReportRoutes';
import { errorResponder } from '../http/errorResponder';

const moderator = { role: 'moderator', city: 'Yukos' };
const now = new Date('2026-10-03T00:00:00Z');
const app = express();
app.use((req: any, _res, next) => { req.auth = { ...moderator, role: req.headers['x-role'] ?? 'moderator', city: req.headers['x-city'] ?? 'Yukos' }; next(); });
app.use('/reports', barangayReportRoutes);
app.use(errorResponder);

describe('barangay report isolation and exports', () => {
  beforeEach(() => { vi.clearAllMocks(); db.event.findUnique.mockResolvedValue({ barangay: 'Yukos' }); });
  it('enforces all 52 assigned barangays and rejects missing assignments and scope overrides', () => {
    expect(BARANGAYS).toHaveLength(52);
    for (const city of BARANGAYS) expect(reportScope({ role: 'moderator', city: ` ${city.toLowerCase()} ` })).toBe(city);
    expect(() => reportScope(moderator, 'Abo')).toThrow('assigned barangay');
    expect(() => reportScope(moderator, 'all')).toThrow('assigned barangay');
    expect(() => reportScope({ role: 'moderator', city: null })).toThrow('needs an assigned');
    expect(() => reportScope({ role: 'user', city: 'Yukos' })).toThrow('moderator access');
    expect(reportScope({ role: 'admin' })).toBeNull();
    expect(reportScope({ role: 'admin' }, 'Abo')).toBe('Abo');
    expect(() => reportScope({ role: 'admin' }, ['Abo'])).toThrow('valid barangay');
  });
  it('uses inclusive PHT dates and rejects impossible dates, reversed and excessive ranges', () => {
    const period = reportPeriod({ from: '2026-10-01', to: '2026-10-03' }, now);
    expect(period.range.gte.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(period.range.lt.toISOString()).toBe('2026-10-03T16:00:00.000Z');
    expect(reportPeriod({}, new Date('2026-09-30T18:00:00Z')).from).toBe('2026-10-01');
    for (const query of [{ from: '2026-02-30' }, { from: '2026-11-01', to: '2026-10-01' }, { from: '2024-01-01', to: '2026-10-03' }]) expect(() => reportPeriod(query, now)).toThrow();
  });
  it('applies resident, event and announcement scope to every report data source', async () => {
    db.rewardTransaction.groupBy.mockResolvedValueOnce([{ type: 'exp', _sum: { amount: 15 } }, { type: 'eco_coins', _sum: { amount: 4 } }]);
    db.$queryRaw.mockResolvedValueOnce([{ status: 'claimed', count: 2n }]);
    const result = await getBarangayReport(moderator, { from: '2026-10-01', to: '2026-10-03' }, now);
    const user = { role: 'user', profile: { city: { equals: 'Yukos', mode: 'insensitive' } } };
    expect(db.user.count.mock.calls[0][0].where).toEqual(user);
    for (const model of [db.challengeSubmission, db.userChallenge, db.userLessonProgress, db.userBadge, db.swapListing]) {
      for (const [args] of model.count.mock.calls) expect(args.where.user).toEqual(user);
    }
    for (const model of [db.eventRegistration, db.eventSubmission]) for (const [args] of model.count.mock.calls) expect(args.where.event).toEqual({ barangay: 'Yukos' });
    expect(db.event.count.mock.calls[0][0].where.barangay).toBe('Yukos');
    expect(db.rewardTransaction.groupBy.mock.calls[0][0].where).toMatchObject({ user, amount: { gt: 0 } });
    expect(db.swapRequest.count.mock.calls[0][0].where.OR).toEqual([{ fromUser: user }, { toUser: user }]);
    const sql = db.$queryRaw.mock.calls[0][0];
    expect(sql.values).toContain('Yukos');
    expect(sql.sql).toContain('u.role');
    expect(db.announcement.findMany.mock.calls[0][0].where.AND).toContainEqual({ OR: [{ targetAudience: 'All Residents' }, { barangays: { has: 'Yukos' } }] });
    expect(result.sections.slice(0, 2).map(s => s.title)).toEqual(['Barangay Overview', 'Announcements']);
    expect(result.sections.find(s => s.title === 'Rewards & Badges')?.metrics['Eco Points awarded']).toBe(15);
    expect(result.sections.find(s => s.title === 'Redeem Requests')?.metrics.claimed).toBe(2);
  });
  it('blocks cross-barangay requests in JSON, PDF and Excel before database aggregation', async () => {
    for (const path of ['/reports', '/reports/pdf', '/reports/excel']) {
      await request(app).get(`${path}?barangay=Abo`).expect(403);
      await request(app).get(`${path}?barangay=all`).expect(403);
      await request(app).get(path).set('x-city', 'Unknown').expect(403);
      await request(app).get(`${path}?from=2026-02-30`).expect(400);
    }
    expect(db.user.count).not.toHaveBeenCalled();
  });
  it('counts redeem requests using a database join without including other barangays or moderator accounts', async () => {
    await getBarangayReport(moderator, { from: '2026-10-01', to: '2026-10-03' }, now);
    const sql = db.$queryRaw.mock.calls[0][0];
    const pg = new PGlite();
    try {
      await pg.exec(`CREATE TABLE users(id text PRIMARY KEY, role text);
        CREATE TABLE "Profile"("userId" text, city text);
        CREATE TABLE redeem_requests(user_id text, status text, created_at timestamptz);
        INSERT INTO users VALUES ('own','user'),('other','user'),('mod','moderator');
        INSERT INTO "Profile" VALUES ('own','yukos'),('other','Abo'),('mod','Yukos');
        INSERT INTO redeem_requests VALUES ('own','claimed','2026-10-02'),('other','claimed','2026-10-02'),('mod','claimed','2026-10-02'),('own','pending','2026-09-01');`);
      const result = await pg.query<{ status: string; count: number }>(sql.text, sql.values);
      expect(result.rows).toEqual([{ status: 'claimed', count: 1 }]);
    } finally { await pg.close(); }
  }, 15000);
  it('generates real PDF and Excel documents with the same authorized scope', async () => {
    const binary = (res: NodeJS.ReadableStream, callback: (error: Error | null, body: Buffer) => void) => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    };
    const json = await request(app).get('/reports?from=2026-10-01&to=2026-10-03').expect(200);
    expect(json.body.barangay).toBe('Yukos');
    const pdf = await request(app).get('/reports/pdf?from=2026-10-01&to=2026-10-03').buffer(true).parse(binary).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('Yukos-2026-10-01-2026-10-03.pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    const excel = await request(app).get('/reports/excel?from=2026-10-01&to=2026-10-03').buffer(true).parse(binary).expect(200);
    expect(excel.headers['content-type']).toContain('spreadsheetml');
    expect(excel.headers['content-disposition']).toContain('Yukos-2026-10-01-2026-10-03.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excel.body);
    expect(workbook.getWorksheet('Barangay Report')?.getCell('B2').value).toBe('Yukos');
    expect(workbook.worksheets.map(sheet => sheet.name)).toContain('Announcements (latest 20)');
  });
  it('allows admins to aggregate all barangays or select a specific barangay', async () => {
    await request(app).get('/reports?barangay=Abo').set('x-role', 'admin').expect(200);
    expect(db.user.count.mock.calls[0][0].where.profile.city.equals).toBe('Abo');
    vi.clearAllMocks();
    const result = await getBarangayReport({ role: 'admin' }, {}, now);
    expect(result.barangays).toHaveLength(52);
    expect(db.user.count.mock.calls[0][0].where).toEqual({ role: 'user' });
  });
  it('restricts existing event report endpoints to events in the assigned barangay', async () => {
    await expect(authorizeEventReport(moderator, 'own-event')).resolves.toBeUndefined();
    db.event.findUnique.mockResolvedValueOnce({ barangay: 'Abo' });
    await expect(authorizeEventReport(moderator, 'other-event')).rejects.toThrow('assigned barangay');
    db.event.findUnique.mockResolvedValueOnce({ barangay: null });
    await expect(authorizeEventReport(moderator, 'global-event')).rejects.toThrow('assigned barangay');
    db.event.findUnique.mockResolvedValueOnce(null);
    await expect(authorizeEventReport(moderator, 'missing')).rejects.toThrow('not found');
    await expect(authorizeEventReport({ role: 'admin' }, 'other-event')).resolves.toBeUndefined();
  });
});
