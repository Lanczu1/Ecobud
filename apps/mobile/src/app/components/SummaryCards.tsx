import React from 'react';
import { StyleSheet, View} from 'react-native';
import { Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StreakFlame } from './StreakFlame';
import { isStreakFlameActive } from '../../shared/api/streakSummary';
import { type SummaryCardsProps } from '../types/home';
import { getVisibleStreak } from '../utils/appUtils';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';

export function SummaryCards({ currentStreak, streakActive = false, ecoPoints, onPressRewards, onOpenStreakOverlay, style }: SummaryCardsProps) {

  const visibleStreak = getVisibleStreak(currentStreak);
  const isStreakActive = isStreakFlameActive(currentStreak, streakActive);
  const milestones = [3, 10, 30, 100];
  const nextMilestone = milestones.find(milestone => visibleStreak < milestone);

  return (
    <LinearGradient
      colors={isStreakActive ? ['#0B5F58', '#12684E'] : ['#3F4F46', '#52685A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.streakCard, { marginBottom: verticalScale(20) }, style]}
    >
        <View style={styles.streakGlow} />
        <View style={styles.streakHeader}>
          <TouchableOpacity
            activeOpacity={onOpenStreakOverlay ? 0.7 : 1}
            onPress={onOpenStreakOverlay}
            style={styles.flameCircle}
          >
            <StreakFlame count={currentStreak} active={streakActive} size={scale(42)} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>YOUR ECO STREAK</Text>
            <Text style={styles.streakTagline} numberOfLines={2}>
              {!isStreakActive
                ? currentStreak === 0
                  ? 'Complete a challenge to start.'
                  : currentStreak < 3 ? `${3 - currentStreak} more ${3 - currentStreak === 1 ? 'challenge' : 'challenges'} to ignite your streak.` : 'Count saved. Restore your streak.'
                : 'Build your streak with challenges.'}
            </Text>
          </View>
        </View>

        <View style={[styles.streakNumberRow, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1 }}>
            <Text
              style={styles.streakNumber}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
            >
              {visibleStreak}
            </Text>
            <Text style={styles.streakUnit}>Challenges</Text>
          </View>
          {onPressRewards && (
            <TouchableOpacity
              onPress={onPressRewards}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: scale(12), paddingVertical: verticalScale(8), borderRadius: moderateScale(16), flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="gift-outline" size={scale(15)} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: responsiveFontSize(13) }}>Rewards</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.milestones}>
          <Text style={styles.milestoneHeading}>Reward milestones</Text>
          <View
            style={styles.milestoneRow}
            accessible
            accessibilityLabel={`Reward milestones: ${milestones.join(', ')} challenges. ${visibleStreak} challenges completed. ${nextMilestone ? `Next reward at ${nextMilestone} challenges.` : 'All milestones reached.'}`}
          >
            {milestones.map((milestone, index) => {
              const previous = milestones[index - 1] ?? 0;
              const progress = Math.max(0, Math.min(1, (visibleStreak - previous) / (milestone - previous)));
              const reached = visibleStreak >= milestone;
              const next = nextMilestone === milestone;
              return (
                <View key={milestone} style={styles.milestoneColumn}>
                  <View style={[styles.milestoneTrack, next && styles.milestoneTrackNext]}>
                    <View style={[styles.milestoneFill, { width: `${progress * 100}%` }]} />
                  </View>
                  <Text style={[styles.milestoneValue, (reached || next) && styles.milestoneValueActive]}>{milestone}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.milestoneCaption}>
            {nextMilestone ? `${nextMilestone - visibleStreak} more ${nextMilestone - visibleStreak === 1 ? 'challenge' : 'challenges'} to your next reward` : 'All reward milestones reached'}
          </Text>
        </View>
      </LinearGradient>
  );
}

const styles = StyleSheet.create({
  milestones: {
    marginTop: verticalScale(4),
    gap: verticalScale(10),
  },
  milestoneHeading: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(13),
    fontWeight: '600',
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: scale(6),
  },
  milestoneColumn: {
    flex: 1,
    alignItems: 'center',
    gap: verticalScale(6),
  },
  milestoneTrack: {
    width: '100%',
    height: verticalScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  milestoneTrackNext: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  milestoneFill: {
    height: '100%',
    borderRadius: moderateScale(4),
    backgroundColor: '#A7F3D0',
  },
  milestoneValue: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(12),
    fontWeight: '500',
  },
  milestoneValueActive: {
    fontWeight: '800',
  },
  milestoneCaption: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(18),
  },
  streakCard: {
    borderRadius: moderateScale(24),
    padding: moderateScale(20),
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#0B5F58',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: verticalScale(8) },
    elevation: 6,
  },
  streakGlow: {
    position: 'absolute',
    top: verticalScale(-40),
    right: scale(-40),
    width: '45%',
    aspectRatio: 1,
    borderRadius: 9999,
    backgroundColor: '#34D399',
    opacity: 0.2,
    transform: [{ scale: 1.5 }],
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    zIndex: 2,
  },
  flameCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(14),
    position: 'relative',
  },
  streakLabel: {
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 1.2,
    marginBottom: verticalScale(4),
  },
  streakTagline: {
    fontSize: responsiveFontSize(13),
    color: '#FFFFFF',
    fontWeight: '500',
    opacity: 0.9,
    flexShrink: 1,
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: verticalScale(16),
    zIndex: 2,
  },
  streakNumber: {
    fontSize: responsiveFontSize(44),
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  streakUnit: {
    fontSize: responsiveFontSize(16),
    fontWeight: '700',
    color: '#A7F3D0',
    marginLeft: scale(6),
    opacity: 0.9,
  },
  streakDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: scale(4),
    gap: scale(4),
  },
  streakDot: {
    flex: 1,
    height: verticalScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  streakDotDone: {
    backgroundColor: '#34D399',
    shadowColor: '#34D399',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  streakDotToday: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    height: verticalScale(10),
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  fireOverlayTestBtn: {
    marginTop: verticalScale(14),
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 222, 0, 0.4)',
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    zIndex: 2,
  },
  fireOverlayTestBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: responsiveFontSize(12),
    letterSpacing: 0.5,
  },
});
