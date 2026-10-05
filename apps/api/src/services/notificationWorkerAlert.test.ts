import { describe, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({ transaction:vi.fn(),query:vi.fn(),execute:vi.fn(),failure:vi.fn(),recovery:vi.fn() }));
vi.mock('../prismaClient',()=>({ prisma:{ $transaction:mock.transaction,$queryRaw:mock.query,$executeRaw:mock.execute } }));
vi.mock('./adminPushService',()=>({ recordAdminWorkerFailure:mock.failure,resolveAdminWorkerFailure:mock.recovery }));
vi.mock('../lib/firebaseMessaging',()=>({ firebaseMessaging:{} }));
vi.mock('./supabaseRealtimeService',()=>({ supabaseRealtimeService:{} }));
import { notificationTick } from './notificationService';
describe('resident publication worker admin alerts',()=>{
  it('records a processing failure and resolves it once after a successful tick',async()=>{
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    try {
      mock.transaction.mockRejectedValueOnce(new Error('Fixture worker unavailable'));
      await notificationTick();
      expect(mock.failure).toHaveBeenCalledWith('resident-notifications');
      mock.query.mockResolvedValue([]); mock.execute.mockResolvedValue(1);
      mock.transaction.mockImplementation(async callback=>callback({ $queryRaw:mock.query }));
      await notificationTick(); await notificationTick();
      expect(mock.recovery).toHaveBeenCalledTimes(1); expect(mock.recovery).toHaveBeenCalledWith('resident-notifications');
    } finally { log.mockRestore(); }
  });
});
