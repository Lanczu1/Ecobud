import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type LessonWithProgress, type ChallengeWithProgress, type EcoEvent, ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { resolveMediaUrl } from '../utils/appUtils';
import { triggerImpactLight } from '../utils/haptics';
import { useTheme } from '../../shared/theme/ecoTheme';

export interface ForYouFeedProps {
  lesson: LessonWithProgress | null;
  challenge: ChallengeWithProgress | null;
  event: EcoEvent | null;
  onOpenLesson: (lessonId: string) => void;
  onOpenChallenge: (challenge: ChallengeWithProgress) => void;
  onOpenEvent: (event: EcoEvent) => void;
  onSeeAllLessons: () => void;
  onSeeAllChallenges: () => void;
  onSeeAllEvents: () => void;
  /** When true, feed CTAs are secondary (e.g. user still has to log daily habit) */
  hasPendingHabit?: boolean;
}

export function ForYouFeed({
  lesson,
  challenge,
  event,
  onOpenLesson,
  onOpenChallenge,
  onOpenEvent,
  onSeeAllLessons,
  onSeeAllChallenges,
  onSeeAllEvents,
  hasPendingHabit = false,
}: ForYouFeedProps) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();

  // Responsive card sizing with momentum snap interval
  const cardWidth = Math.min(width * 0.76, scale(290));
  const cardGap = scale(12);
  const snapInterval = cardWidth + cardGap;

  // Track image load errors gracefully with fallback icons
  const [lessonImgErr, setLessonImgErr] = useState(false);
  const [challengeImgErr, setChallengeImgErr] = useState(false);
  const [eventImgErr, setEventImgErr] = useState(false);

  const lessonImg = lesson?.imageUrl ? resolveMediaUrl(lesson.imageUrl, ecobudApiOrigin) : null;
  const challengeImg = challenge?.imageUrl ? resolveMediaUrl(challenge.imageUrl, ecobudApiOrigin) : null;
  const eventImg = event?.imageUrl ? resolveMediaUrl(event.imageUrl, ecobudApiOrigin) : null;

  // Render nothing if all 3 items are null
  if (!lesson && !challenge && !event) {
    return null;
  }

  return (
    <View style={styles.sectionContainer}>
      {/* 1. Unified Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Ionicons name="sparkles" size={scale(16)} color={isDark ? theme.colors.primary : '#126027'} />
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>For You</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            triggerImpactLight();
            onSeeAllLessons();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.headerSeeAll, { color: isDark ? theme.colors.primary : '#126027' }]}>
            Explore all
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Horizontally-scrollable feed with momentum snap */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        contentContainerStyle={[styles.scrollContent, { gap: cardGap }]}
      >
        {/* CARD 1: Lesson Card */}
        {lesson && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              triggerImpactLight();
              onOpenLesson(lesson.id);
            }}
            style={[
              styles.card,
              {
                width: cardWidth,
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.cardBorder,
                shadowOpacity: isDark ? 0.2 : 0.08,
              },
            ]}
          >
            {/* Media Area (Fixed height prevents CLS) */}
            <View style={styles.mediaWrap}>
              {lessonImg && !lessonImgErr ? (
                <Image
                  source={{ uri: lessonImg }}
                  style={styles.cardImage}
                  resizeMode="cover"
                  onError={() => setLessonImgErr(true)}
                />
              ) : (
                <View style={[styles.cardImage, styles.fallbackImage, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9' }]}>
                  <Ionicons name="book-outline" size={scale(36)} color={isDark ? theme.colors.primary : '#126027'} />
                </View>
              )}
              {/* Type & Category Pill */}
              <View style={[styles.typeBadge, { backgroundColor: '#0284C7' }]}>
                <Ionicons name="book" size={scale(10)} color="#FFF" />
                <Text style={styles.typeBadgeText}>LESSON</Text>
              </View>
              {lesson.pointsReward ? (
                <View style={styles.rewardBadge}>
                  <Ionicons name="leaf" size={scale(11)} color="#FFF" />
                  <Text style={styles.rewardBadgeText}>+{lesson.pointsReward} pts</Text>
                </View>
              ) : null}
            </View>

            {/* Card Content Body */}
            <View style={styles.bodyWrap}>
              <Text style={[styles.metaCategory, { color: theme.colors.textMuted }]}>
                {(lesson.category || 'General').toUpperCase()} • {lesson.durationMinutes || 5} MIN
              </Text>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                {lesson.title}
              </Text>
              <Text style={[styles.cardDesc, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {lesson.description || 'Interactive bite-sized eco learning.'}
              </Text>

              {/* Single Secondary CTA (or primary if habit is already logged) */}
              <View
                style={[
                  styles.ctaButton,
                  hasPendingHabit
                    ? [styles.ctaSecondary, { borderColor: isDark ? theme.colors.border : '#D4EBD9', backgroundColor: isDark ? theme.colors.surfaceMuted : '#F4FAF6' }]
                    : [styles.ctaPrimary, { backgroundColor: isDark ? theme.colors.primary : '#126027' }],
                ]}
              >
                <Text
                  style={[
                    styles.ctaText,
                    hasPendingHabit
                      ? { color: isDark ? theme.colors.primary : '#126027' }
                      : { color: isDark ? '#0E1512' : '#FFFFFF' },
                  ]}
                >
                  {lesson.status === 'completed' ? 'Review Lesson' : lesson.status === 'seen' ? 'Continue' : 'Start Learning'}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={scale(13)}
                  color={hasPendingHabit ? (isDark ? theme.colors.primary : '#126027') : (isDark ? '#0E1512' : '#FFFFFF')}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* CARD 2: Challenge Card */}
        {challenge && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              triggerImpactLight();
              onOpenChallenge(challenge);
            }}
            style={[
              styles.card,
              {
                width: cardWidth,
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.cardBorder,
                shadowOpacity: isDark ? 0.2 : 0.08,
              },
            ]}
          >
            {/* Media Area (Fixed height prevents CLS) */}
            <View style={styles.mediaWrap}>
              {challengeImg && !challengeImgErr ? (
                <Image
                  source={{ uri: challengeImg }}
                  style={styles.cardImage}
                  resizeMode="cover"
                  onError={() => setChallengeImgErr(true)}
                />
              ) : (
                <View style={[styles.cardImage, styles.fallbackImage, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#FEF3C7' }]}>
                  <Ionicons name="trophy-outline" size={scale(36)} color="#D97706" />
                </View>
              )}
              {/* Type & Category Pill */}
              <View style={[styles.typeBadge, { backgroundColor: '#D97706' }]}>
                <Ionicons name="trophy" size={scale(10)} color="#FFF" />
                <Text style={styles.typeBadgeText}>CHALLENGE</Text>
              </View>
              <View style={styles.rewardBadge}>
                <Ionicons name="leaf" size={scale(11)} color="#FFF" />
                <Text style={styles.rewardBadgeText}>+{challenge.expReward} pts</Text>
              </View>
            </View>

            {/* Card Content Body */}
            <View style={styles.bodyWrap}>
              <Text style={[styles.metaCategory, { color: theme.colors.textMuted }]}>
                {((challenge as any).category || 'Daily').toUpperCase()} • {challenge.difficulty || 'Easy'}
              </Text>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                {challenge.title}
              </Text>
              <Text style={[styles.cardDesc, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {challenge.description || 'Take action today to help the planet.'}
              </Text>

              {/* Single Secondary CTA */}
              <View
                style={[
                  styles.ctaButton,
                  hasPendingHabit
                    ? [styles.ctaSecondary, { borderColor: isDark ? theme.colors.border : '#D4EBD9', backgroundColor: isDark ? theme.colors.surfaceMuted : '#F4FAF6' }]
                    : [styles.ctaPrimary, { backgroundColor: isDark ? theme.colors.primary : '#126027' }],
                ]}
              >
                <Text
                  style={[
                    styles.ctaText,
                    hasPendingHabit
                      ? { color: isDark ? theme.colors.primary : '#126027' }
                      : { color: isDark ? '#0E1512' : '#FFFFFF' },
                  ]}
                >
                  {challenge.type === 'AI Image Recognition Challenge' ? 'Open Mission' : 'Start Challenge'}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={scale(13)}
                  color={hasPendingHabit ? (isDark ? theme.colors.primary : '#126027') : (isDark ? '#0E1512' : '#FFFFFF')}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* CARD 3: Upcoming Event Card */}
        {event && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              triggerImpactLight();
              onOpenEvent(event);
            }}
            style={[
              styles.card,
              {
                width: cardWidth,
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.cardBorder,
                shadowOpacity: isDark ? 0.2 : 0.08,
              },
            ]}
          >
            {/* Media Area (Fixed height prevents CLS) */}
            <View style={styles.mediaWrap}>
              {eventImg && !eventImgErr ? (
                <Image
                  source={{ uri: eventImg }}
                  style={styles.cardImage}
                  resizeMode="cover"
                  onError={() => setEventImgErr(true)}
                />
              ) : (
                <View style={[styles.cardImage, styles.fallbackImage, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#EDE9FE' }]}>
                  <Ionicons name="calendar-outline" size={scale(36)} color="#7C3AED" />
                </View>
              )}
              {/* Type Pill */}
              <View style={[styles.typeBadge, { backgroundColor: '#7C3AED' }]}>
                <Ionicons name="calendar" size={scale(10)} color="#FFF" />
                <Text style={styles.typeBadgeText}>COMMUNITY EVENT</Text>
              </View>
              {event.expReward ? (
                <View style={styles.rewardBadge}>
                  <Ionicons name="leaf" size={scale(11)} color="#FFF" />
                  <Text style={styles.rewardBadgeText}>+{event.expReward} pts</Text>
                </View>
              ) : null}
            </View>

            {/* Card Content Body */}
            <View style={styles.bodyWrap}>
              <Text style={[styles.metaCategory, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {event.location || 'Local Drive'}
              </Text>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={[styles.cardDesc, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {event.description || 'Join community eco warriors for real impact.'}
              </Text>

              {/* Single Secondary CTA */}
              <View
                style={[
                  styles.ctaButton,
                  hasPendingHabit
                    ? [styles.ctaSecondary, { borderColor: isDark ? theme.colors.border : '#D4EBD9', backgroundColor: isDark ? theme.colors.surfaceMuted : '#F4FAF6' }]
                    : [styles.ctaPrimary, { backgroundColor: isDark ? theme.colors.primary : '#126027' }],
                ]}
              >
                <Text
                  style={[
                    styles.ctaText,
                    hasPendingHabit
                      ? { color: isDark ? theme.colors.primary : '#126027' }
                      : { color: isDark ? '#0E1512' : '#FFFFFF' },
                  ]}
                >
                  Join Event
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={scale(13)}
                  color={hasPendingHabit ? (isDark ? theme.colors.primary : '#126027') : (isDark ? '#0E1512' : '#FFFFFF')}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: verticalScale(2),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  headerTitle: {
    fontSize: responsiveFontSize(16),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSeeAll: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: verticalScale(4),
  },
  card: {
    borderRadius: moderateScale(20),
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  mediaWrap: {
    position: 'relative',
    width: '100%',
    height: verticalScale(110),
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  fallbackImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(9.5),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rewardBadge: {
    position: 'absolute',
    bottom: scale(8),
    right: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(10),
  },
  rewardBadgeText: {
    color: '#A7F3D0',
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
  },
  bodyWrap: {
    padding: moderateScale(12),
  },
  metaCategory: {
    fontSize: responsiveFontSize(10),
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: verticalScale(2),
  },
  cardTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: '800',
    marginBottom: verticalScale(2),
  },
  cardDesc: {
    fontSize: responsiveFontSize(11),
    lineHeight: responsiveFontSize(16),
    marginBottom: verticalScale(10),
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(12),
  },
  ctaPrimary: {
    backgroundColor: '#126027',
  },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: '#D4EBD9',
    backgroundColor: '#F4FAF6',
  },
  ctaText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
  },
});
