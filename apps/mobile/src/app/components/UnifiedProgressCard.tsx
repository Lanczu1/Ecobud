import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { triggerImpactLight } from '../utils/haptics';
import { getVisibleStreak } from '../utils/appUtils';
import { type LeaderboardData } from '../../shared/api/ecobudApi';
import { StreakFlame } from './StreakFlame';
import { useAccessibility } from '../../shared/accessibility/AccessibilityContext';
import { useTheme } from '../../shared/theme/ecoTheme';

export interface UnifiedProgressCardProps {
  ecoPoints: number;
  currentStreak: number;
  streakActive?: boolean;
  leaderboard?: LeaderboardData | null;
  onOpenRoadmap: () => void;
  onOpenStreak: () => void;
  onOpenLeaderboard: () => void;
  onProgressBarMeasured?: (layout: { x: number; y: number; width: number; height: number }) => void;
}

export const LEVELS = [
  { level: 1, name: 'Eco Seedling', icon: 'sprout', points: 0 },
  { level: 2, name: 'Eco Learner', icon: 'book-open-variant', points: 100 },
  { level: 3, name: 'Eco Advocate', icon: 'bullhorn', points: 300 },
  { level: 4, name: 'Eco Warrior', icon: 'recycle', points: 600 },
  { level: 5, name: 'Eco Champion', icon: 'trophy', points: 1000 },
  { level: 6, name: 'Eco Guardian', icon: 'tree', points: 1500 },
  { level: 7, name: 'Eco Leader', icon: 'earth', points: 2200 },
  { level: 8, name: 'Eco Ambassador', icon: 'heart', points: 3000 },
  { level: 9, name: 'Eco Hero', icon: 'shield-star', points: 4000 },
  { level: 10, name: 'Eco Legend', icon: 'crown', points: 5500 },
];

export const LEVEL_PERKS: Record<number, string> = {
  1: 'Basic habits & daily eco tracker',
  2: 'Earn 1.1x coins on habits',
  3: 'Unlock Community Missions',
  4: 'Warrior Badge & exclusive shop rewards',
  5: 'VIP Leaderboard highlight & event badges',
  6: 'Bonus monthly eco points drop',
  7: 'Special community leader permissions',
  8: 'Official EcoBud Ambassador status',
  9: 'Custom profile banner & title',
  10: 'Max Tier: EcoBud Legend Trophy',
};

export function getLevelFromPoints(points: number) {
  let currentLevelObj = LEVELS[0];
  let nextLevelObj = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].points) {
      currentLevelObj = LEVELS[i];
      nextLevelObj = LEVELS[i + 1] || LEVELS[i];
      break;
    }
  }

  return { currentLevelObj, nextLevelObj };
}

