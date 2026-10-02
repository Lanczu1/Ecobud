import React, { useEffect, useImperativeHandle, useRef } from 'react';
import NativeLottie from 'lottie-react-native';
import { useAccessibility, getAccessibilityPreferences } from './AccessibilityContext';

type LottieHandle = React.ElementRef<typeof NativeLottie>;
const AccessibleLottie = React.forwardRef<LottieHandle, React.ComponentProps<typeof NativeLottie>>((props, ref) => {
  const inner = useRef<LottieHandle>(null);
  const completed = useRef(false);
  const wantsPlayback = useRef(props.autoPlay !== false);
  const onFinish = useRef(props.onAnimationFinish);
  onFinish.current = props.onAnimationFinish;
  const { preferences } = useAccessibility();
  useImperativeHandle(ref, () => ({
    play: (...args: Parameters<LottieHandle['play']>) => { wantsPlayback.current = true; if (!getAccessibilityPreferences().performance) inner.current?.play(...args); },
    pause: () => { wantsPlayback.current = false; inner.current?.pause(); },
    resume: () => { wantsPlayback.current = true; if (!getAccessibilityPreferences().performance) inner.current?.resume(); },
    reset: () => { wantsPlayback.current = false; inner.current?.reset(); },
  } as LottieHandle), []);
  useEffect(() => {
    if (preferences.performance) inner.current?.pause();
    else if (props.autoPlay !== false || wantsPlayback.current) inner.current?.play();
  }, [preferences.performance, props.autoPlay]);
  useEffect(() => {
    if (preferences.performance && props.loop === false && !completed.current) {
      completed.current = true;
      onFinish.current?.(false);
    }
  }, [preferences.performance, props.loop]);
  return <NativeLottie {...props} ref={inner} autoPlay={preferences.performance ? false : props.autoPlay} loop={preferences.performance ? false : props.loop} progress={preferences.performance ? 0 : props.progress} />;
});
export default AccessibleLottie;
