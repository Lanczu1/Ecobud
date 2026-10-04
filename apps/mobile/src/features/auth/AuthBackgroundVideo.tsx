import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAccessibility } from '../../shared/accessibility/AccessibilityContext';
import { useAppActive } from '../../shared/accessibility/useAppActive';
import { useVideoPlayer, VideoView } from '../../shared/platform/VideoCompat';

export const AuthBackgroundVideo = React.memo(function AuthBackgroundVideo() {
  const { preferences } = useAccessibility();
  const active = useAppActive();
  const player = useVideoPlayer(require('../../../assets/mobile-bg.mp4'), video => {
    video.loop = true;
    video.muted = true;
    video.staysActiveInBackground = false;
    video.showNowPlayingNotification = false;
    video.timeUpdateEventInterval = 0;
  });

  useEffect(() => {
    if (active && !preferences.performance) player.play();
    else player.pause();
  }, [player, active, preferences.performance]);

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