const AnimatedPointsCount = React.memo(function AnimatedPointsCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    let frame = 0;
    let startedAt: number | null = null;
    const start = display;
    const duration = 800;
    if (start === value) return;
    const tick = (now: number) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min((now - startedAt) / duration, 1);
      setDisplay(Math.floor(start + (value - start) * (1 - (1 - progress) ** 2)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <Text style={styles.pointsNumber}>{display}</Text>;
});

export function UnifiedProgressCard({
  ecoPoints,
  currentStreak,
  streakActive = false,
  leaderboard,
  onOpenRoadmap,
  onOpenStreak,
  onOpenLeaderboard,
  onProgressBarMeasured,
}: UnifiedProgressCardProps) {
  const { preferences } = useAccessibility();
  const { theme, isDark } = useTheme();
  const largeText = preferences.size === 'Large';
  const progressBarRef = useRef<View>(null);
  const { currentLevelObj, nextLevelObj } = getLevelFromPoints(ecoPoints);
  const isMaxLevel = currentLevelObj.level === 10;

  let progressPercent = 100;
  let pointsToNext = 0;

  if (!isMaxLevel) {
    const pointsInCurrentLevel = ecoPoints - currentLevelObj.points;
    const pointsNeededForNextLevel = nextLevelObj.points - currentLevelObj.points;
    progressPercent = Math.min(100, Math.max(0, (pointsInCurrentLevel / pointsNeededForNextLevel) * 100));
    pointsToNext = Math.max(0, nextLevelObj.points - ecoPoints);
  }

  // The card names one reward; the roadmap lists the rest.
  const nextReward = (LEVEL_PERKS[nextLevelObj.level] || 'Exclusive perks & badges').split(' & ')[0];

  const userRank = leaderboard?.items.find((item) => item.isCurrentUser)?.rank ?? leaderboard?.currentUserRank ?? null;
  const visibleStreak = getVisibleStreak(currentStreak);

  const handleMeasure = () => {
    if (onProgressBarMeasured && progressBarRef.current) {
      progressBarRef.current.measureInWindow((x, y, width, height) => {
        onProgressBarMeasured({ x, y, width, height });
      });
    }
  };

  const secondaryCardStyle = { backgroundColor: theme.colors.card, borderColor: theme.colors.border };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#064E3B', '#047857', '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* 1. Level & title */}
        <View style={styles.levelRow}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={currentLevelObj.icon as any} size={scale(18)} color="#6EE7B7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.levelSubtitle}>LEVEL {currentLevelObj.level}</Text>
            <Text style={styles.levelTitle}>{currentLevelObj.name}</Text>
          </View>
        </View>

        {/* 2. Eco Points */}
        <View style={styles.pointsRow}>
          <AnimatedPointsCount value={ecoPoints} />
          <Text style={styles.pointsUnit}>Eco Points</Text>
        </View>

        {/* 3. Progress to the next level */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressHeadline}>
            {isMaxLevel ? 'Highest level reached' : `${pointsToNext} Eco Points to Level ${nextLevelObj.level}`}
          </Text>
          <View
            ref={progressBarRef}
            onLayout={handleMeasure}
            style={styles.progressBarTrack}
          >
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          {!isMaxLevel && (
            <View style={styles.progressFooterRow}>
              <Text style={styles.progressFooterText}>Next: {nextLevelObj.name}</Text>
              <Text style={styles.progressFooterText}>{ecoPoints} / {nextLevelObj.points}</Text>
            </View>
          )}
        </View>

        {/* 4. Next reward + roadmap */}
        <View style={styles.footerRow}>
          {!isMaxLevel && (
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardLabel}>Next reward</Text>
              <Text style={styles.rewardName} numberOfLines={1}>{nextReward}</Text>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open level roadmap"
            onPress={() => {
              triggerImpactLight();
              onOpenRoadmap();
            }}
            style={styles.roadmapButton}
          >
            <Text style={styles.roadmapText}>Roadmap</Text>
            <Ionicons name="chevron-forward" size={scale(16)} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Streak and leaderboard sit below the card so they don't compete with level progress */}
      <View style={[styles.secondaryRow, largeText && { flexDirection: 'column' }]}>
        <TouchableOpacity
          activeOpacity={0.82}
          accessibilityRole="button"
          onPress={() => {
            triggerImpactLight();
            onOpenStreak();
          }}
          style={[styles.secondaryCard, secondaryCardStyle]}
        >
          <StreakFlame count={currentStreak} active={streakActive} size={26} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.secondaryTitle, { color: theme.colors.textPrimary }]}>{visibleStreak}</Text>
            <Text style={[styles.secondarySub, { color: theme.colors.textMuted }]} numberOfLines={1}>Challenge streak</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.82}
          accessibilityRole="button"
          onPress={() => {
            triggerImpactLight();
            onOpenLeaderboard();
          }}
          style={[styles.secondaryCard, secondaryCardStyle]}
        >
          <Ionicons name="trophy" size={scale(20)} color={isDark ? '#FBBF24' : '#B45309'} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.secondaryTitle, { color: theme.colors.textPrimary }]}>{userRank ? `#${userRank}` : 'Leaderboard'}</Text>
            <Text style={[styles.secondarySub, { color: theme.colors.textMuted }]} numberOfLines={1}>{userRank ? 'Weekly leaderboard' : 'This week'}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: verticalScale(14),
  },
  card: {
    borderRadius: moderateScale(22),
    padding: moderateScale(16),
    overflow: 'hidden',
    shadowColor: '#064E3B',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginBottom: verticalScale(10),
  },
  iconCircle: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelSubtitle: {
    color: '#D1FAE5',
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
    letterSpacing: 1,
  },
  levelTitle: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(18),
    fontWeight: '800',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: scale(8),
    marginBottom: verticalScale(10),
  },
  pointsNumber: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(32),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pointsUnit: {
    color: '#D1FAE5',
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: verticalScale(12),
  },
  progressHeadline: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    marginBottom: verticalScale(6),
  },
  progressBarTrack: {
    height: verticalScale(8),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: moderateScale(5),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6EE7B7',
    borderRadius: moderateScale(5),
  },
  progressFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: scale(8),
    marginTop: verticalScale(4),
  },
  progressFooterText: {
    color: '#D1FAE5',
    fontSize: responsiveFontSize(13),
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: scale(12),
    paddingTop: verticalScale(10),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
  },
  rewardLabel: {
    color: '#D1FAE5',
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
  },
  rewardName: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(15),
    fontWeight: '800',
  },
  roadmapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    gap: scale(4),
  },
  roadmapText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: scale(8),
    marginTop: verticalScale(8),
  },
  secondaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    gap: scale(8),
  },
  secondaryTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: '800',
  },
  secondarySub: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
  },
});
