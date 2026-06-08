import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  SafeAreaView,
  ScrollView,
  ImageBackground,
  Pressable,
  Easing,
  KeyboardAvoidingView,
  useWindowDimensions,
  StyleSheet,
  Alert,
  type StyleProp,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { styles } from '../styles/appStyles';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { LoadingScreenVisual, LoadingGlyph } from '../../shared/ui/OptimizedLoading';
import { EcoBudMobileModel } from '../types/home';
import {
  buildCalendarCells,
  formatMonthLabel,
  usePressScale,
} from '../utils/appUtils';
import {
  TopNavbar,
  ProgressBar,
  AvatarBubble,
  SurfaceCard,
  SecondaryButton,
} from './CommonComponents';
import { SummaryCards } from './SummaryCards';
import { QuickActions } from './QuickActions';
import { ActiveChallengeCard } from './ActiveChallengeCard';
import { DailyTipCard } from './DailyTipCard';
import { ContinueLessonCard } from './ContinueLessonCard';
import { CommunityImpactCard } from './CommunityImpactCard';

// Local components used in Views
export function BootView() {
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeIn]);
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style='dark' />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: fadeIn,
          },
        ]}
      >
        <LoadingScreenVisual
          label="Growing your EcoBud journey"
          message="Preparing your dashboard with a lighter Android-safe loading flow."
        />
      </Animated.View>
    </SafeAreaView>
  );
}

export function LaunchBackdrop() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style='dark' />
      <LoadingScreenVisual label="Preparing your EcoBud welcome" />
    </SafeAreaView>
  );
}

