import React from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

interface ConnectionStatusIndicatorProps {
  hasUsableInternet: boolean;
  size?: number;
  showLabel?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}

export function ConnectionStatusIndicator({
  hasUsableInternet,
  size = 12,
  showLabel = false,
  labelStyle,
  style,
}: ConnectionStatusIndicatorProps) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (hasUsableInternet) {
      scale.stopAnimation();
      opacity.stopAnimation();
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }

    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.22,
            duration: 1700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.45,
            duration: 1700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 1700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    breathingLoop.start();

    return () => {
      breathingLoop.stop();
    };
  }, [hasUsableInternet, opacity, scale]);

  const dotSize = Math.max(size, 10);

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.dot,
          hasUsableInternet ? styles.dotOnline : styles.dotOffline,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />

      {showLabel ? (
        <Text style={[styles.label, labelStyle]}>
          {hasUsableInternet ? 'Online' : 'Offline'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    borderWidth: 2,
    borderColor: '#F7F9F7',
  },
  dotOnline: {
    backgroundColor: '#22C55E',
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  label: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '800',
    color: '#1A211D',
  },
});
