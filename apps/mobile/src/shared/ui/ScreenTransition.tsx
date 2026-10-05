import React, { useEffect, useRef } from 'react';
import { Easing, StyleProp, ViewStyle } from 'react-native';
import { Animated } from '../accessibility/animations';

/**
 * Small native-driven entrance transition for routes, overlays, and hub screens.
 * Give it a changing key/name when the displayed destination changes.
 */
export function ScreenTransition({
  children,
  style,
  enabled = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
      isInteraction: false,
    });

    animation.start();
    return () => animation.stop();
  }, [progress, enabled]);

  if (!enabled) {
    return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      style={[
        { flex: 1 },
        style,
        { opacity: progress },
      ]}
    >
      {children}
    </Animated.View>
  );
}
