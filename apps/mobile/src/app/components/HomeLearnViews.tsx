import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View, TextInput, ScrollView, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { styles } from '../styles/appStyles';
import { type EcoBudMobileModel } from '../types/home';
import { ActiveChallengeCard } from './ActiveChallengeCard';
import { DiscoverChallengeCard } from './DiscoverChallengeCard';
import { TopNavbar, SurfaceCard, AvatarBubble } from './CommonComponents';
import { LearnLessonCard } from './LearnLessonCard';
import { CoachMarkTarget } from './CoachMarkTarget';
import { QuickActions } from './QuickActions';
import { SummaryCards } from './SummaryCards';
import { LevelCard } from './LevelCard';
import { MilestoneBadgePreview } from './MilestoneBadgePreview';
import { UpcomingEventCard } from './UpcomingEventCard';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { resolveMediaUrl, getCategoryDetails } from '../utils/appUtils';
import { HomeViewSkeleton, LearnViewSkeleton } from '../../shared/ui/SkeletonLoaders';
import { useTheme } from '../../shared/theme/ecoTheme';

export { getCategoryDetails };

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



const LeaderboardSnippet = ({ model }: { model: EcoBudMobileModel }) => {
  const { theme } = useTheme();
  const leaderboard = model.leaderboard;
  if (!leaderboard || leaderboard.items.length === 0) return null;

  const currentUser = leaderboard.items.find((item) => item.isCurrentUser) || leaderboard.items[0];
  const userAvatar = currentUser.isCurrentUser
    ? (currentUser.avatarUrl || model.profile?.profile?.avatarUrl || model.session?.user.avatarUrl)
    : currentUser.avatarUrl;

  return (
    <View style={{ backgroundColor: theme.colors.card, borderRadius: moderateScale(20), padding: moderateScale(16), marginBottom: verticalScale(14), borderWidth: 1, borderColor: theme.colors.cardBorder }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: responsiveFontSize(14), fontWeight: '800' }}>Weekly Leaderboard</Text>
        <TouchableOpacity onPress={() => model.setActiveOverlay('leaderboard')}>
          <Text style={{ color: theme.colors.primary, fontSize: responsiveFontSize(12), fontWeight: '700' }}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', backgroundColor: theme.colors.surfaceMuted, borderRadius: moderateScale(12), padding: moderateScale(12) }}>
        <Text style={{ fontSize: responsiveFontSize(15), fontWeight: 'bold', color: theme.colors.textMuted, width: scale(24), flexShrink: 1 }}>#{currentUser.rank}</Text>
        <AvatarBubble
          label={currentUser.isCurrentUser ? model.userDisplayName : currentUser.displayName}
          avatarUrl={userAvatar}
          size={scale(34)}
          style={{ marginRight: scale(10), flexShrink: 0 }}
          textStyle={{ fontSize: responsiveFontSize(13) }}
        />
        <View style={{ flex: 1, minWidth: scale(120) }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: responsiveFontSize(13), fontWeight: '700' }}>{currentUser.isCurrentUser ? 'You' : currentUser.displayName}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: responsiveFontSize(11) }}>
            {currentUser.isCurrentUser
              ? currentUser.rank === 1
                ? 'You are #1 on the leaderboard!'
                : 'Keep going to reach #1!'
              : 'Top weekly eco contributor'}
          </Text>
        </View>
        <Text style={{ color: theme.colors.textPrimary, fontSize: responsiveFontSize(13), fontWeight: 'bold' }}>{currentUser.points} pts</Text>
      </View>
    </View>
  );
};

