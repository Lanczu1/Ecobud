import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import NativeLottie from 'lottie-react-native';
import { useAccessibility, getAccessibilityPreferences } from './AccessibilityContext';
import { useScreenActive } from '../ui/ScreenActivity';

type LottieHandle = React.ElementRef<typeof NativeLottie>;
const AccessibleLottie = React.forwardRef<LottieHandle, React.ComponentProps<typeof NativeLottie>>((props, ref) => {
  const inner = useRef<LottieHandle>(null);
  const playback = useMemo(() => ({
    wantsPlayback: props.autoPlay !== false,
    started: false,
    loaded: false,
    completed: false,
    frames: [] as Parameters<LottieHandle['play']>,
  }), [props.source]);
  const onFinish = useRef(props.onAnimationFinish);
  onFinish.current = props.onAnimationFinish;
  const { preferences } = useAccessibility();
  const active = useScreenActive();
  const activeRef = useRef(active);
  activeRef.current = active;
  const canPlay = () => activeRef.current && !getAccessibilityPreferences().performance &&
    (AppState.currentState === null || AppState.currentState === 'active');
  const synchronize = () => {
    if (!playback.loaded || !playback.wantsPlayback || !canPlay()) return;
    if (playback.started) inner.current?.resume();
    else {
      inner.current?.play(...playback.frames);
      playback.started = true;
    }
  };
  useImperativeHandle(ref, () => ({
    play: (...args: Parameters<LottieHandle['play']>) => {
      playback.wantsPlayback = true;
      playback.completed = false;
      playback.frames = args;
      playback.started = false;
      synchronize();
    },
    pause: () => { playback.wantsPlayback = false; inner.current?.pause(); },
    resume: () => { playback.wantsPlayback = true; synchronize(); },
    reset: () => { playback.wantsPlayback = false; playback.started = false; inner.current?.reset(); },
  } as LottieHandle), [playback]);
  useEffect(() => {
    playback.wantsPlayback = props.autoPlay !== false;
  }, [playback, props.autoPlay]);
  useEffect(() => {
    if (!active || preferences.performance || !playback.wantsPlayback) inner.current?.pause();
    else synchronize();
  }, [playback, active, preferences.performance, props.autoPlay]);
  useEffect(() => {
    if (preferences.performance && props.loop === false && !playback.completed) {
      playback.completed = true;
      playback.wantsPlayback = false;
      onFinish.current?.(false);
    }
  }, [playback, preferences.performance, props.loop]);
  return <NativeLottie {...props} ref={inner} autoPlay={false}
    loop={preferences.performance ? false : props.loop}
    progress={preferences.performance ? 0 : props.progress}
    onAnimationLoaded={() => {
      playback.loaded = true;
      synchronize();
      props.onAnimationLoaded?.();
    }}
    onAnimationFinish={cancelled => {
      if (!props.loop && !cancelled) {
        playback.wantsPlayback = false;
        playback.completed = true;
        playback.started = false;
      }
      onFinish.current?.(cancelled);
    }} />;
});
export default AccessibleLottie;
