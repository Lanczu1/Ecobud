import { describe, expect, it, vi } from 'vitest';
import { singleFlightRead } from '../../../mobile/src/shared/api/singleFlightRead';

describe('concurrent ID verification reads', () => {
  it('shares the network request between the page and background sync, then reads fresh next time', async () => {
    let resolve!: (value: string) => void;
    const fetch = vi.fn(() => new Promise<string>(done => { resolve = done; }));
    const read = singleFlightRead(fetch);
    const page = read('account-a');
    const background = read('account-a');
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve('pending');
    expect(await Promise.all([page, background])).toEqual(['pending', 'pending']);
    const refresh = read('account-a');
    expect(fetch).toHaveBeenCalledTimes(2);
    resolve('approved');
    expect(await refresh).toBe('approved');
  });
  it('does not share another account’s ID status', async () => {
    const fetch = vi.fn(async (token: string) => token === 'account-a' ? 'pending' : 'approved');
    const read = singleFlightRead(fetch);
    expect(await Promise.all([read('account-a'), read('account-b')])).toEqual(['pending', 'approved']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('allows retry after a failed request', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce('pending');
    const read = singleFlightRead(fetch);
    await expect(read('account-a')).rejects.toThrow('Offline');
    await expect(read('account-a')).resolves.toBe('pending');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
