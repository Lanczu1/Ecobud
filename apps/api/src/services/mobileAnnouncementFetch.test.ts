import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  fetchAnnouncements: vi.fn(), fetchDashboard: vi.fn(), fetchLessons: vi.fn(),
  fetchChallenges: vi.fn(), fetchHabitsToday: vi.fn(), fetchEvents: vi.fn(), fetchLeaderboard: vi.fn(),
}));
vi.mock('../../../mobile/src/shared/api/ecobudApi', () => ({ ecobudApi: api }));
import { homeService } from '../../../mobile/src/app/services/homeService';
beforeEach(() => { vi.resetAllMocks(); });
it('coalesces concurrent announcement fetches for one session without sharing accounts', async () => {
  let finish!: (value: { items: any[] }) => void;
  api.fetchAnnouncements.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = homeService.getAnnouncements('alice');
  const second = homeService.getAnnouncements('alice');
  expect(first).toBe(second);
  expect(api.fetchAnnouncements).toHaveBeenCalledTimes(1);
  finish({ items: [{ id: 'a' }] });
  await expect(first).resolves.toEqual([{ id: 'a' }]);
  api.fetchAnnouncements.mockResolvedValue({ items: [{ id: 'b' }] });
  await expect(homeService.getAnnouncements('bob')).resolves.toEqual([{ id: 'b' }]);
  await homeService.getAnnouncements('alice');
  expect(api.fetchAnnouncements).toHaveBeenCalledTimes(3);
});
it('delivers announcement data before a slow dashboard finishes', async () => {
  let finishDashboard!: (value: any) => void;
  api.fetchDashboard.mockImplementation(() => new Promise(resolve => { finishDashboard = resolve; }));
  api.fetchAnnouncements.mockResolvedValue({ items: [{ id: 'fast' }] });
  api.fetchLessons.mockResolvedValue([]);
  api.fetchChallenges.mockResolvedValue({ items: [] });
  api.fetchHabitsToday.mockResolvedValue(null);
  api.fetchEvents.mockResolvedValue({ items: [] });
  api.fetchLeaderboard.mockResolvedValue(null);
  const onAnnouncements = vi.fn();
  const finished = vi.fn();
  const loading = homeService.getHomeCriticalData('session', onAnnouncements).then(finished);
  await vi.waitFor(() => expect(onAnnouncements).toHaveBeenCalledWith([{ id: 'fast' }]));
  expect(finished).not.toHaveBeenCalled();
  finishDashboard(null);
  await loading;
});

