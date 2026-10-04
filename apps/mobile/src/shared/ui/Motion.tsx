import React, { useEffect, useRef } from 'react';
import { Easing, StyleProp, ViewStyle } from 'react-native';
import { Animated } from '../accessibility/animations';
import { isLowEndDevice } from '../performance/deviceTier';

// Fast start, long settle. Every animation here runs on the native driver and
// only touches opacity/transform, so none of them wait on the JS thread.
const settle = Easing.bezier(0.22, 1, 0.36, 1);

const revealed = new Set<string>();

/**
 * Fades and lifts its children into place the first time they mount.
 * `index` staggers siblings; `id` keeps a recycled list row from replaying.
 */
export function Reveal({ children, id, index = 0, style }: {
  children: React.ReactNode;
  id?: string;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const lite = isLowEndDevice();
  const seen = useRef(id !== undefined && revealed.has(id)).current;
  const progress = useRef(new Animated.Value(seen ? 1 : 0)).current;

  useEffect(() => {
    if (seen) return;
    if (id !== undefined) revealed.add(id);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: lite ? 180 : 340,
      delay: lite ? 0 : Math.min(index, 4) * 60,
      easing: settle,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, seen, id, index, lite]);

  return (
    <Animated.View
      style={[
        style,
        { opacity: progress },
        !lite && { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Entrance for a retained tab page. The page stays mounted while hidden, so
 * the value is rewound on exit and the next visit starts from a clean frame.
 */
export function TabEntrance({ active, children }: { active: boolean; children: React.ReactNode }) {
  const lite = isLowEndDevice();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: lite ? 140 : 240,
      easing: settle,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress, lite]);

  return (
    <Animated.View
      style={[
        { flex: 1, opacity: progress },
        !lite && { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}
