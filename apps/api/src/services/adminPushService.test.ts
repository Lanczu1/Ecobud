import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({ query:vi.fn(),execute:vi.fn(),send:vi.fn() }));
vi.mock('../prismaClient',()=>({ prisma:{ $queryRaw:mock.query,$executeRaw:mock.execute } }));
vi.mock('web-push',()=>({ default:{ sendNotification:mock.send } }));
import { deliverAdminPush } from './adminPushService';
const job={ event_id:'event-1',subscription_id:'sub-1',attempts:0 };
const destination={ subscription:{ endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{ p256dh:'test',auth:'test' } },
  userId:'admin',role:'admin',city:null,status:'active',sessionVersion:1,boundVersion:1,pushCategories:['system'],quietStart:null,quietEnd:null };
beforeEach(()=>{ vi.resetAllMocks(); mock.execute.mockResolvedValue(1); mock.send.mockResolvedValue({ statusCode:201 }); });
describe('browser push authorization and delivery outcomes',()=>{
  it('cancels revoked sessions and suspended accounts before contacting a provider',async()=>{
    mock.query.mockResolvedValueOnce([{ ...destination,boundVersion:0 }]); expect(await deliverAdminPush(job)).toBe('cancelled');
    mock.query.mockResolvedValueOnce([{ ...destination,status:'suspended' }]); expect(await deliverAdminPush(job)).toBe('cancelled');
    expect(mock.send).not.toHaveBeenCalled();
  });
  it('cancels inaccessible, read, resolved or opted-out notifications',async()=>{
    mock.query.mockResolvedValueOnce([destination]).mockResolvedValueOnce([]); expect(await deliverAdminPush(job)).toBe('cancelled');
    mock.query.mockResolvedValueOnce([{ ...destination,pushCategories:[] }]).mockResolvedValueOnce([{ id:'event-1',category:'system' }]); expect(await deliverAdminPush(job)).toBe('cancelled');
    expect(mock.send).not.toHaveBeenCalled();
  });
  it('sends generic lock-screen content without record names or barangay data',async()=>{
    mock.query.mockResolvedValueOnce([destination]).mockResolvedValueOnce([{ id:'event-1',category:'system',recordType:'delivery_failure' }]);
    expect(await deliverAdminPush(job)).toBe('sent');
    const payload=JSON.parse(mock.send.mock.calls[0][1]);
    expect(payload.notificationId).toBe('event-1'); expect(payload.body).toBe('An update needs your attention. Sign in to view details.');
    expect(payload).not.toHaveProperty('recordId'); expect(payload).not.toHaveProperty('barangays');
  });
  it('removes expired endpoints, retries explicit throttling, and avoids duplicate ambiguous sends',async()=>{
    for (const [error,state] of [[{ statusCode:410 },'cancelled'],[{ statusCode:429 },'pending'],[{ code:'ECONNRESET' },'uncertain']] as const) {
      mock.query.mockResolvedValueOnce([destination]).mockResolvedValueOnce([{ id:'event-1',category:'system' }]); mock.send.mockRejectedValueOnce(error);
      expect(await deliverAdminPush(job)).toBe(state);
    }
    expect(mock.execute).toHaveBeenCalledTimes(1);
  });
});
