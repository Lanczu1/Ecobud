import { AppTab } from '../types/home';
import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

// EcoBud is a Philippines (Asia/Manila, UTC+8) product. All habit/tracker
// "day" keys must be computed in PHT, not UTC, so the calendar highlights the
// correct date at local midnight (16:00 UTC the previous day).
const PH_TIMEZONE = 'Asia/Manila';
const PH_LOCALE = 'en-PH';

/**
 * Returns the Philippines (PHT) "YYYY-MM-DD" date key for a given instant.
 * Defaults to now. Uses Intl formatting to stay correct regardless of the
 * device's own timezone.
 */
export function getPhDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat(PH_LOCALE, {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Returns the Philippines (PHT) "YYYY-MM" month key for a given instant.
 * Defaults to now.
 */
export function getPhMonthKey(date: Date = new Date()): string {
  return getPhDateKey(date).slice(0, 7);
}

// ─── Eco Level System ────────────────────────────────────────────────────────
// A 5-tier gamified progression ladder driven by total Eco Points.
export interface EcoLevelTier {
  level: number;
  name: string;
  emoji: string;
  floor: number;
  ceiling: number; // exclusive upper bound; Infinity for the top tier
}

const ECO_LEVEL_TIERS: EcoLevelTier[] = [
  { level: 1, name: 'Eco Seedling', emoji: '🌱', floor: 0, ceiling: 200 },
  { level: 2, name: 'Eco Learner', emoji: '🌿', floor: 200, ceiling: 450 },
  { level: 3, name: 'Eco Advocate', emoji: '🌳', floor: 450, ceiling: 800 },
  { level: 4, name: 'Eco Warrior', emoji: '🛡️', floor: 800, ceiling: 1200 },
  { level: 5, name: 'Eco Champion', emoji: '👑', floor: 1200, ceiling: Infinity },
];

export function getEcoLevel(totalPoints: number) {
  const safe = Math.max(0, Math.round(totalPoints));
  const tier = ECO_LEVEL_TIERS.find((entry) => safe < entry.ceiling) ?? ECO_LEVEL_TIERS[ECO_LEVEL_TIERS.length - 1];
  const nextTier = ECO_LEVEL_TIERS.find((entry) => entry.level === tier.level + 1) ?? null;

  const span = tier.ceiling - tier.floor;
  const into = Math.min(span, Math.max(0, safe - tier.floor));
  const progressPercentage = tier.ceiling === Infinity ? 100 : Math.round((into / span) * 100);

  return {
    level: tier.level,
    name: tier.name,
    emoji: tier.emoji,
    currentPoints: into,
    totalPoints: safe,
    pointsToNext: tier.ceiling === Infinity ? 0 : tier.ceiling - safe,
    nextName: nextTier?.name ?? null,
    nextCeiling: tier.ceiling === Infinity ? null : tier.ceiling,
    progressPercentage,
  };
}

export function getLessonProgressPercent(status?: string | null) {
  if (status === 'completed') {
    return 100;
  }
  if (status === 'seen') {
    return 0;
  }
  return 0;
}

export function formatChatTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatLongDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatEventDateTag(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase();
}

export function formatMonthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });
}

export function shiftMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const shifted = new Date(year, monthIndex - 1 + offset, 1);
  const nextYear = shifted.getFullYear();
  const nextMonth = String(shifted.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

export function buildCalendarCells(month: string, completedDays: string[]) {
  const [year, monthIndex] = month.split('-').map(Number);
  const completedSet = new Set(completedDays);
  const firstDate = new Date(year, monthIndex - 1, 1);
  const lastDate = new Date(year, monthIndex, 0);
  const startPadding = firstDate.getDay();
  const todayKey = getPhDateKey();
  const cells: { dateKey: string | null; day: number | null; completed: boolean; isToday: boolean }[] = [];

  for (let index = 0; index < startPadding; index += 1) {
    cells.push({ dateKey: null, day: null, completed: false, isToday: false });
  }

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    const dateKey = `${year}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      dateKey,
      day,
      completed: completedSet.has(dateKey),
      isToday: dateKey === todayKey,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, day: null, completed: false, isToday: false });
  }

  return cells;
}

export function initialsFromLabel(label: string) {
  return label.trim().slice(0, 1).toUpperCase() || 'E';
}

export function shortHash(hash: string) {
  if (hash.length <= 14) {
    return hash;
  }
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export function usePressScale(pressedScale = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback((toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 150,
    }).start();
  }, [scale]);

  const onPressIn = useCallback(() => {
    animateTo(pressedScale);
  }, [animateTo, pressedScale]);

  const onPressOut = useCallback(() => {
    animateTo(1);
  }, [animateTo]);

  return { scale, onPressIn, onPressOut };
}
