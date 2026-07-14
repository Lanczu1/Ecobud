import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type SummaryCardsProps } from '../types/home';
import { FireStreak } from './FireStreak';
import { getVisibleStreak } from '../utils/appUtils';

export function SummaryCards({ currentStreak, ecoPoints, onPressRewards, lastSevenDays, completedDays }: SummaryCardsProps) {

  // Visual placeholder for streak progress if real data is not provided
  const visibleStreak = getVisibleStreak(currentStreak);
  const maxVisualStreak = Math.min(currentStreak, 7);
  const todayIndex = currentStreak === 0 ? 0 : Math.min(currentStreak - 1, 6);

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
    <View style={{ marginBottom: 24, paddingHorizontal: 0 }}>
      <LinearGradient
        colors={['#0B5F58', '#169070', '#22A77B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.streakCard}
      >
        <View style={styles.streakGlow} />
        <View style={styles.streakHeader}>
          <View style={styles.flameCircle}>
            <FireStreak
              streakCount={visibleStreak}
              isActive={currentStreak >= 3}
              size={28}
              mode="badge"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>CURRENT STREAK</Text>
            <Text style={styles.streakTagline}>
              {currentStreak < 3 ? (currentStreak === 0 ? 'Log a habit to start your streak!' : `${3 - currentStreak} more days to unlock your streak!`) : 'Keep your eco habits growing!'}
            </Text>
          </View>
        </View>

        <View style={[styles.streakNumberRow, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={styles.streakNumber}>{visibleStreak}</Text>
            <Text style={styles.streakUnit}>Days</Text>
          </View>
          {onPressRewards && (
            <TouchableOpacity 
              onPress={onPressRewards} 
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Text style={{ fontSize: 14 }}>🎁</Text>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Rewards</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  streakCard: {
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#0B5F58',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  streakGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#34D399',
    opacity: 0.2,
    transform: [{ scale: 1.5 }],
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 2,
  },
  flameCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  flameGlow: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FBBF24',
    opacity: 0.4,
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  streakTagline: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    opacity: 0.9,
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
    zIndex: 2,
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  streakUnit: {
    fontSize: 18,
    fontWeight: '700',
    color: '#A7F3D0',
    marginLeft: 8,
    opacity: 0.9,
  },
  streakDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: 4,
  },
  streakDot: {
    width: 36,
    height: 8,
    borderRadius: 4,
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
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
