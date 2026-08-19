import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StyleProp, ViewStyle, useWindowDimensions, Easing } from 'react-native';
import { moderateScale, responsiveFontSize, scale, verticalScale } from '../../app/utils/responsive';

export function SkeletonBox({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: '#E2EBE5',
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton for Home Dashboard
 */
export function HomeViewSkeleton() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  return (
    <View style={styles.container}>
      {/* Top Greeting Skeleton */}
      <View style={{ marginBottom: verticalScale(14) }}>
        <SkeletonBox width={scale(180)} height={verticalScale(28)} borderRadius={12} style={{ marginBottom: 8 }} />
        <SkeletonBox width={scale(240)} height={verticalScale(16)} borderRadius={8} />
      </View>

      {/* AI Bar Skeleton */}
      <SkeletonBox width="100%" height={verticalScale(50)} borderRadius={moderateScale(22)} style={{ marginBottom: verticalScale(18) }} />

      {/* Top Stats Cards (Side-by-side on tablet) */}
      {isTablet ? (
        <View style={{ flexDirection: 'row', gap: scale(14), marginBottom: verticalScale(16) }}>
          <View style={{ flex: 1 }}>
            <SkeletonBox width="100%" height={verticalScale(140)} borderRadius={moderateScale(24)} />
          </View>
          <View style={{ flex: 1 }}>
            <SkeletonBox width="100%" height={verticalScale(140)} borderRadius={moderateScale(24)} />
          </View>
        </View>
      ) : (
        <View style={{ gap: verticalScale(16), marginBottom: verticalScale(18) }}>
          <SkeletonBox width="100%" height={verticalScale(140)} borderRadius={moderateScale(24)} />
          <SkeletonBox width="100%" height={verticalScale(140)} borderRadius={moderateScale(24)} />
        </View>
      )}

      {/* Leaderboard Snippet Skeleton */}
      <SkeletonBox width="100%" height={verticalScale(76)} borderRadius={moderateScale(20)} style={{ marginBottom: verticalScale(16) }} />

      {/* Featured Lesson Skeleton */}
      <View style={{ marginTop: verticalScale(8) }}>
        <SkeletonBox width={scale(100)} height={verticalScale(16)} borderRadius={8} style={{ marginBottom: verticalScale(10) }} />
        <SkeletonBox width="100%" height={verticalScale(160)} borderRadius={moderateScale(22)} />
      </View>
    </View>
  );
}

/**
 * Skeleton for Learn / Eco Academy Tab
 */
export function LearnViewSkeleton() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  return (
    <View style={styles.container}>
      {/* Title & Subtitle */}
      <SkeletonBox width={scale(160)} height={verticalScale(26)} borderRadius={10} style={{ marginBottom: 6 }} />
      <SkeletonBox width={scale(260)} height={verticalScale(16)} borderRadius={8} style={{ marginBottom: verticalScale(14) }} />

      {/* Progress Banner Skeleton */}
      <SkeletonBox width="100%" height={verticalScale(100)} borderRadius={moderateScale(22)} style={{ marginBottom: verticalScale(14) }} />

      {/* Horizontal Category Chips */}
      <View style={{ flexDirection: 'row', gap: scale(8), marginBottom: verticalScale(18) }}>
        <SkeletonBox width={scale(84)} height={verticalScale(34)} borderRadius={moderateScale(17)} />
        <SkeletonBox width={scale(96)} height={verticalScale(34)} borderRadius={moderateScale(17)} />
        <SkeletonBox width={scale(80)} height={verticalScale(34)} borderRadius={moderateScale(17)} />
        <SkeletonBox width={scale(90)} height={verticalScale(34)} borderRadius={moderateScale(17)} />
      </View>

      {/* Lesson Cards Grid */}
      <View style={isTablet ? { flexDirection: 'row', flexWrap: 'wrap', gap: scale(12) } : { gap: verticalScale(14) }}>
        {[1, 2, 3, 4].map((item) => (
          <View key={item} style={isTablet ? { width: '48.5%' } : { width: '100%' }}>
            <View style={styles.lessonCardSkeleton}>
              <SkeletonBox width={scale(56)} height={scale(56)} borderRadius={moderateScale(14)} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBox width="40%" height={12} borderRadius={6} />
                <SkeletonBox width="85%" height={16} borderRadius={8} />
                <SkeletonBox width="60%" height={12} borderRadius={6} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Skeleton for Tasks & Challenges Tab
 */
export function ChallengesViewSkeleton() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  return (
    <View style={styles.container}>
      {/* Search and Category filters */}
      <SkeletonBox width="100%" height={verticalScale(46)} borderRadius={moderateScale(20)} style={{ marginBottom: verticalScale(12) }} />
      <View style={{ flexDirection: 'row', gap: scale(8), marginBottom: verticalScale(16) }}>
        <SkeletonBox width={scale(70)} height={verticalScale(32)} borderRadius={16} />
        <SkeletonBox width={scale(80)} height={verticalScale(32)} borderRadius={16} />
        <SkeletonBox width={scale(90)} height={verticalScale(32)} borderRadius={16} />
        <SkeletonBox width={scale(75)} height={verticalScale(32)} borderRadius={16} />
      </View>

      {/* Challenge Cards Grid */}
      <View style={isTablet ? { flexDirection: 'row', flexWrap: 'wrap', gap: scale(14) } : { gap: verticalScale(16) }}>
        {[1, 2, 3, 4].map((item) => (
          <View key={item} style={[styles.challengeCardSkeleton, isTablet && { width: '48.5%' }]}>
            <SkeletonBox width="100%" height={verticalScale(140)} borderRadius={moderateScale(18)} />
            <View style={{ padding: moderateScale(14), gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <SkeletonBox width={scale(70)} height={14} borderRadius={6} />
                <SkeletonBox width={scale(50)} height={14} borderRadius={6} />
              </View>
              <SkeletonBox width="80%" height={18} borderRadius={8} />
              <SkeletonBox width="95%" height={14} borderRadius={6} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <SkeletonBox width={scale(80)} height={16} borderRadius={6} />
                <SkeletonBox width={scale(90)} height={verticalScale(36)} borderRadius={moderateScale(14)} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Skeleton for Community Leaderboard
 */
export function LeaderboardSkeleton() {
  return (
    <View style={{ gap: verticalScale(12), marginTop: verticalScale(10) }}>
      {/* Podium Top 3 Skeleton */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', marginBottom: verticalScale(20), paddingHorizontal: scale(10) }}>
        {/* 2nd Place */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={scale(54)} height={scale(54)} borderRadius={scale(27)} />
          <SkeletonBox width={scale(60)} height={12} borderRadius={6} />
          <SkeletonBox width={scale(70)} height={verticalScale(70)} borderRadius={14} />
        </View>
        {/* 1st Place */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={scale(68)} height={scale(68)} borderRadius={scale(34)} />
          <SkeletonBox width={scale(70)} height={14} borderRadius={6} />
          <SkeletonBox width={scale(80)} height={verticalScale(95)} borderRadius={14} />
        </View>
        {/* 3rd Place */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={scale(50)} height={scale(50)} borderRadius={scale(25)} />
          <SkeletonBox width={scale(55)} height={12} borderRadius={6} />
          <SkeletonBox width={scale(65)} height={verticalScale(55)} borderRadius={14} />
        </View>
      </View>

      {/* Row Items */}
      {[1, 2, 3, 4, 5].map((item) => (
        <View key={item} style={styles.leaderboardRowSkeleton}>
          <SkeletonBox width={scale(24)} height={16} borderRadius={6} />
          <SkeletonBox width={scale(40)} height={scale(40)} borderRadius={scale(20)} />
          <View style={{ flex: 1, gap: 4 }}>
            <SkeletonBox width="60%" height={14} borderRadius={6} />
            <SkeletonBox width="35%" height={10} borderRadius={5} />
          </View>
          <SkeletonBox width={scale(50)} height={16} borderRadius={6} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(12),
  },
  lessonCardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(18),
    padding: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    borderWidth: 1,
    borderColor: '#E6F4EC',
  },
  challengeCardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(22),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6F4EC',
  },
  leaderboardRowSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: moderateScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
});
