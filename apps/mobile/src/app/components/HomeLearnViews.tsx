import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View, TextInput, ScrollView, TouchableOpacity, Image, useWindowDimensions, StyleSheet } from 'react-native';
import { styles } from '../styles/appStyles';
import { type EcoBudMobileModel } from '../types/home';
import { ActiveChallengeCard } from './ActiveChallengeCard';
import { DiscoverChallengeCard } from './DiscoverChallengeCard';
import { TopNavbar, SurfaceCard, AvatarBubble, AiAssistantBar } from './CommonComponents';
import { LearnLessonCard, LearnLessonSkeleton } from './LearnLessonCard';
import { CoachMarkTarget } from './CoachMarkTarget';
import { QuickActions } from './QuickActions';
import { SummaryCards } from './SummaryCards';
import { LevelCard } from './LevelCard';
import { MilestoneBadgePreview } from './MilestoneBadgePreview';
import { UpcomingEventCard } from './UpcomingEventCard';
import { UnifiedProgressCard } from './UnifiedProgressCard';
import { ForYouFeed } from './ForYouFeed';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { resolveMediaUrl, getCategoryDetails } from '../utils/appUtils';
import { HomeViewSkeleton, HomeCardsSkeleton, LearnViewSkeleton } from '../../shared/ui/SkeletonLoaders';
import { useTheme } from '../../shared/theme/ecoTheme';
import { mobileStorage } from '../../shared/storage/mobileStorage';
import { triggerSelectionHaptic } from '../utils/haptics';

export { getCategoryDetails };

type LearnLayoutMode = 'grid' | 'list';

function useLearnLayoutPreference() {
  const [layoutMode, setLayoutModeState] = React.useState<LearnLayoutMode>(() => {
    const savedMode = mobileStorage.getItemSync('ecobud_learn_layout');
    return savedMode === 'grid' || savedMode === 'list' ? savedMode : 'list';
  });

  const setLayoutMode = (nextMode: LearnLayoutMode) => {
    setLayoutModeState(nextMode);
    mobileStorage.setItemSync('ecobud_learn_layout', nextMode);
    void mobileStorage.setItem('ecobud_learn_layout', nextMode).catch((error) => {
      console.warn('Failed to save Learn layout:', error);
    });
  };

  return [layoutMode, setLayoutMode] as const;
}