export function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const isLandscape = width > height;
  const isCompact = height < 740;
  const { scale, onPressIn, onPressOut } = usePressScale();

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const screenFadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -15,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [screenFadeAnim, floatAnim]);

  const steps = [
    {
      title: 'Learn, Act, and\nEarn rewards',
      subtitle: 'Discover sustainable habits, join\nchallenges, and track your impact\nwith ECOBUD.',
      image: require('../../../assets/onboarding_hero.png'),
      buttonText: 'Start Your Eco Journey',
    },
    {
      title: 'Verified Actions',
      subtitle: 'Every positive move matters.\nLog your activities and see real-time\ndata on how you are saving the planet.',
      image: require('../../../assets/forest.png'),
      buttonText: 'Continue',
    },
    {
      title: 'Lead the Way',
      subtitle: 'Join a global community of eco-warriors.\nLead by example and earn rewards\nfor your contributions.',
      image: require('../../../assets/floating_island.png'),
      buttonText: 'Get Started',
    },
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setStep(step + 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        onComplete();
      });
    }
  };

  const currentStepData = steps[step];

  return (
    <Animated.View style={[styles.newOnboardingContainer, { opacity: screenFadeAnim }]}>
      <StatusBar style="dark" />
      <SafeAreaView style={[styles.newOnboardingSafeArea, isLandscape && { flexDirection: 'row', alignItems: 'center' }]}>
        {!isLandscape && (
          <View style={styles.newOnboardingHeader}>
            <Image
              source={require('../../../assets/newlogo.png')}
              style={styles.newOnboardingLogo}
              resizeMode="contain"
            />
          </View>
        )}

        <Animated.View style={[styles.newOnboardingHeroContent, isLandscape && { flex: 0.5, marginTop: 0 }, { opacity: fadeAnim, transform: [{ translateY: floatAnim }] }]}>
          <View style={styles.heroCircleWrapper}>
            <Image
              source={currentStepData.image}
              style={[
                styles.newOnboardingHeroImage,
                isCompact && !isLandscape && { height: '110%' },
              ]}
              resizeMode="cover"
            />
          </View>
        </Animated.View>

        <View style={[isLandscape ? { flex: 0.5, paddingRight: 30 } : { flex: 1 }]}>
          {!isLandscape && <View style={{ height: 20 }} />}

          <Animated.View style={[styles.newOnboardingTextContainer, isLandscape && { marginBottom: 20, paddingHorizontal: 0, alignItems: 'flex-start' }, { opacity: fadeAnim }]}>
            <Text style={[
              styles.newOnboardingTitle,
              isCompact && { fontSize: 28, lineHeight: 32 },
              isLandscape && { textAlign: 'left' }
            ]}>
              {currentStepData.title}
            </Text>
            <Text style={[
              styles.newOnboardingSubtitle,
              isLandscape && { textAlign: 'left', paddingHorizontal: 0 }
            ]}>
              {currentStepData.subtitle}
            </Text>
          </Animated.View>

          <View style={[styles.newOnboardingBottom, isLandscape && { paddingHorizontal: 0, paddingBottom: 0 }, step === 0 && { marginTop: 20 }]}>
            <Animated.View style={[{ transform: [{ scale }] }]}>
              <Pressable
                onPress={nextStep}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                style={styles.primaryButton}
              >
                <LinearGradient
                  colors={['#0B5F58', '#169070', '#69CDA8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButtonGradient}
                >
                  <View style={styles.primaryButtonGlow} />
                  <Animated.Text style={[styles.primaryButtonText, { opacity: fadeAnim }]}>
                    {currentStepData.buttonText}
                  </Animated.Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <View style={[styles.newOnboardingPagination, isLandscape && { alignSelf: 'flex-start' }]}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.newOnboardingDot,
                    i === step && styles.newOnboardingDotActive
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

export function HomeView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
        <Text style={styles.welcomeTitle}>Hello, {model.userDisplayName.split(' ')[0]}!</Text>
        <Text style={styles.welcomeSubtitle}>Your live sustainability stats are synced from the API.</Text>

        <SummaryCards
          currentStreak={model.dashboard?.streak ?? model.session?.user.currentStreak ?? 0}
          ecoPoints={model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0}
        />

        <QuickActions weeklyGoal={model.dashboard?.weeklyGoal ?? 0} />

        {model.challenges[0] ? (
          <ActiveChallengeCard
            dailyChallenge={model.challenges[0]}
            onComplete={() => void model.handleChallengeProgress(model.challenges[0]!, 100)}
          />
        ) : null}

        <DailyTipCard />

        <ContinueLessonCard />

        <CommunityImpactCard
          co2Saved="4.2kg"
          treesPlanted={1240}
          communityMembers={8500}
        />

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}

export function LearnView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>

        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=800&auto=format&fit=crop' }} style={styles.featuredProgramCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.featuredProgramOverlay} />
          <View style={styles.featuredProgramContent}>
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <View style={styles.tagLight}><Text style={styles.tagLightText}>FEATURED COURSE</Text></View>
            </View>
            <Text style={styles.featuredProgramTitle}>Mastering Zero Waste: A Complete Guide</Text>
            <Text style={styles.featuredProgramDesc}>Learn the essential strategies to reduce your footprint and live a circular life through professional-led video lessons.</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity style={styles.featuredProgramBtn}>
                <Ionicons name="play-circle" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.featuredProgramBtnText}>Start Lesson</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: -8 }}>
                {['Mia', 'Noah', 'Sage'].map((name) => (
                  <AvatarBubble
                    key={name}
                    label={name}
                    size={28}
                    style={styles.nftAvatar}
                    textStyle={styles.nftAvatarText}
                  />
                ))}
                <View style={[styles.nftAvatar, { backgroundColor: '#1E4C31' }]}><Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>+12k</Text></View>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View style={{ marginTop: 24 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Your Learning Path</Text>
            <Text style={styles.taskMetaValueDark}>65% Complete</Text>
          </View>
          <ProgressBar progress={65} />
          <Text style={styles.metaTextSmall}>Next: Micro-plastic Awareness (15 min)</Text>
        </View>

        <View style={styles.knowledgePointsCard}>
          <View style={styles.knowledgeIconWrap}>
            <MaterialCommunityIcons name="star-four-points" size={24} color="#FFF" />
          </View>
          <View>
            <Text style={styles.knowledgePointsLabel}>KNOWLEDGE POINTS</Text>
            <Text style={styles.knowledgePointsValue}>2,450</Text>
          </View>
        </View>

        <View style={[styles.rowBetween, { marginTop: 24 }]}>
          <View>
            <Text style={styles.sectionHeadline}>Browse Categories</Text>
            <Text style={styles.pageSubtitle}>Structured knowledge for a greener future</Text>
          </View>
          <TouchableOpacity><Text style={styles.taskMetaValueDark}>View All →</Text></TouchableOpacity>
        </View>

        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=800&auto=format&fit=crop' }} style={styles.categoryLargeCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.categoryLargeOverlay} />
          <View style={styles.featuredProgramContent}>
            <Text style={styles.categoryLargeTitle}>Waste Management Basics</Text>
            <Text style={styles.categoryLargeDesc}>Master sorting, recycling, and composting like a pro.</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={styles.rowMeta}><Ionicons name="document-text" size={14} color="#FFF" /><Text style={styles.metaTextWhite}> 12 Lessons</Text></View>
              <View style={styles.rowMeta}><Ionicons name="time" size={14} color="#FFF" /><Text style={styles.metaTextWhite}> 4.5 Hours</Text></View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.categoryMediumCard}>
          <View style={styles.badgeCircleLightGreen}><Ionicons name="leaf" size={18} color="#FFF" /></View>
          <Text style={styles.categoryMediumTitle}>Sustainable Living 101</Text>
          <Text style={styles.categoryMediumDesc}>Fundamental habits for an eco-conscious lifestyle.</Text>
          <TouchableOpacity style={styles.categoryOutlineBtn}><Text style={styles.categoryOutlineBtnText}>Start Learning</Text></TouchableOpacity>
        </View>

        <View style={styles.categorySmallCard}>
          <Ionicons name="water" size={18} color="#126027" />
          <Text style={styles.cardTitle}>Water Conservation</Text>
          <Text style={styles.metaTextSmallDark}>Reducing domestic water usage and footprint.</Text>
        </View>

        <View style={styles.categorySmallCard}>
          <Ionicons name="flash" size={18} color="#126027" />
          <Text style={styles.cardTitle}>Renewable Energy</Text>
          <Text style={styles.metaTextSmallDark}>Understanding solar, wind, and smart grids.</Text>
        </View>

        <View style={styles.categorySmallCard}>
          <Ionicons name="basket" size={18} color="#126027" />
          <Text style={styles.cardTitle}>Ethical Consumerism</Text>
          <Text style={styles.metaTextSmallDark}>How to shop with impact and transparency.</Text>
        </View>

        <Text style={[styles.sectionHeadline, { marginTop: 24, marginBottom: 16 }]}>Active Courses</Text>

        <View style={styles.activeCourseRow}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=200&auto=format&fit=crop' }} style={styles.courseThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Circular Economy Principles</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}><ProgressBar progress={30} /></View>
              <Text style={styles.coursePercentText}>30% SEEN</Text>
            </View>
          </View>
          <Ionicons name="play-circle" size={32} color="#126027" />
        </View>

        <View style={styles.activeCourseRow}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1585320806055-e7bb0fff6ca2?q=80&w=200&auto=format&fit=crop' }} style={styles.courseThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Urban Gardening & Composting</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}><ProgressBar progress={80} /></View>
              <Text style={styles.coursePercentText}>80% SEEN</Text>
            </View>
          </View>
          <Ionicons name="play-circle" size={32} color="#126027" />
        </View>

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}

