import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/theme/ecoTheme';
import { moderateScale, responsiveFontSize, scale, verticalScale } from '../utils/responsive';
import { styles as appStyles } from '../styles/appStyles';

interface AiThinkingBubbleProps {
  bubbleMaxWidth?: number | string;
  bubblePadding?: number;
  bubbleRadius?: number;
  isSmall?: boolean;
  style?: StyleProp<ViewStyle>;
}

const THINKING_MESSAGES = [
  'EcoBud is thinking...',
  'Gathering eco insights...',
  'Preparing your response...',
];

export function AiThinkingBubble({
  bubbleMaxWidth = '85%',
  bubblePadding = moderateScale(14),
  bubbleRadius = moderateScale(18),
  isSmall = false,
  style,
}: AiThinkingBubbleProps) {
  const { theme, isDark } = useTheme();

  // Entrance animation
  const entranceAnim = useRef(new Animated.Value(0)).current;

  // Staggered bouncing dot animations (values 0 -> 1 -> 0)
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  // Pulse ring for EcoBud avatar
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Shimmering / breathing text opacity
  const textPulseAnim = useRef(new Animated.Value(0.6)).current;

  // Dynamic progressive status text
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    // 1. Smooth spring entrance
    Animated.spring(entranceAnim, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();

    // 2. Continuous wave bouncing dots
    const createBounceAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 350,
              easing: Easing.bezier(0.33, 1, 0.68, 1), // smooth ease-out-back curve
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 350,
              easing: Easing.bezier(0.32, 0, 0.67, 0), // smooth ease-in curve
              useNativeDriver: true,
            }),
            Animated.delay(260),
          ]),
        ),
      ]);
    };

    const bounce1 = createBounceAnimation(dot1Anim, 0);
    const bounce2 = createBounceAnimation(dot2Anim, 160);
    const bounce3 = createBounceAnimation(dot3Anim, 320);

    bounce1.start();
    bounce2.start();
    bounce3.start();

    // 3. Avatar glow / pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    // 4. Subtle text breathing animation
    const textLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(textPulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(textPulseAnim, {
          toValue: 0.55,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    textLoop.start();

    // 5. Progressive status message interval
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev < THINKING_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 3600);

    return () => {
      bounce1.stop();
      bounce2.stop();
      bounce3.stop();
      pulseLoop.stop();
      textLoop.stop();
      clearInterval(interval);
    };
  }, [entranceAnim, dot1Anim, dot2Anim, dot3Anim, pulseAnim, textPulseAnim]);

  const dotColor = isDark ? theme.colors.primary : '#126027';
  const dotSize = isSmall ? 7 : 9;
  const avatarSize = isSmall ? 26 : 30;

  // Dot translations and scales
  const getDotStyle = (anim: Animated.Value) => ({
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1.2],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.45, 1],
    }),
  });

  // Avatar pulse ring interpolation
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.22],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  return (
    <Animated.View
      style={[
        appStyles.chatBubble,
        appStyles.chatBubbleBot,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          maxWidth: bubbleMaxWidth as any,
          padding: bubblePadding,
          borderRadius: bubbleRadius,
          borderBottomLeftRadius: moderateScale(4),
          borderBottomRightRadius: bubbleRadius,
          marginBottom: isSmall ? 10 : 12,
          opacity: entranceAnim,
          transform: [
            {
              scale: entranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
            {
              translateY: entranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0],
              }),
            },
          ],
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel="EcoBud is thinking of what to respond"
    >
      <View style={styles.bubbleRow}>
        {/* Animated Avatar with Pulse Ring */}
        <View style={[styles.avatarWrapper, { width: avatarSize, height: avatarSize }]}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: dotColor,
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
          <View
            style={[
              styles.avatarInner,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: isDark ? 'rgba(34, 197, 94, 0.18)' : '#ECFAEF',
                borderColor: isDark ? 'rgba(34, 197, 94, 0.35)' : '#C9EBCF',
              },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={isSmall ? 13 : 15}
              color={dotColor}
            />
          </View>
        </View>

        {/* Content Column: Wave dots + status */}
        <View style={styles.contentCol}>
          {/* Animated 3-Dots Wave */}
          <View style={styles.dotsContainer}>
            <Animated.View
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: dotColor,
                },
                getDotStyle(dot1Anim),
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: dotColor,
                },
                getDotStyle(dot2Anim),
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: dotColor,
                },
                getDotStyle(dot3Anim),
              ]}
            />
          </View>

          {/* Thinking Status Text with gentle breathing pulse */}
          <Animated.Text
            style={[
              styles.statusText,
              {
                color: theme.colors.textMuted,
                fontSize: responsiveFontSize(isSmall ? 11 : 12),
                opacity: textPulseAnim,
              },
            ]}
          >
            {THINKING_MESSAGES[statusIndex]}
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
  },
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  avatarInner: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  contentCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: verticalScale(3),
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    height: verticalScale(16),
  },
  dot: {
    // Base dot shape
  },
  statusText: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
