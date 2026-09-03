import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StyleProp, ViewStyle, useWindowDimensions, Easing } from 'react-native';
import { moderateScale, responsiveFontSize, scale, verticalScale } from '../../app/utils/responsive';
import { useTheme } from '../theme/ecoTheme';

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
  const { theme, isDark } = useTheme();
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
          backgroundColor: isDark ? theme.colors.surfaceMuted : '#E2EBE5',
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton for Home Dashboard with synchronized breathing pulse/shimmer animation
 */
export function HomeViewSkeleton() {
  const { width } = useWindowDimensions();
  const { theme, isDark } = useTheme();
  const isTablet = width >= 600;
  const boneBg = isDark ? theme.colors.surfaceMuted : '#E4E9E6';
  const pulseAnim = useRef(new Animated.Value(isDark ? 0.5 : 0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.95 : 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.5 : 0.55,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim, isDark]);

  const cardStyle = [
    {
      backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
      borderColor: isDark ? theme.colors.cardBorder : '#E4F0E8',
      borderWidth: 1,
      borderRadius: moderateScale(22),
      opacity: pulseAnim,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Greeting Skeleton */}
      <View style={{ marginBottom: verticalScale(14) }}>
        <View style={{ height: verticalScale(14), width: scale(130), borderRadius: 7, backgroundColor: boneBg, marginBottom: verticalScale(6) }} />
        <View style={{ height: verticalScale(28), width: scale(190), borderRadius: 10, backgroundColor: boneBg, marginBottom: verticalScale(8) }} />
        <View style={{ height: verticalScale(14), width: '85%', borderRadius: 7, backgroundColor: boneBg }} />
      </View>

      {/* AI Assistant Bar Skeleton */}
      <Animated.View
        style={[
          cardStyle,
          {
            height: verticalScale(50),
            paddingHorizontal: scale(16),
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: verticalScale(18),
          },
        ]}
      >
        <View style={{ width: scale(32), height: scale(32), borderRadius: scale(16), backgroundColor: boneBg }} />
        <View style={{ height: 14, width: '55%', borderRadius: 7, backgroundColor: boneBg, marginLeft: scale(10) }} />
      </Animated.View>

      {/* Quick Action Icons Placeholder */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(18) }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: scale(54), height: scale(54), borderRadius: scale(27), backgroundColor: boneBg }} />
            <View style={{ width: scale(46), height: 10, borderRadius: 5, backgroundColor: boneBg }} />
          </View>
        ))}
      </View>

      {/* Top Stats Cards (Side-by-side on tablet, stacked on phone) */}
      {isTablet ? (
        <View style={{ flexDirection: 'row', gap: scale(14), marginBottom: verticalScale(16) }}>
          <Animated.View style={[{ flex: 1, height: verticalScale(140), padding: moderateScale(16) }, cardStyle]}>
            <View style={{ height: 16, width: 80, borderRadius: 8, backgroundColor: boneBg, marginBottom: 12 }} />
            <View style={{ height: 28, width: 120, borderRadius: 10, backgroundColor: boneBg, marginBottom: 14 }} />
            <View style={{ height: 12, width: '90%', borderRadius: 6, backgroundColor: boneBg }} />
          </Animated.View>
          <Animated.View style={[{ flex: 1, height: verticalScale(140), padding: moderateScale(16) }, cardStyle]}>
            <View style={{ height: 16, width: 80, borderRadius: 8, backgroundColor: boneBg, marginBottom: 12 }} />
            <View style={{ height: 28, width: 120, borderRadius: 10, backgroundColor: boneBg, marginBottom: 14 }} />
            <View style={{ height: 12, width: '90%', borderRadius: 6, backgroundColor: boneBg }} />
          </Animated.View>
        </View>
      ) : (
        <View style={{ gap: verticalScale(14), marginBottom: verticalScale(18) }}>
          <Animated.View style={[{ height: verticalScale(130), padding: moderateScale(16) }, cardStyle]}>
            <View style={{ height: 14, width: 80, borderRadius: 7, backgroundColor: boneBg, marginBottom: 10 }} />
            <View style={{ height: 26, width: 140, borderRadius: 9, backgroundColor: boneBg, marginBottom: 12 }} />
            <View style={{ height: 12, width: '85%', borderRadius: 6, backgroundColor: boneBg }} />
          </Animated.View>
          <Animated.View style={[{ height: verticalScale(130), padding: moderateScale(16) }, cardStyle]}>
            <View style={{ height: 14, width: 80, borderRadius: 7, backgroundColor: boneBg, marginBottom: 10 }} />
            <View style={{ height: 26, width: 140, borderRadius: 9, backgroundColor: boneBg, marginBottom: 12 }} />
            <View style={{ height: 12, width: '85%', borderRadius: 6, backgroundColor: boneBg }} />
          </Animated.View>
        </View>
      )}

      {/* Leaderboard Snippet Skeleton */}
      <Animated.View
        style={[
          cardStyle,
          {
            height: verticalScale(76),
            padding: moderateScale(14),
            marginBottom: verticalScale(16),
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(10),
          },
        ]}
      >
        <View style={{ width: scale(36), height: scale(36), borderRadius: scale(18), backgroundColor: boneBg }} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 14, width: '50%', borderRadius: 7, backgroundColor: boneBg }} />
          <View style={{ height: 11, width: '75%', borderRadius: 5, backgroundColor: boneBg }} />
        </View>
        <View style={{ height: 16, width: 45, borderRadius: 8, backgroundColor: boneBg }} />
      </Animated.View>

      {/* Featured Lesson Skeleton */}
      <Animated.View style={[cardStyle, { overflow: 'hidden', marginBottom: verticalScale(16) }]}>
        <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: boneBg }} />
        <View style={{ padding: moderateScale(16) }}>
          <View style={{ height: 14, width: 60, borderRadius: 7, backgroundColor: boneBg, marginBottom: 8 }} />
          <View style={{ height: 18, width: '70%', borderRadius: 9, backgroundColor: boneBg, marginBottom: 10 }} />
          <View style={{ height: 14, width: '90%', borderRadius: 7, backgroundColor: boneBg }} />
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Skeleton for Home Dashboard CARDS ONLY (leaves Title and Ask EcoBud AI untouched)
 */
