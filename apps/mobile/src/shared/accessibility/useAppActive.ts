import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

const listeners = new Set<() => void>();
let subscription: ReturnType<typeof AppState.addEventListener> | undefined;
const isActive = () => AppState.currentState === null || AppState.currentState === 'active';
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  subscription ??= AppState.addEventListener('change', () => {
    listeners.forEach(notify => notify());
  });
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = undefined;
    }
  };
};

export function useAppActive() {
  return useSyncExternalStore(subscribe, isActive, () => true);
}