export function HomeView({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  if ((model.initializing || model.booting) && !model.dashboard && !model.session) {
    return (
      <>
        <TopNavbar model={model} />
        <HomeViewSkeleton />
      </>
    );
  }

  const currentStreak = model.dashboard?.streak ?? model.session?.user.currentStreak ?? 0;
  const baseEcoPoints = model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0;
  const ecoPoints = (model.activeOverlay === 'lessonCompleted' || model.activeOverlay === 'eventApproved')
    ? Math.max(0, baseEcoPoints - (model.earnedPoints || 0)) 
    : baseEcoPoints;
  const weeklyGoal = model.dashboard?.weeklyGoal ?? 0;
  const firstDiscoverChallenge = model.challenges?.slice().sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0))[0] || null;
  const featuredLesson = model.lessons?.find((l: any) => l.featured) || (model.lessons && model.lessons.length > 0 ? model.lessons[0] : null);

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

        <TouchableOpacity
          onPress={() => model.setActiveOverlay('assistant')}
          activeOpacity={0.88}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.card,
            borderRadius: moderateScale(22),
            paddingHorizontal: scale(16),
            paddingVertical: verticalScale(10),
            marginBottom: verticalScale(18),
            minHeight: verticalScale(50),
            shadowColor: '#126027',
            shadowOpacity: isDark ? 0.2 : 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
          }}
        >
          <View style={{ width: scale(32), height: scale(32), borderRadius: scale(16), backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={scale(16)} color={isDark ? theme.colors.primary : '#126027'} />
          </View>
          <Text style={{ flex: 1, marginLeft: scale(10), fontSize: responsiveFontSize(14), color: theme.colors.textSecondary, fontWeight: '600' }}>
            Ask EcoBud AI a question...
          </Text>
          <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#EDF6F1', paddingHorizontal: scale(10), paddingVertical: verticalScale(4), borderRadius: moderateScale(12), flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: isDark ? theme.colors.primary : '#126027', fontSize: responsiveFontSize(11), fontWeight: '800' }}>AI</Text>
            <Ionicons name="chevron-forward" size={scale(12)} color={isDark ? theme.colors.primary : '#126027'} />
          </View>
        </TouchableOpacity>

        {/* Quick Action Grid */}
        <QuickActions model={model} />

        {isTablet ? (
          <View style={{ flexDirection: 'row', gap: scale(14), marginBottom: verticalScale(4), alignItems: 'stretch' }}>
            <View style={{ flex: 1 }}>
              <LevelCard
                ecoPoints={ecoPoints}
                onPress={() => model.setActiveOverlay('ecoLevels')}
                onProgressBarMeasured={model.setProgressBarLayout}
              />
              <MilestoneBadgePreview
                ecoPoints={ecoPoints}
                onPress={() => model.setActiveOverlay('ecoLevels')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SummaryCards
                currentStreak={currentStreak}
                ecoPoints={ecoPoints}
                onOpenStreakOverlay={() => model.setActiveOverlay('streakUnlocked')}
              />
            </View>
          </View>
        ) : (
          <>
            <LevelCard
              ecoPoints={ecoPoints}
              onPress={() => model.setActiveOverlay('ecoLevels')}
              onProgressBarMeasured={model.setProgressBarLayout}
            />
            <MilestoneBadgePreview
              ecoPoints={ecoPoints}
              onPress={() => model.setActiveOverlay('ecoLevels')}
            />
            <SummaryCards
              currentStreak={currentStreak}
              ecoPoints={ecoPoints}
              onOpenStreakOverlay={() => model.setActiveOverlay('streakUnlocked')}
            />
          </>
        )}

        <LeaderboardSnippet model={model} />

        {featuredLesson && (
          <View style={{ marginBottom: verticalScale(14) }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: responsiveFontSize(13), fontWeight: '800', textTransform: 'uppercase' }}>Lesson</Text>
              <TouchableOpacity onPress={() => model.setActiveTab('learn')}>
                <Text style={{ color: isDark ? theme.colors.primary : '#126027', fontSize: responsiveFontSize(12), fontWeight: '700' }}>See all</Text>
              </TouchableOpacity>
            </View>
            <LearnLessonCard
              lesson={featuredLesson}
              onPress={() => void model.openLesson(featuredLesson.id)}
            />
          </View>
        )}

        {!model.dashboard ? (
          <SurfaceCard style={{ padding: moderateScale(18), borderRadius: moderateScale(22) }}>
            <Text style={styles.cardTitle}>Dashboard unavailable</Text>
            <Text style={styles.metaTextSmallDark}>Pull to refresh and load your latest streak, eco points, and weekly goal.</Text>
          </SurfaceCard>
        ) : null}

        {firstDiscoverChallenge ? (
          <View style={{ marginBottom: verticalScale(14) }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: responsiveFontSize(13), fontWeight: '800', textTransform: 'uppercase' }}>Challenges</Text>
              <TouchableOpacity onPress={() => model.setActiveTab('challenges')}>
                <Text style={{ color: isDark ? theme.colors.primary : '#126027', fontSize: responsiveFontSize(12), fontWeight: '700' }}>See all</Text>
              </TouchableOpacity>
            </View>
            <DiscoverChallengeCard
              challenge={firstDiscoverChallenge}
              onPress={() => {
                model.openChallengeMission(firstDiscoverChallenge);
              }}
            />
          </View>
        ) : null}

        {(() => {
          const featuredEvent = model.events.find((e) => e.isFeatured) || model.events[0];
          if (!featuredEvent) return null;

          return (
            <View style={{ marginBottom: verticalScale(14) }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {featuredEvent.isFeatured && <Ionicons name="star" size={scale(13)} color="#F59E0B" />}
                  <Text style={{ color: theme.colors.textPrimary, fontSize: responsiveFontSize(13), fontWeight: '800', textTransform: 'uppercase' }}>
                    {featuredEvent.isFeatured ? 'Featured Event' : 'Event'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => model.setActiveOverlay('events')}>
                  <Text style={{ color: isDark ? theme.colors.primary : '#126027', fontSize: responsiveFontSize(12), fontWeight: '700' }}>See all</Text>
                </TouchableOpacity>
              </View>
              <UpcomingEventCard
                event={featuredEvent}
                onJoin={() => {
                  if (featuredEvent?.id) {
                    void model.handleJoinEvent(featuredEvent.id);
                  }
                }}
                onSignIn={() => model.leaveReadOnlyAccess()}
                onRecordAttendance={() => model.setActiveOverlay('events')}
                onClaimReward={() => {
                  if (featuredEvent?.id) {
                    void model.handleClaimEventReward(featuredEvent.id);
                  }
                }}
              />
            </View>
          );
        })()}

        <View style={{ height: verticalScale(80) }} />
      </View>
    </>
  );
}

