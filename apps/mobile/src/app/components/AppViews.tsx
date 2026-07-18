import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  ScrollView,
  ImageBackground,
  Pressable,
  Easing,
  KeyboardAvoidingView,
  useWindowDimensions,
  StyleSheet,
  Alert,
  TextInput,
  type StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { styles } from '../styles/appStyles';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { LoadingScreenVisual, LoadingGlyph } from '../../shared/ui/OptimizedLoading';
import { EcoBudMobileModel } from '../types/home';
import {
  buildCalendarCells,
  formatMonthLabel,
  getEcoLevel,
  getPhMonthKey,
  usePressScale,
  getVisibleStreak,
} from '../utils/appUtils';
import {
  TopNavbar,
  ProgressBar,
  AvatarBubble,
  SurfaceCard,
  SecondaryButton,
} from './CommonComponents';
import { FireStreak } from './FireStreak';
import { LevelCard } from './LevelCard';
import { SummaryCards } from './SummaryCards';
import { QuickActions } from './QuickActions';
import { ActiveChallengeCard } from './ActiveChallengeCard';
import { DailyTipCard } from './DailyTipCard';
import { ContinueLessonCard } from './ContinueLessonCard';
import { CommunityImpactCard } from './CommunityImpactCard';
import { ecobudApiOrigin, type ChallengeWithProgress } from '../../shared/api/ecobudApi';

