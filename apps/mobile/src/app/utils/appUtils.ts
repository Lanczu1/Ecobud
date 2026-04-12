import { AppTab } from '../types/home';
import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

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
  const todayKey = new Date().toISOString().slice(0, 10);
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
