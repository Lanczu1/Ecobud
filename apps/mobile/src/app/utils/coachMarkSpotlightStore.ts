export interface SpotlightTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

let currentRect: SpotlightTargetRect | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const getSnapshot = () => currentRect;

const set = (rect: SpotlightTargetRect | null) => {
  const prev = currentRect;
  if (prev === rect || (!prev && !rect)) return;
  if (prev && rect &&
      Math.round(prev.x) === Math.round(rect.x) &&
      Math.round(prev.y) === Math.round(rect.y) &&
      Math.round(prev.width) === Math.round(rect.width) &&
      Math.round(prev.height) === Math.round(rect.height) &&
      prev.borderRadius === rect.borderRadius) return;

  currentRect = rect;
  listeners.forEach((listener) => listener());
};

export const coachMarkSpotlightStore = { subscribe, getSnapshot, set };
