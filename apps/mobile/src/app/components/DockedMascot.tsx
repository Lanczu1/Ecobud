import React from 'react';
import { AccessibilityInfo, AppState, Easing, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Animated } from '../../shared/accessibility/animations';
import { useAccessibility } from '../../shared/accessibility/AccessibilityContext';
import { useHomeAnimationVisibility } from './HomeAnimationVisibility';

export const DockedMascot = React.memo(function DockedMascot({ size, side, animated }: {
  size: number;
  side: 'left' | 'right';
  animated: boolean;
}) {
  const motion = React.useRef(new Animated.Value(0)).current;
  const { preferences } = useAccessibility();
  const { visible } = useHomeAnimationVisibility();
  const [active, setActive] = React.useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = React.useState(true);
  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const stateSubscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { mounted = false; motionSubscription.remove(); stateSubscription.remove(); };
  }, []);
  React.useEffect(() => {
    motion.setValue(0);
    if (!animated || !visible || !active || reduceMotion || preferences.performance) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(motion, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(motion, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => { loop.stop(); motion.setValue(0); };
  }, [animated, visible, active, reduceMotion, preferences.performance, motion]);
  const tabSize = Math.min(64, Math.max(48, size * 0.7));
  return <View style={[styles.tab, {
    width: tabSize, height: tabSize,
    borderTopLeftRadius: side === 'right' ? 18 : 0,
    borderBottomLeftRadius: side === 'right' ? 18 : 0,
    borderTopRightRadius: side === 'left' ? 18 : 0,
    borderBottomRightRadius: side === 'left' ? 18 : 0,
  }]}>
    <View style={styles.tile}>
      <Animated.View pointerEvents="none" style={{ transform: [
        { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
        { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
      ] }}>
        <Svg width={tabSize * 0.72} height={tabSize * 0.76} viewBox="0 0 64 68">
          <Path d="M34 15 C30 9 28 5 33 2 C41 3 45 7 43 12 C39 9 36 8 34 8" fill="#A3D62B" />
          <Path d="M32 23 C16 9 5 13 5 32 C4 47 18 57 32 64 C45 55 59 45 59 29 C59 12 45 10 32 23Z" fill="#8BCC20" stroke="#578C16" strokeWidth="1.5" />
          <Path d="M32 24 C39 17 51 15 55 23 C60 40 46 51 32 61Z" fill="#B7E638" />
          <Path d="M32 25 L32 59" stroke="#70A91C" strokeWidth="1.5" />
          <Path d="M14 25 Q19 21 24 25 M38 25 Q43 21 48 25" fill="none" stroke="#3A581C" strokeWidth="2" strokeLinecap="round" />
          <Ellipse cx="20" cy="33" rx="7" ry="9" fill="#F9FFEC" />
          <Ellipse cx="43" cy="33" rx="7" ry="9" fill="#F9FFEC" />
          <Ellipse cx="22" cy="34" rx="3.4" ry="5.4" fill="#28451F" />
          <Ellipse cx="41" cy="34" rx="3.4" ry="5.4" fill="#28451F" />
          <Ellipse cx="23" cy="32" rx="1.2" ry="1.8" fill="#FFF" />
          <Ellipse cx="42" cy="32" rx="1.2" ry="1.8" fill="#FFF" />
          <Path d="M26 46 Q32 51 38 45" fill="none" stroke="#395721" strokeWidth="2" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  </View>;
});

const styles = StyleSheet.create({
  tab: { backgroundColor: '#454A47', padding: 7, justifyContent: 'center', alignItems: 'center' },
  tile: { flex: 1, width: '100%', borderRadius: 12, backgroundColor: '#176A2C', justifyContent: 'center', alignItems: 'center' },
});
