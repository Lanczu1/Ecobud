import { describe, expect, it } from 'vitest';
import { adminClientId, adminLiveEvents, sectionsForPath, type AdminLiveChange } from './adminLiveEvents';

describe('admin live change sections', () => {
  it.each([
    ['/admin/challenges/abc', ['challenges']],
    ['/admin/challenges/photo-delete-requests/r1/approve', ['challenges']],
    ['/admin/submissions/s1/review', ['challenges', 'events']],
    ['/admin/events/e1/qr', ['events']],
    ['/events/e1/claim', ['events']],
    ['/redeem/requests/r1/claim', ['redeem']],
    ['/give-and-get/swap-listings/l1', ['giveget']],
    ['/id-verification/submit', ['idVerification', 'users']],
    ['/users/me', ['users']],
    ['/admin/upload', []],
  ])('maps %s', (path, sections) => {
    expect(sectionsForPath(path)).toEqual(sections);
  });

  it('refreshes every screen for a path it does not know, and never matches a prefix mid-word', () => {
    expect(sectionsForPath('/admin/reports/something')).toBe('all');
    expect(sectionsForPath('/eventsfeed')).toBe('all');
  });

  it('accepts only well-formed admin browser ids', () => {
    expect(adminClientId('3f2a9c1e-77b0-4c1d-9e1a-2b6c0d4e8f10')).toBe('3f2a9c1e-77b0-4c1d-9e1a-2b6c0d4e8f10');
    expect(adminClientId('short')).toBeNull();
    expect(adminClientId('bad id with spaces!')).toBeNull();
    expect(adminClientId(undefined)).toBeNull();
  });

  it('labels emits inside a request with that request origin, and drops empty section lists', async () => {
    const seen: AdminLiveChange[] = [];
    const stop = adminLiveEvents.subscribe(change => seen.push(change));
    adminLiveEvents.withOrigin('browser-one-1234', () => {
      void Promise.resolve().then(() => adminLiveEvents.emit(['events']));
      adminLiveEvents.emit([]);
    });
    adminLiveEvents.emit(['redeem']);
    await Promise.resolve();
    stop();
    expect(seen).toEqual([
      { sections: ['redeem'], origin: null },
      { sections: ['events'], origin: 'browser-one-1234' },
    ]);
  });

  it('treats work that finishes after the answer was sent as no longer that browser\'s', async () => {
    const seen: AdminLiveChange[] = [];
    const stop = adminLiveEvents.subscribe(change => seen.push(change));
    let followUp: Promise<void> = Promise.resolve();
    adminLiveEvents.withOrigin('browser-one-1234', release => {
      adminLiveEvents.emit(['challenges']);
      followUp = new Promise<void>(resolve => setTimeout(() => { adminLiveEvents.emit(['users']); resolve(); }, 0));
      release();
    });
    await followUp;
    stop();
    expect(seen).toEqual([
      { sections: ['challenges'], origin: 'browser-one-1234' },
      { sections: ['users'], origin: null },
    ]);
  });
});