export function HomeCardsSkeleton() {
  const { width } = useWindowDimensions();
  const { theme, isDark } = useTheme();
  const isTablet = width >= 600;
  const boneBg = isDark ? theme.colors.surfaceMuted : '#E4E9E6';
  const pulseAnim = useRef(new Animated.Value(isDark ? 0.5 : 0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.95 : 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.5 : 0.55,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim, isDark]);

  const cardStyle = [
    {
      backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
      borderColor: isDark ? theme.colors.cardBorder : '#E4F0E8',
      borderWidth: 1,
      borderRadius: moderateScale(22),
      opacity: pulseAnim,
    },
  ];

  return (
    <View style={{ width: '100%' }}>
      {/* Quick Action Icons Placeholder */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(18) }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: scale(54), height: scale(54), borderRadius: scale(27), backgroundColor: boneBg }} />
            <View style={{ width: scale(46), height: 10, borderRadius: 5, backgroundColor: boneBg }} />
          </View>
        ))}
      </View>

      {/* Top Stats Cards (Side-by-side on tablet, stacked on phone) */}
      {isTablet ? (
        <View style={{ flexDirection: 'row', gap: scale(14), marginBottom: verticalScale(16) }}>
          <Animated.View style={[{ flex: 1, height: verticalScale(140), padding: moderateScale(16) }, cardStyle]}>
            <View style={{ height: 16, width: 80, borderRadius: 8, backgroundColor: boneBg, marginBottom: 12 }} />
            <View style={{ height: 28, width: 120, borderRadius: 10, backgroundColor: boneBg, marginBottom: 14 }} />
            <View style={{ height: 12, width: '90%', borderRadius: 6, backgroundColor: boneBg }} />
          </Animated.View>
          <Animated.View style={[{ flex: 1, height: verticalScale(140), padding: moderateScale(16) }, cardStyle]}>
            <View style={{ height: 16, width: 80, borderRadius: 8, backgroundColor: boneBg, marginBottom: 12 }} />
            <View style={{ height: 28, width: 120, borderRadius: 10, backgroundColor: boneBg, marginBottom: 14 }} />
            <View style={{ height: 12, width: '90%', borderRadius: 6, backgroundColor: boneBg }} />
          </Animated.View>
        </View>
      ) : (
        <View style={{ gap: verticalScale(14), marginBottom: verticalScale(18) }}>
          <Animated.View style={[{ height: verticalScale(130), padding: moderateScale(16) }, cardStyle]}>
            <View style={{ height: 14, width: 80, borderRadius: 7, backgroundColor: boneBg, marginBottom: 10 }} />
            <View style={{ height: 26, width: 140, borderRadius: 9, backgroundColor: boneBg, marginBottom: 12 }} />
            <View style={{ height: 12, width: '85%', borderRadius: 6, backgroundColor: boneBg }} />
          </Animated.View>
          <Animated.View style={[{ height: verticalScale(130), padding: moderateScale(16) }, cardStyle]}>
            <View style={{ height: 14, width: 80, borderRadius: 7, backgroundColor: boneBg, marginBottom: 10 }} />
            <View style={{ height: 26, width: 140, borderRadius: 9, backgroundColor: boneBg, marginBottom: 12 }} />
            <View style={{ height: 12, width: '85%', borderRadius: 6, backgroundColor: boneBg }} />
          </Animated.View>
        </View>
      )}

      {/* Leaderboard Snippet Skeleton */}
      <Animated.View
        style={[
          cardStyle,
          {
            height: verticalScale(76),
            padding: moderateScale(14),
            marginBottom: verticalScale(16),
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(10),
          },
        ]}
      >
        <View style={{ width: scale(36), height: scale(36), borderRadius: scale(18), backgroundColor: boneBg }} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 14, width: '50%', borderRadius: 7, backgroundColor: boneBg }} />
          <View style={{ height: 11, width: '75%', borderRadius: 5, backgroundColor: boneBg }} />
        </View>
        <View style={{ height: 16, width: 45, borderRadius: 8, backgroundColor: boneBg }} />
      </Animated.View>

      {/* Featured Lesson Skeleton */}
      <Animated.View style={[cardStyle, { overflow: 'hidden', marginBottom: verticalScale(16) }]}>
        <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: boneBg }} />
        <View style={{ padding: moderateScale(16) }}>
          <View style={{ height: 14, width: 60, borderRadius: 7, backgroundColor: boneBg, marginBottom: 8 }} />
          <View style={{ height: 18, width: '70%', borderRadius: 9, backgroundColor: boneBg, marginBottom: 10 }} />
          <View style={{ height: 14, width: '90%', borderRadius: 7, backgroundColor: boneBg }} />
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Skeleton for Learn / Eco Academy Tab
 * Matches Give & Get Hub's clean full-card skeleton pattern with dark/light mode support
 */
