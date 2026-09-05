import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { triggerImpactLight } from '../utils/haptics';
import { getVisibleStreak } from '../utils/appUtils';
import { type LeaderboardData } from '../../shared/api/ecobudApi';

export interface UnifiedProgressCardProps {
  ecoPoints: number;
  currentStreak: number;
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

export function UnifiedProgressCard({
  ecoPoints,
  currentStreak,
  leaderboard,
  onOpenRoadmap,
  onOpenStreak,
  onOpenLeaderboard,
  onProgressBarMeasured,
}: UnifiedProgressCardProps) {
  const [displayPoints, setDisplayPoints] = useState(ecoPoints);
  const progressBarRef = useRef<View>(null);

  // Smooth number counting animation
  useEffect(() => {
    let animationFrameId: number;
    let startTime: number | null = null;
    const duration = 800;
    const startValue = displayPoints;
    const targetValue = ecoPoints;

    if (startValue === targetValue) return;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      const currentVal = Math.floor(startValue + (targetValue - startValue) * easeProgress);
      setDisplayPoints(currentVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayPoints(targetValue);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [ecoPoints]);

  const { currentLevelObj, nextLevelObj } = getLevelFromPoints(displayPoints);
  const isMaxLevel = currentLevelObj.level === 10;

  let progressPercent = 100;
  let pointsToNext = 0;

  if (!isMaxLevel) {
    const pointsInCurrentLevel = displayPoints - currentLevelObj.points;
    const pointsNeededForNextLevel = nextLevelObj.points - currentLevelObj.points;
    progressPercent = Math.min(100, Math.max(0, (pointsInCurrentLevel / pointsNeededForNextLevel) * 100));
    pointsToNext = Math.max(0, nextLevelObj.points - displayPoints);
  }

  const nextPerk = LEVEL_PERKS[nextLevelObj.level] || 'Exclusive perks & badges';

  // Leaderboard text calculation
  const currentUserItem = leaderboard?.items.find((item) => item.isCurrentUser) || leaderboard?.items[0];
  const userRank = currentUserItem?.rank;
  const leaderboardStripText = userRank
    ? userRank === 1
      ? '#1 this week — You are leading the board!'
      : userRank === 2
      ? '#2 this week — 1 spot from the top'
      : `#${userRank} this week — ${userRank - 1} spots from #1`
    : 'View weekly community leaderboard';

  const visibleStreak = getVisibleStreak(currentStreak);

  const handleMeasure = () => {
    if (onProgressBarMeasured && progressBarRef.current) {
      progressBarRef.current.measure((_x, _y, width, height, pageX, pageY) => {
        onProgressBarMeasured({ x: pageX, y: pageY, width, height });
      });
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#064E3B', '#047857', '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Background leaf watermarks */}
        <MaterialCommunityIcons name="leaf" size={70} color="rgba(255,255,255,0.04)" style={styles.bgLeaf1} />
        <MaterialCommunityIcons name="leaf" size={110} color="rgba(255,255,255,0.03)" style={styles.bgLeaf2} />

        {/* 1. Headline Row: Level & Points + Roadmap Link */}
        <View style={styles.headlineRow}>
          <View style={styles.levelBadgeCluster}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name={currentLevelObj.icon as any} size={scale(18)} color="#34D399" />
            </View>
            <View>
              <Text style={styles.levelSubtitle}>LEVEL {currentLevelObj.level}</Text>
              <Text style={styles.levelTitle}>{currentLevelObj.name}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerImpactLight();
              onOpenRoadmap();
            }}
            style={styles.roadmapButton}
          >
            <Text style={styles.roadmapText}>Roadmap</Text>
            <Ionicons name="chevron-forward" size={scale(12)} color="#E6F4EC" />
          </TouchableOpacity>
        </View>

        {/* Total Points Display */}
        <View style={styles.pointsRow}>
          <Text style={styles.pointsNumber}>{displayPoints}</Text>
          <Text style={styles.pointsUnit}>Eco Points</Text>
        </View>

        {/* 2. Target Milestone & Single Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressTargetText}>
              {isMaxLevel ? 'Max Level Reached! 🏆' : `Next: ${nextLevelObj.name} (Lv. ${nextLevelObj.level})`}
            </Text>
            <Text style={styles.progressFractionText}>
              {isMaxLevel ? 'Mastered' : `${pointsToNext} XP needed`}
            </Text>
          </View>

          <View
            ref={progressBarRef}
            onLayout={handleMeasure}
            style={styles.progressBarTrack}
          >
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {!isMaxLevel && (
            <Text style={styles.perkTeaserText} numberOfLines={1}>
              🎁 Unlocks: {nextPerk}
            </Text>
          )}
        </View>

        {/* 3. Inline Stats Row: Streak Pill & Weekly Leaderboard Strip */}
        <View style={styles.inlineStatsRow}>
          {/* Streak Chip */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              triggerImpactLight();
              onOpenStreak();
            }}
            style={styles.streakChip}
          >
            <Text style={styles.streakFlameIcon}>🔥</Text>
            <View>
              <Text style={styles.streakChipNumber}>
                {visibleStreak} {visibleStreak === 1 ? 'Day' : 'Days'}
              </Text>
              <Text style={styles.streakChipSub}>Streak</Text>
            </View>
          </TouchableOpacity>

          {/* Leaderboard Strip */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              triggerImpactLight();
              onOpenLeaderboard();
            }}
            style={styles.leaderboardStrip}
          >
            <View style={styles.leaderboardIconCircle}>
              <Ionicons name="trophy" size={scale(13)} color="#F59E0B" />
            </View>
            <Text style={styles.leaderboardStripText} numberOfLines={1}>
              {leaderboardStripText}
            </Text>
            <Ionicons name="chevron-forward" size={scale(12)} color="#A7F3D0" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
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
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#064E3B',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  bgLeaf1: {
    position: 'absolute',
    top: -10,
    right: 40,
  },
  bgLeaf2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
  },
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  levelBadgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  iconCircle: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelSubtitle: {
    color: '#A7F3D0',
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  levelTitle: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(16),
    fontWeight: '800',
  },
  roadmapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(12),
    gap: 3,
  },
  roadmapText: {
    color: '#E6F4EC',
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: scale(6),
    marginBottom: verticalScale(12),
  },
  pointsNumber: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(28),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pointsUnit: {
    color: '#A7F3D0',
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    opacity: 0.9,
  },
  progressContainer: {
    marginBottom: verticalScale(12),
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  progressTargetText: {
    color: '#E6F4EC',
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
  },
  progressFractionText: {
    color: '#A7F3D0',
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
  },
  progressBarTrack: {
    height: verticalScale(7),
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: moderateScale(4),
    overflow: 'hidden',
    marginBottom: verticalScale(4),
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: moderateScale(4),
  },
  perkTeaserText: {
    color: '#D1FAE5',
    fontSize: responsiveFontSize(10.5),
    fontWeight: '500',
    opacity: 0.9,
  },
  inlineStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(2),
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(14),
    gap: scale(6),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  streakFlameIcon: {
    fontSize: responsiveFontSize(14),
  },
  streakChipNumber: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(11.5),
    fontWeight: '800',
  },
  streakChipSub: {
    color: '#A7F3D0',
    fontSize: responsiveFontSize(9),
    fontWeight: '600',
  },
  leaderboardStrip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(14),
    gap: scale(6),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  leaderboardIconCircle: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardStripText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: responsiveFontSize(11),
    fontWeight: '600',
  },
});
