import React from 'react';
import { Platform } from 'react-native';
import LottieView from '../../shared/accessibility/AccessibleLottie';
import { useHomeAnimationVisibility } from './HomeAnimationVisibility';
import { createLottiePlaybackController } from '../utils/homeAnimationVisibility';

const waveSource = Platform.OS === 'android'
  ? require('../../../assets/Ecobud Mascot/New Lottie files/HomeWave.lottie')
  : require('../../../assets/Ecobud Mascot/New Lottie files/Wave.lottie');

export const HomeMascotAnimation = React.memo(function HomeMascotAnimation({ size, animated = true }: {
  size: number;
  animated?: boolean;
}) {
  const { visible } = useHomeAnimationVisibility();
  const animation = React.useRef<React.ElementRef<typeof LottieView>>(null);
  const [playback] = React.useState(() => createLottiePlaybackController(() => animation.current));
  const dimensions = React.useMemo(() => ({ width: size, height: size }), [size]);

  React.useEffect(() => {
    playback.setVisible(visible && animated);
    return () => playback.setVisible(false);
  }, [playback, visible, animated]);

  return <LottieView
    ref={animation}
    source={waveSource}
    autoPlay={false}
    loop={animated}
    progress={animated ? undefined : 0}
    onAnimationLoaded={playback.onLoaded}
    renderMode={Platform.OS === 'android' ? 'SOFTWARE' : 'AUTOMATIC'}
    cacheComposition
    hardwareAccelerationAndroid={false}
    style={dimensions}
    webStyle={dimensions}
  />;
});