export function LearnViewSkeleton() {
  const { width } = useWindowDimensions();
  const { theme, isDark } = useTheme();
  const isTablet = width >= 600;
  const boneBg = isDark ? theme.colors.surfaceMuted : '#E4E9E6';
  const pulseAnim = useRef(new Animated.Value(isDark ? 0.5 : 0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.95 : 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.5 : 0.55,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim, isDark]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header Placeholder */}
      <View style={{ marginBottom: verticalScale(14) }}>
        <View style={{ height: verticalScale(14), width: scale(110), borderRadius: 7, backgroundColor: boneBg, marginBottom: verticalScale(6) }} />
        <View style={{ height: verticalScale(26), width: scale(180), borderRadius: 10, backgroundColor: boneBg, marginBottom: verticalScale(8) }} />
        <View style={{ height: verticalScale(14), width: '92%', borderRadius: 7, backgroundColor: boneBg }} />
      </View>

      {/* Full-Card Skeletons (Identical to Give & Get Hub's SwapListingSkeleton card structure) */}
      <View style={isTablet ? { flexDirection: 'row', flexWrap: 'wrap', gap: scale(14) } : { gap: verticalScale(14) }}>
        {[1, 2, 3].map((item) => (
          <Animated.View
            key={item}
            style={[
              styles.challengeCardSkeleton,
              isTablet && { width: '48.5%' },
              {
                backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                borderColor: isDark ? theme.colors.cardBorder : '#E4F0E8',
                borderRadius: moderateScale(22),
                opacity: pulseAnim,
                overflow: 'hidden',
                borderWidth: 1,
              },
            ]}
          >
            {/* Aspect Ratio 16/9 Card Image Banner */}
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: boneBg }} />
            
            {/* Card Body */}
            <View style={{ padding: moderateScale(16) }}>
              <View style={{ height: 14, width: 60, borderRadius: 7, backgroundColor: boneBg, marginBottom: 8 }} />
              <View style={{ height: 18, width: '70%', borderRadius: 9, backgroundColor: boneBg, marginBottom: 10 }} />
              <View style={{ height: 14, width: '90%', borderRadius: 7, backgroundColor: boneBg, marginBottom: 14 }} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ height: 28, width: 80, borderRadius: 14, backgroundColor: boneBg }} />
                <View style={{ height: 28, width: 80, borderRadius: 14, backgroundColor: boneBg }} />
              </View>
            </View>
          </Animated.View>
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
  const { theme, isDark } = useTheme();
  const isTablet = width >= 600;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
          <View key={item} style={[styles.challengeCardSkeleton, isTablet && { width: '48.5%' }, {
            backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
            borderColor: isDark ? theme.colors.cardBorder : '#E6F4EC',
          }]}>
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
 * Skeleton for Tracker View CARDS ONLY (leaves TopNavbar untouched)
 */
