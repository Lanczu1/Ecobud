export type QuickMissionGesture = { phase: 'move' | 'release' | 'cancel'; x: number; y: number };

export function createQuickMissionGestureChannel() {
  let latest: QuickMissionGesture | null = null;
  let ended = false;
  const listeners = new Set<(gesture: QuickMissionGesture) => void>();
  return {
    reset() { latest = null; ended = false; },
    emit(gesture: QuickMissionGesture) {
      if (ended) return;
      latest = gesture;
      ended = gesture.phase !== 'move';
      listeners.forEach(listener => listener(gesture));
    },
    subscribe(listener: (gesture: QuickMissionGesture) => void) {
      listeners.add(listener);
      // Keep releases that arrive while the overlay is still mounting.
      if (latest) listener(latest);
      return () => { listeners.delete(listener); };
    },
  };
}

export type QuickMissionGestureChannel = ReturnType<typeof createQuickMissionGestureChannel>;
