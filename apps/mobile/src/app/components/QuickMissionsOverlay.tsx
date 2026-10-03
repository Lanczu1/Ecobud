import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Text } from '../../shared/accessibility/primitives';
import { FastImage } from '../../shared/ui/FastImage';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../utils/haptics';
import type { EcoBudMobileModel, ChallengeWithProgress } from '../types/home';

export type QuickMissionGesture = { phase: 'move' | 'release' | 'cancel'; x: number; y: number };

export function QuickMissionsOverlay({
  model,
  onClose,
  anchorBounds,
  gesture,
}: {
  model: EcoBudMobileModel;
  onClose: () => void;
  anchorBounds?: { x: number; y: number; width: number; height: number };
  gesture?: QuickMissionGesture | null;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const isNarrow = screenWidth < 380;
  const isVeryNarrow = screenWidth < 340;
  const iconSize = isVeryNarrow ? 18 : isNarrow ? 20 : 22;
  const centerDiameter = anchorBounds?.width ?? iconSize * 3;

  const bottomMargin = insets.bottom > 0 ? insets.bottom : isNarrow ? 10 : 14;
  const barHeight = isNarrow ? 58 : 64;

  // Real Challenges trophy circle center coordinates
  const anchorBottom = bottomMargin + barHeight / 2 + Math.round(centerDiameter * 0.22);
  const anchorX = anchorBounds ? anchorBounds.x + anchorBounds.width / 2 : screenWidth / 2;
  const anchorY = anchorBounds ? anchorBounds.y + anchorBounds.height / 2 : screenHeight - anchorBottom;

  // Radial arc geometry
  const spreadX = screenWidth < 360 ? 96 : 108;
  const leftRightY = screenWidth < 360 ? 120 : 136;
  const centerY = screenWidth < 360 ? 175 : 196;

  const circleSizeSide = screenWidth < 360 ? 68 : 74;
  const circleSizeCenter = screenWidth < 360 ? 74 : 80;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fanAnim = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // Hover state and animated scale springs for the 3 items
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);

  const scaleAnim0 = useRef(new Animated.Value(1)).current;
  const scaleAnim1 = useRef(new Animated.Value(1)).current;
  const scaleAnim2 = useRef(new Animated.Value(1)).current;

  // Filter 3 active quick missions
  let missions = model.challenges
    .filter(challenge => {
      const expired = challenge.endDate && new Date(challenge.endDate).getTime() <= Date.now();
      return challenge.active && !expired && challenge.imageUrl && challenge.progress?.status !== 'completed';
    })
    .sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)))
    .slice(0, 3);

  if (missions.length < 3) {
    const existingIds = new Set(missions.map(m => m.id));
    const extras = model.challenges
      .filter(c => c.active && c.imageUrl && !existingIds.has(c.id))
      .slice(0, 3 - missions.length);
    missions = [...missions, ...extras];
  }

  // Smooth entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(fanAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, fanAnim]);

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.spring(fanAnim, { toValue: 0, tension: 90, friction: 9, useNativeDriver: true }),
    ]).start(() => {
      onClose();
    });
  }, [fadeAnim, fanAnim, onClose]);

  const handleSelectMission = useCallback(
    (mission: ChallengeWithProgress) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      triggerSuccessHaptic();
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fanAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start(() => {
        onClose();
        model.openChallengeMission(mission);
      });
    },
    [fadeAnim, fanAnim, onClose, model]
  );

  // Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDismiss();
      return true;
    });
    return () => sub.remove();
  }, [handleDismiss]);

  // Center positions for the 3 circles
  const c0X = anchorX - spreadX;
  const c0Y = anchorY - leftRightY;

  const c1X = anchorX;
  const c1Y = anchorY - centerY;

  const c2X = anchorX + spreadX;
  const c2Y = anchorY - leftRightY;

  // Hit-testing helper
  const calculateHoveredIndex = useCallback(
    (x: number, y: number) => {
      const distAnchor = Math.hypot(x - anchorX, y - anchorY);
      if (distAnchor < centerDiameter * 0.85) {
        return -1; // Over real Challenges button
      }

      const d0 = Math.hypot(x - c0X, y - c0Y);
      const d1 = Math.hypot(x - c1X, y - c1Y);
      const d2 = Math.hypot(x - c2X, y - c2Y);

      if (d0 < 68) return 0;
      if (d1 < 72) return 1;
      if (d2 < 68) return 2;

      // Sector direction check when dragging upward towards an image
      if (y < anchorY - centerDiameter / 2 - 10) {
        const minD = Math.min(d0, d1, d2);
        if (minD < 90) {
          if (minD === d0) return 0;
          if (minD === d1) return 1;
          if (minD === d2) return 2;
        }
      }

      return -1;
    },
    [anchorX, anchorY, centerDiameter, c0X, c0Y, c1X, c1Y, c2X, c2Y]
  );

  const updateHover = useCallback(
    (x: number, y: number) => {
      const nextIndex = calculateHoveredIndex(x, y);
      if (hoveredIndexRef.current !== nextIndex) {
        hoveredIndexRef.current = nextIndex;
        setHoveredIndex(nextIndex);
        if (nextIndex >= 0) {
          triggerSelectionHaptic();
        }
      }
    },
    [calculateHoveredIndex]
  );

  // Animate hover scale springs
  useEffect(() => {
    Animated.spring(scaleAnim0, {
      toValue: hoveredIndex === 0 ? 1.15 : hoveredIndex === 1 || hoveredIndex === 2 ? 0.95 : 1,
      tension: 130,
      friction: 8,
      useNativeDriver: true,
    }).start();

    Animated.spring(scaleAnim1, {
      toValue: hoveredIndex === 1 ? 1.15 : hoveredIndex === 0 || hoveredIndex === 2 ? 0.95 : 1,
      tension: 130,
      friction: 8,
      useNativeDriver: true,
    }).start();

    Animated.spring(scaleAnim2, {
      toValue: hoveredIndex === 2 ? 1.15 : hoveredIndex === 0 || hoveredIndex === 1 ? 0.95 : 1,
      tension: 130,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [hoveredIndex, scaleAnim0, scaleAnim1, scaleAnim2]);

  const releaseAt = useCallback((x: number, y: number) => {
    const target = calculateHoveredIndex(x, y);
    if (target >= 0 && missions[target]) handleSelectMission(missions[target]);
    else handleDismiss();
  }, [calculateHoveredIndex, missions, handleSelectMission, handleDismiss]);

  useEffect(() => {
    if (!gesture) return;
    if (gesture.phase === 'move') updateHover(gesture.x, gesture.y);
    else if (gesture.phase === 'release') releaseAt(gesture.x, gesture.y);
    else handleDismiss();
  }, [gesture, updateHover, releaseAt, handleDismiss]);

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        updateHover(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      },
      onPanResponderMove: evt => {
        updateHover(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      },
      onPanResponderRelease: evt => releaseAt(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        handleDismiss();
      },
    }), [updateHover, releaseAt, handleDismiss]);

  // SVG Connection Lines coordinates
  const anchorTopY = anchorY - centerDiameter / 2;
  const leftLineEndY = c0Y + circleSizeSide / 2 + 16;
  const centerLineEndY = c1Y + circleSizeCenter / 2 + 16;
  const rightLineEndY = c2Y + circleSizeSide / 2 + 16;

  // Quadratic curve control points
  const leftControlX = anchorX - spreadX * 0.28;
  const leftControlY = anchorTopY - leftRightY * 0.42;

  const rightControlX = anchorX + spreadX * 0.28;
  const rightControlY = anchorTopY - leftRightY * 0.42;

  // Glowing midpoint nodes (t=0.5 on bezier)
  const leftNodeX = 0.25 * (anchorX - 16) + 0.5 * leftControlX + 0.25 * (anchorX - spreadX);
  const leftNodeY = 0.25 * (anchorTopY + 2) + 0.5 * leftControlY + 0.25 * leftLineEndY;

  const centerNodeX = anchorX;
  const centerNodeY = (anchorTopY + centerLineEndY) / 2;

  const rightNodeX = 0.25 * (anchorX + 16) + 0.5 * rightControlX + 0.25 * (anchorX + spreadX);
  const rightNodeY = 0.25 * (anchorTopY + 2) + 0.5 * rightControlY + 0.25 * rightLineEndY;

  const fallback = (
    <View style={styles.fallback}>
      <Ionicons name="leaf" size={26} color="#34D399" />
    </View>
  );

  return (
      <View style={[styles.screen, StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]} {...panResponder.panHandlers}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.scrim,
            {
              bottom: 0,
              opacity: fadeAnim,
            },
          ]}
        />

        {/* SVG Radial Connector Lines with glowing nodes */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fanAnim }]} pointerEvents="none">
          <Svg style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }]}>
            {/* Left curved line */}
            <Path
              d={`M ${anchorX - 16} ${anchorTopY + 2} Q ${leftControlX} ${leftControlY} ${anchorX - spreadX} ${leftLineEndY}`}
              stroke={hoveredIndex === 0 ? '#6EE7B7' : '#34D399'}
              strokeWidth={hoveredIndex === 0 ? '3.5' : '2.2'}
              fill="none"
              strokeLinecap="round"
            />
            {/* Left node dot */}
            <Circle
              cx={leftNodeX}
              cy={leftNodeY}
              r={hoveredIndex === 0 ? '6' : '4.5'}
              fill={hoveredIndex === 0 ? '#6EE7B7' : '#34D399'}
            />

            {/* Center vertical line */}
            <Line
              x1={anchorX}
              y1={anchorTopY}
              x2={anchorX}
              y2={centerLineEndY}
              stroke={hoveredIndex === 1 ? '#6EE7B7' : '#34D399'}
              strokeWidth={hoveredIndex === 1 ? '3.5' : '2.2'}
              strokeLinecap="round"
            />
            {/* Center node dot */}
            <Circle
              cx={centerNodeX}
              cy={centerNodeY}
              r={hoveredIndex === 1 ? '6' : '4.5'}
              fill={hoveredIndex === 1 ? '#6EE7B7' : '#34D399'}
            />

            {/* Right curved line */}
            <Path
              d={`M ${anchorX + 16} ${anchorTopY + 2} Q ${rightControlX} ${rightControlY} ${anchorX + spreadX} ${rightLineEndY}`}
              stroke={hoveredIndex === 2 ? '#6EE7B7' : '#34D399'}
              strokeWidth={hoveredIndex === 2 ? '3.5' : '2.2'}
              fill="none"
              strokeLinecap="round"
            />
            {/* Right node dot */}
            <Circle
              cx={rightNodeX}
              cy={rightNodeY}
              r={hoveredIndex === 2 ? '6' : '4.5'}
              fill={hoveredIndex === 2 ? '#6EE7B7' : '#34D399'}
            />
          </Svg>
        </Animated.View>

        {/* ─── Item 0: Left Circle & Pill ─── */}
        {missions[0] && (
          <Animated.View
            style={[
              styles.circleItemAbsolute,
              {
                left: c0X - circleSizeSide / 2,
                top: c0Y - circleSizeSide / 2,
                width: circleSizeSide,
                opacity: fanAnim,
                transform: [
                  {
                    translateX: fanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [spreadX * 0.45, 0],
                    }),
                  },
                  {
                    translateY: fanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [leftRightY * 0.45, 0],
                    }),
                  },
                  {
                    scale: Animated.multiply(
                      fanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                      scaleAnim0
                    ),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.circleRing,
                {
                  width: circleSizeSide,
                  height: circleSizeSide,
                  borderRadius: circleSizeSide / 2,
                  borderColor: hoveredIndex === 0 ? '#6EE7B7' : '#34D399',
                  shadowColor: hoveredIndex === 0 ? '#6EE7B7' : '#34D399',
                  shadowRadius: hoveredIndex === 0 ? 16 : 10,
                },
              ]}
            >
              <FastImage
                source={{ uri: missions[0].imageUrl }}
                style={styles.imageFill}
                contentFit="cover"
                fallback={fallback}
              />
            </View>

            {/* Pill: Leaves and Coins */}
            <View
              style={[
                styles.rewardPill,
                hoveredIndex === 0 && {
                  borderColor: '#6EE7B7',
                  backgroundColor: '#0C2D1F',
                },
              ]}
            >
              <Ionicons name="leaf" size={13} color="#34D399" />
              <Text style={styles.pillTextLeaf}>+{missions[0].expReward || 100}</Text>
              <View style={styles.pillDivider} />
              <FastImage
                source={require('../../../assets/coin.png')}
                style={styles.pillCoinIcon}
                contentFit="contain"
              />
              <Text style={styles.pillTextCoin}>
                +{missions[0].ecoCoinReward > 0 ? missions[0].ecoCoinReward : 20}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ─── Item 1: Center Circle & Pill (Raised) ─── */}
        {missions[1] && (
          <Animated.View
            style={[
              styles.circleItemAbsolute,
              {
                left: c1X - circleSizeCenter / 2,
                top: c1Y - circleSizeCenter / 2,
                width: circleSizeCenter,
                opacity: fanAnim,
                transform: [
                  {
                    translateY: fanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [centerY * 0.45, 0],
                    }),
                  },
                  {
                    scale: Animated.multiply(
                      fanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                      scaleAnim1
                    ),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.circleRing,
                {
                  width: circleSizeCenter,
                  height: circleSizeCenter,
                  borderRadius: circleSizeCenter / 2,
                  borderColor: hoveredIndex === 1 ? '#6EE7B7' : '#34D399',
                  shadowColor: hoveredIndex === 1 ? '#6EE7B7' : '#34D399',
                  shadowRadius: hoveredIndex === 1 ? 16 : 10,
                },
              ]}
            >
              <FastImage
                source={{ uri: missions[1].imageUrl }}
                style={styles.imageFill}
                contentFit="cover"
                fallback={fallback}
              />
            </View>

            {/* Pill: Leaves and Coins */}
            <View
              style={[
                styles.rewardPill,
                hoveredIndex === 1 && {
                  borderColor: '#6EE7B7',
                  backgroundColor: '#0C2D1F',
                },
              ]}
            >
              <Ionicons name="leaf" size={13} color="#34D399" />
              <Text style={styles.pillTextLeaf}>+{missions[1].expReward || 100}</Text>
              <View style={styles.pillDivider} />
              <FastImage
                source={require('../../../assets/coin.png')}
                style={styles.pillCoinIcon}
                contentFit="contain"
              />
              <Text style={styles.pillTextCoin}>
                +{missions[1].ecoCoinReward > 0 ? missions[1].ecoCoinReward : 20}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ─── Item 2: Right Circle & Pill ─── */}
        {missions[2] && (
          <Animated.View
            style={[
              styles.circleItemAbsolute,
              {
                left: c2X - circleSizeSide / 2,
                top: c2Y - circleSizeSide / 2,
                width: circleSizeSide,
                opacity: fanAnim,
                transform: [
                  {
                    translateX: fanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-spreadX * 0.45, 0],
                    }),
                  },
                  {
                    translateY: fanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [leftRightY * 0.45, 0],
                    }),
                  },
                  {
                    scale: Animated.multiply(
                      fanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                      scaleAnim2
                    ),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.circleRing,
                {
                  width: circleSizeSide,
                  height: circleSizeSide,
                  borderRadius: circleSizeSide / 2,
                  borderColor: hoveredIndex === 2 ? '#6EE7B7' : '#34D399',
                  shadowColor: hoveredIndex === 2 ? '#6EE7B7' : '#34D399',
                  shadowRadius: hoveredIndex === 2 ? 16 : 10,
                },
              ]}
            >
              <FastImage
                source={{ uri: missions[2].imageUrl }}
                style={styles.imageFill}
                contentFit="cover"
                fallback={fallback}
              />
            </View>

            {/* Pill: Leaves and Coins */}
            <View
              style={[
                styles.rewardPill,
                hoveredIndex === 2 && {
                  borderColor: '#6EE7B7',
                  backgroundColor: '#0C2D1F',
                },
              ]}
            >
              <Ionicons name="leaf" size={13} color="#34D399" />
              <Text style={styles.pillTextLeaf}>+{missions[2].expReward || 200}</Text>
              <View style={styles.pillDivider} />
              <FastImage
                source={require('../../../assets/coin.png')}
                style={styles.pillCoinIcon}
                contentFit="contain"
              />
              <Text style={styles.pillTextCoin}>
                +{missions[2].ecoCoinReward > 0 ? missions[2].ecoCoinReward : 50}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ─── Glowing Anchor Ring directly outlining the real Challenges trophy circle ─── */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.challengesGlowRing,
            {
              left: anchorX - centerDiameter / 2,
              top: anchorY - centerDiameter / 2,
              width: centerDiameter,
              height: centerDiameter,
              borderRadius: centerDiameter / 2,
              backgroundColor: '#EDF6F1',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: fanAnim,
              borderColor: hoveredIndex === -1 ? '#6EE7B7' : '#34D399',
              shadowColor: hoveredIndex === -1 ? '#6EE7B7' : '#34D399',
            },
          ]}
        >
          <Ionicons name="trophy-outline" size={Math.round(iconSize * 1.35)} color="#8A959F" />
        </Animated.View>
      </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(2, 14, 9, 0.72)',
  },
  circleItemAbsolute: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleRing: {
    overflow: 'hidden',
    borderWidth: 2.8,
    backgroundColor: '#072418',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    elevation: 10,
  },
  imageFill: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071A12',
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    marginTop: 4,
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
    minWidth: 84,
  },
  pillTextLeaf: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  pillDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(52, 211, 153, 0.3)',
    marginHorizontal: 3,
  },
  pillCoinIcon: {
    width: 13,
    height: 13,
  },
  pillTextCoin: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
  },
  fallback: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#072418',
  },
  challengesGlowRing: {
    position: 'absolute',
    borderWidth: 2.2,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
});