export function TrackerCardsSkeleton() {
  const { theme, isDark } = useTheme();
  const boneBg = isDark ? theme.colors.surfaceMuted : '#E4E9E6';
  const pulseAnim = useRef(new Animated.Value(isDark ? 0.5 : 0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.95 : 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.5 : 0.55,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim, isDark]);

  const cardStyle = [
    {
      backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
      borderColor: isDark ? theme.colors.cardBorder : '#E4F0E8',
      borderWidth: 1,
      borderRadius: moderateScale(24),
      opacity: pulseAnim,
    },
  ];

  return (
    <View style={{ width: '100%' }}>
      {/* Current Streak & Eco Points Card */}
      <Animated.View style={[{ height: verticalScale(130), padding: moderateScale(18), marginBottom: verticalScale(20) }, cardStyle]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(12) }}>
          <View style={{ height: 16, width: 90, borderRadius: 8, backgroundColor: boneBg }} />
          <View style={{ height: 16, width: 70, borderRadius: 8, backgroundColor: boneBg }} />
        </View>
        <View style={{ height: 28, width: 150, borderRadius: 10, backgroundColor: boneBg, marginBottom: verticalScale(10) }} />
        <View style={{ height: 12, width: '80%', borderRadius: 6, backgroundColor: boneBg }} />
      </Animated.View>

      {/* Level Progress Card */}
      <Animated.View style={[{ height: verticalScale(120), padding: moderateScale(18), marginBottom: verticalScale(20) }, cardStyle]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(10) }}>
          <View style={{ height: 16, width: 110, borderRadius: 8, backgroundColor: boneBg }} />
          <View style={{ height: 16, width: 50, borderRadius: 8, backgroundColor: boneBg }} />
        </View>
        <View style={{ height: 12, width: '100%', borderRadius: 6, backgroundColor: boneBg, marginBottom: verticalScale(12) }} />
        <View style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: boneBg }} />
      </Animated.View>

      {/* Segmented Switch Buttons Placeholder */}
      <Animated.View style={[{ height: verticalScale(46), borderRadius: moderateScale(14), marginBottom: verticalScale(16) }, cardStyle]} />

      {/* Activity Calendar Box Skeleton */}
      <Animated.View style={[{ padding: moderateScale(18), borderRadius: moderateScale(22) }, cardStyle]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(16) }}>
          <View style={{ height: 18, width: 120, borderRadius: 9, backgroundColor: boneBg }} />
          <View style={{ height: 16, width: 90, borderRadius: 8, backgroundColor: boneBg }} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(16) }}>
          <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: boneBg }} />
          <View style={{ height: 20, width: 140, borderRadius: 10, backgroundColor: boneBg }} />
          <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: boneBg }} />
        </View>

        {/* 7 Days of Week Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(12) }}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View key={i} style={{ height: 14, width: 14, borderRadius: 7, backgroundColor: boneBg }} />
          ))}
        </View>

        {/* Calendar Grid Cells */}
        <View style={{ gap: verticalScale(10) }}>
          {[1, 2, 3, 4].map((row) => (
            <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                <View key={col} style={{ width: scale(32), height: scale(32), borderRadius: scale(8), backgroundColor: boneBg }} />
              ))}
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Skeleton for Community Leaderboard
 */
export function LeaderboardSkeleton() {
  const { theme, isDark } = useTheme();

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
        <View
          key={item}
          style={[
            styles.leaderboardRowSkeleton,
            {
              backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
              borderColor: isDark ? theme.colors.cardBorder : '#E8F5E9',
            },
          ]}
        >
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

