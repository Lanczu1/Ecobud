import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type SummaryCardsProps } from '../types/home';

export function SummaryCards({ currentStreak, ecoPoints }: SummaryCardsProps) {
  const flameScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameScale, { toValue: 1.12, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(flameScale, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flameScale, currentStreak]);

  // Generate an array of 7 items just for visual placeholder if we don't have completedDays
  const fakeDots = Array.from({ length: 7 }).map((_, i) => ({
    isToday: i === 6,
    done: currentStreak > 0 && i >= 6 - Math.min(currentStreak, 7) + 1,
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
          <Animated.View
            style={[
              styles.flameCircle,
              currentStreak > 0 ? { transform: [{ scale: flameScale }] } : undefined,
            ]}
          >
            <MaterialCommunityIcons name="fire" size={30} color="#FBBF24" />
            {currentStreak > 0 && <View style={styles.flameGlow} />}
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>CURRENT STREAK</Text>
            <Text style={styles.streakTagline}>
              {currentStreak === 0 ? 'Log a habit to start your streak!' : 'Keep your eco habits growing!'}
            </Text>
          </View>
        </View>

        <View style={styles.streakNumberRow}>
          <Text style={styles.streakNumber}>{currentStreak}</Text>
          <Text style={styles.streakUnit}>Days</Text>
        </View>

        <View style={styles.streakDotsRow}>
          {fakeDots.map((dot, index) => (
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
