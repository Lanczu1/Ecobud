import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View, TextInput, ScrollView, TouchableOpacity, Image } from 'react-native';
import { styles } from '../styles/appStyles';
import { type EcoBudMobileModel } from '../types/home';
import { ActiveChallengeCard } from './ActiveChallengeCard';
import { TopNavbar, SurfaceCard } from './CommonComponents';
import { LearnLessonCard } from './LearnLessonCard';
import { QuickActions } from './QuickActions';
import { SummaryCards } from './SummaryCards';
import { LevelCard } from './LevelCard';
import { UpcomingEventCard } from './UpcomingEventCard';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';

const getCategoryDetails = (category: string, isActive: boolean) => {
  const name = category === 'All Categories' ? 'All' : category;
  const normalized = name.toLowerCase().trim();
  
  let iconName: string = 'apps';
  let iconColor: string = isActive ? '#126027' : '#6B7A75';
  let iconSet: 'Ionicons' | 'MaterialCommunityIcons' = 'Ionicons';

  if (normalized === 'all') {
    iconName = 'apps';
    iconColor = isActive ? '#126027' : '#6B7A75';
  } else if (normalized === 'featured') {
    iconName = 'star';
    iconColor = isActive ? '#126027' : '#F59E0B';
  } else if (normalized === 'environment' || normalized === 'general') {
    iconSet = 'MaterialCommunityIcons';
    iconName = 'sprout';
    iconColor = isActive ? '#126027' : '#2E7D32';
  } else if (normalized === 'waste') {
    iconSet = 'MaterialCommunityIcons';
    iconName = 'recycle';
    iconColor = isActive ? '#126027' : '#2E7D32';
  } else if (normalized === 'water') {
    iconSet = 'MaterialCommunityIcons';
    iconName = 'water';
    iconColor = isActive ? '#126027' : '#2196F3';
  } else if (normalized === 'energy') {
    iconSet = 'MaterialCommunityIcons';
    iconName = 'flash';
    iconColor = isActive ? '#126027' : '#FFB300';
  } else if (normalized === 'climate') {
    iconSet = 'MaterialCommunityIcons';
    iconName = 'earth';
    iconColor = isActive ? '#126027' : '#2196F3';
  } else {
    iconName = 'book';
    iconColor = isActive ? '#126027' : '#6B7A75';
  }

  return { name, iconName, iconColor, iconSet };
};

const getGreetingPHT = (): string => {
  try {
    const timeString = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false, hour: 'numeric' });
    const hour = parseInt(timeString, 10);
    
    if (!isNaN(hour)) {
      if (hour >= 5 && hour < 12) return '☀️ Good morning';
      if (hour >= 12 && hour < 18) return '🌤️ Good afternoon';
      return '🌙 Good evening';
    }
  } catch (e) {
    // Fallback if Intl is not fully supported
  }
  return '☀️ Hello';
};


