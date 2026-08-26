import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View, TextInput, ScrollView, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { styles } from '../styles/appStyles';
import { type EcoBudMobileModel } from '../types/home';
import { ActiveChallengeCard } from './ActiveChallengeCard';
import { DiscoverChallengeCard } from './DiscoverChallengeCard';
import { TopNavbar, SurfaceCard, AvatarBubble } from './CommonComponents';
import { LearnLessonCard } from './LearnLessonCard';
import { QuickActions } from './QuickActions';
import { SummaryCards } from './SummaryCards';
import { LevelCard } from './LevelCard';
import { MilestoneBadgePreview } from './MilestoneBadgePreview';
import { UpcomingEventCard } from './UpcomingEventCard';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { resolveMediaUrl, getCategoryDetails } from '../utils/appUtils';
import { HomeViewSkeleton, LearnViewSkeleton } from '../../shared/ui/SkeletonLoaders';

export { getCategoryDetails };

const getGreetingPHT = (): string => {
  try {
    const timeString = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false, hour: 'numeric' });
    const hour = parseInt(timeString, 10);
    
    if (!isNaN(hour)) {
      if (hour >= 5 && hour < 12) return 'Good morning';
      if (hour >= 12 && hour < 18) return 'Good afternoon';
      return 'Good evening';
    }
  } catch (e) {
    // Fallback if Intl is not fully supported
  }
  return 'Hello';
};


const LeaderboardSnippet = ({ model }: { model: EcoBudMobileModel }) => {
  const leaderboard = model.leaderboard;
  if (!leaderboard || leaderboard.items.length === 0) return null;

  const currentUser = leaderboard.items.find((item) => item.isCurrentUser) || leaderboard.items[0];
  const userAvatar = currentUser.isCurrentUser
    ? (currentUser.avatarUrl || model.profile?.profile?.avatarUrl || model.session?.user.avatarUrl)
    : currentUser.avatarUrl;

  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: moderateScale(20), padding: moderateScale(16), marginBottom: verticalScale(14), borderWidth: 1, borderColor: '#E6F4EC' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) }}>
        <Text style={{ color: '#1A211D', fontSize: responsiveFontSize(14), fontWeight: '800' }}>Weekly Leaderboard</Text>
        <TouchableOpacity onPress={() => model.setActiveOverlay('leaderboard')}>
          <Text style={{ color: '#126027', fontSize: responsiveFontSize(12), fontWeight: '700' }}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#F8FAF9', borderRadius: moderateScale(12), padding: moderateScale(12) }}>
        <Text style={{ fontSize: responsiveFontSize(15), fontWeight: 'bold', color: '#6B7A75', width: scale(24), flexShrink: 1 }}>#{currentUser.rank}</Text>
        <AvatarBubble
          label={currentUser.isCurrentUser ? model.userDisplayName : currentUser.displayName}
          avatarUrl={userAvatar}
          size={scale(34)}
          style={{ marginRight: scale(10), flexShrink: 0 }}
          textStyle={{ fontSize: responsiveFontSize(13) }}
        />
        <View style={{ flex: 1, minWidth: scale(120) }}>
          <Text style={{ color: '#1A211D', fontSize: responsiveFontSize(13), fontWeight: '700' }}>{currentUser.isCurrentUser ? 'You' : currentUser.displayName}</Text>
          <Text style={{ color: '#6B7A75', fontSize: responsiveFontSize(11) }}>
            {currentUser.isCurrentUser
              ? currentUser.rank === 1
                ? 'You are #1 on the leaderboard!'
                : 'Keep going to reach #1!'
              : 'Top weekly eco contributor'}
          </Text>
        </View>
        <Text style={{ color: '#1A211D', fontSize: responsiveFontSize(13), fontWeight: 'bold' }}>{currentUser.points} pts</Text>
      </View>
    </View>
  );
};

