import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { FastImage } from '../../shared/ui/FastImage';
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
          <FeedCard
            width={cardWidth}
            onPress={() => onOpenLesson(lesson.id)}
            imageUri={lessonImg}
            imageFailed={lessonImgErr}
            onImageError={() => setLessonImgErr(true)}
            fallbackBg="#E8F5E9"
            fallbackIcon="book-outline"
            fallbackIconColor={isDark ? theme.colors.primary : '#126027'}
            badgeColor="#0284C7"
            badgeIcon="book"
            badgeLabel="LESSON"
            rewardLabel={lesson.pointsReward ? `+${lesson.pointsReward} pts` : null}
            meta={`${(lesson.category || 'General').toUpperCase()} • ${lesson.durationMinutes || 5} MIN`}
            title={lesson.title}
            description={lesson.description || 'Interactive bite-sized eco learning.'}
            ctaLabel={lesson.status === 'completed' ? 'Review Lesson' : lesson.status === 'seen' ? 'Continue' : 'Start Learning'}
            hasPendingHabit={hasPendingHabit}
          />
        )}

        {/* CARD 2: Challenge Card */}
        {challenge && (
          <FeedCard
            width={cardWidth}
            onPress={() => onOpenChallenge(challenge)}
            imageUri={challengeImg}
            imageFailed={challengeImgErr}
            onImageError={() => setChallengeImgErr(true)}
            fallbackBg="#FEF3C7"
            fallbackIcon="trophy-outline"
            fallbackIconColor="#D97706"
            badgeColor="#D97706"
            badgeIcon="trophy"
            badgeLabel="CHALLENGE"
            rewardLabel={`+${challenge.expReward} pts`}
            meta={`${((challenge as any).category || 'Daily').toUpperCase()} • ${challenge.difficulty || 'Easy'}`}
            title={challenge.title}
            description={challenge.description || 'Take action today to help the planet.'}
            ctaLabel={challenge.type === 'AI Image Recognition Challenge' ? 'Open Mission' : 'Start Challenge'}
            hasPendingHabit={hasPendingHabit}
          />
        )}

        {/* CARD 3: Upcoming Event Card */}
        {event && (
          <FeedCard
            width={cardWidth}
            onPress={() => onOpenEvent(event)}
            imageUri={eventImg}
            imageFailed={eventImgErr}
            onImageError={() => setEventImgErr(true)}
            fallbackBg="#EDE9FE"
            fallbackIcon="calendar-outline"
            fallbackIconColor="#7C3AED"
            badgeColor="#7C3AED"
            badgeIcon="calendar"
            badgeLabel="COMMUNITY EVENT"
            rewardLabel={event.expReward ? `+${event.expReward} pts` : null}
            meta={event.location || 'Local Drive'}
            metaNumberOfLines={1}
            title={event.title}
            description={event.description || 'Join community eco warriors for real impact.'}
            ctaLabel="Join Event"
            hasPendingHabit={hasPendingHabit}
          />
        )}
      </ScrollView>
    </View>
  );
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface FeedCardProps {
  width: number;
  onPress: () => void;
  imageUri: string | null;
  imageFailed: boolean;
  onImageError: () => void;
  /** Light-mode background behind the fallback icon */
  fallbackBg: string;
  fallbackIcon: IoniconName;
  fallbackIconColor: string;
  badgeColor: string;
  badgeIcon: IoniconName;
  badgeLabel: string;
  rewardLabel: string | null;
  meta: string;
  metaNumberOfLines?: number;
  title: string;
  description: string;
  ctaLabel: string;
  hasPendingHabit: boolean;
}

function FeedCard({
  width,
  onPress,
  imageUri,
  imageFailed,
  onImageError,
  fallbackBg,
  fallbackIcon,
  fallbackIconColor,
  badgeColor,
  badgeIcon,
  badgeLabel,
  rewardLabel,
  meta,
  metaNumberOfLines,
  title,
  description,
  ctaLabel,
  hasPendingHabit,
}: FeedCardProps) {
  const { theme, isDark } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        triggerImpactLight();
        onPress();
      }}
      style={[
        styles.card,
        {
          width,
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.cardBorder,
          shadowOpacity: isDark ? 0.2 : 0.08,
        },
      ]}
    >
      {/* Media Area (Fixed height prevents CLS) */}
      <View style={styles.mediaWrap}>
        {imageUri && !imageFailed ? (
          <FastImage
            source={{ uri: imageUri }}
            style={styles.cardImage}
            contentFit="cover"
            onError={onImageError}
          />
        ) : (
          <View style={[styles.cardImage, styles.fallbackImage, { backgroundColor: isDark ? theme.colors.surfaceMuted : fallbackBg }]}>
            <Ionicons name={fallbackIcon} size={scale(36)} color={fallbackIconColor} />
          </View>
        )}
        {/* Type & Category Pill */}
        <View style={[styles.typeBadge, { backgroundColor: badgeColor }]}>
          <Ionicons name={badgeIcon} size={scale(10)} color="#FFF" />
          <Text style={styles.typeBadgeText}>{badgeLabel}</Text>
        </View>
        {rewardLabel ? (
          <View style={styles.rewardBadge}>
            <Ionicons name="leaf" size={scale(11)} color="#FFF" />
            <Text style={styles.rewardBadgeText}>{rewardLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Card Content Body */}
      <View style={styles.bodyWrap}>
        <Text style={[styles.metaCategory, { color: theme.colors.textMuted }]} numberOfLines={metaNumberOfLines}>
          {meta}
        </Text>
        <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.cardDesc, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {description}
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
            {ctaLabel}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={scale(13)}
            color={hasPendingHabit ? (isDark ? theme.colors.primary : '#126027') : (isDark ? '#0E1512' : '#FFFFFF')}
          />
        </View>
      </View>
    </TouchableOpacity>
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