const LeaderboardSnippet = ({ model }: { model: EcoBudMobileModel }) => {
  const leaderboard = model.leaderboard;
  if (!leaderboard || leaderboard.items.length === 0) return null;

  const currentUser = leaderboard.items.find((item) => item.isCurrentUser) || leaderboard.items[0];

  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E6F4EC' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: '#1A211D', fontSize: 14, fontWeight: '800' }}>Weekly Leaderboard</Text>
        <TouchableOpacity onPress={() => model.setActiveOverlay('leaderboard')}>
          <Text style={{ color: '#126027', fontSize: 12, fontWeight: '700' }}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAF9', borderRadius: 12, padding: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#6B7A75', width: 24 }}>#{currentUser.rank}</Text>
        <View style={{ width: 32, height: 32, backgroundColor: '#126027', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>{currentUser.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#1A211D', fontSize: 14, fontWeight: '700' }}>{currentUser.isCurrentUser ? 'You' : currentUser.displayName}</Text>
          <Text style={{ color: '#6B7A75', fontSize: 11 }}>
            {leaderboard.items[0]?.rank === currentUser.rank ? "You are #1!" : `Keep going to reach #1!`}
          </Text>
        </View>
        <Text style={{ color: '#1A211D', fontSize: 14, fontWeight: 'bold' }}>{currentUser.points} pts</Text>
      </View>
    </View>
  );
};

export function HomeView({ model }: { model: EcoBudMobileModel }) {
  const currentStreak = model.dashboard?.streak ?? model.session?.user.currentStreak ?? 0;
  const baseEcoPoints = model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0;
  const ecoPoints = model.activeOverlay === 'lessonCompleted' 
    ? Math.max(0, baseEcoPoints - (model.earnedPoints || 0)) 
    : baseEcoPoints;
  const weeklyGoal = model.dashboard?.weeklyGoal ?? 0;
  const primaryChallenge = model.challenges[0] ?? null;
  const featuredLesson = model.lessons?.find((l: any) => l.featured) || (model.lessons && model.lessons.length > 0 ? model.lessons[0] : null);

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.welcomeTitle}>{getGreetingPHT()}, {model.userDisplayName.split(' ')[0]}! 👋</Text>
        <Text style={[styles.welcomeSubtitle, { marginBottom: 16 }]}>Great to see you again! Let's keep building a greener tomorrow.</Text>

        <TouchableOpacity
          onPress={() => model.setActiveOverlay('assistant')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            paddingHorizontal: 16,
            marginBottom: 24,
            height: 50,
            shadowColor: '#126027',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            borderWidth: 1,
            borderColor: '#E6F4EC',
          }}
        >
          <Ionicons name="sparkles" size={20} color="#126027" />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#6B7A75', fontWeight: '500' }}>
            Ask EcoBud a question...
          </Text>
          <View style={{ backgroundColor: '#EDF6F1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#126027', fontSize: 12, fontWeight: '700' }}>AI</Text>
          </View>
        </TouchableOpacity>

        <LevelCard ecoPoints={ecoPoints} />

        <SummaryCards currentStreak={currentStreak} ecoPoints={ecoPoints} />

        <LeaderboardSnippet model={model} />

        {featuredLesson && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#1A211D', fontSize: 14, fontWeight: '800', textTransform: 'uppercase' }}>Lesson</Text>
              <TouchableOpacity onPress={() => model.setActiveTab('learn')}>
                <Text style={{ color: '#126027', fontSize: 12, fontWeight: '700' }}>See all</Text>
              </TouchableOpacity>
            </View>
            <LearnLessonCard
              lesson={featuredLesson}
              onPress={() => void model.openLesson(featuredLesson.id)}
            />
          </View>
        )}



        {!model.dashboard ? (
          <SurfaceCard style={{ padding: 20, borderRadius: 24 }}>
            <Text style={styles.cardTitle}>Dashboard unavailable</Text>
            <Text style={styles.metaTextSmallDark}>Pull to refresh and load your latest streak, eco points, and weekly goal.</Text>
          </SurfaceCard>
        ) : null}

        {primaryChallenge ? (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#1A211D', fontSize: 14, fontWeight: '800', textTransform: 'uppercase' }}>Challenges</Text>
              <TouchableOpacity onPress={() => model.setActiveTab('challenges')}>
                <Text style={{ color: '#126027', fontSize: 12, fontWeight: '700' }}>See all</Text>
              </TouchableOpacity>
            </View>
            <ActiveChallengeCard
              dailyChallenge={primaryChallenge}
              isViewed={model.viewedMissionIds.includes(primaryChallenge.id)}
              onComplete={() => {
                if (primaryChallenge.type === 'AI Image Recognition Challenge') {
                  model.openChallengeMission(primaryChallenge);
                } else {
                  void model.handleChallengeProgress(primaryChallenge, 100);
                }
              }}
              onClaim={() => {
                if (primaryChallenge.id) {
                  void model.handleClaimChallengeReward(primaryChallenge.id);
                }
              }}
            />
          </View>
        ) : null}

        {model.events[0] ? (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#1A211D', fontSize: 14, fontWeight: '800', textTransform: 'uppercase' }}>Event</Text>
              <TouchableOpacity onPress={() => model.setActiveOverlay('events')}>
                <Text style={{ color: '#126027', fontSize: 12, fontWeight: '700' }}>See all</Text>
              </TouchableOpacity>
            </View>
            <UpcomingEventCard
              event={model.events[0]}
              isReadOnly={model.isReadOnlyExperience}
              onJoin={() => model.setActiveOverlay('events')}
              onSignIn={() => model.leaveReadOnlyAccess()}
            />
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}

export function LearnView({ model }: { model: EcoBudMobileModel }) {
  const continueLesson = model.lessons.find((l) => l.status === 'seen');
  const completedLessonsCount = model.lessons.filter((l) => l.status === 'completed').length;
  const totalLessonsCount = model.lessons.length;
  const progressPercentage = totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.pageTitle}>Learn & Grow</Text>
          <Text style={[styles.pageSubtitle, { color: '#6B7A75', fontSize: 14, marginTop: 4, lineHeight: 20 }]}>
            Master eco-friendly living with bite-sized lessons, complete quizzes, and build sustainable habits.
          </Text>
          

        </View>

        {/* Premium Learning Progress Card */}
        {totalLessonsCount > 0 && (
          <View style={{
            backgroundColor: '#126027',
            borderRadius: 24,
            padding: 18,
            marginTop: 8,
            marginBottom: 8,
            shadowColor: '#126027',
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ color: '#E6F4EC', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>ECO ACADEMY</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 }}>Your Learning Journey</Text>
              </View>
              <View style={{ backgroundColor: '#1A4D27', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#247D3F' }}>
                <Text style={{ color: '#E6F4EC', fontSize: 12, fontWeight: '800' }}>
                  {completedLessonsCount}/{totalLessonsCount} Completed
                </Text>
              </View>
            </View>
            
            {/* Progress bar */}
            <View style={{ height: 6, backgroundColor: '#0D381A', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <View style={{ width: `${progressPercentage}%`, height: '100%', backgroundColor: '#5DDF87', borderRadius: 3 }} />
            </View>
            
            <Text style={{ color: '#C8E6D3', fontSize: 12, fontWeight: '600' }}>
              {progressPercentage === 100 
                ? "🏆 Outstanding! You've mastered all available lessons!" 
                : `Keep going! You are ${progressPercentage}% through the courses.`}
            </Text>
          </View>
        )}

        {continueLesson && (
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <Text style={[styles.cardTitle, { marginBottom: 12, fontSize: 16 }]}>Jump Back In</Text>
            <TouchableOpacity 
              onPress={() => void model.openLesson(continueLesson.id)}
              activeOpacity={0.9}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#126027',
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}
            >
              {continueLesson.imageUrl && continueLesson.imageUrl !== 'null' && continueLesson.imageUrl !== 'undefined' ? (
                <Image 
                  source={{ uri: `${ecobudApiOrigin}${continueLesson.imageUrl}` }}
                  style={{ width: 64, height: 64, borderRadius: 12, marginRight: 16 }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: 12, marginRight: 16, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 32, opacity: 0.7 }}>📖</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1A211D', fontSize: 16, fontWeight: '800', marginBottom: 4 }} numberOfLines={1}>{continueLesson.title}</Text>
                <Text style={{ color: '#6B7A75', fontSize: 13, fontWeight: '600' }}>{continueLesson.progress}% Completed</Text>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6F4EC', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                <Ionicons name="play" size={16} color="#126027" style={{ marginLeft: 2 }} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          paddingHorizontal: 16,
          marginTop: 16,
          height: 50,
          shadowColor: '#126027',
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}>
          <Ionicons name="search" size={20} color="#6B7A75" />
          <TextInput
            style={{
              flex: 1,
              marginLeft: 10,
              fontSize: 16,
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
          style={{ marginTop: 16, maxHeight: 40 }}
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          {(['all', 'not_started', 'seen', 'completed'] as const).map((filter) => {
            const isActive = model.learnFilter === filter;
            const labels: Record<typeof filter, string> = {
              all: '🌐 All Status',
              not_started: '⏳ Not Started',
              seen: '📖 In Progress',
              completed: '✅ Completed',
            };
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => model.setLearnFilter(filter)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: isActive ? '#126027' : '#E8F5E9',
                  borderRadius: 20,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    color: isActive ? '#FFFFFF' : '#126027',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: 14,
                  }}
                >
                  {labels[filter]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12, maxHeight: 48 }}
          contentContainerStyle={{ paddingBottom: 4, alignItems: 'center' }}
        >
          {['All Categories', 'Featured', ...Array.from(new Set(model.lessons.map(l => l.category || 'General')))].map((category) => {
            const isActive = model.learnCategory === category;
            const { name, iconName, iconColor, iconSet } = getCategoryDetails(category, isActive);
            const IconComponent = iconSet === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
            
            return (
              <TouchableOpacity
                key={category}
                onPress={() => model.setLearnCategory(category)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: isActive ? '#E8F5E9' : '#FFFFFF',
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: isActive ? '#2E7D32' : '#E5E7EB',
                  marginRight: 8,
                }}
              >
                <IconComponent 
                  name={iconName as any} 
                  size={16} 
                  color={isActive ? '#2E7D32' : iconColor} 
                  style={{ marginRight: 6 }} 
                />
                <Text
                  style={{
                    color: isActive ? '#2E7D32' : '#6B7A75',
                    fontWeight: '700',
                    fontSize: 14,
                  }}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={{ marginTop: 24 }}>
          {model.filteredLessons.length === 0 ? (
            <SurfaceCard style={{ padding: 30, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAF9' }}>
              <Text style={[styles.cardTitle, { textAlign: 'center', fontSize: 18, marginBottom: 8 }]}>📚 No lessons available yet.</Text>
              <Text style={[styles.metaTextSmallDark, { textAlign: 'center', fontSize: 14 }]}>Check back soon for new content.</Text>
            </SurfaceCard>
          ) : (
            model.filteredLessons.map((lesson) => (
              <LearnLessonCard
                key={lesson.id}
                lesson={lesson}
                onPress={() => void model.openLesson(lesson.id)}
              />
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}