export function ChallengesView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.pageTitle}>Challenges</Text>
        <Text style={styles.pageSubtitle}>Turn your eco-intentions into daily impact.</Text>

        <View style={[styles.rowBetween, { marginTop: 24, marginBottom: 16 }]}>
          <Text style={styles.welcomeLabel}>TODAY'S HABITS</Text>
        </View>
        <Text style={[styles.sectionHeadline, { marginTop: 0 }]}>Consistency is Key</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24, gap: 16, paddingBottom: 16 }}>
          {model.habitsToday?.items.map((habit) => (
            <View key={habit.id} style={styles.habitSquareCard}>
              <View style={styles.habitIconWrap}>
                <Ionicons name="leaf" size={18} color="#126027" />
              </View>
              <Text style={styles.habitTopText}>{habit.title}</Text>
              <Text style={styles.habitMetaText}>Daily • {habit.pointsReward} XP</Text>
              <TouchableOpacity
                disabled={habit.completedToday}
                onPress={() => void model.handleHabitCheckIn(habit.id)}
                style={[styles.habitSquareBtn, habit.completedToday && { backgroundColor: 'transparent' }]}
              >
                {habit.completedToday ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.activeDot} />
                    <Text style={styles.habitActiveText}>ACTIVE</Text>
                  </View>
                ) : (
                  <Text style={styles.habitSquareBtnText}>LOG TASK</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <Text style={[styles.welcomeLabel, { marginTop: 24, marginBottom: 8 }]}>ACTIVE CHALLENGES</Text>
        <Text style={styles.sectionHeadline}>Featured Programs</Text>

        {model.challenges.map((challenge, index) => (
          index === 0 ? (
            <ImageBackground 
              key={challenge.id}
              source={{ uri: challenge.imageUrl || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop' }} 
              style={styles.featuredProgramCard} 
              imageStyle={{ borderRadius: 24 }}
            >
              <View style={styles.featuredProgramOverlay} />
              <View style={styles.featuredProgramContent}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <View style={styles.tagDark}><Text style={styles.tagDarkText}>{challenge.difficulty.toUpperCase()}</Text></View>
                  <View style={styles.tagLight}><Text style={styles.tagLightText}>{challenge.expReward} XP</Text></View>
                  {challenge.ecoCoinReward > 0 && <View style={[styles.tagLight, { backgroundColor: '#E8F5E9' }]}><Text style={[styles.tagLightText, { color: '#2E7D32' }]}>{challenge.ecoCoinReward} Coins</Text></View>}
                </View>
                <Text style={styles.featuredProgramTitle}>{challenge.title}</Text>
                <Text style={styles.featuredProgramDesc}>{challenge.description}</Text>

                <View style={styles.featuredGlassBar}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.progressLabelLight}>PROGRESS</Text>
                    <Text style={styles.progressLabelLight}>{challenge.progress?.progressPercentage || 0}%</Text>
                  </View>
                  <View style={styles.progressTrackLight}>
                    <View style={[styles.progressFillLight, { width: `${challenge.progress?.progressPercentage || 0}%` }]} />
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => void model.handleChallengeProgress(challenge, 100)}
                  style={styles.featuredProgramBtn}
                >
                  <Text style={styles.featuredProgramBtnText}>
                    {challenge.progress?.status === 'completed' ? 'CHALLENGE FINISHED' : 'CONTINUE JOURNEY'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ImageBackground>
          ) : (
            <View key={challenge.id} style={styles.taskCard}>
              <Image 
                source={{ uri: challenge.imageUrl || 'https://images.unsplash.com/photo-1585320806055-e7bb0fff6ca2?q=80&w=200&auto=format&fit=crop' }} 
                style={styles.taskCardImg} 
              />
              <View style={styles.taskCardBody}>
                <View style={styles.rowBetween}>
                  <Text style={styles.taskMetaLabel}>{challenge.difficulty.toUpperCase()}</Text>
                  <Text style={styles.taskMetaValue}>{challenge.progress?.progressPercentage || 0}% COMPLETE</Text>
                </View>
                <Text style={styles.taskCardTitle}>{challenge.title}</Text>
                <ProgressBar progress={challenge.progress?.progressPercentage || 0} />
                <TouchableOpacity 
                   onPress={() => void model.handleChallengeProgress(challenge, 100)}
                   style={styles.taskActionBtn}
                >
                  <Text style={styles.taskActionBtnText}>
                    {challenge.progress?.status === 'completed' ? 'CHECK RESULTS' : 'VIEW TASK'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        ))}

        {model.challenges.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
            <Ionicons name="trophy-outline" size={48} color="#126027" />
            <Text style={[styles.sectionHeadline, { marginTop: 16 }]}>Check back soon!</Text>
            <Text style={styles.pageSubtitle}>Admins are preparing new challenges for the community.</Text>
          </View>
        )}

        <View style={styles.nftPromoCard}>
          <Text style={styles.welcomeLabelLight}>UNLOCKED SOON</Text>
          <Text style={styles.nftPromoTitle}>Rare Digital Seed</Text>
          <Text style={styles.nftPromoDesc}>Complete 2 more challenges this week to earn the exclusive 'Ancient Oak' NFT badge.</Text>
          <View style={{ flexDirection: 'row', gap: -8, marginTop: 12 }}>
            <View style={styles.nftAvatar}><Ionicons name="trophy" size={14} color="#FFF" /></View>
            <View style={[styles.nftAvatar, { backgroundColor: '#7D9984' }]}><Ionicons name="star" size={14} color="#FFF" /></View>
            <View style={[styles.nftAvatar, { backgroundColor: '#5C7A63' }]}><Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>+3</Text></View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}

export function TrackerView({ model }: { model: EcoBudMobileModel }) {
  const trackerMonth = model.tracker?.month ?? new Date().toISOString().slice(0, 7);
  const calendarCells = buildCalendarCells(trackerMonth, model.tracker?.completedDays ?? []);

  return (
    <>
      <TopNavbar model={model} showBack={true} title="Habits Tracker" />

      <ScrollView contentContainerStyle={styles.homeContent}>
        <SurfaceCard style={[styles.trackerHeroCard, { backgroundColor: '#126027', borderRadius: 24, padding: 24 }]}>
          <View style={styles.trackerHeroLeft}>
            <Text style={[styles.trackerHeroTitle, { color: '#FFF', fontSize: 20, fontWeight: '800' }]}>You are on fire!</Text>
            <Text style={[styles.trackerHeroStreak, { color: '#4ADE80', fontSize: 28, fontWeight: '900', marginTop: 8 }]}>{model.tracker?.currentStreak ?? 0} day streak</Text>
            <Text style={[styles.metaTextWhite, { marginTop: 8 }]}>Weekly Eco Goal: {model.todaysCompletedHabits}/7 days</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard style={[styles.calendarCard, { marginTop: 16, backgroundColor: '#FFF', borderRadius: 24, padding: 20 }]}>
          <View style={styles.rowBetween}>
            <TouchableOpacity onPress={() => void model.loadTrackerMonth(-1)}>
              <Feather name="chevron-left" size={24} color="#6B7A75" />
            </TouchableOpacity>
            <Text style={[styles.calendarMonth, { fontSize: 16, fontWeight: '800', color: '#1A211D' }]}>{formatMonthLabel(trackerMonth)}</Text>
            <TouchableOpacity onPress={() => void model.loadTrackerMonth(1)}>
              <Feather name="chevron-right" size={24} color="#6B7A75" />
            </TouchableOpacity>
          </View>

          <View style={[styles.calendarWeekRow, { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }]}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={[styles.calendarWeekLabel, { width: 40, textAlign: 'center', color: '#6B7A75', fontSize: 12, fontWeight: '700' }]}>
                {day}
              </Text>
            ))}
          </View>

          <View style={[styles.calendarGrid, { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }]}>
            {calendarCells.map((cell, index) => (
              <View key={`${cell.dateKey ?? 'empty'}-${index}`} style={[styles.calendarCell, { width: '14.28%', padding: 4, alignItems: 'center' }]}>
                {cell.dateKey ? (
                  <View style={[
                    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
                    cell.completed && { backgroundColor: '#4ADE80' },
                    cell.isToday && !cell.completed && { borderWidth: 2, borderColor: '#126027' }
                  ]}>
                    <Text style={[
                      { color: '#1A211D', fontSize: 12, fontWeight: '600' },
                      cell.completed && { color: '#126027', fontWeight: '800' },
                      cell.isToday && { fontWeight: '800' }
                    ]}>{cell.day}</Text>
                  </View>
                ) : (
                  <View style={{ width: 36, height: 36 }} />
                )}
              </View>
            ))}
          </View>
        </SurfaceCard>

        <Text style={[styles.sectionHeadline, { marginTop: 24, marginBottom: 12 }]}>Daily Check-in</Text>
        {model.tracker?.todayHabits.map((habit) => (
          <SurfaceCard key={habit.id} style={[styles.checkInCard, { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '700', color: '#1A211D' }]}>{habit.title}</Text>
              <Text style={{ fontSize: 12, color: '#6B7A75', marginTop: 4 }}>{habit.pointsReward} XP</Text>
            </View>
            <TouchableOpacity
              onPress={() => void model.handleHabitCheckIn(habit.id)}
              disabled={habit.completedToday}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: habit.completedToday ? '#F0F5F2' : '#126027',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
              {habit.completedToday ? <Ionicons name="checkmark" size={16} color="#4ADE80" /> : <Feather name="plus" size={16} color="#FFF" />}
            </TouchableOpacity>
          </SurfaceCard>
        ))}
      </ScrollView>
    </>
  );
}

export function ProfileView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <View style={styles.availablePointsCard}>
          <Text style={styles.pointsLabel}>AVAILABLE POINTS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 }}>
            <Text style={styles.pointsBigValue}>{(model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0).toLocaleString()}</Text>
            <Text style={styles.pointsUnit}> Leaves</Text>
          </View>
          <View style={styles.rowBetween}>
            <TouchableOpacity style={styles.pointsBtnPrimary}><Text style={styles.pointsBtnPrimaryText}>Exchange Points</Text></TouchableOpacity>
            <TouchableOpacity style={styles.pointsBtnSecondary}><Text style={styles.pointsBtnSecondaryText}>History</Text></TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionHeadline, { marginTop: 24 }]}>Lifetime Journey</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.metaText}>Level 12 • Forest Guardian</Text>
          <Text style={styles.taskMetaValueDark}>850 XP TO LEVEL 13</Text>
        </View>

        <View style={styles.carbonOffsetCard}>
          <View style={styles.carbonIconWrap}>
            <Ionicons name="leaf" size={24} color="#126027" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Carbon Offset</Text>
              <Text style={styles.carbonValueDark}>1.2 Tons</Text>
            </View>
            <ProgressBar progress={70} />
          </View>
        </View>

        <Text style={[styles.sectionHeadline, { marginTop: 24 }]}>Collectible Badges</Text>
        <View style={styles.badgeGrid}>
          <View style={styles.badgeCard}>
            <View style={styles.badgeCircleDark}>
              <Ionicons name="trash" size={32} color="#FFF" />
              <View style={styles.badgeTagGold}><Text style={styles.badgeTagGoldText}>GOLD</Text></View>
            </View>
            <Text style={styles.badgeTitle}>Waste Warrior</Text>
            <Text style={styles.badgeDesc}>Recycled for 30 consecutive days</Text>
          </View>

          <View style={styles.badgeCard}>
            <View style={styles.badgeCircleMedium}>
              <Ionicons name="flash" size={32} color="#FFF" />
            </View>
            <Text style={styles.badgeTitle}>Energy Saver</Text>
            <Text style={styles.badgeDesc}>Reduced home energy by 15%</Text>
          </View>

          <View style={styles.badgeCard}>
            <View style={styles.badgeCircleLight}>
              <Ionicons name="bicycle" size={32} color="#B0C4B8" />
            </View>
            <Text style={styles.badgeTitleLight}>Pedal Power</Text>
            <View style={styles.lockedRow}>
              <Ionicons name="lock-closed" size={12} color="#126027" />
              <Text style={styles.lockedText}>LOCKED</Text>
            </View>
            <View style={{ width: 60, alignSelf: 'center', marginTop: 8 }}><ProgressBar progress={30} /></View>
          </View>

          <View style={styles.badgeCard}>
            <View style={styles.badgeCircleLight}>
              <Ionicons name="water" size={32} color="#B0C4B8" />
            </View>
            <Text style={styles.badgeTitleLight}>Water Wise</Text>
            <View style={styles.lockedRow}>
              <Ionicons name="lock-closed" size={12} color="#126027" />
              <Text style={styles.lockedText}>LOCKED</Text>
            </View>
            <View style={{ width: 60, alignSelf: 'center', marginTop: 8 }}><ProgressBar progress={10} /></View>
          </View>
        </View>

        <View style={styles.nftPromoCardLight}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=200&auto=format&fit=crop' }} style={styles.nftPromoLightImg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeLabel}>NEW CHALLENGE</Text>
            <Text style={styles.nftPromoTitleDark}>Plant 10 Seeds this week</Text>
            <Text style={styles.nftPromoDescDark}>Earn the "Garden Guardian" badge and +500 leaves.</Text>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <SecondaryButton label="Sign Out" onPress={() => void model.handleLogout()} />
        </View>

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}
