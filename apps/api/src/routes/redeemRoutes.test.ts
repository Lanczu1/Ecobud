import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';

const { db } = vi.hoisted(() => ({ db: {
  $transaction: vi.fn(),
  redeemItem: { findUnique: vi.fn(), updateMany: vi.fn() },
  redeemRequest: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  userStats: { updateMany: vi.fn() },
  user: { findUnique: vi.fn() },
  rewardTransaction: { create: vi.fn() },
} }));
vi.mock('@prisma/client', async (original) => ({
  ...await original<object>(), PrismaClient: class { constructor() { return db; } },
}));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, _res: any, next: () => void) => { req.auth = { userId: 'member' }; next(); },
  requireUserAccess: (_req: any, _res: any, next: () => void) => next(),
  requireModeratorAccess: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../http/uploadMiddleware', () => ({ redeemUploadMiddleware: { single: () => (_req: any, _res: any, next: () => void) => next() } }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: {} }));
import router from './redeemRoutes';

const app = express();
app.use(express.json(), router);
const conflict = () => new Prisma.PrismaClientKnownRequestError('Concurrent write', { code: 'P2034', clientVersion: '5.22.0' });

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (run) => run(db));
  db.redeemItem.findUnique.mockResolvedValue({ id: 'item', isActive: true, stock: 1, coinCost: 100, title: 'Reward', imageUrl: null });
  db.redeemRequest.findFirst.mockResolvedValue(null);
  db.redeemRequest.findMany.mockResolvedValue([]);
  db.redeemRequest.count.mockResolvedValue(0);
  db.userStats.updateMany.mockResolvedValue({ count: 1 });
  db.redeemItem.updateMany.mockResolvedValue({ count: 1 });
  db.user.findUnique.mockResolvedValue({ name: 'Member' });
  db.redeemRequest.create.mockResolvedValue({ id: 'request' });
});

describe('redemption reservations', () => {
  it('uses serializable isolation and conditional balance/stock reservations', async () => {
    await request(app).post('/redeem').send({ itemId: 'item' }).expect(201);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(db.userStats.updateMany).toHaveBeenCalledWith({ where: { userId: 'member', ecoCoins: { gte: 100 } }, data: { ecoCoins: { decrement: 100 } } });
    expect(db.redeemItem.updateMany).toHaveBeenCalledWith({ where: { id: 'item', stock: { gt: 0 }, isActive: true }, data: { stock: { decrement: 1 } } });
  });
  it('rechecks duplicate eligibility after a transaction conflict', async () => {
    db.$transaction.mockImplementationOnce(async () => { throw conflict(); });
    db.redeemRequest.findFirst.mockResolvedValue({ id: 'competing-request' });
    const response = await request(app).post('/redeem').send({ itemId: 'item' }).expect(200);
    expect(response.body.alreadyRequested).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(db.redeemRequest.create).not.toHaveBeenCalled();
  });
  it('blocks duplicate requests while an earlier request is awaiting review or pickup', async () => {
    db.redeemRequest.findFirst.mockResolvedValue({ id: 'existing-request', status: 'approved' });
    const response = await request(app).post('/redeem').send({ itemId: 'item' }).expect(200);
    expect(response.body.alreadyRequested).toBe(true);
    expect(db.redeemRequest.findFirst).toHaveBeenCalledWith({
      where: { userId: 'member', itemId: 'item', status: { in: ['pending', 'approved', 'ready_to_claim'] } },
    });
    expect(db.userStats.updateMany).not.toHaveBeenCalled();
  });
  it('bounds retries and returns a recoverable conflict', async () => {
    db.$transaction.mockRejectedValue(conflict());
    await request(app).post('/redeem').send({ itemId: 'item' }).expect(409);
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });
  it.each(['balance', 'stock'])('rejects a failed %s reservation without creating a request', async (resource) => {
    (resource === 'balance' ? db.userStats : db.redeemItem).updateMany.mockResolvedValue({ count: 0 });
    await request(app).post('/redeem').send({ itemId: 'item' }).expect(400);
    expect(db.redeemRequest.create).not.toHaveBeenCalled();
    expect(db.rewardTransaction.create).not.toHaveBeenCalled();
  });
  it('preserves unlimited stock', async () => {
    db.redeemItem.findUnique.mockResolvedValue({ id: 'item', isActive: true, stock: -1, coinCost: 100 });
    await request(app).post('/redeem').send({ itemId: 'item' }).expect(201);
    expect(db.redeemItem.updateMany).not.toHaveBeenCalled();
  });
});

describe('admin redemption request filters', () => {
  it('lists claimed requests in the archive filter', async () => {
    await request(app).get('/requests?status=claimed').expect(200);
    expect(db.redeemRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'claimed' } }));
    expect(db.redeemRequest.count).toHaveBeenCalledWith({ where: { status: 'claimed' } });
  });

  it('excludes claimed requests from the active filter', async () => {
    await request(app).get('/requests?status=active').expect(200);
    expect(db.redeemRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: { not: 'claimed' } } }));
    expect(db.redeemRequest.count).toHaveBeenCalledWith({ where: { status: { not: 'claimed' } } });
  });
});

describe('request deletion', () => {
  it.each(['pending', 'approved', 'ready_to_claim'])('preserves %s requests', async (status) => {
    db.redeemRequest.deleteMany.mockImplementation(async ({ where }) => ({ count: where.status.in.includes(status) ? 1 : 0 }));
    const result = await request(app).delete('/requests/request').expect(409);
    expect(result.body.message).toContain('refund coins');
  });
  it.each(['rejected', 'claimed'])('allows deleting %s requests', async (status) => {
    db.redeemRequest.deleteMany.mockImplementation(async ({ where }) => ({ count: where.status.in.includes(status) ? 1 : 0 }));
    await request(app).delete('/requests/request').expect(204);
  });
});
