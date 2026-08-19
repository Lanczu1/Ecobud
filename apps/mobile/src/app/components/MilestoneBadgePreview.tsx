import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { getLevelFromPoints } from './LevelCard';
import { triggerImpactLight } from '../utils/haptics';

export interface MilestoneBadgePreviewProps {
  ecoPoints: number;
  onPress?: () => void;
}

const LEVEL_PERKS: Record<number, string> = {
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

export function MilestoneBadgePreview({ ecoPoints, onPress }: MilestoneBadgePreviewProps) {
  const { currentLevelObj, nextLevelObj } = getLevelFromPoints(ecoPoints);
  const isMaxLevel = currentLevelObj.level === 10;

  const pointsInCurrentLevel = ecoPoints - currentLevelObj.points;
  const pointsNeededForNextLevel = nextLevelObj.points - currentLevelObj.points;
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, (pointsInCurrentLevel / (pointsNeededForNextLevel || 1)) * 100));
  const pointsToNext = Math.max(0, nextLevelObj.points - ecoPoints);
  const nextPerk = LEVEL_PERKS[nextLevelObj.level] || 'Exclusive badge & perk';

  const handlePress = () => {
    triggerImpactLight();
    if (onPress) onPress();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handlePress}
        style={styles.cardWrapper}
      >
        <LinearGradient
          colors={['#FFFFFF', '#F6FBF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.tag}>
                <Ionicons name="ribbon-outline" size={scale(12)} color="#126027" />
                <Text style={styles.tagText}>NEXT MILESTONE</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.viewDetailsText}>View All Levels</Text>
              <Ionicons name="chevron-forward" size={scale(12)} color="#126027" />
            </View>
          </View>

          {/* Main Content Row */}
          <View style={styles.contentRow}>
            {/* Badge Icon */}
            <View style={styles.badgeContainer}>
              <LinearGradient
                colors={isMaxLevel ? ['#F59E0B', '#D97706'] : ['#E8F5E9', '#C8E6C9']}
                style={styles.badgeCircle}
              >
                <MaterialCommunityIcons
                  name={(isMaxLevel ? currentLevelObj.icon : nextLevelObj.icon) as any}
                  size={scale(26)}
                  color={isMaxLevel ? '#FFFFFF' : '#126027'}
                />
              </LinearGradient>
              {!isMaxLevel && (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={scale(10)} color="#FFFFFF" />
                </View>
              )}
            </View>

            {/* Target Badge Info */}
            <View style={styles.infoCol}>
              <View style={styles.titleRow}>
                <Text style={styles.badgeTitle} numberOfLines={1}>
                  {isMaxLevel ? 'Eco Legend (Max Tier)' : nextLevelObj.name}
                </Text>
                <View style={styles.levelPill}>
                  <Text style={styles.levelPillText}>Lv. {isMaxLevel ? 10 : nextLevelObj.level}</Text>
                </View>
              </View>

              <Text style={styles.perkText} numberOfLines={1}>
                {isMaxLevel ? '🏆 You reached the highest eco status!' : `🎁 Unlocks: ${nextPerk}`}
              </Text>
            </View>
          </View>

          {/* Progress Bar & Countdown */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressLabel}>
                {isMaxLevel ? 'Mastery Achieved' : `${Math.round(progressPercent)}% completed`}
              </Text>
              <Text style={styles.progressPoints}>
                {isMaxLevel ? `${ecoPoints} pts` : `${pointsToNext} XP to unlock`}
              </Text>
            </View>

            <View style={styles.progressBarTrack}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
              />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: verticalScale(14),
  },
  cardWrapper: {
    borderRadius: moderateScale(20),
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardGradient: {
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: '#E2EFE7',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(10),
    gap: scale(4),
  },
  tagText: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#126027',
    letterSpacing: 0.6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
  },
  viewDetailsText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    color: '#126027',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  badgeContainer: {
    position: 'relative',
    marginRight: scale(12),
  },
  badgeCircle: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#126027',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: '#6B7A75',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(3),
    gap: scale(6),
  },
  badgeTitle: {
    fontSize: responsiveFontSize(15),
    fontWeight: '800',
    color: '#1A211D',
    flex: 1,
  },
  levelPill: {
    backgroundColor: '#EDF6F1',
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#D4E8DC',
  },
  levelPillText: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#126027',
  },
  perkText: {
    fontSize: responsiveFontSize(11),
    color: '#55655F',
    fontWeight: '500',
  },
  progressContainer: {
    marginTop: verticalScale(2),
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(5),
  },
  progressLabel: {
    fontSize: responsiveFontSize(11),
    fontWeight: '600',
    color: '#6B7A75',
  },
  progressPoints: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    color: '#126027',
  },
  progressBarTrack: {
    height: verticalScale(6),
    backgroundColor: '#E4EFE8',
    borderRadius: moderateScale(3),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: moderateScale(3),
  },
});
