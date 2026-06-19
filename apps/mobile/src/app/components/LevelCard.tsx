import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface LevelCardProps {
  ecoPoints: number;
}

const LEVELS = [
  { level: 1, name: 'Eco Seedling', icon: '🌱', points: 0 },
  { level: 2, name: 'Eco Learner', icon: '📚', points: 100 },
  { level: 3, name: 'Eco Advocate', icon: '🗣️', points: 300 },
  { level: 4, name: 'Eco Warrior', icon: '♻️', points: 600 },
  { level: 5, name: 'Eco Champion', icon: '🏆', points: 1000 },
  { level: 6, name: 'Eco Guardian', icon: '🌳', points: 1500 },
  { level: 7, name: 'Eco Leader', icon: '🌎', points: 2200 },
  { level: 8, name: 'Eco Ambassador', icon: '💚', points: 3000 },
  { level: 9, name: 'Eco Hero', icon: '🌍', points: 4000 },
  { level: 10, name: 'Eco Legend', icon: '👑', points: 5500 },
];

export function LevelCard({ ecoPoints }: LevelCardProps) {
  let currentLevelObj = LEVELS[0];
  let nextLevelObj = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (ecoPoints >= LEVELS[i].points) {
      currentLevelObj = LEVELS[i];
      nextLevelObj = LEVELS[i + 1] || LEVELS[i];
      break;
    }
  }

  const isMaxLevel = currentLevelObj.level === 10;
  let progressPercent = 100;
  let pointsToNext = 0;

  if (!isMaxLevel) {
    const pointsInCurrentLevel = ecoPoints - currentLevelObj.points;
    const pointsNeededForNextLevel = nextLevelObj.points - currentLevelObj.points;
    progressPercent = (pointsInCurrentLevel / pointsNeededForNextLevel) * 100;
    pointsToNext = nextLevelObj.points - ecoPoints;
  }

  return (
    <View style={{ marginBottom: 24, paddingHorizontal: 0 }}>
      <LinearGradient
        colors={['#064E3B', '#047857', '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Background Leaves Decorations */}
        <View style={styles.cardGlow} />
        <MaterialCommunityIcons name="leaf" size={60} color="rgba(255,255,255,0.05)" style={styles.bgLeaf1} />
        <MaterialCommunityIcons name="leaf" size={90} color="rgba(255,255,255,0.03)" style={styles.bgLeaf2} />
        <MaterialCommunityIcons name="leaf" size={40} color="rgba(255,255,255,0.06)" style={styles.bgLeaf3} />
        
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 24 }}>{currentLevelObj.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.levelLabel}>LEVEL {currentLevelObj.level}</Text>
            <Text style={styles.levelTitle}>{currentLevelObj.name}</Text>
          </View>
        </View>

        <View style={styles.pointsRow}>
          <Text style={styles.pointsNumber}>{ecoPoints}</Text>
          <Text style={styles.pointsUnit}>Eco Points</Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            {isMaxLevel ? (
              <Text style={styles.progressText}>Max Level Reached!</Text>
            ) : (
              <>
                <Text style={styles.progressText}>Progress to {nextLevelObj.name}</Text>
                <Text style={styles.progressText}>{ecoPoints} / {nextLevelObj.points}</Text>
              </>
            )}
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          {!isMaxLevel && (
             <Text style={styles.pointsToNextText}>{pointsToNext} points to next level</Text>
          )}
        </View>

      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#064E3B',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#34D399',
    opacity: 0.2,
    transform: [{ scale: 1.5 }],
  },
  bgLeaf1: {
    position: 'absolute',
    top: -10,
    right: 10,
    transform: [{ rotate: '45deg' }],
  },
  bgLeaf2: {
    position: 'absolute',
    bottom: -30,
    right: -20,
    transform: [{ rotate: '-30deg' }],
  },
  bgLeaf3: {
    position: 'absolute',
    top: 40,
    left: -20,
    transform: [{ rotate: '15deg' }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    zIndex: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  levelLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  levelTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
    zIndex: 2,
  },
  pointsNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  pointsUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6EE7B7',
    marginLeft: 6,
    opacity: 0.9,
  },
  progressContainer: {
    zIndex: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D1FAE5',
    opacity: 0.9,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: 4,
  },
  pointsToNextText: {
    fontSize: 11,
    color: '#A7F3D0',
    fontWeight: '500',
    textAlign: 'right',
  }
});
