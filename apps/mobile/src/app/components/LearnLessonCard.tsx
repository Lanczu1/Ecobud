import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Animated,
} from 'react-native';
import { type LessonWithProgress, ecobudApiOrigin } from '../../shared/api/ecobudApi';

interface LearnLessonCardProps {
  lesson: LessonWithProgress;
  onPress: () => void;
}

const getActionLabel = (status: LessonWithProgress['status']) => {
  if (status === 'completed') {
    return 'Review Lesson';
  }

  if (status === 'seen') {
    return 'Continue Learning';
  }

  return 'Start Learning';
};

const getStatusLabel = (status: LessonWithProgress['status']) => {
  if (status === 'completed') {
    return 'Completed';
  }

  if (status === 'seen') {
    return 'Viewed';
  }

  return 'Not Started';
};

export function LearnLessonCard({ lesson, onPress }: LearnLessonCardProps) {
  const animatedProgress = React.useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = React.useState(0);

  React.useEffect(() => {
    animatedProgress.addListener(({ value }) => {
      setDisplayProgress(Math.round(value));
    });
    
    Animated.timing(animatedProgress, {
      toValue: Math.max(lesson.progress, 0),
      duration: 1500,
      useNativeDriver: false,
    }).start();
    
    return () => {
      animatedProgress.removeAllListeners();
    };
  }, [lesson.progress]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.card}>
      {lesson.featured && (
        <View style={{ position: 'absolute', top: 32, left: 32, backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, zIndex: 10, shadowColor: '#F59E0B', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>⭐ Featured</Text>
        </View>
      )}

      {lesson.imageUrl && lesson.imageUrl !== 'null' && lesson.imageUrl !== 'undefined' ? (
        <Image 
          source={{ uri: `${ecobudApiOrigin}${lesson.imageUrl}` }}
          style={{ width: '100%', height: 160, borderRadius: 16, marginBottom: 16 }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: '100%', height: 160, borderRadius: 16, marginBottom: 16, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 64, opacity: 0.7 }}>📖</Text>
        </View>
      )}

      <Text style={styles.title}>{lesson.title}</Text>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 13, color: '#6B7A75', fontWeight: '700' }}>
          🔖 {lesson.category || 'General'}  •  {lesson.difficulty?.toLowerCase() === 'advanced' ? '🔴' : lesson.difficulty?.toLowerCase() === 'intermediate' ? '🟠' : '🟢'} {lesson.difficulty || 'Beginner'}  •  ⏱ {lesson.durationMinutes || 8} min
        </Text>
      </View>

      <Text style={[styles.description, { marginBottom: 16, lineHeight: 20 }]} numberOfLines={3}>
        {lesson.description}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 14, color: '#126027', fontWeight: '900', backgroundColor: '#E6F4EC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' }}>
          🍃 +{lesson.pointsReward || 10} Eco points
        </Text>
      </View>

      <View style={{ 
        marginTop: 4, 
        paddingTop: 16, 
        paddingBottom: 16,
        borderTopWidth: 1, 
        borderTopColor: '#F0F5F2', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Text style={{ color: '#126027', fontSize: 16, fontWeight: '800' }}>
          {getActionLabel(lesson.status)}
        </Text>
      </View>

      {/* Sleek Progress Bar */}
      <View style={{ height: 4, backgroundColor: '#F0F5F2', width: '100%', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <Animated.View style={{
          height: '100%',
          backgroundColor: '#126027',
          width: animatedProgress.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%']
          })
        }} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    backgroundColor: '#E6F4EC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: '#126027',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B7A75',
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metaBadgeTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metaBadgePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  metaBadgeDifficulty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  metaEmoji: {
    fontSize: 14,
  },
  metaBadgeTextTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  metaBadgeTextPoints: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  metaBadgeTextDifficulty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 0.6,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#126027',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E4E9E6',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#249D7A',
    borderRadius: 999,
  },
  footer: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#126027',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    opacity: 0.8,
  },
  authorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7A75',
  },
});
