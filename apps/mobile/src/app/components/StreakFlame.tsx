import React from 'react';
import { AccessibilityInfo, AppState, Image, View } from 'react-native';
import LottieView from '../../shared/accessibility/AccessibleLottie';
import { isStreakFlameActive } from '../../shared/api/streakSummary';
import { useHomeAnimationVisibility } from './HomeAnimationVisibility';
import { createLottiePlaybackController } from '../utils/homeAnimationVisibility';

const fireSource = require('../../../assets/Fire.lottie');
const inactiveSource = require('../../../assets/Unfire.png');

type StreakFlameProps = { count: number; active: boolean; size?: number };

export function StreakFlame(props: StreakFlameProps) {
  return <MemoizedStreakFlame {...props} />;
}

const MemoizedStreakFlame = React.memo(function StreakFlameContent({ count, active, size = 88 }: StreakFlameProps) {
  if (isStreakFlameActive(count, active)) return <ActiveFlame size={size} />;
  return <Image source={inactiveSource} resizeMode="contain" style={{ width: size, height: size }} accessibilityLabel={count < 3 ? 'Complete 3 challenges to ignite your streak' : 'Inactive streak flame'} />;
}, (previous, next) => previous.size === next.size && isStreakFlameActive(previous.count, previous.active) === isStreakFlameActive(next.count, next.active) && (previous.count < 3) === (next.count < 3));

function ActiveFlame({ size }: { size: number }) {
  const animation = React.useRef<React.ElementRef<typeof LottieView>>(null);
  const homeVisibility = useHomeAnimationVisibility(true);
  const [playback] = React.useState(() => createLottiePlaybackController(() => animation.current));
  const [foreground, setForeground] = React.useState(AppState.currentState === 'active');
  const [reduced, setReduced] = React.useState(false);
  const dimensions = React.useMemo(() => ({ width: size, height: size }), [size]);
  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  React.useEffect(() => {
    if (homeVisibility.managed) {
      playback.setVisible(homeVisibility.visible && foreground && !reduced);
      return () => playback.setVisible(false);
    }
    if (foreground && !reduced) animation.current?.play();
    else animation.current?.pause();
  }, [foreground, reduced, homeVisibility.managed, homeVisibility.visible, playback]);
  return <View ref={homeVisibility.viewRef} collapsable={false} onLayout={homeVisibility.onLayout} accessible accessibilityLabel="Active challenge streak flame"><LottieView ref={animation} source={fireSource} autoPlay={!homeVisibility.managed && foreground && !reduced} onAnimationLoaded={homeVisibility.managed ? playback.onLoaded : undefined} loop={!reduced} style={dimensions} webStyle={dimensions} /></View>;
}
