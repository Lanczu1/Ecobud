import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const db = vi.hoisted(() => ({
  swapConversation: { findFirst: vi.fn() },
  swapMessage: { findMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
}));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('./notificationService', () => ({ sendDirectNotification: vi.fn() }));
vi.mock('./supabaseStorageService', () => ({ supabaseStorageService: {} }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: {} }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, _res: any, next: any) => { req.auth = { userId: req.headers['x-user'] ?? 'member', role: 'user' }; next(); },
}));
import { swapService } from './swapService';
import swapRoutes from '../routes/swapRoutes';
import { errorResponder } from '../http/errorResponder';

const app = express();
app.use('/swap', swapRoutes);
app.use(errorResponder);
let rows: any[];
function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'OR') return value.some((branch: any) => matches(row, branch));
    if (value instanceof Date) return +row[key] === +value;
    if (value && typeof value === 'object') return ('lt' in value ? row[key] < value.lt : row[key] > value.gt);
    return row[key] === value;
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  db.swapConversation.findFirst.mockResolvedValue({ id: 'conversation', user1Id: 'member', user2Id: 'other' });
  rows = Array.from({ length: 81 }, (_, index) => ({ id: `m${String(index).padStart(3, '0')}`, swapRequestId: 'conversation', senderId: 'other', timestamp: new Date('2026-10-04T00:00:00Z'), text: String(index), read: false }));
  rows.push({ ...rows[0], id: 'private', swapRequestId: 'another-conversation' });
  db.swapMessage.findMany.mockImplementation(async ({ where, orderBy, take }) => rows.filter(row => matches(row, where)).sort((a, b) => {
    const result = +a.timestamp - +b.timestamp || a.id.localeCompare(b.id);
    return orderBy[0].timestamp === 'asc' ? result : -result;
  }).slice(0, take));
});

describe('bounded conversation messages', () => {
  it('loads latest 40, then older messages with stable ordering for equal timestamps', async () => {
    const first = await request(app).get('/swap/conversations/conversation/messages?paged=1').expect(200);
    expect(first.body.items).toHaveLength(40);
    expect(first.body.items[0].id).toBe('m041');
    rows.push({ ...rows[0], id: 'new', timestamp: new Date('2026-10-04T00:01:00Z') });
    const second = await request(app).get('/swap/conversations/conversation/messages').query({ paged: '1', before: first.body.nextCursor }).expect(200);
    const last = await request(app).get('/swap/conversations/conversation/messages').query({ paged: '1', before: second.body.nextCursor }).expect(200);
    const ids = [...last.body.items, ...second.body.items, ...first.body.items].map(item => item.id);
    expect(ids).toEqual(Array.from({ length: 81 }, (_, index) => `m${String(index).padStart(3, '0')}`));
    expect(last.body.nextCursor).toBeNull();
    expect(db.swapMessage.findMany.mock.calls.every(([query]) => query.take === 41)).toBe(true);
  });

  it('catches up on new messages in bounded ascending pages', async () => {
    const initial = await swapService.fetchMessages('conversation', 'member', 'user');
    rows.push(...Array.from({ length: 61 }, (_, index) => ({ ...rows[0], id: `n${String(index).padStart(3, '0')}`, timestamp: new Date('2026-10-04T00:01:00Z') })));
    const first = await swapService.fetchMessages('conversation', 'member', 'user', { after: initial.newestCursor! });
    const last = await swapService.fetchMessages('conversation', 'member', 'user', { after: first.nextCursor! });
    expect(first.items).toHaveLength(40);
    expect(last.items).toHaveLength(21);
    expect(last.nextCursor).toBeNull();
    expect(new Set([...first.items, ...last.items].map(item => item.id)).size).toBe(61);
  });

  it('preserves the legacy array response while bounding it', async () => {
    const response = await request(app).get('/swap/conversations/conversation/messages').expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(40);
  });

  it.each(['limit=51', 'limit=-1', 'limit=0', 'before=bad!', 'before=e30&after=e30'])('rejects invalid paging: %s', async query => {
    await request(app).get(`/swap/conversations/conversation/messages?${query}`).expect(400);
    expect(db.swapMessage.findMany).not.toHaveBeenCalled();
  });

  it('checks participation before fetching or marking messages read', async () => {
    await request(app).get('/swap/conversations/conversation/messages').set('x-user', 'outsider').expect(403);
    await request(app).patch('/swap/conversations/conversation/read').set('x-user', 'outsider').expect(403);
    expect(db.swapMessage.findMany).not.toHaveBeenCalled();
    expect(db.swapMessage.updateMany).not.toHaveBeenCalled();
  });

  it('rejects nonexistent conversations for reads and sends', async () => {
    db.swapConversation.findFirst.mockResolvedValue(null);
    await request(app).get('/swap/conversations/missing/messages').expect(404);
    await expect(swapService.sendMessage('missing', 'member', 'user', 'hi')).rejects.toMatchObject({ statusCode: 404 });
    expect(db.swapMessage.findMany).not.toHaveBeenCalled();
    expect(db.swapMessage.create).not.toHaveBeenCalled();
  });
});
