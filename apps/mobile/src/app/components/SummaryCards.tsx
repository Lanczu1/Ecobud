import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { type SummaryCardsProps } from '../types/home';
import { getVisibleStreak } from '../utils/appUtils';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';

export function SummaryCards({ currentStreak, ecoPoints, onPressRewards, onOpenStreakOverlay, lastSevenDays, completedDays, style }: SummaryCardsProps) {

  // Visual placeholder for streak progress if real data is not provided
  const visibleStreak = getVisibleStreak(currentStreak);
  const cycleDay = visibleStreak > 0 ? (visibleStreak - 1) % 7 + 1 : 0;
  const maxVisualStreak = cycleDay;
  const todayIndex = cycleDay === 0 ? 0 : cycleDay - 1;

  const isStreakActive = currentStreak >= 3;

  const dots = lastSevenDays && completedDays
    ? lastSevenDays.map((date, index) => {
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return {
          done: completedDays.includes(dateKey),
          isToday: index === lastSevenDays.length - 1,
        };
      })
    : Array.from({ length: 7 }).map((_, i) => ({
        isToday: i === todayIndex,
        done: i < maxVisualStreak,
      }));

  return (
    <LinearGradient
      colors={['#0B5F58', '#169070', '#22A77B']}
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
            {isStreakActive ? (
              <LottieView
                source={require('../../../assets/Fire.lottie')}
                autoPlay
                loop
                style={{ width: scale(42), height: scale(42) }}
              />
            ) : (
              <Image
                source={require('../../../assets/Unfire.png')}
                style={{ width: scale(34), height: scale(34), resizeMode: 'contain' }}
              />
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>YOUR ECO STREAK</Text>
            <Text style={styles.streakTagline} numberOfLines={2}>
              {!isStreakActive
                ? currentStreak === 0
                  ? 'Log a habit to start your streak!'
                  : `${3 - currentStreak} more days to unlock your streak!`
                : 'Keep your eco habits growing!'}
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
            <Text style={styles.streakUnit}>{visibleStreak === 1 ? 'Streak' : 'Streaks'}</Text>
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

        <View style={styles.streakDotsRow}>
          {dots.map((dot, index) => (
            <View
              key={index}
              style={[
                styles.streakDot,
                dot.done && styles.streakDotDone,
                dot.isToday && styles.streakDotToday,
              ]}
            />
          ))}
        </View>
      </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
