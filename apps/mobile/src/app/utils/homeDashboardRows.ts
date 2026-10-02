import type { EcoBudMobileModel } from '../types/home';

export type HomeDashboardSection = 0 | 1 | 2 | 3;
export type HomeDashboardRowProps = { model: EcoBudMobileModel; section?: HomeDashboardSection };

export const HOME_DASHBOARD_ROWS: HomeDashboardSection[] = [0, 1, 2, 3];

const rowDependencies: Record<HomeDashboardSection, readonly (keyof EcoBudMobileModel)[]> = {
  0: ['userDisplayName', 'profile', 'session', 'notificationCount', 'hasUsableInternet', 'setActiveOverlay', 'setActiveTab'],
  1: ['todaysCompletedHabits', 'setActiveOverlay', 'setActiveTab'],
  2: ['dashboard', 'session', 'activeOverlay', 'earnedPoints', 'leaderboard', 'setActiveOverlay', 'setProgressBarLayout'],
  3: ['announcements', 'session', 'lessons', 'challenges', 'events', 'todaysCompletedHabits', 'openLesson', 'openChallengeMission', 'setActiveOverlay', 'setActiveTab'],
};

const cardsLoading = (model: EcoBudMobileModel) =>
  !model.dashboard && (model.isHydrating || model.initializing || model.booting);

export function areHomeDashboardRowsEqual(previous: HomeDashboardRowProps, next: HomeDashboardRowProps): boolean {
  if (previous.section !== next.section) return false;
  if (previous.model === next.model) return true;
  if (next.section === undefined) return false;
  if (next.section !== 0 && cardsLoading(previous.model) !== cardsLoading(next.model)) return false;
  return rowDependencies[next.section].every(key => Object.is(previous.model[key], next.model[key]));
}
