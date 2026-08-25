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
import { responsiveFontSize, moderateScale, scale, verticalScale, useResponsive, clampFontSize } from '../utils/responsive';
import { resolveMediaUrl } from '../utils/appUtils';
import { getCategoryDetails } from './HomeLearnViews';

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
  const { isSmall } = useResponsive();
  const [imgError, setImgError] = React.useState(false);
  const animatedProgress = React.useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = React.useState(0);

  const resolvedImageUrl = resolveMediaUrl(lesson.imageUrl, ecobudApiOrigin);

  React.useEffect(() => {
    setImgError(false);
  }, [lesson.imageUrl]);

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

  const starIconSize = isSmall ? clampFontSize(9.5, 8, 10) : clampFontSize(11, 10, 12);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.card}>
      <View style={styles.imageWrapper}>
        {resolvedImageUrl && !imgError ? (
          <Image 
            source={{ uri: resolvedImageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.cardImage, styles.fallbackImageWrap]}>
            <Ionicons name="book-outline" size={scale(44)} color="#126027" style={{ opacity: 0.7 }} />
          </View>
        )}

        {lesson.featured && (
          <View style={[
            styles.featuredBadge,
            isSmall && styles.featuredBadgeSmall
          ]}>
            <Ionicons name="star" size={starIconSize} color="#FFF" style={styles.featuredStarIcon} />
            <Text 
              style={[
                styles.featuredBadgeText,
                isSmall && styles.featuredBadgeTextSmall
              ]}
              numberOfLines={1}
            >
              Featured
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{lesson.title}</Text>
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: verticalScale(10), gap: scale(6) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name={getCategoryDetails(lesson.category || 'General', false).iconName} size={scale(12)} color="#6B7A75" />
          <Text style={{ fontSize: responsiveFontSize(12), color: '#6B7A75', fontWeight: '700' }}>
            {lesson.category || 'General'}
          </Text>
        </View>
        <Text style={{ color: '#9CA3AF' }}>•</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons
            name="shield-checkmark"
            size={scale(11)}
            color={lesson.difficulty?.toLowerCase() === 'advanced' ? '#EF4444' : lesson.difficulty?.toLowerCase() === 'intermediate' ? '#F59E0B' : '#10B981'}
          />
          <Text style={{ fontSize: responsiveFontSize(12), color: '#6B7A75', fontWeight: '700' }}>
            {lesson.difficulty || 'Beginner'}
          </Text>
        </View>
        {lesson.durationMinutes && lesson.durationMinutes > 0 ? (
          <>
            <Text style={{ color: '#9CA3AF' }}>•</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="time-outline" size={scale(12)} color="#6B7A75" />
              <Text style={{ fontSize: responsiveFontSize(12), color: '#6B7A75', fontWeight: '700' }}>
                {lesson.durationMinutes} min
              </Text>
            </View>
          </>
        ) : null}
      </View>

      <Text style={[styles.description, { marginBottom: verticalScale(14), lineHeight: responsiveFontSize(20) }]} numberOfLines={3}>
        {lesson.description}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6F4EC', paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderRadius: moderateScale(8), gap: scale(4) }}>
          <Ionicons name="leaf" size={scale(13)} color="#126027" />
          <Text style={{ fontSize: responsiveFontSize(13), color: '#126027', fontWeight: '900' }}>
            +{lesson.pointsReward || 10} Eco points
          </Text>
        </View>
      </View>

      <View style={{ 
        marginTop: verticalScale(4), 
        paddingTop: verticalScale(12), 
        paddingBottom: verticalScale(12),
        borderTopWidth: 1, 
        borderTopColor: '#F0F5F2', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Text style={{ color: '#126027', fontSize: responsiveFontSize(15), fontWeight: '800' }}>
          {getActionLabel(lesson.status)}
        </Text>
      </View>

      {/* Sleek Progress Bar */}
      <View style={{ height: verticalScale(4), backgroundColor: '#F0F5F2', width: '100%', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
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
    borderRadius: moderateScale(22),
    padding: moderateScale(16),
    marginBottom: verticalScale(14),
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'hidden',
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: verticalScale(150),
    borderRadius: moderateScale(16),
    marginBottom: verticalScale(14),
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: moderateScale(16),
  },
  fallbackImageWrap: {
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBadge: {
    position: 'absolute',
    top: moderateScale(10),
    left: moderateScale(10),
    backgroundColor: '#F59E0B',
    paddingHorizontal: moderateScale(9, 0.3),
    paddingVertical: moderateScale(4.5, 0.3),
    borderRadius: moderateScale(8),
    zIndex: 10,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredBadgeSmall: {
    top: moderateScale(8),
    left: moderateScale(8),
    paddingHorizontal: moderateScale(7, 0.3),
    paddingVertical: moderateScale(3.5, 0.3),
    borderRadius: moderateScale(6),
  },
  featuredStarIcon: {
    marginRight: moderateScale(4),
  },
  featuredBadgeText: {
    color: '#FFF',
    fontSize: responsiveFontSize(10.5, 0.3),
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  featuredBadgeTextSmall: {
    fontSize: responsiveFontSize(9.5, 0.3),
    letterSpacing: 0.3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  iconWrap: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    backgroundColor: '#F0F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    backgroundColor: '#E6F4EC',
    borderRadius: 999,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
  },
  statusText: {
    color: '#126027',
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: responsiveFontSize(18),
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: verticalScale(6),
  },
  description: {
    fontSize: responsiveFontSize(13),
    lineHeight: responsiveFontSize(20),
    color: '#6B7A75',
    marginBottom: verticalScale(14),
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: verticalScale(14),
  },
  metaBadgeTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: '#F3F4F6',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metaBadgePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: '#ECFDF5',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  metaBadgeDifficulty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: '#FEF3C7',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  metaEmoji: {
    fontSize: responsiveFontSize(13),
  },
  metaBadgeTextTime: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    color: '#4B5563',
  },
  metaBadgeTextPoints: {
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    color: '#065F46',
  },
  metaBadgeTextDifficulty: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    color: '#92400E',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  progressLabel: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 0.6,
  },
  progressValue: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: '#126027',
  },
  progressTrack: {
    height: verticalScale(8),
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
    marginTop: verticalScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#126027',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    marginBottom: verticalScale(14),
    opacity: 0.8,
  },
  authorText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '600',
    color: '#6B7A75',
  },
});