export function HomeView({ model }: { model: EcoBudMobileModel }) {
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

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.welcomeTitle}>{getGreetingPHT()}, {model.userDisplayName.split(' ')[0]}!</Text>
        <Text style={[styles.welcomeSubtitle, { marginBottom: verticalScale(14) }]}>Great to see you again! Let's keep building a greener tomorrow.</Text>

        <TouchableOpacity
          onPress={() => model.setActiveOverlay('assistant')}
          activeOpacity={0.88}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: moderateScale(22),
            paddingHorizontal: scale(16),
            paddingVertical: verticalScale(10),
            marginBottom: verticalScale(18),
            minHeight: verticalScale(50),
            shadowColor: '#126027',
            shadowOpacity: 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            borderWidth: 1,
            borderColor: '#E2EFE7',
          }}
        >
          <View style={{ width: scale(32), height: scale(32), borderRadius: scale(16), backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={scale(16)} color="#126027" />
          </View>
          <Text style={{ flex: 1, marginLeft: scale(10), fontSize: responsiveFontSize(14), color: '#4B5563', fontWeight: '600' }}>
            Ask EcoBud AI a question...
          </Text>
          <View style={{ backgroundColor: '#EDF6F1', paddingHorizontal: scale(10), paddingVertical: verticalScale(4), borderRadius: moderateScale(12), flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#126027', fontSize: responsiveFontSize(11), fontWeight: '800' }}>AI</Text>
            <Ionicons name="chevron-forward" size={scale(12)} color="#126027" />
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
              />
              <MilestoneBadgePreview
                ecoPoints={ecoPoints}
                onPress={() => model.setActiveOverlay('ecoLevels')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SummaryCards currentStreak={currentStreak} ecoPoints={ecoPoints} />
            </View>
          </View>
        ) : (
          <>
            <LevelCard
              ecoPoints={ecoPoints}
              onPress={() => model.setActiveOverlay('ecoLevels')}
            />
            <MilestoneBadgePreview
              ecoPoints={ecoPoints}
              onPress={() => model.setActiveOverlay('ecoLevels')}
            />
            <SummaryCards currentStreak={currentStreak} ecoPoints={ecoPoints} />
          </>
        )}

        <LeaderboardSnippet model={model} />

        {featuredLesson && (
          <View style={{ marginBottom: verticalScale(14) }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10) }}>
              <Text style={{ color: '#1A211D', fontSize: responsiveFontSize(13), fontWeight: '800', textTransform: 'uppercase' }}>Lesson</Text>
              <TouchableOpacity onPress={() => model.setActiveTab('learn')}>
                <Text style={{ color: '#126027', fontSize: responsiveFontSize(12), fontWeight: '700' }}>See all</Text>
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
              <Text style={{ color: '#1A211D', fontSize: responsiveFontSize(13), fontWeight: '800', textTransform: 'uppercase' }}>Challenges</Text>
              <TouchableOpacity onPress={() => model.setActiveTab('challenges')}>
                <Text style={{ color: '#126027', fontSize: responsiveFontSize(12), fontWeight: '700' }}>See all</Text>
              </TouchableOpacity>
            </View>
            <DiscoverChallengeCard
              challenge={firstDiscoverChallenge}
              isCycleActive={model.isCycleActive}
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
                  <Text style={{ color: '#1A211D', fontSize: responsiveFontSize(13), fontWeight: '800', textTransform: 'uppercase' }}>
                    {featuredEvent.isFeatured ? 'Featured Event' : 'Event'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => model.setActiveOverlay('events')}>
                  <Text style={{ color: '#126027', fontSize: responsiveFontSize(12), fontWeight: '700' }}>See all</Text>
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
          <Text style={styles.pageTitle}>Learn & Grow</Text>
          <Text style={[styles.pageSubtitle, { color: '#6B7A75', fontSize: responsiveFontSize(13), marginTop: verticalScale(4), lineHeight: responsiveFontSize(19) }]}>
            Master eco-friendly living with bite-sized lessons, complete quizzes, and build sustainable habits.
          </Text>
        </View>

        {/* Premium Learning Progress Card */}
        {totalLessonsCount > 0 && (
          <View style={{
            backgroundColor: '#126027',
            borderRadius: moderateScale(22),
            padding: moderateScale(16),
            marginTop: verticalScale(6),
            marginBottom: verticalScale(6),
            shadowColor: '#126027',
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(10), gap: scale(8) }}>
              <View style={{ flex: 1, minWidth: scale(140) }}>
                <Text style={{ color: '#E6F4EC', fontSize: responsiveFontSize(10), fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>ECO ACADEMY</Text>
                <Text style={{ color: '#FFFFFF', fontSize: responsiveFontSize(16), fontWeight: '800', marginTop: verticalScale(2) }} numberOfLines={2}>Your Learning Journey</Text>
              </View>
              <View style={{ backgroundColor: '#1A4D27', borderRadius: moderateScale(12), paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderWidth: 1, borderColor: '#247D3F', alignSelf: 'flex-start' }}>
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
              <Text style={[styles.cardTitle, { marginBottom: verticalScale(10), fontSize: responsiveFontSize(15) }]}>Jump Back In</Text>
              <TouchableOpacity 
                onPress={() => void model.openLesson(continueLesson.id)}
                activeOpacity={0.9}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: moderateScale(16),
                  padding: moderateScale(12),
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  shadowColor: '#126027',
                  shadowOpacity: 0.06,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                  borderWidth: 1,
                  borderColor: '#E6F4EC',
                  gap: scale(12),
                }}
              >
                <View style={{ width: scale(48), height: scale(48), borderRadius: moderateScale(12), backgroundColor: '#E8F5E9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {continueImgUrl ? (
                    <Image source={{ uri: continueImgUrl }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                  ) : (
                    <Ionicons name="book" size={scale(22)} color="#126027" />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: scale(120) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: '#D97706', fontSize: responsiveFontSize(10), fontWeight: '700' }}>IN PROGRESS</Text>
                    </View>
                    <Text style={{ color: '#6B7A75', fontSize: responsiveFontSize(11), fontWeight: '500' }}>
                      {continueLesson.durationMinutes || 5} min read
                    </Text>
                  </View>
                  <Text style={{ color: '#1A211D', fontSize: responsiveFontSize(14), fontWeight: '700' }} numberOfLines={1}>
                    {continueLesson.title}
                  </Text>
                </View>
                <View style={{ backgroundColor: '#126027', width: scale(32), height: scale(32), borderRadius: scale(16), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play" size={scale(14)} color="#FFFFFF" style={{ marginLeft: 2 }} />
                </View>
              </TouchableOpacity>
            </View>
          );
        })()}

        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: moderateScale(20),
          paddingHorizontal: scale(14),
          marginTop: verticalScale(14),
          minHeight: verticalScale(46),
          shadowColor: '#126027',
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}>
          <Ionicons name="search" size={scale(18)} color="#6B7A75" />
          <TextInput
            style={{
              flex: 1,
              marginLeft: scale(8),
              fontSize: responsiveFontSize(14),
              color: '#1A211D',
            }}
            placeholder="Search lessons..."
            placeholderTextColor="#6B7A75"
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
                  backgroundColor: isActive ? '#126027' : '#E8F5E9',
                  borderRadius: moderateScale(17),
                  marginRight: scale(8),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={labels[filter].icon} size={scale(13)} color={isActive ? '#FFFFFF' : '#126027'} />
                  <Text
                    style={{
                      color: isActive ? '#FFFFFF' : '#126027',
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
                  backgroundColor: isActive ? '#E8F5E9' : '#FFFFFF',
                  borderRadius: moderateScale(22),
                  borderWidth: 1,
                  borderColor: isActive ? '#2E7D32' : '#E5E7EB',
                  marginRight: scale(8),
                }}
              >
                <Ionicons 
                  name={iconName} 
                  size={scale(15)} 
                  color={iconColor} 
                  style={{ marginRight: scale(5) }} 
                />
                <Text
                  style={{
                    color: isActive ? '#2E7D32' : '#6B7A75',
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
              {model.filteredLessons.map((lesson) => (
                <View key={lesson.id} style={isTablet ? { width: '48.5%' } : { width: '100%' }}>
                  <LearnLessonCard
                    lesson={lesson}
                    onPress={() => void model.openLesson(lesson.id)}
                  />
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

