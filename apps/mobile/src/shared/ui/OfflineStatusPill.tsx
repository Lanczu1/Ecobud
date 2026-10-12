import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated } from '../accessibility/animations';
import { Text } from '../accessibility/primitives';
import { useTheme } from '../theme/ecoTheme';

/** Small top-center pill that stays on screen and blinks for as long as the device is offline. */
export function OfflineStatusPill({ visible }: { visible: boolean }) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = React.useState(visible);
  const entrance = React.useRef(new Animated.Value(visible ? 1 : 0)).current;
  const blink = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (visible) setMounted(true);
    const slide = Animated.timing(entrance, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    slide.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => slide.stop();
  }, [entrance, visible]);

  React.useEffect(() => {
    if (!visible) return;
    blink.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink, visible]);

  if (!mounted) return null;

  return (
    <View pointerEvents="none" style={[styles.host, { top: Math.max(insets.top, 12) + 6 }]}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel="No internet connection"
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? '#2A1215' : '#1F2937',
            borderColor: isDark ? '#7F1D1D' : 'rgba(255,255,255,0.14)',
            opacity: entrance,
            transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
          },
        ]}
      >
        <Animated.View style={[styles.dot, { opacity: blink }]} />
        <Animated.View style={{ opacity: blink }}>
          <Ionicons name="cloud-offline-outline" size={14} color="#FCA5A5" />
        </Animated.View>
        <Text style={styles.label} numberOfLines={1}>No internet connection</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 900 },
  pill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    elevation: 6,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  dot: { backgroundColor: '#EF4444', borderRadius: 4, height: 8, width: 8 },
  label: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});