const getValidImageUrl = (url: string | null | undefined) => {
  if (!url) return undefined;
  let cleanUrl = url.replace(/\\/g, '/');
  if (cleanUrl.includes('localhost:3000')) {
    cleanUrl = cleanUrl.replace('http://localhost:3000', ecobudApiOrigin);
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = `${ecobudApiOrigin}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
  }
  return cleanUrl;
};

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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
        <Text style={styles.welcomeTitle}>Hello, {model.userDisplayName.split(' ')[0]}!</Text>
        <Text style={styles.welcomeSubtitle}>Let's keep your green streak going and make a positive impact today!</Text>

        <SummaryCards
          currentStreak={model.dashboard?.streak ?? model.session?.user.currentStreak ?? 0}
          ecoPoints={model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0}
          onPressRewards={() => model.setActiveOverlay('streakRewards')}
        />

        <QuickActions weeklyGoal={model.dashboard?.weeklyGoal ?? 0} />

        {(() => {
          const challenge = model.challenges[0];
          if (!challenge) return null;
          return (
            <Animated.View key={challenge.id} style={localStyles.featuredCard}>
              <View style={[localStyles.featuredImage, { backgroundColor: '#1A3B2A' }]}>
                {challenge.imageUrl ? (
                  <Image source={{ uri: getValidImageUrl(challenge.imageUrl) }} style={StyleSheet.absoluteFill} blurRadius={10} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }]}>
                    <Ionicons name="trophy" size={80} color="#4ADE80" style={{ opacity: 0.5 }} />
                  </View>
                )}
                <View style={localStyles.featuredOverlay} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']} style={localStyles.featuredGradient} />
                
                <View style={localStyles.featuredContent}>
                  <View style={[styles.rowBetween, { marginBottom: 16, alignItems: 'flex-start' }]}>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                      <View style={[localStyles.glassTag, { backgroundColor: 'rgba(74,222,128,0.3)', borderColor: 'rgba(74,222,128,0.5)' }]}>
                        <Text style={[localStyles.glassTagText, { color: '#ECFDF5' }]}>TODAY'S CHALLENGE</Text>
                      </View>
                      <View style={localStyles.glassTag}>
                        <Text style={localStyles.glassTagText}>
                          {challenge.difficulty.toLowerCase() === 'easy' ? '🟢' : challenge.difficulty.toLowerCase() === 'medium' ? '🟡' : challenge.difficulty.toLowerCase() === 'hard' ? '🔴' : '🔥'} {challenge.difficulty.toUpperCase()}
                        </Text>
                      </View>
                      <View style={localStyles.glassTag}>
                        <Text style={localStyles.glassTagText}>🌿 {challenge.expReward} Eco Points</Text>
                      </View>
                      {challenge.ecoCoinReward > 0 && (
                        <View style={[localStyles.glassTag, { backgroundColor: 'rgba(74,222,128,0.3)', borderColor: 'rgba(74,222,128,0.5)', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                          <Image source={require('../../../assets/coin.png')} style={{ width: 14, height: 14, resizeMode: 'contain' }} />
                          <Text style={[localStyles.glassTagText, { color: '#ECFDF5' }]}>{challenge.ecoCoinReward} Coins</Text>
                        </View>
                      )}
                    </View>
                    
                    {model.viewedMissionIds.includes(challenge.id) ? (
                      <View style={[localStyles.glassTag, { backgroundColor: 'rgba(59, 130, 246, 0.3)', borderColor: 'rgba(59, 130, 246, 0.5)', marginLeft: 8 }]}>
                        <Text style={[localStyles.glassTagText, { color: '#EFF6FF' }]}>👁️ VIEWED</Text>
                      </View>
                    ) : (
                      <View style={[localStyles.glassTag, { backgroundColor: 'rgba(239, 68, 68, 0.3)', borderColor: 'rgba(239, 68, 68, 0.5)', marginLeft: 8 }]}>
                        <Text style={[localStyles.glassTagText, { color: '#FEF2F2' }]}>🆕 NEW</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={{ fontSize: 34, fontWeight: '900', color: '#FFF', marginBottom: 10, letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>{challenge.title}</Text>
                  <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 24, lineHeight: 24, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{challenge.description}</Text>

                  {challenge.type === 'AI Image Recognition Challenge' && challenge.aiDetectionTargets && challenge.aiDetectionTargets.length > 0 && (
                    <LinearGradient colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']} style={localStyles.aiGradientBox}>
                      <Text style={{ color: '#A7F3D0', fontSize: 13, fontWeight: '800', marginBottom: 6, letterSpacing: 1 }}>
                        <Ionicons name="camera" size={14} color="#A7F3D0" /> AI RECOGNITION MISSION
                      </Text>
                      <Text style={{ color: '#FFF', fontSize: 14, lineHeight: 22 }}>
                        Find & capture: <Text style={{ fontWeight: '800', color: '#4ADE80' }}>{challenge.aiDetectionTargets.join(', ')}</Text>
                      </Text>
                    </LinearGradient>
                  )}

                  {challenge.type !== 'AI Image Recognition Challenge' && (
                    <View style={{ marginTop: 8 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.progressLabelLight}>PROGRESS</Text>
                        <Text style={styles.progressLabelLight}>{challenge.progress?.progressPercentage || 0}%</Text>
                      </View>
                      <View style={styles.progressTrackLight}>
                        <View style={[styles.progressFillLight, { width: `${challenge.progress?.progressPercentage || 0}%`, backgroundColor: '#4ADE80' }]} />
                      </View>
                    </View>
                  )}

                  <AnimatedStartButton challenge={challenge} model={model} pulseAnim={pulseAnim} />
                </View>
              </View>
            </Animated.View>
          );
        })()}

        <DailyTipCard title={model.dashboard?.dailyTip?.title} description={model.dashboard?.dailyTip?.description} />

        <ContinueLessonCard />

        <CommunityImpactCard
          co2Saved={model.dashboard?.communityStats?.co2Saved ?? "4.2kg"}
          treesPlanted={model.dashboard?.communityStats?.treesPlanted ?? 1240}
          communityMembers={model.dashboard?.communityStats?.communityMembers ?? 8500}
        />

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}

export function LearnView({ model }: { model: EcoBudMobileModel }) {
  const featuredLesson = model.lessons[0];
  const activeLessons = model.lessons.slice(1, 3);

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>

        {featuredLesson ? (
          <ImageBackground source={{ uri: featuredLesson.imageUrl ? `${ecobudApiOrigin}${featuredLesson.imageUrl}` : 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=800&auto=format&fit=crop' }} style={styles.featuredProgramCard} imageStyle={{ borderRadius: 24 }}>
            <View style={styles.featuredProgramOverlay} />
            <View style={styles.featuredProgramContent}>
              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                <View style={styles.tagLight}><Text style={styles.tagLightText}>FEATURED COURSE</Text></View>
              </View>
              <Text style={styles.featuredProgramTitle}>{featuredLesson.title}</Text>
              <Text style={styles.featuredProgramDesc}>{featuredLesson.description}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={() => void model.openLesson(featuredLesson.id)} style={styles.featuredProgramBtn}>
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
        ) : (
          <SurfaceCard style={styles.publicInfoCard}>
            <Text style={styles.sectionHeadline}>No courses available</Text>
          </SurfaceCard>
        )}

        <View style={{ marginTop: 24 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Your Learning Path</Text>
            <Text style={styles.taskMetaValueDark}>{model.dashboard?.learningProgress ?? 0}% Complete</Text>
          </View>
          <ProgressBar progress={model.dashboard?.learningProgress ?? 0} />
          <Text style={styles.metaTextSmall}>Next: Micro-plastic Awareness (15 min)</Text>
        </View>

        <View style={styles.knowledgePointsCard}>
          <View style={styles.knowledgeIconWrap}>
            <MaterialCommunityIcons name="star-four-points" size={24} color="#FFF" />
          </View>
          <View>
            <Text style={styles.knowledgePointsLabel}>KNOWLEDGE POINTS</Text>
            <Text style={styles.knowledgePointsValue}>{model.dashboard?.knowledgePoints ?? 0}</Text>
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

        {activeLessons.map(lesson => (
          <TouchableOpacity key={lesson.id} onPress={() => void model.openLesson(lesson.id)} style={styles.activeCourseRow}>
            <Image source={{ uri: lesson.imageUrl ? `${ecobudApiOrigin}${lesson.imageUrl}` : 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=200&auto=format&fit=crop' }} style={styles.courseThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{lesson.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}><ProgressBar progress={lesson.progress || 0} /></View>
                <Text style={styles.coursePercentText}>{lesson.progress || 0}% VIEWED</Text>
              </View>
            </View>
            <Ionicons name="play-circle" size={32} color="#126027" />
          </TouchableOpacity>
        ))}

        {activeLessons.length === 0 && (
          <Text style={styles.metaTextSmall}>No active courses at the moment.</Text>
        )}

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}

const AnimatedStartButton = ({ challenge, model, pulseAnim }: { challenge: any, model: any, pulseAnim: any }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isPressing, setIsPressing] = useState(false);

  const handlePress = () => {
    const currentStatus = challenge.progress?.status?.toLowerCase();
    if (currentStatus === 'pending' || currentStatus === 'completed') {
      return;
    }
    setIsPressing(true);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.05, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start(() => {
      setIsPressing(false);
      if (currentStatus === 'approved' || currentStatus === 'unclaimed') {
        void model.handleClaimChallengeReward(challenge.id);
      } else if (challenge.type === 'AI Image Recognition Challenge') {
        model.openChallengeMission(challenge);
      } else {
        void model.handleChallengeProgress(challenge, 100);
      }
    });
  };

  const isAI = challenge.type === 'AI Image Recognition Challenge';
  const currentStatus = challenge.progress?.status?.toLowerCase();
  const isCompleted = currentStatus === 'completed';
  const isPending = currentStatus === 'pending';
  const isApproved = currentStatus === 'approved' || currentStatus === 'unclaimed';
  const shouldPulse = isAI && !isCompleted && !isPending && !isApproved;

  return (
    <Animated.View style={shouldPulse ? { transform: [{ scale: Animated.multiply(pulseAnim, scaleAnim) }] } : { transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={handlePress}
        disabled={isPressing || isPending || isCompleted}
        style={isApproved ? [styles.featuredProgramBtn, { backgroundColor: '#F59E0B', borderColor: '#D97706' }] : (isAI ? localStyles.pulseBtn : styles.featuredProgramBtn)}
      >
        <Text style={isApproved ? [styles.featuredProgramBtnText, { color: '#FFFFFF' }] : (isAI ? localStyles.pulseBtnText : styles.featuredProgramBtnText)}>
          {isCompleted 
            ? 'CHALLENGE FINISHED' 
            : isPending
              ? 'PENDING APPROVAL'
              : isApproved
                ? (isPressing ? 'CLAIMING...' : 'CLAIM REWARD')
                : isAI
                  ? (model.viewedMissionIds.includes(challenge.id) ? (isPressing ? 'CONTINUING...' : 'CONTINUE MISSION') : (isPressing ? 'STARTING...' : 'START MISSION'))
                  : 'MARK AS COMPLETE'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export function ChallengesView({ model }: { model: EcoBudMobileModel }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'Discover' | 'My Tasks' | 'History'>('Discover');
  const [sortOption, setSortOption] = useState<'Default' | 'Highest Reward' | 'Easiest'>('Default');

  const categories = ['All', 'General', 'Waste', 'Transport', 'Food', 'Energy', 'Nature', 'Water', 'Lifestyle'];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const isFiltering = searchQuery.trim() !== '' || selectedCategory !== 'All';

  const filterChallenge = (c: ChallengeWithProgress) => {
    const searchLower = searchQuery.toLowerCase();
    const catLower = selectedCategory.toLowerCase();
    const matchesSearch = searchQuery === '' || c.title.toLowerCase().includes(searchLower) || c.description.toLowerCase().includes(searchLower);
    const challengeCat = ((c as any).category || 'General').toLowerCase();
    const matchesCategory = selectedCategory === 'All' || challengeCat === catLower || c.title.toLowerCase().includes(catLower) || c.description.toLowerCase().includes(catLower) || (c.type && c.type.toLowerCase().includes(catLower));
    return matchesSearch && matchesCategory;
  };

  const sortChallenges = (list: ChallengeWithProgress[]) => {
    if (sortOption === 'Highest Reward') return [...list].sort((a, b) => b.expReward - a.expReward);
    if (sortOption === 'Easiest') {
      const diffRank: Record<string, number> = { 'easy': 1, 'medium': 2, 'hard': 3, 'expert': 4 };
      return [...list].sort((a, b) => (diffRank[a.difficulty.toLowerCase()] || 99) - (diffRank[b.difficulty.toLowerCase()] || 99));
    }
    return list;
  };

  const filteredFeaturedRaw = model.challenges.filter(c => c.isFeatured).filter(filterChallenge);
  const filteredActiveRaw = model.challenges.filter(c => !c.isFeatured).filter(filterChallenge);
  
  const filteredActiveSorted = sortChallenges(filteredActiveRaw);
  const discoverChallenges = filteredActiveSorted.filter(c => (c.progress?.progressPercentage || 0) === 0 && !model.viewedMissionIds.includes(c.id) && c.progress?.status?.toLowerCase() !== 'completed' && c.progress?.status?.toLowerCase() !== 'approved');
  const inProgressChallenges = filteredActiveSorted.filter(c => ((c.progress?.progressPercentage || 0) > 0 || model.viewedMissionIds.includes(c.id)) && c.progress?.status?.toLowerCase() !== 'completed' && c.progress?.status?.toLowerCase() !== 'approved');
  const completedChallenges = filteredActiveSorted.filter(c => c.progress?.status?.toLowerCase() === 'completed' || c.progress?.status?.toLowerCase() === 'approved');

  const filteredFeatured = viewMode === 'Discover' ? filteredFeaturedRaw : [];
  const currentActiveList = viewMode === 'Discover' ? discoverChallenges : viewMode === 'My Tasks' ? inProgressChallenges : completedChallenges;

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={localStyles.headerTitle}>Challenge Eco Missions</Text>
        <Text style={localStyles.headerSubtitle}>Level up your impact. Complete tasks to earn rewards and heal the planet.</Text>

        {/* View Mode Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: '#F0F5F2', borderRadius: 12, padding: 4, marginTop: 20, marginBottom: 10 }}>
          {['Discover', 'My Tasks', 'History'].map(tab => (
            <TouchableOpacity 
              key={tab} 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: viewMode === tab ? '#FFFFFF' : 'transparent', shadowColor: viewMode === tab ? '#000' : 'transparent', shadowOpacity: 0.05, shadowRadius: 3, elevation: viewMode === tab ? 2 : 0 }}
              onPress={() => setViewMode(tab as any)}
            >
              <Text style={{ fontWeight: '700', color: viewMode === tab ? '#126027' : '#6B7A75', fontSize: 13 }}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Discovery & Filtering Section */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 15, marginTop: 20, marginBottom: 15, height: 48, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, borderWidth: 1, borderColor: '#F0F5F2' }}>
          <Ionicons name="search-outline" size={20} color="#6B7A75" style={{ marginRight: 10 }} />
          <TextInput
            style={{ flex: 1, fontSize: 16, color: '#1A211D' }}
            placeholder="Search challenges..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15, maxHeight: 40, minHeight: 40 }} contentContainerStyle={{ paddingRight: 20 }}>
          {categories.map((cat, index) => (
            <TouchableOpacity 
              key={index} 
              style={{
                backgroundColor: selectedCategory === cat ? '#126027' : '#FFFFFF',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 10,
                borderWidth: 1,
                borderColor: selectedCategory === cat ? '#126027' : '#E5E7EB',
                alignSelf: 'center',
              }}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={{
                color: selectedCategory === cat ? '#FFFFFF' : '#4B5563',
                fontWeight: '600',
              }}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {viewMode !== 'History' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7A75' }}>Sort by:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['Default', 'Highest Reward', 'Easiest'].map(sort => (
                <TouchableOpacity key={sort} onPress={() => setSortOption(sort as any)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: sortOption === sort ? '#E8F5E9' : '#F3F4F6', borderWidth: 1, borderColor: sortOption === sort ? '#A5D6A7' : 'transparent' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: sortOption === sort ? '#126027' : '#4B5563' }}>{sort}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {!isFiltering && model.recentViewedMission && viewMode === 'Discover' && (
          <View style={{ marginTop: 24, marginBottom: 8 }}>
            <Text style={[styles.welcomeLabel, { marginBottom: 8 }]}>RECENT ACTIVITY</Text>
            <Text style={[styles.sectionHeadline, { marginTop: 0, color: '#4ADE80' }]}>Recently Viewed</Text>
            <Pressable style={({ pressed }) => [localStyles.premiumTaskCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }, { borderColor: '#4ADE80', borderWidth: 2 }]} onPress={() => {
              const status = model.recentViewedMission!.progress?.status?.toLowerCase();
              if (status === 'pending' || status === 'completed') {
                return;
              }
              if (status === 'approved' || status === 'unclaimed') {
                void model.handleClaimChallengeReward(model.recentViewedMission!.id);
              } else if (model.recentViewedMission!.type === 'AI Image Recognition Challenge') {
                model.openChallengeMission(model.recentViewedMission!);
              } else {
                void model.handleChallengeProgress(model.recentViewedMission!, 100);
              }
            }}>
              <View style={localStyles.premiumTaskImgWrap}>
                {model.recentViewedMission.imageUrl ? (
                  <Image 
                    source={{ uri: getValidImageUrl(model.recentViewedMission.imageUrl) }} 
                    style={localStyles.premiumTaskImg} 
                  />
                ) : (
                  <View style={[localStyles.premiumTaskImg, { backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="trophy" size={40} color="#126027" style={{ opacity: 0.5 }} />
                  </View>
                )}
                <View style={{ ...StyleSheet.absoluteFill as any, backgroundColor: 'rgba(0,0,0,0.1)' }} />
              </View>
              <View style={localStyles.premiumTaskBody}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <Text style={[styles.taskMetaLabel, { color: '#126027' }]}>{model.recentViewedMission.difficulty.toUpperCase()}</Text>
                  <Text style={[styles.taskMetaLabel, { color: '#047857', backgroundColor: '#D1FAE5' }]}>{((model.recentViewedMission as any).category || 'GENERAL').toUpperCase()}</Text>
                  <Text style={styles.taskMetaValue}>🌿 {model.recentViewedMission.expReward} Eco Points</Text>
                  <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#1D4ED8' }}>👁️ VIEWED</Text>
                  </View>
                </View>
                <Text style={localStyles.premiumTaskTitle} numberOfLines={2}>{model.recentViewedMission.title}</Text>
                <Text style={{ fontSize: 13, color: '#6B7A75', marginTop: 4, lineHeight: 18 }} numberOfLines={2}>{model.recentViewedMission.description}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
                  {model.recentViewedMission.progress?.status?.toLowerCase() === 'approved' || model.recentViewedMission.progress?.status?.toLowerCase() === 'unclaimed' ? (
                    <TouchableOpacity 
                      style={{ backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      onPress={() => void model.handleClaimChallengeReward(model.recentViewedMission!.id)}
                    >
                      <Ionicons name="gift" size={14} color="#FFF" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFF' }}>CLAIM REWARD</Text>
                    </TouchableOpacity>
                  ) : model.recentViewedMission.progress?.status?.toLowerCase() === 'pending' ? (
                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="time" size={14} color="#B45309" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#B45309' }}>PENDING APPROVAL</Text>
                    </View>
                  ) : model.recentViewedMission.progress?.status?.toLowerCase() === 'completed' ? (
                    <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-done-circle" size={14} color="#059669" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#059669' }}>COMPLETED</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#4ADE80' }}>
                      CONTINUE MISSION
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          </View>
        )}

        {filteredFeatured.length > 0 && (
          <>
            <Text style={[styles.welcomeLabel, { marginTop: (!isFiltering && model.recentViewedMission) ? 16 : 24, marginBottom: 8 }]}>FEATURED PROGRAMS</Text>
            {filteredFeatured.map((challenge) => (
              <Animated.View key={challenge.id} style={localStyles.featuredCard}>
                <View style={[localStyles.featuredImage, { backgroundColor: '#1A3B2A' }]}>
                  {challenge.imageUrl ? (
                    <Image source={{ uri: getValidImageUrl(challenge.imageUrl) }} style={StyleSheet.absoluteFill} blurRadius={10} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }]}>
                      <Ionicons name="trophy" size={80} color="#4ADE80" style={{ opacity: 0.5 }} />
                    </View>
                  )}
                  <View style={localStyles.featuredOverlay} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']} style={localStyles.featuredGradient} />
                  
                  <View style={localStyles.featuredContent}>
                    <View style={[styles.rowBetween, { marginBottom: 16, alignItems: 'flex-start' }]}>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                        <View style={localStyles.glassTag}>
                          <Text style={localStyles.glassTagText}>
                            {challenge.difficulty.toLowerCase() === 'easy' ? '🟢' : challenge.difficulty.toLowerCase() === 'medium' ? '🟡' : challenge.difficulty.toLowerCase() === 'hard' ? '🔴' : '🔥'} {challenge.difficulty.toUpperCase()}
                          </Text>
                        </View>
                        <View style={[localStyles.glassTag, { backgroundColor: 'rgba(52, 211, 153, 0.2)', borderColor: 'rgba(52, 211, 153, 0.4)' }]}>
                          <Text style={[localStyles.glassTagText, { color: '#D1FAE5' }]}>
                            {((challenge as any).category || 'GENERAL').toUpperCase()}
                          </Text>
                        </View>
                        <View style={localStyles.glassTag}>
                          <Text style={localStyles.glassTagText}>🌿 {challenge.expReward} Eco Points</Text>
                        </View>
                        {challenge.ecoCoinReward > 0 && (
                          <View style={[localStyles.glassTag, { backgroundColor: 'rgba(74,222,128,0.3)', borderColor: 'rgba(74,222,128,0.5)', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                            <Image source={require('../../../assets/coin.png')} style={{ width: 14, height: 14, resizeMode: 'contain' }} />
                            <Text style={[localStyles.glassTagText, { color: '#ECFDF5' }]}>{challenge.ecoCoinReward} Coins</Text>
                          </View>
                        )}
                      </View>
                      
                      {model.viewedMissionIds.includes(challenge.id) ? (
                        <View style={[localStyles.glassTag, { backgroundColor: 'rgba(59, 130, 246, 0.3)', borderColor: 'rgba(59, 130, 246, 0.5)', marginLeft: 8 }]}>
                          <Text style={[localStyles.glassTagText, { color: '#EFF6FF' }]}>👁️ VIEWED</Text>
                        </View>
                      ) : (
                        <View style={[localStyles.glassTag, { backgroundColor: 'rgba(239, 68, 68, 0.3)', borderColor: 'rgba(239, 68, 68, 0.5)', marginLeft: 8 }]}>
                          <Text style={[localStyles.glassTagText, { color: '#FEF2F2' }]}>🆕 NEW</Text>
                        </View>
                      )}
                    </View>
                    
                    <Text style={{ fontSize: 34, fontWeight: '900', color: '#FFF', marginBottom: 10, letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>{challenge.title}</Text>
                    <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 24, lineHeight: 24, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{challenge.description}</Text>

                    {challenge.type === 'AI Image Recognition Challenge' && challenge.aiDetectionTargets && challenge.aiDetectionTargets.length > 0 && (
                      <LinearGradient colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']} style={localStyles.aiGradientBox}>
                        <Text style={{ color: '#A7F3D0', fontSize: 13, fontWeight: '800', marginBottom: 6, letterSpacing: 1 }}>
                          <Ionicons name="camera" size={14} color="#A7F3D0" /> AI RECOGNITION MISSION
                        </Text>
                        <Text style={{ color: '#FFF', fontSize: 14, lineHeight: 22 }}>
                          Find & capture: <Text style={{ fontWeight: '800', color: '#4ADE80' }}>{challenge.aiDetectionTargets.join(', ')}</Text>
                        </Text>
                      </LinearGradient>
                    )}

                    {challenge.type !== 'AI Image Recognition Challenge' && (
                      <View style={{ marginTop: 8 }}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.progressLabelLight}>PROGRESS</Text>
                          <Text style={styles.progressLabelLight}>{challenge.progress?.progressPercentage || 0}%</Text>
                        </View>
                        <View style={styles.progressTrackLight}>
                          <View style={[styles.progressFillLight, { width: `${challenge.progress?.progressPercentage || 0}%`, backgroundColor: '#4ADE80' }]} />
                        </View>
                      </View>
                    )}

                    <AnimatedStartButton challenge={challenge} model={model} pulseAnim={pulseAnim} />
                  </View>
                </View>
              </Animated.View>
            ))}
          </>
        )}

        {currentActiveList.length > 0 && (
          <Text style={[styles.welcomeLabel, { marginTop: filteredFeatured.length > 0 && (!isFiltering && model.recentViewedMission) ? 16 : ((!isFiltering && model.recentViewedMission) ? 16 : 24), marginBottom: 8 }]}>
            {isFiltering ? 'SEARCH RESULTS' : viewMode === 'Discover' ? 'DISCOVER CHALLENGES' : viewMode === 'My Tasks' ? 'IN PROGRESS' : 'COMPLETED CHALLENGES'}
          </Text>
        )}
        {currentActiveList.length === 0 && filteredFeatured.length === 0 && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, marginTop: 20 }}>
            <Ionicons name="leaf-outline" size={60} color="#A7F3D0" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#126027', marginBottom: 8 }}>
              {isFiltering ? 'No matches found' : viewMode === 'My Tasks' ? 'No active tasks' : viewMode === 'History' ? 'No completed tasks yet' : 'Check back later!'}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7A75', textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 }}>
              {isFiltering ? 'Try adjusting your search or category filters to find what you are looking for.' : viewMode === 'My Tasks' ? 'Start a mission from the Discover tab to see it here.' : viewMode === 'History' ? 'Complete eco missions to earn rewards and build your history.' : 'We are adding new challenges soon.'}
            </Text>
          </View>
        )}
        <View style={isTablet ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' } : {}}>
          {currentActiveList.map((challenge, index) => (
              <Pressable key={challenge.id} style={({ pressed }) => [localStyles.premiumTaskCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }, { opacity: challenge.progress?.status?.toLowerCase() === 'completed' ? 0.7 : 1 }, isTablet && { width: '48%' }]} onPress={() => {
              const currentStatus = challenge.progress?.status?.toLowerCase();
              if (currentStatus === 'pending' || currentStatus === 'completed') {
                return;
              }
              if (currentStatus === 'approved' || currentStatus === 'unclaimed') {
                void model.handleClaimChallengeReward(challenge.id);
              } else if (challenge.type === 'AI Image Recognition Challenge') {
                model.openChallengeMission(challenge);
              } else {
                void model.handleChallengeProgress(challenge, 100);
              }
            }}>
              <View style={localStyles.premiumTaskImgWrap}>
                {challenge.imageUrl ? (
                  <Image 
                    source={{ uri: getValidImageUrl(challenge.imageUrl) }} 
                    style={localStyles.premiumTaskImg} 
                  />
                ) : (
                  <View style={[localStyles.premiumTaskImg, { backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="trophy" size={40} color="#126027" style={{ opacity: 0.5 }} />
                  </View>
                )}
                <View style={{ ...StyleSheet.absoluteFill as any, backgroundColor: 'rgba(0,0,0,0.1)' }} />
              </View>
              <View style={localStyles.premiumTaskBody}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <Text style={[styles.taskMetaLabel, { color: '#126027' }]}>{challenge.difficulty.toUpperCase()}</Text>
                  <Text style={[styles.taskMetaLabel, { color: '#047857', backgroundColor: '#D1FAE5' }]}>{((challenge as any).category || 'GENERAL').toUpperCase()}</Text>
                  <Text style={styles.taskMetaValue}>🌿 {challenge.expReward} Eco Points</Text>
                  {challenge.ecoCoinReward > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 }}>
                      <Image source={require('../../../assets/coin.png')} style={{ width: 12, height: 12, resizeMode: 'contain' }} />
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#B45309' }}>{challenge.ecoCoinReward} COINS</Text>
                    </View>
                  )}
                  {model.viewedMissionIds.includes(challenge.id) ? (
                    <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#1D4ED8' }}>👁️ VIEWED</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#B91C1C' }}>🆕 NEW</Text>
                    </View>
                  )}
                </View>
                <Text style={localStyles.premiumTaskTitle} numberOfLines={2}>{challenge.title}</Text>
                <Text style={{ fontSize: 13, color: '#6B7A75', marginTop: 4, lineHeight: 18 }} numberOfLines={2}>{challenge.description}</Text>
                
                {challenge.type === 'AI Image Recognition Challenge' && challenge.aiDetectionTargets && challenge.aiDetectionTargets.length > 0 && (
                  <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={{ padding: 10, borderRadius: 12, marginTop: 6, marginBottom: 8, borderWidth: 1, borderColor: '#BBF7D0' }}>
                    <Text style={{ color: '#166534', fontSize: 11, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 }}>
                      <Ionicons name="camera" size={12} color="#15803D" /> AI TASK
                    </Text>
                    <Text style={{ color: '#15803D', fontSize: 12 }} numberOfLines={1}>
                      Targets: <Text style={{ fontWeight: '700' }}>{challenge.aiDetectionTargets.join(', ')}</Text>
                    </Text>
                  </LinearGradient>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
                  {challenge.type !== 'AI Image Recognition Challenge' && (
                    <View style={localStyles.circularProgressWrap}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#126027' }}>{challenge.progress?.progressPercentage || 0}%</Text>
                    </View>
                  )}
                  {challenge.progress?.status?.toLowerCase() === 'approved' || challenge.progress?.status?.toLowerCase() === 'unclaimed' ? (
                    <TouchableOpacity 
                      style={{ backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      onPress={() => void model.handleClaimChallengeReward(challenge.id)}
                    >
                      <Ionicons name="gift" size={14} color="#FFF" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFF' }}>CLAIM REWARD</Text>
                    </TouchableOpacity>
                  ) : challenge.progress?.status?.toLowerCase() === 'pending' ? (
                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="time" size={14} color="#B45309" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#B45309' }}>PENDING APPROVAL</Text>
                    </View>
                  ) : challenge.progress?.status?.toLowerCase() === 'completed' ? (
                    <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-done-circle" size={14} color="#059669" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#059669' }}>COMPLETED</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#4ADE80' }}>
                      {challenge.type === 'AI Image Recognition Challenge'
                            ? (model.viewedMissionIds.includes(challenge.id) ? 'CONTINUE MISSION' : 'START MISSION')
                            : 'MARK AS COMPLETE'}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {model.challenges.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
            <Ionicons name="trophy-outline" size={48} color="#126027" />
            <Text style={[styles.sectionHeadline, { marginTop: 16 }]}>Check back soon!</Text>
            <Text style={styles.pageSubtitle}>Admins are preparing new challenges for the community.</Text>
          </View>
        )}



        <View style={{ height: 100 }} />
      </View>
    </>
  );
}

export function TrackerView({ model }: { model: EcoBudMobileModel }) {
  // ── Real-time Philippines (PHT) month ──────────────────────────────────────
  // Re-evaluate every minute so the calendar's "today" highlight rolls over
  // live at local midnight and the month auto-advances at the turn of the month,
  // even while the screen stays open.
  const [liveMonth, setLiveMonth] = useState(() => getPhMonthKey());
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveMonth((current) => {
        const next = getPhMonthKey();
        return next === current ? current : next;
      });
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const trackerMonth = model.tracker?.month ?? liveMonth;
  const completedDays = model.tracker?.completedDays ?? [];
  const calendarCells = buildCalendarCells(trackerMonth, completedDays);

  // ── Derived gamification state ─────────────────────────────────────────────
  const totalPoints = model.tracker?.points ?? model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0;
  const ecoLevel = getEcoLevel(totalPoints);
  const streak = getVisibleStreak(model.tracker?.currentStreak ?? 0);

  // Last 7 days progress dots (oldest → newest). A day counts if it's in the
  // completed set; today is always the rightmost dot.
  const lastSevenDays = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - offset));
    return date;
  });

  // ── Segmented switch: Activity Calendar ↔ Leaderboard ──────────────────────
  const [segment, setSegment] = useState<'calendar' | 'leaderboard'>('calendar');
  const [segmentWidth, setSegmentWidth] = useState(0);
  const switchAnim = useRef(new Animated.Value(segment === 'calendar' ? 0 : 1)).current;
  useEffect(() => {
    Animated.spring(switchAnim, {
      toValue: segment === 'calendar' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
  }, [segment, switchAnim]);

  // ── Animated level progress bar ────────────────────────────────────────────
  const levelBarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(levelBarAnim, {
      toValue: Math.max(0, Math.min(100, ecoLevel.progressPercentage)),
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ecoLevel.progressPercentage, levelBarAnim]);

  // ── Streak flame pulse ─────────────────────────────────────────────────────
  const flameScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (streak === 0) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameScale, { toValue: 1.12, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(flameScale, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flameScale, streak]);


  // ── Day detail popup ───────────────────────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState<{ dateKey: string; label: string } | null>(null);
  const popupFade = useRef(new Animated.Value(0)).current;
  const popupScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (selectedDay) {
      Animated.parallel([
        Animated.timing(popupFade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(popupScale, { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }),
      ]).start();
    } else {
      popupFade.setValue(0);
      popupScale.setValue(0.9);
    }
  }, [selectedDay, popupFade, popupScale]);

  const leaderboardItems = model.leaderboard?.items ?? [];
  const currentRank = model.leaderboard?.currentUserRank ?? null;

  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const lbTotalPages = Math.max(1, Math.ceil(leaderboardItems.length / 10));
  const lbStartIndex = (leaderboardPage - 1) * 10;
  const lbEndIndex = lbStartIndex + 10;
  const lbCurrentItems = leaderboardItems.slice(lbStartIndex, lbEndIndex);
  
  const isLbPageOne = leaderboardPage === 1;
  const podiumTop3 = isLbPageOne ? lbCurrentItems.slice(0, 3) : [];
  const rankListItems = isLbPageOne ? lbCurrentItems.slice(3) : lbCurrentItems;

  const lbFadeAnim = useRef(new Animated.Value(0)).current;
  const lbSlideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    lbFadeAnim.setValue(0);
    lbSlideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(lbFadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(lbSlideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
  }, [leaderboardPage, lbFadeAnim, lbSlideAnim, segment]);

  const rankMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const intensityStyle = (cell: (typeof calendarCells)[number]) => {
    if (!cell.dateKey || !cell.completed) {
      return trackerStyles.cellEmpty;
    }
    return trackerStyles.cellActive;
  };

  const openDay = (cell: (typeof calendarCells)[number]) => {
    if (!cell.dateKey) {
      return;
    }
    const [y, m, d] = cell.dateKey.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString([], {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    setSelectedDay({ dateKey: cell.dateKey, label });
  };

  return (
    <>
      <TopNavbar model={model} showBack={true} title="Tracker" />

      <View style={styles.homeContent}>
        {/* ── 🔥 Current Streak Card ─────────────────────────────────────────── */}
        <SummaryCards
          currentStreak={model.dashboard?.streak ?? model.session?.user.currentStreak ?? 0}
          ecoPoints={model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0}
          onPressRewards={() => model.setActiveOverlay('streakRewards')}
        />


        {/* ── 🌱 Level Progress Card ────────────────────────────────────────── */}
        <View style={{ marginTop: 24 }}>
          <LevelCard ecoPoints={totalPoints} />
        </View>

        {/* ── Segmented Switch ─────────────────────────────────────────────── */}
        <View style={trackerStyles.segmentWrap}>
          <View
            style={trackerStyles.segmentTrack}
            onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                trackerStyles.segmentThumb,
                {
                  transform: [
                    {
                      translateX: switchAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.max(0, segmentWidth / 2)],
                      }),
                    },
                  ],
                },
              ]}
            />
            {(['calendar', 'leaderboard'] as const).map((key) => (
              <TouchableOpacity
                key={key}
                style={trackerStyles.segmentButton}
                onPress={() => setSegment(key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    trackerStyles.segmentText,
                    segment === key && trackerStyles.segmentTextActive,
                  ]}
                >
                  {key === 'calendar' ? '📅 Activity Calendar' : '🏆 Leaderboard'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Activity Calendar View ───────────────────────────────────────── */}
        {segment === 'calendar' && (
          <View style={trackerStyles.surfaceCard}>
            <View style={styles.rowBetween}>
              <Text style={trackerStyles.surfaceTitle}>Activity Calendar</Text>
              <Text style={trackerStyles.surfaceSubtitle}>{formatMonthLabel(trackerMonth)}</Text>
            </View>

            <View style={trackerStyles.calNavRow}>
              <TouchableOpacity
                onPress={() => void model.loadTrackerMonth(-1)}
                style={trackerStyles.calNavBtn}
              >
                <Feather name="chevron-left" size={20} color="#1A211D" />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                {model.tracker?.currentStreak && model.tracker.currentStreak >= 3 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#169070', letterSpacing: 0.5 }}>
                      BUILDING STREAK: {model.tracker.currentStreak} 🔥
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7A75', marginBottom: 6 }}>
                    Count {model.tracker?.currentStreak || 0}/3 to show the streak
                  </Text>
                )}
                <View style={trackerStyles.calLegendRow}>
                  <View style={[trackerStyles.legendChip, trackerStyles.cellEmpty]} />
                  <Text style={trackerStyles.legendText}>None</Text>
                  <View style={[trackerStyles.legendChip, trackerStyles.cellActive]} />
                  <Text style={trackerStyles.legendText}>Active</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => void model.loadTrackerMonth(1)}
                style={trackerStyles.calNavBtn}
              >
                <Feather name="chevron-right" size={20} color="#1A211D" />
              </TouchableOpacity>
            </View>

            <View style={trackerStyles.calWeekRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <Text key={i} style={trackerStyles.calWeekLabel}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={trackerStyles.calGrid}>
              {calendarCells.map((cell, index) => (
                <TouchableOpacity
                  key={`${cell.dateKey ?? 'empty'}-${index}`}
                  style={trackerStyles.calCell}
                  disabled={!cell.dateKey}
                  onPress={() => openDay(cell)}
                  activeOpacity={0.7}
                >
                  {cell.dateKey ? (
                    <View
                      style={[
                        trackerStyles.heatmapCell,
                        intensityStyle(cell),
                        cell.isToday && trackerStyles.heatmapToday,
                      ]}
                    >
                      <Text
                        style={[
                          trackerStyles.heatmapText,
                          cell.completed && trackerStyles.heatmapTextDone,
                          cell.isToday && trackerStyles.heatmapTextToday,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Leaderboard View ─────────────────────────────────────────────── */}
        {segment === 'leaderboard' && (
          <View style={trackerStyles.surfaceCard}>
            <View style={styles.rowBetween}>
              <Text style={trackerStyles.surfaceTitle}>Community Leaderboard</Text>
              <Text style={trackerStyles.surfaceSubtitle}>By Eco Points</Text>
            </View>

            {leaderboardItems.length === 0 ? (
              <View style={trackerStyles.leaderboardEmpty}>
                <MaterialCommunityIcons name="trophy-outline" size={40} color="#B0C4B8" />
                <Text style={trackerStyles.leaderboardEmptyText}>No rankings yet. Be the first!</Text>
              </View>
            ) : (
              <Animated.View style={{ opacity: lbFadeAnim, transform: [{ translateY: lbSlideAnim }] }}>
                {/* Podium / top 3 */}
                {isLbPageOne && podiumTop3.length > 0 && (
                  <View style={trackerStyles.podiumRow}>
                    {podiumTop3.map((entry) => {
                      const medal = rankMedal(entry.rank);
                      const isUser = entry.isCurrentUser;
                      const podiumHeight = entry.rank === 1 ? 78 : entry.rank === 2 ? 62 : 52;
                      return (
                        <View key={entry.id} style={trackerStyles.podiumColumn}>
                          <Text style={trackerStyles.podiumMedal}>{medal ?? '⭐'}</Text>
                          <View style={[trackerStyles.podiumAvatar, isUser && trackerStyles.podiumAvatarUser]}>
                            <Text style={trackerStyles.podiumAvatarText}>
                              {entry.displayName.slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={trackerStyles.podiumName} numberOfLines={1}>
                            {isUser ? 'You' : entry.displayName}
                          </Text>
                          <Text style={trackerStyles.podiumPoints}>{entry.points} Eco Points</Text>
                          <View
                            style={[
                              trackerStyles.podiumBlock,
                              { height: podiumHeight },
                              entry.rank === 1 && trackerStyles.podiumBlockGold,
                              entry.rank === 2 && trackerStyles.podiumBlockSilver,
                              entry.rank === 3 && trackerStyles.podiumBlockBronze,
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Remaining ranks */}
                <View style={trackerStyles.rankList}>
                  {rankListItems.map((entry) => (
                    <View
                      key={entry.id}
                      style={[
                        trackerStyles.rankRow,
                        entry.isCurrentUser && trackerStyles.rankRowUser,
                      ]}
                    >
                      <Text style={trackerStyles.rankNumber}>#{entry.rank}</Text>
                      <View style={trackerStyles.rankAvatar}>
                        <Text style={trackerStyles.rankAvatarText}>
                          {entry.displayName.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={trackerStyles.rankName} numberOfLines={1}>
                        {entry.isCurrentUser ? 'You' : entry.displayName}
                      </Text>
                      <Text style={trackerStyles.rankPoints}>{entry.points} Eco Points</Text>
                    </View>
                  ))}
                </View>

                {/* Pagination Controls */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderColor: '#EDF6F1', alignItems: 'center' }}>
                  <TouchableOpacity 
                    disabled={leaderboardPage === 1} 
                    onPress={() => setLeaderboardPage(leaderboardPage - 1)}
                    style={{ padding: 8, opacity: leaderboardPage === 1 ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-back" size={24} color="#126027" />
                  </TouchableOpacity>
                  <Text style={{ fontWeight: '800', color: '#126027', fontSize: 14 }}>
                    Page {leaderboardPage} of {lbTotalPages}
                  </Text>
                  <TouchableOpacity 
                    disabled={leaderboardPage >= lbTotalPages} 
                    onPress={() => setLeaderboardPage(leaderboardPage + 1)}
                    style={{ padding: 8, opacity: leaderboardPage >= lbTotalPages ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={24} color="#126027" />
                  </TouchableOpacity>
                </View>

                {/* Current user anchor */}
                {currentRank != null && !lbCurrentItems.some((entry) => entry.isCurrentUser) && (
                  <View style={trackerStyles.currentUserAnchor}>
                    <Text style={trackerStyles.rankNumber}>#{currentRank}</Text>
                    <View style={[trackerStyles.rankAvatar, trackerStyles.rankAvatarUser]}>
                      <Text style={[trackerStyles.rankAvatarText, { color: '#FFF' }]}>Y</Text>
                    </View>
                    <Text style={trackerStyles.rankName}>You</Text>
                    <Text style={trackerStyles.rankPoints}>{totalPoints} Eco Points</Text>
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        )}

        <View style={{ height: 110 }} />
      </View>

      {/* ── Day Detail Popup ──────────────────────────────────────────────── */}
      {selectedDay && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedDay(null)}
          />
          <Animated.View
            style={[
              trackerStyles.popupOverlay,
              { opacity: popupFade },
            ]}
          />
          <View style={trackerStyles.popupCenter}>
            <Animated.View
              style={[
                trackerStyles.popupCard,
                { transform: [{ scale: popupScale }], opacity: popupFade },
              ]}
            >
              <View style={trackerStyles.popupHeader}>
                <MaterialCommunityIcons name="calendar-check" size={20} color="#126027" />
                <Text style={trackerStyles.popupTitle}>{selectedDay.label}</Text>
                <TouchableOpacity onPress={() => setSelectedDay(null)} hitSlop={12}>
                  <Feather name="x" size={20} color="#6B7A75" />
                </TouchableOpacity>
              </View>

              {completedDays.includes(selectedDay.dateKey) ? (
                <>
                  {model.tracker?.logsByDate?.[selectedDay.dateKey] && model.tracker.logsByDate[selectedDay.dateKey].length > 0 ? (
                    <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                      {model.tracker.logsByDate[selectedDay.dateKey].map((log, index) => (
                        <View key={index} style={[trackerStyles.popupRow, { marginBottom: 8 }]}>
                          <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                          <Text style={[trackerStyles.popupRowText, { flex: 1 }]} numberOfLines={2}>{log.title}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6F4EC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                            <MaterialCommunityIcons name="leaf" size={12} color="#126027" />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#126027', marginLeft: 2 }}>+{log.points}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <>
                      <View style={trackerStyles.popupRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                        <Text style={trackerStyles.popupRowText}>Eco activity completed</Text>
                      </View>
                      <View style={trackerStyles.popupReward}>
                        <MaterialCommunityIcons name="leaf" size={16} color="#FFF" />
                        <Text style={trackerStyles.popupRewardText}>+Eco Points earned</Text>
                      </View>
                    </>
                  )}
                </>
              ) : (
                <View style={trackerStyles.popupEmpty}>
                  <MaterialCommunityIcons name="leaf-off" size={28} color="#B0C4B8" />
                  <Text style={trackerStyles.popupEmptyText}>No activity logged this day.</Text>
                  <Text style={trackerStyles.popupEmptySub}>Complete any eco action to fill the calendar!</Text>
                </View>
              )}
            </Animated.View>
          </View>
        </View>
      )}
    </>
  );
}

export function ProfileView({ model }: { model: EcoBudMobileModel }) {
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      model.handleUpdateProfileImage(result.assets[0].uri);
    }
  };

  const avatarUrl = model.session?.user.avatarUrl ? `${ecobudApiOrigin}${model.session.user.avatarUrl}` : null;

  return (
    <>
      <TopNavbar model={model} />
      
      {/* Background Decor Orbs */}
      <View style={profileStyles.backgroundOrbOne} />
      <View style={profileStyles.backgroundOrbTwo} />

      <View style={styles.homeContent}>
        
        {/* Profile Card Banner */}
        <LinearGradient
          colors={['#126027', '#0F4D20', '#0A3B18']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={profileStyles.headerCard}
        >
          <View style={profileStyles.headerTopRow}>
            <View style={profileStyles.headerBadge}>
              <Text style={profileStyles.headerBadgeText}>LEVEL 12</Text>
            </View>
            <TouchableOpacity 
              style={profileStyles.headerSettingsBtn}
              onPress={() => model.setActiveOverlay('settings')}
            >
              <Ionicons name="settings-sharp" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={profileStyles.profileMainInfo}>
            <TouchableOpacity onPress={() => void pickImage()} style={profileStyles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={profileStyles.avatarImg} />
              ) : (
                <View style={profileStyles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#126027" />
                </View>
              )}
              <View style={profileStyles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color="#FFF" />
              </View>
            </TouchableOpacity>
            
            <View style={profileStyles.profileMeta}>
              <Text style={profileStyles.profileName} numberOfLines={1}>
                {model.userDisplayName}
              </Text>
              <Text style={profileStyles.profileEmail} numberOfLines={1}>
                {model.session?.user.email}
              </Text>
              <View style={profileStyles.titleBadge}>
                <MaterialCommunityIcons name="shield-crown" size={14} color="#F59E0B" />
                <Text style={profileStyles.titleBadgeText}>Forest Guardian</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Stats Grid */}
        <View style={profileStyles.statsRow}>
          <View style={profileStyles.statCard}>
            <View style={[profileStyles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Image source={require('../../../assets/coin.png')} style={profileStyles.coinIcon} resizeMode="contain" />
            </View>
            <Text style={profileStyles.statValue}>{model.dashboard?.ecoCoins ?? 0}</Text>
            <Text style={profileStyles.statLabel}>Eco Coins</Text>
          </View>

          <View style={profileStyles.statCard}>
            <View style={[profileStyles.statIconBox, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="trophy" size={18} color="#0284C7" />
            </View>
            <Text style={profileStyles.statValue}>Lv. 12</Text>
            <Text style={profileStyles.statLabel}>Forest Guardian</Text>
          </View>

          <View style={profileStyles.statCard}>
            <View style={[profileStyles.statIconBox, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="leaf" size={18} color="#15803D" />
            </View>
            <Text style={profileStyles.statValue}>1.2T</Text>
            <Text style={profileStyles.statLabel}>CO2 Offset</Text>
          </View>
        </View>

        {/* Progress Bar Info */}
        <View style={profileStyles.progressSection}>
          <View style={profileStyles.progressInfoRow}>
            <Text style={profileStyles.progressInfoText}>Journey Progress</Text>
            <Text style={profileStyles.progressInfoValue}>850 XP to Lv. 13</Text>
          </View>
          <ProgressBar progress={70} />
        </View>

        {/* Events Quick Card */}
        <View style={profileStyles.sectionContainer}>
          <Text style={profileStyles.sectionHeadline}>My Eco Events</Text>
          <View style={profileStyles.eventBanner}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(240, 253, 244, 0.95)']}
              style={profileStyles.eventBannerGrad}
            >
              <View style={profileStyles.eventBannerTextCol}>
                <Text style={profileStyles.eventBannerTitle}>Local Workshops</Text>
                <Text style={profileStyles.eventBannerDesc}>Join clean-ups, eco events, and tree plant activities.</Text>
              </View>
              <TouchableOpacity
                onPress={() => model.setActiveOverlay('events')}
                style={profileStyles.eventBannerBtn}
              >
                <Text style={profileStyles.eventBannerBtnText}>Discover</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

        {/* Unified Eco Actions List */}
        <View style={profileStyles.sectionContainer}>
          <Text style={profileStyles.sectionHeadline}>Eco Hub</Text>
          <View style={profileStyles.actionListCard}>
            <TouchableOpacity style={profileStyles.actionItem}>
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: '#EDF6F1' }]}>
                <Ionicons name="gift-outline" size={20} color="#126027" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={profileStyles.actionLabel}>Redeem Rewards</Text>
                <Text style={profileStyles.actionSub}>Trade Eco Coins for rewards & vouchers</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B0C4B8" />
            </TouchableOpacity>

            <View style={profileStyles.divider} />

            <TouchableOpacity style={profileStyles.actionItem}>
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: '#EDF6F1' }]}>
                <Ionicons name="time-outline" size={20} color="#126027" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={profileStyles.actionLabel}>Coins History</Text>
                <Text style={profileStyles.actionSub}>Check your points and task completion logs</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B0C4B8" />
            </TouchableOpacity>

            <View style={profileStyles.divider} />

            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => model.setActiveOverlay('settings')}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: '#EDF6F1' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#126027" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={profileStyles.actionLabel}>Settings & Security</Text>
                <Text style={profileStyles.actionSub}>Manage account security & notifications</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B0C4B8" />
            </TouchableOpacity>

            <View style={profileStyles.divider} />

            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => void model.handleLogout()}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: '#EF4444' }]}>Sign Out</Text>
                <Text style={profileStyles.actionSub}>Logout of your current device session</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FCA5A5" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Collectible Badges Grid */}
        <View style={profileStyles.sectionContainer}>
          <Text style={profileStyles.sectionHeadline}>Collectible Badges</Text>
          <View style={profileStyles.badgesGrid}>
            
            <View style={profileStyles.badgeCard}>
              <View style={[profileStyles.badgeIconRing, { borderColor: '#F59E0B' }]}>
                <LinearGradient
                  colors={['#126027', '#1D7537']}
                  style={profileStyles.badgeIconBg}
                >
                  <Ionicons name="trash-outline" size={26} color="#FFF" />
                </LinearGradient>
                <View style={profileStyles.goldBadgeTag}>
                  <Text style={profileStyles.goldBadgeTagText}>GOLD</Text>
                </View>
              </View>
              <Text style={profileStyles.badgeTitle}>Waste Warrior</Text>
              <Text style={profileStyles.badgeDescription}>Recycled for 30 consecutive days</Text>
            </View>

            <View style={profileStyles.badgeCard}>
              <View style={[profileStyles.badgeIconRing, { borderColor: '#10B981' }]}>
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={profileStyles.badgeIconBg}
                >
                  <Ionicons name="flash-outline" size={26} color="#FFF" />
                </LinearGradient>
              </View>
              <Text style={profileStyles.badgeTitle}>Energy Saver</Text>
              <Text style={profileStyles.badgeDescription}>Reduced home energy by 15%</Text>
            </View>

            <View style={[profileStyles.badgeCard, { opacity: 0.75 }]}>
              <View style={[profileStyles.badgeIconRing, { borderColor: '#B0C4B8' }]}>
                <View style={[profileStyles.badgeIconBg, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="bicycle-outline" size={26} color="#9CA3AF" />
                </View>
                <View style={profileStyles.lockBadgeTag}>
                  <Ionicons name="lock-closed" size={10} color="#FFF" />
                </View>
              </View>
              <Text style={profileStyles.badgeTitleLocked}>Pedal Power</Text>
              <Text style={profileStyles.badgeDescription}>Cycle to work 10 times (3/10)</Text>
              <View style={profileStyles.badgeProgressWrap}>
                <ProgressBar progress={30} />
              </View>
            </View>

            <View style={[profileStyles.badgeCard, { opacity: 0.75 }]}>
              <View style={[profileStyles.badgeIconRing, { borderColor: '#B0C4B8' }]}>
                <View style={[profileStyles.badgeIconBg, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="water-outline" size={26} color="#9CA3AF" />
                </View>
                <View style={profileStyles.lockBadgeTag}>
                  <Ionicons name="lock-closed" size={10} color="#FFF" />
                </View>
              </View>
              <Text style={profileStyles.badgeTitleLocked}>Water Wise</Text>
              <Text style={profileStyles.badgeDescription}>Save 50 gallons of water (5/50)</Text>
              <View style={profileStyles.badgeProgressWrap}>
                <ProgressBar progress={10} />
              </View>
            </View>

          </View>
        </View>

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}

const localStyles = StyleSheet.create({
  headerTitle: { fontSize: 38, fontWeight: '900', color: '#126027', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 16, color: '#6B7A75', marginTop: 6, lineHeight: 24 },
  
  featuredCard: {
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 10,
    backgroundColor: '#126027',
  },
  featuredImage: { minHeight: 420, justifyContent: 'flex-end' },
  featuredOverlay: { ...StyleSheet.absoluteFill as any, backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  featuredGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '90%' },
  featuredContent: { padding: 24, paddingTop: 40 },
  
  glassTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  glassTagText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  premiumTaskCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F5F2',
  },
  premiumTaskImgWrap: {
    width: 96, height: 96,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 16,
    backgroundColor: '#F0F5F2',
  },
  premiumTaskImg: { width: '100%', height: '100%' },
  premiumTaskBody: { flex: 1 },
  premiumTaskTitle: { fontSize: 18, fontWeight: '800', color: '#1A211D', marginBottom: 4, lineHeight: 24 },
  
  circularProgressWrap: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F5F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E8F5E9',
  },

  aiGradientBox: {
    padding: 16, borderRadius: 20, marginTop: 8, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  
  pulseBtn: {
    backgroundColor: '#4ADE80',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  pulseBtnText: { color: '#126027', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});

const trackerStyles = StyleSheet.create({
  // ── 🔥 Streak Card ────────────────────────────────────────────────────────
  streakCard: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#0B5F58',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  streakGlow: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderRadius: 24,
  },
  streakHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flameCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(251,191,36,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251,191,36,0.15)',
  },
  streakLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  streakTagline: { color: '#FFF', fontSize: 15, fontWeight: '700', marginTop: 2 },
  streakNumberRow: { alignItems: 'baseline', flexDirection: 'row', marginTop: 20, gap: 6 },
  streakNumber: { color: '#FFF', fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  streakUnit: { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' },
  streakDotsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 4, alignItems: 'center' },
  streakDot: { width: 36, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  streakDotDone: { 
    backgroundColor: '#34D399',
    shadowColor: '#34D399',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  streakDotToday: { 
    borderWidth: 2, 
    borderColor: '#FFFFFF', 
    height: 10, 
    backgroundColor: 'rgba(255, 255, 255, 0.4)' 
  },

  // ── 🌱 Level Card ─────────────────────────────────────────────────────────
  levelCard: {
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  levelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#126027',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  levelTierLabel: { color: '#6B7A75', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  levelTierName: { color: '#1A211D', fontSize: 17, fontWeight: '800', marginTop: 2 },
  levelPointsPill: {
    backgroundColor: 'rgba(18,96,39,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  levelPointsPillText: { color: '#126027', fontSize: 13, fontWeight: '800' },
  levelBarRow: {
    height: 10,
    backgroundColor: '#F0F5F2',
    borderRadius: 5,
    marginTop: 16,
    overflow: 'hidden',
  },
  levelBarFill: {
    height: '100%',
    backgroundColor: '#22A77B',
    borderRadius: 5,
  },
  levelMeta: { color: '#6B7A75', fontSize: 12, fontWeight: '600', marginTop: 10 },
  levelMetaAccent: { color: '#126027', fontSize: 12, fontWeight: '700', marginTop: 10 },

  // ── Segmented Switch ──────────────────────────────────────────────────────
  segmentWrap: { marginTop: 20 },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#F0F5F2',
    borderRadius: 16,
    padding: 4,
    position: 'relative',
  },
  segmentThumb: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: '50%',
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: { color: '#6B7A75', fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: '#126027', fontWeight: '800' },

  // ── Surface Card (shared for Calendar & Leaderboard) ──────────────────────
  surfaceCard: {
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  surfaceTitle: { fontSize: 18, fontWeight: '800', color: '#1A211D' },
  surfaceSubtitle: { fontSize: 13, fontWeight: '600', color: '#6B7A75' },

  // ── Activity Calendar ─────────────────────────────────────────────────────
  calNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendChip: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 11, fontWeight: '600', color: '#6B7A75', marginRight: 8 },
  calWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 2,
  },
  calWeekLabel: {
    width: 44,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  calCell: {
    width: '14.28%',
    padding: 2,
    alignItems: 'center',
  },

  // Heatmap cells
  heatmapCell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellEmpty: {
    backgroundColor: '#F0F5F2',
    borderColor: '#E8F0EC',
  },
  cellActive: {
    backgroundColor: '#22C55E',
    borderColor: '#16A34A',
  },
  heatmapToday: {
    borderWidth: 2,
    borderColor: '#126027',
  },
  heatmapText: {
    color: '#6B7A75',
    fontSize: 12,
    fontWeight: '600',
  },
  heatmapTextDone: { color: '#FFF', fontWeight: '700' },
  heatmapTextToday: { fontWeight: '800', color: '#126027' },

  // ── Leaderboard ────────────────────────────────────────────────────────────
  leaderboardEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  leaderboardEmptyText: { color: '#6B7A75', fontSize: 14, fontWeight: '600' },

  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
    paddingBottom: 8,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  podiumMedal: { fontSize: 28 },
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F5F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E8F0EC',
  },
  podiumAvatarUser: {
    backgroundColor: '#126027',
    borderColor: '#0B5F58',
  },
  podiumAvatarText: { color: '#126027', fontSize: 16, fontWeight: '800' },
  podiumName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A211D',
    textAlign: 'center',
    maxWidth: 80,
  },
  podiumPoints: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7A75',
  },
  podiumBlock: {
    width: '100%',
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#F0F5F2',
  },
  podiumBlockGold: { backgroundColor: '#FDE68A' },
  podiumBlockSilver: { backgroundColor: '#D1D5DB' },
  podiumBlockBronze: { backgroundColor: '#FBBF24' },

  rankList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F5F2',
    paddingTop: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F2',
    gap: 12,
  },
  rankRowUser: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    paddingHorizontal: 12,
  },
  rankNumber: {
    width: 32,
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7A75',
  },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarUser: { backgroundColor: '#126027' },
  rankAvatarText: { color: '#126027', fontSize: 14, fontWeight: '700' },
  rankName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1A211D' },
  rankPoints: { fontSize: 14, fontWeight: '800', color: '#126027' },

  currentUserAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#126027',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
  },

  // ── Day Detail Popup ──────────────────────────────────────────────────────
  popupOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  popupCenter: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popupCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  popupTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#1A211D',
  },
  popupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F2',
  },
  popupRowText: { fontSize: 14, fontWeight: '600', color: '#1A211D' },
  popupReward: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#126027',
    paddingVertical: 12,
    borderRadius: 16,
  },
  popupRewardText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  popupEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  popupEmptyText: { color: '#6B7A75', fontSize: 14, fontWeight: '600' },
  popupEmptySub: { color: '#9CA3AF', fontSize: 12, fontWeight: '500' },
});

const profileStyles = StyleSheet.create({
  backgroundOrbOne: {
    position: 'absolute',
    top: 150,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(74, 222, 128, 0.05)',
  },
  backgroundOrbTwo: {
    position: 'absolute',
    top: 400,
    right: -40,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  headerCard: {
    borderRadius: 28,
    padding: 20,
    marginTop: 12,
    marginBottom: 20,
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerSettingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#FFF',
    backgroundColor: '#E6F4EC',
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#FFF',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  profileMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 6,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  titleBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F5F2',
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  coinIcon: {
    width: 18,
    height: 18,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1A211D',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7A75',
    fontWeight: '600',
    textAlign: 'center',
  },
  progressSection: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F0F5F2',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressInfoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A211D',
  },
  progressInfoValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#126027',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeadline: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  eventBanner: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  eventBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 16,
  },
  eventBannerTextCol: {
    flex: 1,
  },
  eventBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#126027',
    marginBottom: 4,
  },
  eventBannerDesc: {
    fontSize: 12,
    color: '#6B7A75',
    lineHeight: 16,
  },
  eventBannerBtn: {
    backgroundColor: '#126027',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventBannerBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  actionListCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F0F5F2',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  actionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 11,
    color: '#6B7A75',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F5F2',
    marginHorizontal: 12,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F5F2',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  badgeIconBg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldBadgeTag: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  goldBadgeTagText: {
    color: '#FFF',
    fontSize: 7,
    fontWeight: '900',
  },
  lockBadgeTag: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#9CA3AF',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A211D',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeTitleLocked: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7A75',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 10,
    color: '#6B7A75',
    textAlign: 'center',
    lineHeight: 13,
  },
  badgeProgressWrap: {
    width: '100%',
    marginTop: 8,
  },
});

