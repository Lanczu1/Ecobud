export type AnimationBounds = { top: number; height: number };

export function createHomeAnimationVisibilityStore() {
  let screenVisible = false;
  let offset = 0;
  let viewportTop = 0;
  let viewportHeight = 0;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    isVisible(bounds?: AnimationBounds | null) {
      if (!screenVisible) return false;
      if (bounds === undefined) return true;
      if (!bounds || viewportHeight <= 0 || bounds.height <= 0) return false;
      const top = bounds.top - offset;
      return top < viewportTop + viewportHeight && top + bounds.height > viewportTop;
    },
    captureBounds(y: number, height: number): AnimationBounds { return { top: y + offset, height }; },
    setScreenVisible(value: boolean) { if (value !== screenVisible) { screenVisible = value; notify(); } },
    setOffset(value: number) { if (value !== offset) { offset = value; notify(); } },
    setViewport(top: number, height: number) {
      if (top !== viewportTop || height !== viewportHeight) { viewportTop = top; viewportHeight = height; notify(); }
    },
  };
}

export type HomeAnimationVisibilityStore = ReturnType<typeof createHomeAnimationVisibilityStore>;

type LottiePlayback = { play: () => void; pause: () => void; resume: () => void };

export function createLottiePlaybackController(getAnimation: () => LottiePlayback | null) {
  let ready = false;
  let visible = false;
  let started = false;
  let playing = false;
  const synchronize = () => {
    const animation = getAnimation();
    if (!ready || !animation) return;
    if (visible && !playing) {
      if (started) animation.resume();
      else animation.play();
      started = true;
      playing = true;
    } else if (!visible && playing) {
      animation.pause();
      playing = false;
    }
  };
  return {
    setVisible(value: boolean) { visible = value; synchronize(); },
    onLoaded() { ready = true; synchronize(); },
  };
}
