import { Animated as NativeAnimated } from 'react-native';
import { getAccessibilityPreferences, subscribeAccessibility } from './AccessibilityContext';
import { Text } from './primitives';

const running = new Set<{ stop: () => void; finish?: () => void }>();
subscribeAccessibility(() => {
  if (!getAccessibilityPreferences().performance) return;
  [...running].forEach(animation => { animation.stop(); animation.finish?.(); });
});
function transition(factory: typeof NativeAnimated.timing): typeof NativeAnimated.timing {
  return (value, config) => {
    let animation: Animated.CompositeAnimation | undefined;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingCallback: ((result: { finished: boolean }) => void) | undefined;
    const finish = () => {
      if (typeof config.toValue === 'number') (value as NativeAnimated.Value).setValue(config.toValue);
      else if ('x' in config.toValue && 'y' in config.toValue && typeof config.toValue.x === 'number' && typeof config.toValue.y === 'number') (value as NativeAnimated.ValueXY).setValue(config.toValue as { x: number; y: number });
    };
    const stop = () => {
      running.delete(entry);
      if (completionTimer !== undefined) {
        clearTimeout(completionTimer);
        completionTimer = undefined;
        const callback = pendingCallback;
        pendingCallback = undefined;
        callback?.({ finished: false });
      }
      animation?.stop();
    };
    const entry = { stop, finish };
    return Object.assign({
      start(callback?: (result: { finished: boolean }) => void) {
        if (getAccessibilityPreferences().performance) {
          finish();
          pendingCallback = callback;
          running.add(entry);
          completionTimer = setTimeout(() => {
            completionTimer = undefined;
            running.delete(entry);
            const complete = pendingCallback;
            pendingCallback = undefined;
            complete?.({ finished: true });
          }, 0);
          return;
        }
        animation = factory(value, config);
        running.add(entry);
        animation.start(result => { running.delete(entry); callback?.(result); });
      },
      stop,
      reset() { animation?.reset(); },
    }, {
      _isUsingNativeDriver: () => config.useNativeDriver || false,
      _startNativeLoop(iterations: number, callback?: (result: { finished: boolean }) => void) {
        if (getAccessibilityPreferences().performance) return;
        animation = factory(value, { ...config, iterations } as typeof config);
        running.add(entry);
        animation.start(result => { running.delete(entry); callback?.(result); });
      },
    });
  };
}
export const Animated = {
  ...NativeAnimated,
  Text: NativeAnimated.createAnimatedComponent(Text),
  delay: (duration: number) => NativeAnimated.delay(getAccessibilityPreferences().performance ? 0 : duration),
  timing: transition(NativeAnimated.timing),
  spring: transition(NativeAnimated.spring as typeof NativeAnimated.timing) as typeof NativeAnimated.spring,
  loop(animation: Animated.CompositeAnimation, config?: Parameters<typeof NativeAnimated.loop>[1]): Animated.CompositeAnimation {
    let loop: Animated.CompositeAnimation | undefined;
    const entry = { stop: () => { running.delete(entry); loop?.stop(); } };
    return {
      start(onComplete) {
        if (getAccessibilityPreferences().performance) return;
        const native = animation as Animated.CompositeAnimation & { _isUsingNativeDriver?: () => boolean; _startNativeLoop?: (iterations: number, callback?: (result: { finished: boolean }) => void) => void };
        if (native._isUsingNativeDriver?.() && native._startNativeLoop) {
          loop = animation;
          native._startNativeLoop(config?.iterations ?? -1, onComplete);
          return;
        }
        loop = NativeAnimated.loop(animation, config);
        running.add(entry);
        loop.start(result => { running.delete(entry); onComplete?.(result); });
      },
      stop() { entry.stop(); },
      reset() { loop?.reset(); },
    };
  },
};
export namespace Animated {
  export type CompositeAnimation = NativeAnimated.CompositeAnimation;
  export type Value = NativeAnimated.Value;
  export type ValueXY = NativeAnimated.ValueXY;
  export type AnimatedInterpolation<T extends string | number> = NativeAnimated.AnimatedInterpolation<T>;
}