function LearnLayoutToggle({ value, onChange }: { value: LearnLayoutMode; onChange: (mode: LearnLayoutMode) => void }) {
  const { theme, isDark } = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Lessons layout"
      style={[learnLayoutStyles.toggle, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}
    >
      {(['grid', 'list'] as const).map((mode) => {
        const selected = value === mode;
        return (
          <TouchableOpacity
            key={mode}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show lessons as a ${mode}`}
            activeOpacity={0.8}
            onPress={() => {
              triggerSelectionHaptic();
              onChange(mode);
            }}
            style={[learnLayoutStyles.button, selected && { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}
          >
            <Ionicons
              name={mode === 'grid' ? 'grid-outline' : 'list-outline'}
              size={17}
              color={selected ? (isDark ? theme.colors.primary : '#126027') : theme.colors.textMuted}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const learnLayoutStyles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  button: {
    width: 36,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});

const getGreetingInfo = (): { text: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string } => {
  try {
    const timeString = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false, hour: 'numeric' });
    const hour = parseInt(timeString, 10);
    
    if (!isNaN(hour)) {
      if (hour >= 5 && hour < 12) return { text: 'Good morning', icon: 'sunny', iconColor: '#F59E0B' };
      if (hour >= 12 && hour < 18) return { text: 'Good afternoon', icon: 'partly-sunny', iconColor: '#F97316' };
      return { text: 'Good evening', icon: 'moon', iconColor: '#6366F1' };
    }
  } catch (e) {
    // Fallback if Intl is not fully supported
  }
  return { text: 'Hello', icon: 'sparkles', iconColor: '#10B981' };
};

export function HomeView({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  // Show card skeleton on cold launch when there is genuinely no data yet
  const isCardsLoading = !model.dashboard && (model.isHydrating || model.initializing || model.booting);


  const currentStreak = model.dashboard?.streak ?? model.session?.user.currentStreak ?? 0;
  const baseEcoPoints = model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0;
  const ecoPoints = (model.activeOverlay === 'lessonCompleted' || model.activeOverlay === 'eventApproved')
    ? Math.max(0, baseEcoPoints - (model.earnedPoints || 0)) 
    : baseEcoPoints;
  const weeklyGoal = model.dashboard?.weeklyGoal ?? 0;
  const firstDiscoverChallenge = model.challenges?.slice().sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0))[0] || null;
  const featuredLesson = model.lessons?.find((l: any) => l.featured) || (model.lessons && model.lessons.length > 0 ? model.lessons[0] : null);
  const featuredEvent = model.events.find((e) => e.isFeatured) || model.events[0] || null;
  const isHabitPending = model.todaysCompletedHabits === 0;

  const greeting = getGreetingInfo();
  const firstName = model.userDisplayName.split(' ')[0] || 'Eco-Warrior';

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: verticalScale(4) }}>
          <View style={{ flex: 1, paddingRight: scale(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: verticalScale(2) }}>
              <Ionicons name={greeting.icon} size={scale(18)} color={greeting.iconColor} />
              <Text style={{ fontSize: responsiveFontSize(13), fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {greeting.text}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: scale(8) }}>
              <Text style={[styles.welcomeTitle, { marginTop: 0, color: theme.colors.textPrimary }]}>
                {firstName}
              </Text>
              <MaterialCommunityIcons name="hand-wave" size={scale(26)} color="#F59E0B" style={{ transform: [{ rotate: '-10deg' }] }} />
            </View>
          </View>
          <View
            style={{
              width: scale(44),
              height: scale(44),
              borderRadius: scale(22),
              backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: isDark ? theme.colors.border : '#C8E6C9',
            }}
          >
            <Ionicons name="leaf" size={scale(22)} color={isDark ? theme.colors.primary : '#126027'} />
          </View>
        </View>
        <Text style={[styles.welcomeSubtitle, { marginTop: 0, marginBottom: verticalScale(14), color: theme.colors.textMuted }]}>Great to see you again! Let's keep building a greener tomorrow.</Text>

        {/* Discoverable AI Assistant Bar (Replaces floating FAB) */}
        <AiAssistantBar onPress={() => model.setActiveOverlay('assistant')} />

        {isCardsLoading ? (
          <HomeCardsSkeleton />
        ) : (
          <>
            {/* Quick Action Grid with Hero Primary CTA indicator */}
            <QuickActions model={model} isHabitPending={isHabitPending} />

            {/* Consolidated Gamification Progress Card */}
            <UnifiedProgressCard
              ecoPoints={ecoPoints}
              currentStreak={currentStreak}
              leaderboard={model.leaderboard}
              onOpenRoadmap={() => model.setActiveOverlay('ecoLevels')}
              onOpenStreak={() => model.setActiveOverlay('streakUnlocked')}
              onOpenLeaderboard={() => model.setActiveOverlay('leaderboard')}
              onProgressBarMeasured={model.setProgressBarLayout}
            />

            {!model.dashboard ? (
              <SurfaceCard style={{ padding: moderateScale(18), borderRadius: moderateScale(22), marginBottom: verticalScale(14) }}>
                <Text style={styles.cardTitle}>Dashboard unavailable</Text>
                <Text style={styles.metaTextSmallDark}>Pull to refresh and load your latest streak, eco points, and weekly goal.</Text>
              </SurfaceCard>
            ) : null}

            {/* Consolidated Horizontal "For You" Feed */}
            <ForYouFeed
              lesson={featuredLesson}
              challenge={firstDiscoverChallenge}
              event={featuredEvent}
              onOpenLesson={(id) => void model.openLesson(id)}
              onOpenChallenge={(challenge) => model.openChallengeMission(challenge)}
              onOpenEvent={(_e) => model.setActiveOverlay('events')}
              onSeeAllLessons={() => model.setActiveTab('learn')}
              onSeeAllChallenges={() => model.setActiveTab('challenges')}
              onSeeAllEvents={() => model.setActiveOverlay('events')}
              hasPendingHabit={isHabitPending}
            />
          </>
        )}
      </View>
    </>
  );
}

export function LearnView({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [layoutMode, setLayoutMode] = useLearnLayoutPreference();
  const gridColumnCount = width >= 900 ? 3 : 2;
  const gridGap = scale(width < 360 ? 8 : 12);

  const [cardsLoading, setCardsLoading] = React.useState(model.lessons.length === 0);

  React.useEffect(() => {
    if (model.lessons.length > 0) {
      setCardsLoading(false);
    }
  }, [model.lessons.length]);

  const isCardsLoading = (cardsLoading || model.isHydrating) && model.lessons.length === 0;

  const continueLesson = model.lessons.find((l) => l.status === 'seen');
  const completedLessonsCount = model.lessons.filter((l) => l.status === 'completed').length;
  const totalLessonsCount = model.lessons.length;
  const progressPercentage = totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <View style={{ marginBottom: verticalScale(12) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: verticalScale(4) }}>
            <View style={{ flex: 1, paddingRight: scale(8) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: verticalScale(2) }}>
                <Ionicons name="sparkles" size={scale(16)} color="#10B981" />
                <Text style={{ fontSize: responsiveFontSize(13), fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  ECO ACADEMY
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: scale(8) }}>
                <Text style={[styles.welcomeTitle, { marginTop: 0, color: theme.colors.textPrimary }]}>
                  Learn & Grow
                </Text>
                <MaterialCommunityIcons name="school" size={scale(26)} color={isDark ? theme.colors.primary : '#126027'} />
              </View>
            </View>
            <View
              style={{
                width: scale(44),
                height: scale(44),
                borderRadius: scale(22),
                backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: isDark ? theme.colors.border : '#C8E6C9',
              }}
            >
              <MaterialCommunityIcons name="book-open-page-variant" size={scale(22)} color={isDark ? theme.colors.primary : '#126027'} />
            </View>
          </View>
          <Text style={[styles.welcomeSubtitle, { marginTop: 0, marginBottom: verticalScale(6), color: theme.colors.textMuted, fontSize: responsiveFontSize(13), lineHeight: responsiveFontSize(19) }]}>
            Master eco-friendly living with bite-sized lessons, complete quizzes, and build sustainable habits.
          </Text>
        </View>

        {/* Discoverable Eco AI Tutor Bar */}
        <AiAssistantBar
          onPress={() => model.setActiveOverlay('assistant')}
          placeholder="Ask EcoBud AI about lessons..."
          badgeText="TUTOR"
        />

        {/* Premium Learning Progress Card */}
        {totalLessonsCount > 0 && (
          <View style={{
            backgroundColor: isDark ? '#162D1F' : '#126027',
            borderRadius: moderateScale(22),
            padding: moderateScale(16),
            marginTop: verticalScale(6),
            marginBottom: verticalScale(6),
            shadowColor: '#126027',
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
            borderWidth: isDark ? 1 : 0,
            borderColor: isDark ? theme.colors.border : 'transparent',
          }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10), gap: scale(8) }}>
              <View style={{ flex: 1, minWidth: scale(140) }}>
                <Text style={{ color: '#E6F4EC', fontSize: responsiveFontSize(10), fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>ECO ACADEMY</Text>
                <Text style={{ color: '#FFFFFF', fontSize: responsiveFontSize(16), fontWeight: '800', marginTop: verticalScale(2) }} numberOfLines={2}>Your Learning Journey</Text>
              </View>
              <View style={{ backgroundColor: isDark ? '#234430' : '#1A4D27', borderRadius: moderateScale(12), paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderWidth: 1, borderColor: '#247D3F', alignSelf: 'flex-start' }}>
                <Text style={{ color: '#E6F4EC', fontSize: responsiveFontSize(11), fontWeight: '800' }}>
                  {completedLessonsCount}/{totalLessonsCount} Completed
                </Text>
              </View>
            </View>
            
            {/* Progress bar */}
            <View style={{ height: verticalScale(6), backgroundColor: '#0D381A', borderRadius: 3, overflow: 'hidden', marginBottom: verticalScale(6) }}>
              <View style={{ width: `${progressPercentage}%`, height: '100%', backgroundColor: '#5DDF87', borderRadius: 3 }} />
            </View>
            
            <Text style={{ color: '#C8E6D3', fontSize: responsiveFontSize(11), fontWeight: '600' }}>
              {progressPercentage === 100 
                ? "Outstanding! You've mastered all available lessons!" 
                : `Keep going! You are ${progressPercentage}% through the courses.`}
            </Text>
          </View>
        )}

        {continueLesson && (() => {
          const continueImgUrl = resolveMediaUrl(continueLesson.imageUrl, ecobudApiOrigin);
          return (
            <View style={{ marginTop: verticalScale(14), marginBottom: verticalScale(6) }}>
              <Text style={[styles.cardTitle, { marginBottom: verticalScale(10), fontSize: responsiveFontSize(15), color: theme.colors.textPrimary }]}>Jump Back In</Text>
              <TouchableOpacity 
                onPress={() => void model.openLesson(continueLesson.id)}
                activeOpacity={0.9}
                style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: moderateScale(16),
                  padding: moderateScale(12),
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  shadowColor: '#126027',
                  shadowOpacity: isDark ? 0.2 : 0.06,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                  borderWidth: 1,
                  borderColor: theme.colors.cardBorder,
                  gap: scale(12),
                }}
              >
                <View style={{ width: scale(48), height: scale(48), borderRadius: moderateScale(12), backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {continueImgUrl ? (
                    <Image source={{ uri: continueImgUrl }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                  ) : (
                    <Ionicons name="book" size={scale(22)} color={isDark ? theme.colors.primary : '#126027'} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: scale(120) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <View style={{ backgroundColor: isDark ? '#3D2C0C' : '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: '#F59E0B', fontSize: responsiveFontSize(10), fontWeight: '700' }}>IN PROGRESS</Text>
                    </View>
                    <Text style={{ color: theme.colors.textMuted, fontSize: responsiveFontSize(11), fontWeight: '500' }}>
                      {continueLesson.durationMinutes || 5} min read
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: responsiveFontSize(14), fontWeight: '700' }} numberOfLines={1}>
                    {continueLesson.title}
                  </Text>
                </View>
                <View style={{ backgroundColor: isDark ? theme.colors.primary : '#126027', width: scale(32), height: scale(32), borderRadius: scale(16), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play" size={scale(14)} color={isDark ? '#0E1512' : '#FFFFFF'} style={{ marginLeft: 2 }} />
                </View>
              </TouchableOpacity>
            </View>
          );
        })()}

        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.inputBackground,
          borderRadius: moderateScale(20),
          paddingHorizontal: scale(14),
          marginTop: verticalScale(14),
          minHeight: verticalScale(46),
          borderWidth: 1,
          borderColor: theme.colors.inputBorder,
          shadowColor: '#126027',
          shadowOpacity: isDark ? 0.2 : 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}>
          <Ionicons name="search" size={scale(18)} color={theme.colors.textMuted} />
          <TextInput
            style={{
              flex: 1,
              marginLeft: scale(8),
              fontSize: responsiveFontSize(14),
              color: theme.colors.textPrimary,
            }}
            placeholder="Search lessons..."
            placeholderTextColor={theme.colors.textMuted}
            value={model.learnSearch}
            onChangeText={model.setLearnSearch}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: verticalScale(14) }}
          contentContainerStyle={{ paddingBottom: 4, alignItems: 'center' }}
        >
          {(['all', 'not_started', 'seen', 'completed'] as const).map((filter) => {
            const isActive = model.learnFilter === filter;
            const labels: Record<typeof filter, { text: string; icon: keyof typeof Ionicons.glyphMap }> = {
              all: { text: 'All Status', icon: 'globe-outline' },
              not_started: { text: 'Not Started', icon: 'time-outline' },
              seen: { text: 'In Progress', icon: 'book-outline' },
              completed: { text: 'Completed', icon: 'checkmark-circle-outline' },
            };
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => model.setLearnFilter(filter)}
                style={{
                  paddingHorizontal: scale(14),
                  minHeight: verticalScale(34),
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: isActive ? (isDark ? theme.colors.primary : '#126027') : theme.colors.surfaceMuted,
                  borderRadius: moderateScale(17),
                  marginRight: scale(8),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={labels[filter].icon} size={scale(13)} color={isActive ? (isDark ? '#0E1512' : '#FFFFFF') : (isDark ? theme.colors.primary : '#126027')} />
                  <Text
                    style={{
                      color: isActive ? (isDark ? '#0E1512' : '#FFFFFF') : (isDark ? theme.colors.primary : '#126027'),
                      fontWeight: isActive ? '700' : '500',
                      fontSize: responsiveFontSize(13),
                      textAlign: 'center',
                    }}
                  >
                    {labels[filter].text}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: verticalScale(10) }}
          contentContainerStyle={{ paddingBottom: 4, alignItems: 'center' }}
        >
          {['All Categories', 'Featured', ...Array.from(new Set(model.lessons.map(l => l.category || 'General')))].map((category) => {
            const isActive = model.learnCategory === category;
            const { name, iconName, iconColor } = getCategoryDetails(category, isActive);
            
            return (
              <TouchableOpacity
                key={category}
                onPress={() => model.setLearnCategory(category)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: scale(14),
                  paddingVertical: verticalScale(6),
                  backgroundColor: isActive ? (isDark ? theme.colors.surfaceMuted : '#E8F5E9') : theme.colors.card,
                  borderRadius: moderateScale(22),
                  borderWidth: 1,
                  borderColor: isActive ? (isDark ? theme.colors.primary : '#2E7D32') : theme.colors.border,
                  marginRight: scale(8),
                }}
              >
                <Ionicons 
                  name={iconName} 
                  size={scale(15)} 
                  color={isActive ? (isDark ? theme.colors.primary : iconColor) : theme.colors.textMuted} 
                  style={{ marginRight: scale(5) }} 
                />
                <Text
                  style={{
                    color: isActive ? (isDark ? theme.colors.primary : '#2E7D32') : theme.colors.textMuted,
                    fontWeight: '700',
                    fontSize: responsiveFontSize(13),
                  }}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={{ marginTop: verticalScale(20) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scale(12), marginBottom: verticalScale(12) }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: responsiveFontSize(18), fontWeight: '900' }}>Lessons</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: responsiveFontSize(12), marginTop: 2 }}>
                {model.filteredLessons.length} result{model.filteredLessons.length === 1 ? '' : 's'}
              </Text>
            </View>
            <LearnLayoutToggle value={layoutMode} onChange={setLayoutMode} />
          </View>
          {isCardsLoading ? (
            layoutMode === 'grid' ? (
              <View style={{ gap: gridGap }}>
                {Array.from({ length: Math.ceil(3 / gridColumnCount) }).map((_, rowIndex) => (
                  <View key={`skeleton-row-${rowIndex}`} style={{ flexDirection: 'row', gap: gridGap }}>
                    {Array.from({ length: gridColumnCount }).map((__, columnIndex) => {
                      const itemIndex = rowIndex * gridColumnCount + columnIndex;
                      return itemIndex < 3
                        ? <View key={`skeleton-${itemIndex}`} style={{ flex: 1 }}><LearnLessonSkeleton /></View>
                        : <View key={`skeleton-spacer-${itemIndex}`} style={{ flex: 1 }} />;
                    })}
                  </View>
                ))}
              </View>
            ) : (
              <View>{[1, 2, 3].map((item) => <LearnLessonSkeleton key={item} />)}</View>
            )
          ) : model.filteredLessons.length === 0 ? (
            <SurfaceCard style={{ padding: moderateScale(24), borderRadius: moderateScale(22), alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder, borderWidth: 1 }}>
              <Ionicons name="library-outline" size={scale(36)} color={isDark ? theme.colors.primary : '#126027'} style={{ marginBottom: verticalScale(8) }} />
              <Text style={[styles.cardTitle, { textAlign: 'center', fontSize: responsiveFontSize(16), marginBottom: verticalScale(6), color: theme.colors.textPrimary }]}>No lessons available yet.</Text>
              <Text style={[styles.metaTextSmallDark, { textAlign: 'center', fontSize: responsiveFontSize(13), color: theme.colors.textMuted }]}>Check back soon for new content.</Text>
            </SurfaceCard>
          ) : (
            <View style={{ gap: layoutMode === 'grid' ? gridGap : 0 }}>
              {(layoutMode === 'grid'
                ? Array.from({ length: Math.ceil(model.filteredLessons.length / gridColumnCount) }, (_, rowIndex) =>
                    model.filteredLessons.slice(rowIndex * gridColumnCount, (rowIndex + 1) * gridColumnCount)
                  )
                : model.filteredLessons.map((lesson) => [lesson])
              ).map((lessonRow, rowIndex) => (
                <View key={`lesson-row-${rowIndex}`} style={{ flexDirection: 'row', gap: layoutMode === 'grid' ? gridGap : 0 }}>
                  {lessonRow.map((lesson, columnIndex) => {
                    const lessonIndex = layoutMode === 'grid' ? rowIndex * gridColumnCount + columnIndex : rowIndex;
                    const card = (
                      <LearnLessonCard
                        lesson={lesson}
                        compact={layoutMode === 'grid'}
                        style={{ marginBottom: layoutMode === 'grid' ? 0 : verticalScale(14) }}
                        onPress={() => void model.openLesson(lesson.id)}
                      />
                    );

                    return (
                      <View key={lesson.id} style={{ flex: 1 }}>
                        {lessonIndex === 0 ? (
                          <CoachMarkTarget
                            name="firstLearnLesson"
                            borderRadius={moderateScale(22)}
                            active={model.coachMarksVisible && model.coachMarksCurrentStep === 4}
                            onMeasure={(rect) => model.setSpotlightTargetRect?.(rect)}
                          >
                            {card}
                          </CoachMarkTarget>
                        ) : card}
                      </View>
                    );
                  })}
                  {layoutMode === 'grid' && lessonRow.length < gridColumnCount &&
                    Array.from({ length: gridColumnCount - lessonRow.length }).map((_, spacerIndex) => (
                      <View key={`lesson-spacer-${spacerIndex}`} style={{ flex: 1 }} />
                    ))}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: verticalScale(80) }} />
      </View>
    </>
  );
}

