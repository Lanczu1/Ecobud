import { beforeEach, describe, expect, it, vi } from 'vitest';
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser } }) }));
import { verifyGoogleIdentity } from './googleIdentity';
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('SUPABASE_ANON_KEY', 'test');
});
describe('Google identity verification', () => {
  it('rejects an invalid upstream token', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: {} });
    await expect(verifyGoogleIdentity('fake')).rejects.toMatchObject({ statusCode: 401 });
  });
  it('rejects email/password Supabase accounts masquerading as Google', async () => {
    getUser.mockResolvedValue({ data: { user: { email: 'a@gmail.com', email_confirmed_at: 'now', identities: [{ provider: 'email' }] } }, error: null });
    await expect(verifyGoogleIdentity('fake')).rejects.toMatchObject({ statusCode: 401 });
  });
  it('accepts only a matching, verified Google identity', async () => {
    getUser.mockResolvedValue({ data: { user: { email: 'a@gmail.com', email_confirmed_at: 'now', identities: [{ id: 'google-id', provider: 'google', identity_data: { email: 'a@gmail.com', email_verified: true } }] } }, error: null });
    expect(await verifyGoogleIdentity('valid')).toMatchObject({ email: 'a@gmail.com', id: 'google-id' });
    expect(getUser).toHaveBeenCalledWith('valid');
  });
});
