import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';
import { triggerImpactLight } from '../utils/haptics';

export interface LevelCardProps {
  ecoPoints: number;
  onPress?: () => void;
}

const LEVELS = [
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

export function LevelCard({ ecoPoints, onPress }: LevelCardProps) {
  const [displayPoints, setDisplayPoints] = React.useState(ecoPoints);

  React.useEffect(() => {
    let animationFrameId: number;
    let startTime: number | null = null;
    const duration = 1000; // 1 second count animation
    const startValue = displayPoints;
    const targetValue = ecoPoints;

    if (startValue === targetValue) return;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function (easeOutQuad) for smoother finish
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
    progressPercent = (pointsInCurrentLevel / pointsNeededForNextLevel) * 100;
    pointsToNext = nextLevelObj.points - displayPoints;
  }

  const handlePress = () => {
    if (onPress) {
      triggerImpactLight();
      onPress();
    }
  };

  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <View style={{ marginBottom: 24, paddingHorizontal: 0 }}>
      <CardWrapper
        activeOpacity={0.9}
        onPress={onPress ? handlePress : undefined}
      >
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
              <MaterialCommunityIcons name={currentLevelObj.icon as any} size={22} color="#34D399" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelLabel}>LEVEL {currentLevelObj.level}</Text>
              <Text style={styles.levelTitle}>{currentLevelObj.name}</Text>
            </View>
            {onPress && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: scale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(10), gap: 2 }}>
                <Text style={{ color: '#E6F4EC', fontSize: responsiveFontSize(10), fontWeight: '700' }}>Roadmap</Text>
                <Ionicons name="chevron-forward" size={scale(11)} color="#E6F4EC" />
              </View>
            )}
          </View>

          <View style={styles.pointsRow}>
            <Text style={styles.pointsNumber}>{displayPoints}</Text>
            <Text style={styles.pointsUnit}>Eco Points</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              {isMaxLevel ? (
                <Text style={styles.progressText}>Max Level Reached!</Text>
              ) : (
                <>
                  <Text style={styles.progressText}>Progress to {nextLevelObj.name}</Text>
                  <Text style={styles.progressText}>{displayPoints} / {nextLevelObj.points}</Text>
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
      </CardWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#064E3B',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 4,
  },
  cardGlow: {
    position: 'absolute',
    top: verticalScale(-30),
    right: scale(-30),
    width: '30%',
    aspectRatio: 1,
    borderRadius: 9999,
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
    marginBottom: verticalScale(12),
    zIndex: 2,
  },
  iconCircle: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  levelLabel: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 1.2,
    marginBottom: verticalScale(2),
  },
  levelTitle: {
    fontSize: responsiveFontSize(17),
    color: '#FFFFFF',
    fontWeight: '700',
    flexShrink: 1,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: verticalScale(14),
    zIndex: 2,
  },
  pointsNumber: {
    fontSize: responsiveFontSize(34),
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  pointsUnit: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    color: '#6EE7B7',
    marginLeft: scale(6),
    opacity: 0.9,
  },
  progressContainer: {
    zIndex: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(6),
    flexWrap: 'wrap',
    gap: 4,
  },
  progressText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '600',
    color: '#D1FAE5',
    opacity: 0.9,
    flexShrink: 1,
  },
  progressBarBackground: {
    height: verticalScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    marginBottom: verticalScale(8),
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: moderateScale(4),
  },
  pointsToNextText: {
    fontSize: responsiveFontSize(11),
    color: '#A7F3D0',
    fontWeight: '500',
    textAlign: 'right',
  }
});
