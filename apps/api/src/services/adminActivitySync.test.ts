import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRealtimeService } from '../../../web/src/services/adminRealtimeService';

let browser: EventTarget;
let page: EventTarget & { visibilityState: string };
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  browser = new EventTarget();
  page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', page);
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('admin activity automatic synchronization', () => {
  it('refreshes every 30 seconds, pauses while hidden and catches up when visible', async () => {
    const refresh = vi.fn();
    stop = await adminRealtimeService.connect({ onUsersRefresh: refresh });
    vi.advanceTimersByTime(29999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    page.visibilityState = 'hidden';
    vi.advanceTimersByTime(60000);
    expect(refresh).toHaveBeenCalledTimes(1);
    page.visibilityState = 'visible';
    page.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('refreshes on focus and reconnection and stops all listeners on leaving the page', async () => {
    const refresh = vi.fn();
    stop = await adminRealtimeService.connect({ onUsersRefresh: refresh });
    browser.dispatchEvent(new Event('focus'));
    browser.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(60000);
    browser.dispatchEvent(new Event('focus'));
    browser.dispatchEvent(new Event('online'));
    page.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('shares one timer across admin subscribers and keeps other screens running', async () => {
    const refresh = vi.fn(), otherRefresh = vi.fn();
    const first = await adminRealtimeService.connect({ onUsersRefresh: refresh });
    stop = await adminRealtimeService.connect({ onRedeemRefresh: otherRefresh });
    expect(vi.getTimerCount()).toBe(1);
    first();
    vi.advanceTimersByTime(30000);
    expect(refresh).not.toHaveBeenCalled();
    expect(otherRefresh).toHaveBeenCalledTimes(1);
  });
});
