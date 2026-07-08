/**
 * Platform-safe wrapper for expo-video.
 *
 * expo-video's web implementation requires `globalThis.expo.SharedObject`,
 * which is not available in all web bundling environments. This module
 * re-exports expo-video on native and provides lightweight stubs on web
 * so the rest of the app can import from a single location.
 */
import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';

// ---------- Types (always available) ----------
type VideoSource = any;
type PlayerSetup = (player: any) => void;

// ---------- Native: re-export real expo-video ----------
let _useVideoPlayer: (source: VideoSource, setup?: PlayerSetup) => any;
let _VideoView: React.ComponentType<any>;
let _useEventListener: (...args: any[]) => void;

if (Platform.OS !== 'web') {
  // Dynamic require so Metro never evaluates the web-incompatible module on web.
  const expoVideo = require('expo-video');
  _useVideoPlayer = expoVideo.useVideoPlayer;
  _VideoView = expoVideo.VideoView;

  try {
    const expo = require('expo');
    _useEventListener = expo.useEventListener;
  } catch {
    _useEventListener = () => {};
  }
} else {
  // ---------- Web stubs ----------
  _useVideoPlayer = (_source: VideoSource, _setup?: PlayerSetup) => {
    // Return a no-op player object that won't crash if accessed.
    return {
      loop: false,
      muted: true,
      currentTime: 0,
      duration: 0,
      play: () => {},
      pause: () => {},
    };
  };

  _VideoView = React.forwardRef<any, any>(({ style, ...rest }, ref) => {
    // Render an empty placeholder so layout is preserved.
    return <View ref={ref} style={[styles.placeholder, style]} />;
  });
  (_VideoView as any).displayName = 'VideoViewWebStub';

  _useEventListener = () => {};
}

export const useVideoPlayer = _useVideoPlayer;
export const VideoView = _VideoView;
export const useEventListener = _useEventListener;

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#000',
  },
});