export function LearnView({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  if ((model.initializing || model.booting) && (!model.lessons || model.lessons.length === 0)) {
    return (
      <>
        <TopNavbar model={model} />
        <LearnViewSkeleton />
      </>
    );
  }

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
          {model.filteredLessons.length === 0 ? (
            <SurfaceCard style={{ padding: moderateScale(24), borderRadius: moderateScale(22), alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAF9' }}>
              <Ionicons name="library-outline" size={scale(36)} color="#126027" style={{ marginBottom: verticalScale(8) }} />
              <Text style={[styles.cardTitle, { textAlign: 'center', fontSize: responsiveFontSize(16), marginBottom: verticalScale(6) }]}>No lessons available yet.</Text>
              <Text style={[styles.metaTextSmallDark, { textAlign: 'center', fontSize: responsiveFontSize(13) }]}>Check back soon for new content.</Text>
            </SurfaceCard>
          ) : (
            <View style={isTablet ? { flexDirection: 'row', flexWrap: 'wrap', gap: scale(12) } : {}}>
              {model.filteredLessons.map((lesson, index) => {
                if (index === 0) {
                  return (
                    <View key={lesson.id} style={isTablet ? { width: '48.5%' } : { width: '100%' }}>
                      <CoachMarkTarget
                        name="firstLearnLesson"
                        borderRadius={moderateScale(22)}
                        active={model.coachMarksVisible && model.coachMarksCurrentStep === 4}
                        onMeasure={(rect) => {
                          model.setSpotlightTargetRect?.(rect);
                        }}
                        style={{ marginBottom: verticalScale(14) }}
                      >
                        <LearnLessonCard
                          lesson={lesson}
                          style={{ marginBottom: 0 }}
                          onPress={() => void model.openLesson(lesson.id)}
                        />
                      </CoachMarkTarget>
                    </View>
                  );
                }

                return (
                  <View key={lesson.id} style={isTablet ? { width: '48.5%' } : { width: '100%' }}>
                    <LearnLessonCard
                      lesson={lesson}
                      onPress={() => void model.openLesson(lesson.id)}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: verticalScale(80) }} />
      </View>
    </>
  );
}

