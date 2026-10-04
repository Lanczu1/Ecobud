import type { AppTab } from '../types/home';

const reusable = new Set<AppTab>(['home', 'learn', 'challenges']);

export function retainTabs(previous: AppTab[], active: AppTab, limit: number): AppTab[] {
  const next = [...previous.filter(tab => tab !== active && reusable.has(tab)), active].slice(-Math.max(1, limit));
  return next.length === previous.length && next.every((tab, index) => tab === previous[index]) ? previous : next;
}

export function warmTab(previous: AppTab[], active: AppTab, target: AppTab, limit: number): AppTab[] {
  if (limit < 2 || !reusable.has(target) || target === active || previous.includes(target)) return previous;
  const inactive = previous.filter(tab => tab !== active && reusable.has(tab));
  return [...(limit > 2 ? inactive.slice(-(limit - 2)) : []), target, active];
}

export function nextWarmTab(tabs: AppTab[], limit: number): AppTab | undefined {
  if (tabs.length >= limit) return undefined;
  return (['learn', 'challenges', 'home'] as AppTab[]).find(tab => !tabs.includes(tab));
}
