import React, { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from '../../shared/platform/VideoCompat';

export const AuthBackgroundVideo = React.memo(function AuthBackgroundVideo() {
  const player = useVideoPlayer(require('../../../assets/mobile-bg.mp4'), video => {
    video.loop = true;
    video.muted = true;
    video.staysActiveInBackground = false;
    video.showNowPlayingNotification = false;
    video.timeUpdateEventInterval = 0;
  });

  useEffect(() => {
    const updatePlayback = (state: string | null) => {
      if (state === 'active') player.play();
      else player.pause();
    };
    updatePlayback(AppState.currentState);
    const subscription = AppState.addEventListener('change', updatePlayback);
    return () => {
      subscription.remove();
    };
  }, [player]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
});
