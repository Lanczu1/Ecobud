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
  Modal,
  Switch,
  type StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { styles } from '../styles/appStyles';
import { ecoTheme, useTheme } from '../../shared/theme/ecoTheme';
import { LoadingScreenVisual, LoadingGlyph } from '../../shared/ui/OptimizedLoading';
import { EcoBudMobileModel } from '../types/home';
import {
  buildCalendarCells,
  formatMonthLabel,
  getEcoLevel,
  getPhMonthKey,
  usePressScale,
  getVisibleStreak,
  resolveMediaUrl,
} from '../utils/appUtils';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import {
  TopNavbar,
  ProgressBar,
  AvatarBubble,
  SurfaceCard,
  SecondaryButton,
  AiAssistantBar,
} from './CommonComponents';
import { CoachMarkTarget } from './CoachMarkTarget';
import { RejectionModal } from './RejectionModal';
import { FireStreak } from './FireStreak';
import { LevelCard, getLevelFromPoints } from './LevelCard';
import { SummaryCards } from './SummaryCards';
import { QuickActions } from './QuickActions';
import { ActiveChallengeCard } from './ActiveChallengeCard';
import { DiscoverChallengeCard, DiscoverChallengeSkeleton } from './DiscoverChallengeCard';
import { DailyTipCard } from './DailyTipCard';
import { ContinueLessonCard } from './ContinueLessonCard';
import { CommunityImpactCard } from './CommunityImpactCard';
import { ecobudApiOrigin, type ChallengeWithProgress } from '../../shared/api/ecobudApi';
import { ChallengesViewSkeleton, LeaderboardSkeleton, TrackerCardsSkeleton } from '../../shared/ui/SkeletonLoaders';
import { triggerSelectionHaptic } from '../utils/haptics';

const getValidImageUrl = (url: string | null | undefined) => {
  return resolveMediaUrl(url, ecobudApiOrigin) || undefined;
};

// Local components used in Views
export function BootView() {
  const { theme, isDark } = useTheme();
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeIn]);
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
  const { theme, isDark } = useTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LoadingScreenVisual label="Preparing your EcoBud welcome" />
    </SafeAreaView>
  );
}

export function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const isLandscape = width > height;
  const isSmallDevice = height <= 680 || width < 375; // Targets iPhone SE 2nd/3rd gen (667h x 375w), iPhone 8/7, Display Zoom, mini devices
  const isCompact = height < 750 || width < 380;
  const { scale: buttonScale, onPressIn, onPressOut } = usePressScale();

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
          toValue: isSmallDevice ? -8 : -14,
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
  }, [screenFadeAnim, floatAnim, isSmallDevice]);

  const steps = [
    {
      title: 'Learn, Act, and\nEarn rewards',
      subtitle: 'Discover sustainable habits, join challenges, and track your impact with ECOBUD.',
      image: require('../../../assets/onboarding_hero.png'),
      buttonText: 'Start Your Eco Journey',
    },
    {
      title: 'Verified Actions',
      subtitle: 'Every positive move matters. Log your activities and see real-time data on how you are saving the planet.',
      image: require('../../../assets/forest.png'),
      buttonText: 'Continue',
    },
    {
      title: 'Lead the Way',
      subtitle: 'Join a global community of eco-warriors. Lead by example and earn rewards for your contributions.',
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

  // Dynamic sizing calculations for small devices (e.g. iPhone SE: 375 x 667)
  const heroMaxSize = isSmallDevice ? Math.min(width * 0.52, 200) : isCompact ? Math.min(width * 0.62, 240) : Math.min(width * 0.72, 280);
  const logoWidth = isSmallDevice ? scale(120) : scale(150);

  return (
    <Animated.View style={[styles.newOnboardingContainer, { opacity: screenFadeAnim }, isDark && { backgroundColor: theme.colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView style={[styles.newOnboardingSafeArea, isLandscape && { flexDirection: 'row', alignItems: 'center' }]}>
        {!isLandscape && (
          <View style={[
            styles.newOnboardingHeader,
            isSmallDevice && { marginTop: verticalScale(12), marginBottom: verticalScale(4) }
          ]}>
            <Image
              source={require('../../../assets/ecobud_wordmark.png')}
              style={[
                styles.newOnboardingLogo,
                { width: logoWidth, height: logoWidth * (238 / 691) },
                isDark && { tintColor: '#F3F7F5' }
              ]}
              resizeMode="contain"
            />
          </View>
        )}

        <Animated.View
          style={[
            styles.newOnboardingHeroContent,
            isLandscape && { flex: 0.5, marginTop: 0 },
            isSmallDevice && { paddingHorizontal: scale(16), marginVertical: 0 },
            { opacity: fadeAnim, transform: [{ translateY: floatAnim }] }
          ]}
        >
          <View
            style={[
              styles.heroCircleWrapper,
              { width: heroMaxSize, height: heroMaxSize, maxWidth: heroMaxSize },
              isDark && {
                backgroundColor: 'rgba(31, 51, 39, 0.75)',
                shadowColor: '#22A77B',
                shadowOpacity: 0.35,
                borderWidth: 1.5,
                borderColor: 'rgba(93, 223, 135, 0.25)',
              },
            ]}
          >
            <Image
              source={currentStepData.image}
              style={[
                styles.newOnboardingHeroImage,
                isSmallDevice && { width: '120%', height: '120%' },
              ]}
              resizeMode="cover"
            />
          </View>
        </Animated.View>

        <View style={[isLandscape ? { flex: 0.5, paddingRight: 30 } : { flexShrink: 0, justifyContent: 'flex-end' }]}>
          <Animated.View
            style={[
              styles.newOnboardingTextContainer,
              isSmallDevice && { marginBottom: verticalScale(14), paddingHorizontal: scale(18) },
              isLandscape && { marginBottom: 20, paddingHorizontal: 0, alignItems: 'flex-start' },
              { opacity: fadeAnim }
            ]}
          >
            <Text
              style={[
                styles.newOnboardingTitle,
                isSmallDevice && {
                  fontSize: responsiveFontSize(22),
                  lineHeight: moderateScale(26),
                  marginBottom: verticalScale(6)
                },
                isLandscape && { textAlign: 'left' },
                isDark && { color: theme.colors.textPrimary },
              ]}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              numberOfLines={2}
            >
              {currentStepData.title}
            </Text>
            <Text
              style={[
                styles.newOnboardingSubtitle,
                isSmallDevice && {
                  fontSize: responsiveFontSize(13),
                  lineHeight: moderateScale(18),
                  paddingHorizontal: scale(4)
                },
                isLandscape && { textAlign: 'left', paddingHorizontal: 0 },
                isDark && { color: theme.colors.textMuted },
              ]}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              numberOfLines={3}
            >
              {currentStepData.subtitle}
            </Text>
          </Animated.View>

          <View
            style={[
              styles.newOnboardingBottom,
              isSmallDevice && { paddingHorizontal: scale(20), paddingBottom: Platform.OS === 'ios' ? verticalScale(12) : verticalScale(16) },
              isLandscape && { paddingHorizontal: 0, paddingBottom: 0 }
            ]}
          >
            <Animated.View style={[{ transform: [{ scale: buttonScale }] }]}>
              <Pressable
                onPress={nextStep}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                style={[
                  styles.primaryButton,
                  isSmallDevice && { minHeight: 48, borderRadius: moderateScale(24) }
                ]}
              >
                <LinearGradient
                  colors={isDark ? ['#126027', '#17A07E', '#4ADE80'] : ['#0B5F58', '#169070', '#69CDA8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.primaryButtonGradient,
                    isSmallDevice && { minHeight: 48, borderRadius: moderateScale(24), paddingHorizontal: scale(16) }
                  ]}
                >
                  <View style={styles.primaryButtonGlow} />
                  <Animated.Text
                    style={[
                      styles.primaryButtonText,
                      isSmallDevice && { fontSize: responsiveFontSize(16) },
                      { opacity: fadeAnim }
                    ]}
                  >
                    {currentStepData.buttonText}
                  </Animated.Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <View
              style={[
                styles.newOnboardingPagination,
                isSmallDevice && { marginTop: verticalScale(12), gap: 6 },
                isLandscape && { alignSelf: 'flex-start' }
              ]}
            >
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.newOnboardingDot,
                    isSmallDevice && { width: scale(6), height: verticalScale(6) },
                    isDark && { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
                    i === step && (
                      isDark
                        ? { width: scale(22), backgroundColor: theme.colors.primary }
                        : isSmallDevice
                          ? { width: scale(18), backgroundColor: '#519E59' }
                          : styles.newOnboardingDotActive
                    )
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

function getDisplayStreak(model: EcoBudMobileModel): number {
  const backendStreak = model.dashboard?.streak ?? model.tracker?.currentStreak ?? model.session?.user.currentStreak ?? 0;
  return backendStreak;
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

  const hour = new Date().getHours();
  const greetingInfo = hour >= 5 && hour < 12 
    ? { text: 'Good morning', icon: 'sunny' as const, color: '#F59E0B' }
    : hour >= 12 && hour < 18 
    ? { text: 'Good afternoon', icon: 'partly-sunny' as const, color: '#F97316' }
    : { text: 'Good evening', icon: 'moon' as const, color: '#6366F1' };

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: verticalScale(4) }}>
          <View style={{ flex: 1, paddingRight: scale(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: verticalScale(2) }}>
              <Ionicons name={greetingInfo.icon} size={scale(18)} color={greetingInfo.color} />
              <Text style={{ fontSize: responsiveFontSize(13), fontWeight: '700', color: '#6B7A75', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {greetingInfo.text}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: scale(8) }}>
              <Text style={[styles.welcomeTitle, { marginTop: 0 }]}>
                {model.userDisplayName.split(' ')[0]}
              </Text>
              <MaterialCommunityIcons name="hand-wave" size={scale(26)} color="#F59E0B" style={{ transform: [{ rotate: '-10deg' }] }} />
            </View>
          </View>
          <View
            style={{
              width: scale(44),
              height: scale(44),
              borderRadius: scale(22),
              backgroundColor: '#E8F5E9',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#C8E6C9',
            }}
          >
            <Ionicons name="leaf" size={scale(22)} color="#126027" />
          </View>
        </View>
        <Text style={[styles.welcomeSubtitle, { marginTop: 0, marginBottom: verticalScale(14) }]}>Let's keep your green streak going and make a positive impact today!</Text>

        <SummaryCards
          currentStreak={getDisplayStreak(model)}
          ecoPoints={model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0}
          onPressRewards={() => model.setActiveOverlay('streakRewards')}
          onOpenStreakOverlay={() => model.setActiveOverlay('streakUnlocked')}
        />

        <QuickActions model={model} />

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
                      <View style={[localStyles.glassTag, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Ionicons
                          name="shield-checkmark"
                          size={10}
                          color={challenge.difficulty.toLowerCase() === 'easy' ? '#4ADE80' : challenge.difficulty.toLowerCase() === 'medium' ? '#FBBF24' : '#F87171'}
                        />
                        <Text style={localStyles.glassTagText}>
                          {challenge.difficulty.toUpperCase()}
                        </Text>
                      </View>
                      <View style={[localStyles.glassTag, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Ionicons name="leaf" size={12} color="#4ADE80" />
                        <Text style={localStyles.glassTagText}>{challenge.expReward} Eco Points</Text>
                      </View>
                      {challenge.ecoCoinReward > 0 && (
                        <View style={[localStyles.glassTag, { backgroundColor: 'rgba(74,222,128,0.3)', borderColor: 'rgba(74,222,128,0.5)', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                          <Image source={require('../../../assets/coin.png')} style={{ width: 14, height: 14, resizeMode: 'contain' }} />
                          <Text style={[localStyles.glassTagText, { color: '#ECFDF5' }]}>{challenge.ecoCoinReward} Coins</Text>
                        </View>
                      )}
                    </View>
                    
                    {model.viewedMissionIds.includes(challenge.id) ? (
                      <View style={[localStyles.glassTag, { backgroundColor: 'rgba(59, 130, 246, 0.3)', borderColor: 'rgba(59, 130, 246, 0.5)', marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Ionicons name="eye" size={11} color="#EFF6FF" />
                        <Text style={[localStyles.glassTagText, { color: '#EFF6FF' }]}>VIEWED</Text>
                      </View>
                    ) : (
                      <View style={[localStyles.glassTag, { backgroundColor: 'rgba(239, 68, 68, 0.3)', borderColor: 'rgba(239, 68, 68, 0.5)', marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Ionicons name="sparkles" size={11} color="#FEF2F2" />
                        <Text style={[localStyles.glassTagText, { color: '#FEF2F2' }]}>NEW</Text>
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
          <CoachMarkTarget
            name="featuredLesson"
            borderRadius={moderateScale(24)}
            active={model.coachMarksVisible && model.coachMarksCurrentStep === 4}
            onMeasure={(rect) => {
              model.setSpotlightTargetRect?.(rect);
            }}
            style={{ marginBottom: verticalScale(24) }}
          >
            <ImageBackground source={{ uri: featuredLesson.imageUrl ? `${ecobudApiOrigin}${featuredLesson.imageUrl}` : 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=800&auto=format&fit=crop' }} style={[styles.featuredProgramCard, { marginBottom: 0 }]} imageStyle={{ borderRadius: moderateScale(24) }}>
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
          </CoachMarkTarget>
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

  const isAI = challenge.type === 'AI Image Recognition Challenge';
  const currentStatus = challenge.progress?.status?.toLowerCase();
  const isCompleted = currentStatus === 'completed';
  const isPending = currentStatus === 'pending';
  const isApproved = currentStatus === 'approved' || currentStatus === 'unclaimed';
  const isApprovedCollection = currentStatus === 'approved_collection';
  const shouldPulse = isAI && !isCompleted && !isPending && !isApproved;

  const handlePress = (e: any) => {
    if (isPending || isCompleted) {
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
        void model.handleClaimChallengeReward(challenge.id, { x: e?.nativeEvent?.pageX || 0, y: e?.nativeEvent?.pageY || 0 }, challenge.progress?.submissionId);
      } else {
        model.openChallengeMission(challenge);
      }
    });
  };

  return (
    <Animated.View style={shouldPulse ? { transform: [{ scale: Animated.multiply(pulseAnim, scaleAnim) }] } : { transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={handlePress}
        disabled={isPressing || isPending || isCompleted}
        style={
          isApproved 
            ? [styles.featuredProgramBtn, { backgroundColor: '#F59E0B', borderColor: '#D97706' }] 
            : isApprovedCollection 
              ? [styles.featuredProgramBtn, { backgroundColor: '#1D4ED8', borderColor: '#1E40AF' }]
              : (isAI ? localStyles.pulseBtn : styles.featuredProgramBtn)
        }
      >
        <Text style={isApproved ? [styles.featuredProgramBtnText, { color: '#FFFFFF' }] : (isAI ? localStyles.pulseBtnText : styles.featuredProgramBtnText)}>
          {isCompleted 
            ? 'CHALLENGE FINISHED' 
            : isApprovedCollection
              ? (challenge.progress?.submission?.afterProofUrl ? 'PENDING AFTER REVIEW' : 'TAKE AFTER PHOTO')
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

export function GroupedChallengeSkeleton() {
  const { theme, isDark } = useTheme();
  const boneBg = isDark ? theme.colors.surfaceMuted : '#E4E9E6';
  const pulseAnim = useRef(new Animated.Value(isDark ? 0.5 : 0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.95 : 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: isDark ? 0.5 : 0.55,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim, isDark]);

  return (
    <Animated.View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: theme.colors.cardBorder,
        overflow: 'hidden',
        padding: 16,
        opacity: pulseAnim,
        shadowColor: '#126027',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.2 : 0.06,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        {/* Thumbnail bone */}
        <View style={{ width: 68, height: 68, borderRadius: 14, backgroundColor: boneBg }} />

        {/* Content bones */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ height: 16, width: 60, borderRadius: 6, backgroundColor: boneBg }} />
              <View style={{ height: 16, width: 70, borderRadius: 6, backgroundColor: boneBg }} />
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: boneBg }} />
          </View>

          {/* Title bone */}
          <View style={{ height: 18, width: '78%', borderRadius: 9, backgroundColor: boneBg, marginBottom: 10 }} />

          {/* Badges row bones */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <View style={{ height: 22, width: 95, borderRadius: 8, backgroundColor: boneBg }} />
            <View style={{ height: 22, width: 80, borderRadius: 8, backgroundColor: boneBg }} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function ChallengesView({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  // Brief tab switch skeleton loading transition
  const [tabLoading, setTabLoading] = useState(true);

  useEffect(() => {
    setTabLoading(true);
    const timer = setTimeout(() => {
      setTabLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [model.activeTab, model.challengesViewMode]);

  const isCardsLoading = tabLoading || model.initializing || model.booting || (model.refreshing && (!model.challenges || model.challenges.length === 0));

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const viewMode = model.challengesViewMode;
  const setViewMode = model.setChallengesViewMode;

  const [rejectionModal, setRejectionModal] = useState<{ visible: boolean; reason: string; challengeId: string | null; challengeObj: ChallengeWithProgress | null }>({
    visible: false,
    reason: '',
    challengeId: null,
    challengeObj: null,
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

  const filteredActiveRaw = model.challenges.filter(filterChallenge);
  
  // Discover: all challenges sorted with Featured first, without carrying previous in-progress submissions
  const discoverChallenges = [...filteredActiveRaw]
    .sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0))
    .map(c => ({
      ...c,
      uniqueId: c.id,
      progress: {
        progressPercentage: 0,
        status: 'not_started',
        submission: undefined,
        submissions: [],
      }
    }));

  const [expandedTaskGroups, setExpandedTaskGroups] = useState<{ [challengeId: string]: boolean }>({});

  const toggleTaskGroup = (challengeId: string) => {
    setExpandedTaskGroups(prev => ({
      ...prev,
      [challengeId]: prev[challengeId] === undefined ? false : !prev[challengeId] // default is open (true) when undefined
    }));
  };

  // Group in-progress challenges by Challenge template
  interface InProgressGroup {
    challenge: ChallengeWithProgress;
    submissions: Array<{
      sub: any;
      uniqueId: string;
      status: string;
      rejectionReason?: string;
      detectedQuantity?: number;
      reservedQuantity?: number;
      afterProofUrl?: string;
      qrVerified?: boolean;
      adminPreliminaryApproved?: boolean;
    }>;
    totalQuantity: number;
    approvedCollectionCount: number;
    pendingCount: number;
    rejectedCount: number;
  }

  interface CompletedGroup {
    challenge: ChallengeWithProgress;
    submissions: Array<{
      sub: any;
      uniqueId: string;
      status: string;
      rejectionReason?: string;
      detectedQuantity?: number;
      reservedQuantity?: number;
      isClaimed: boolean;
      isApproved: boolean;
      earnedExp: number;
      earnedCoins: number;
      fullChallengeItem: ChallengeWithProgress;
    }>;
    totalQuantity: number;
    totalEarnedExp: number;
    totalEarnedCoins: number;
    unclaimedCount: number;
    claimedCount: number;
  }

  const inProgressGroups: InProgressGroup[] = [];
  const completedGroups: CompletedGroup[] = [];

  for (const c of filteredActiveRaw) {
    const rawSubs = c.progress?.submissions && c.progress.submissions.length > 0 
      ? c.progress.submissions 
      : (c.progress?.submission ? [c.progress.submission] : []);

    const activeSubsForChallenge: InProgressGroup['submissions'] = [];
    const completedSubsForChallenge: CompletedGroup['submissions'] = [];

    for (const sub of rawSubs) {
      const status = sub.status?.toLowerCase();
      const isClaimed = Boolean(sub.rewardAwarded || status === 'completed');
      const isApproved = !isClaimed && (status === 'approved' || status === 'unclaimed');

      if (status === 'completed' || status === 'approved' || status === 'unclaimed') {
        const earnedExp = sub.expAwarded || c.expReward;
        const earnedCoins = sub.ecoCoinsAwarded !== undefined 
          ? sub.ecoCoinsAwarded 
          : c.ecoCoinReward;

        const fullChallengeItem: ChallengeWithProgress = {
          ...c,
          uniqueId: `${c.id}-${sub.id}`,
          progress: {
            progressPercentage: c.progress?.progressPercentage ?? 100,
            ...c.progress,
            status: isClaimed ? 'completed' : sub.status,
            rejectionReason: sub.rejectionReason,
            submissionId: sub.id,
            submission: sub,
          }
        };

        completedSubsForChallenge.push({
          sub,
          uniqueId: `${c.id}-${sub.id}`,
          status: isClaimed ? 'completed' : sub.status,
          rejectionReason: sub.rejectionReason,
          detectedQuantity: sub.detectedQuantity,
          reservedQuantity: sub.reservedQuantity,
          isClaimed,
          isApproved,
          earnedExp,
          earnedCoins,
          fullChallengeItem,
        });
      } else if (status) {
        activeSubsForChallenge.push({
          sub,
          uniqueId: `${c.id}-${sub.id}`,
          status: sub.status,
          rejectionReason: sub.rejectionReason,
          detectedQuantity: sub.detectedQuantity,
          reservedQuantity: sub.reservedQuantity,
          afterProofUrl: sub.afterProofUrl,
          qrVerified: sub.qrVerified,
          adminPreliminaryApproved: sub.adminPreliminaryApproved,
        });
      }
    }

    if (activeSubsForChallenge.length > 0) {
      const totalQuantity = activeSubsForChallenge.reduce((sum, s) => sum + (s.detectedQuantity || s.reservedQuantity || 1), 0);
      const approvedCollectionCount = activeSubsForChallenge.filter(s => s.status?.toLowerCase() === 'approved_collection').length;
      const pendingCount = activeSubsForChallenge.filter(s => s.status?.toLowerCase() === 'pending').length;
      const rejectedCount = activeSubsForChallenge.filter(s => s.status?.toLowerCase() === 'rejected').length;

      inProgressGroups.push({
        challenge: c,
        submissions: activeSubsForChallenge,
        totalQuantity,
        approvedCollectionCount,
        pendingCount,
        rejectedCount,
      });
    }

    if (completedSubsForChallenge.length > 0) {
      const totalQuantity = completedSubsForChallenge.reduce((sum, s) => sum + (s.detectedQuantity || s.reservedQuantity || 1), 0);
      const totalEarnedExp = completedSubsForChallenge.reduce((sum, s) => sum + s.earnedExp, 0);
      const totalEarnedCoins = completedSubsForChallenge.reduce((sum, s) => sum + s.earnedCoins, 0);
      const unclaimedCount = completedSubsForChallenge.filter(s => s.isApproved).length;
      const claimedCount = completedSubsForChallenge.filter(s => s.isClaimed).length;

      completedGroups.push({
        challenge: c,
        submissions: completedSubsForChallenge,
        totalQuantity,
        totalEarnedExp,
        totalEarnedCoins,
        unclaimedCount,
        claimedCount,
      });
    }
  }

  const currentActiveList = viewMode === 'Discover' ? discoverChallenges : [];

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <View style={{ marginBottom: verticalScale(4) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: verticalScale(4) }}>
            <View style={{ flex: 1, paddingRight: scale(8) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: verticalScale(2) }}>
                <Ionicons name="sparkles" size={scale(16)} color="#10B981" />
                <Text style={{ fontSize: responsiveFontSize(13), fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  YOUR ECO JOURNEY
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[
                    styles.welcomeTitle,
                    {
                      marginTop: 0,
                      color: theme.colors.textPrimary,
                      fontSize: responsiveFontSize(26),
                      letterSpacing: -0.3,
                    },
                  ]}
                >
                  Tasks & Challenges
                </Text>
                <MaterialCommunityIcons
                  name="target"
                  size={scale(24)}
                  color={isDark ? theme.colors.primary : '#10B981'}
                />
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
              <Ionicons name="trophy" size={scale(22)} color={isDark ? theme.colors.primary : '#126027'} />
            </View>
          </View>
          <Text style={[styles.welcomeSubtitle, { marginTop: 0, marginBottom: verticalScale(4), color: theme.colors.textMuted, fontSize: responsiveFontSize(13), lineHeight: responsiveFontSize(19) }]}>
            Small actions add up. Pick a mission that fits your day and start making a difference.
          </Text>
        </View>

        {/* Discoverable Eco AI Guide Bar */}
        <AiAssistantBar
          onPress={() => model.setActiveOverlay('assistant')}
          placeholder="Ask EcoBud AI about challenges..."
          badgeText="GUIDE"
          style={{ marginTop: verticalScale(6), marginBottom: verticalScale(6) }}
        />

        {/* View Mode Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: theme.colors.surfaceMuted, borderRadius: 14, padding: 4, marginTop: verticalScale(10), marginBottom: verticalScale(10) }}>
          {[
            { key: 'Discover', label: 'Discover', icon: 'compass-outline' as const },
            { key: 'My Tasks', label: 'My Tasks', icon: 'list-circle-outline' as const },
            { key: 'History', label: 'History', icon: 'time-outline' as const }
          ].map(tab => (
            <TouchableOpacity 
              key={tab.key} 
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
                borderRadius: 10,
                backgroundColor: viewMode === tab.key ? theme.colors.card : 'transparent',
                shadowColor: viewMode === tab.key ? '#000' : 'transparent',
                shadowOpacity: viewMode === tab.key ? (isDark ? 0.2 : 0.06) : 0,
                shadowRadius: 4,
                elevation: viewMode === tab.key ? 2 : 0
              }}
              onPress={() => setViewMode(tab.key as any)}
            >
              <Ionicons 
                name={tab.icon} 
                size={16} 
                color={viewMode === tab.key ? (isDark ? theme.colors.primary : '#126027') : theme.colors.textMuted} 
              />
              <Text style={{ fontWeight: '700', color: viewMode === tab.key ? (isDark ? theme.colors.primary : '#126027') : theme.colors.textMuted, fontSize: 13 }}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Discovery & Filtering Section */}
        <View style={[localStyles.challengeSearch, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder }]}>
          <Ionicons name="search-outline" size={20} color={theme.colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={{ flex: 1, fontSize: 16, color: theme.colors.textPrimary }}
            placeholder="Search challenges..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear challenge search" onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15, maxHeight: 40, minHeight: 40 }} contentContainerStyle={{ paddingRight: 20 }}>
          {categories.map((cat, index) => (
            <TouchableOpacity 
              key={index} 
              style={{
                backgroundColor: selectedCategory === cat ? (isDark ? theme.colors.primary : '#126027') : theme.colors.card,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 10,
                borderWidth: 1,
                borderColor: selectedCategory === cat ? (isDark ? theme.colors.primary : '#126027') : theme.colors.border,
                alignSelf: 'center',
              }}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={{
                color: selectedCategory === cat ? (isDark ? '#0E1512' : '#FFFFFF') : theme.colors.textMuted,
                fontWeight: '600',
              }}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {viewMode === 'Discover' && !isFiltering && (
          <LinearGradient colors={['#126027', '#1D7A3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={localStyles.discoverOverview}>
            <View style={localStyles.discoverOverviewIcon}>
              <Ionicons name="sparkles" size={22} color="#D9F99D" />
            </View>
            <View style={localStyles.discoverOverviewCopy}>
              <Text style={localStyles.discoverOverviewTitle}>Ready when you are</Text>
              <Text style={localStyles.discoverOverviewText}>{discoverChallenges.length} new mission{discoverChallenges.length === 1 ? '' : 's'} waiting for you</Text>
            </View>
            <View style={localStyles.discoverOverviewCount}>
              <Text style={localStyles.discoverOverviewNumber}>{discoverChallenges.length}</Text>
              <Text style={localStyles.discoverOverviewLabel}>TO TRY</Text>
            </View>
          </LinearGradient>
        )}

        {/* Headings */}
        {((viewMode === 'Discover' && currentActiveList.length > 0) || (viewMode === 'My Tasks' && inProgressGroups.length > 0) || (viewMode === 'History' && completedGroups.length > 0)) && (
          <View style={localStyles.challengeListHeading}>
            <View>
              <Text style={[localStyles.challengeListTitle, { color: theme.colors.textPrimary }]}>
                {isFiltering 
                  ? 'Search results' 
                  : viewMode === 'Discover' 
                  ? 'New missions for you' 
                  : viewMode === 'My Tasks' 
                  ? 'In progress (Grouped by Mission)' 
                  : 'Completed challenges (Grouped by Mission)'}
              </Text>
              {viewMode === 'Discover' && !isFiltering && <Text style={[localStyles.challengeListSubtitle, { color: theme.colors.textMuted }]}>Tap a mission to see how you can help.</Text>}
              {viewMode === 'My Tasks' && !isFiltering && <Text style={[localStyles.challengeListSubtitle, { color: theme.colors.textMuted }]}>Tap any mission card to expand or collapse active submissions.</Text>}
              {viewMode === 'History' && !isFiltering && <Text style={[localStyles.challengeListSubtitle, { color: theme.colors.textMuted }]}>Tap any completed mission card to view past completed submissions.</Text>}
            </View>
            <Text style={[localStyles.challengeListCount, isDark && { backgroundColor: theme.colors.surfaceMuted, color: theme.colors.primary }]}>
              {viewMode === 'Discover' ? currentActiveList.length : viewMode === 'My Tasks' ? inProgressGroups.length : completedGroups.length}
            </Text>
          </View>
        )}

        {/* Empty States */}
        {!isCardsLoading && ((viewMode === 'Discover' && currentActiveList.length === 0) || (viewMode === 'My Tasks' && inProgressGroups.length === 0) || (viewMode === 'History' && completedGroups.length === 0)) && (
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 36,
            paddingHorizontal: 24,
            marginTop: 16,
            backgroundColor: theme.colors.card,
            borderRadius: moderateScale(24),
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            shadowColor: '#126027',
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}>
            <View style={{ width: scale(64), height: scale(64), borderRadius: scale(32), backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ionicons
                name={isFiltering ? 'search' : viewMode === 'My Tasks' ? 'clipboard-outline' : viewMode === 'History' ? 'trophy-outline' : 'leaf-outline'}
                size={scale(30)}
                color={isDark ? theme.colors.primary : '#126027'}
              />
            </View>
            <Text style={{ fontSize: responsiveFontSize(17), fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 6, textAlign: 'center' }}>
              {isFiltering ? 'No matching missions found' : viewMode === 'My Tasks' ? 'No active tasks yet' : viewMode === 'History' ? 'No completed tasks yet' : 'No missions available'}
            </Text>
            <Text style={{ fontSize: responsiveFontSize(13), color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
              {isFiltering ? 'Try searching for a different keyword or category.' : viewMode === 'My Tasks' ? 'Select a mission from the Discover tab to start contributing!' : viewMode === 'History' ? 'Complete eco-challenges to earn points, build streaks, and unlock achievements.' : 'Check back later for newly announced community missions.'}
            </Text>
          </View>
        )}

        {/* === VIEW MODE 1: DISCOVER TAB (ALL AVAILABLE CHALLENGES) === */}
        {viewMode === 'Discover' && (
          isCardsLoading ? (
            <View style={isTablet ? { flexDirection: 'row', flexWrap: 'wrap', gap: scale(14) } : {}}>
              {Array.from({ length: Math.max(3, currentActiveList.length || 0) }).map((_, idx) => (
                <View key={`skel-${idx}`} style={isTablet ? { width: '48.5%' } : { width: '100%' }}>
                  <DiscoverChallengeSkeleton />
                </View>
              ))}
            </View>
          ) : (
            <View style={isTablet ? { flexDirection: 'row', flexWrap: 'wrap', gap: scale(14) } : {}}>
              {currentActiveList.map((challenge, index) => {
              if (index === 0) {
                return (
                  <View key={challenge.uniqueId || challenge.id} style={isTablet ? { width: '48.5%' } : { width: '100%' }}>
                    <CoachMarkTarget
                      name="featuredChallenge"
                      borderRadius={moderateScale(22)}
                      active={model.coachMarksVisible && model.coachMarksCurrentStep === 3}
                      onMeasure={(rect) => {
                        model.setSpotlightTargetRect?.(rect);
                      }}
                      style={{ marginBottom: verticalScale(16) }}
                    >
                      <DiscoverChallengeCard
                        challenge={challenge}
                        isTablet={false}
                        style={{ marginBottom: 0, width: '100%' }}
                        onPress={() => {
                          model.openChallengeMission(challenge);
                        }}
                      />
                    </CoachMarkTarget>
                  </View>
                );
              }

              return (
                <View key={challenge.uniqueId || challenge.id} style={isTablet ? { width: '48.5%' } : { width: '100%' }}>
                  <DiscoverChallengeCard
                    challenge={challenge}
                    isTablet={false}
                    style={{ width: '100%' }}
                    onPress={() => {
                      model.openChallengeMission(challenge);
                    }}
                  />
                </View>
              );
            })}
          </View>
          )
        )}

        {/* === VIEW MODE 2: MY TASKS TAB (GROUPED BY CHALLENGE TEMPLATE) === */}
        {viewMode === 'My Tasks' && (
          isCardsLoading ? (
            <View style={{ gap: 14 }}>
              {Array.from({ length: Math.max(2, inProgressGroups.length || 0) }).map((_, idx) => (
                <GroupedChallengeSkeleton key={`my-tasks-skel-${idx}`} />
              ))}
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {inProgressGroups.map((group) => {
                const { challenge, submissions, totalQuantity, approvedCollectionCount, pendingCount, rejectedCount } = group;
                const isImageMission = !challenge.type || challenge.type === 'AI Image Recognition Challenge' || challenge.type === 'GENERAL';
                const isExpanded = expandedTaskGroups[challenge.id] !== false; // default true

              return (
                <View 
                  key={challenge.id}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: theme.colors.cardBorder,
                    overflow: 'hidden',
                    shadowColor: '#126027',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isDark ? 0.2 : 0.06,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  {/* Group Header Card (Click to expand/collapse) */}
                  <Pressable 
                    onPress={() => toggleTaskGroup(challenge.id)}
                    style={({ pressed }) => [
                      { padding: 16, backgroundColor: pressed ? (isDark ? theme.colors.surfaceMuted : '#F9FAFB') : theme.colors.card }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                      {/* Image Thumbnail */}
                      <View style={{ width: 68, height: 68, borderRadius: 14, overflow: 'hidden', backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9' }}>
                        {challenge.imageUrl ? (
                          <Image source={{ uri: getValidImageUrl(challenge.imageUrl) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                        ) : (
                          <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={isImageMission ? "camera-outline" : "leaf-outline"} size={30} color={isDark ? theme.colors.primary : "#126027"} />
                          </View>
                        )}
                      </View>

                      {/* Main Group Content */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Text style={[styles.taskMetaLabel, { color: isDark ? theme.colors.primary : '#126027' }]}>{challenge.difficulty.toUpperCase()}</Text>
                            <Text style={[styles.taskMetaLabel, { color: isDark ? theme.colors.primary : '#047857', backgroundColor: isDark ? theme.colors.surfaceMuted : '#D1FAE5' }]}>{((challenge as any).category || 'GENERAL').toUpperCase()}</Text>
                          </View>
                          <Ionicons name={isExpanded ? "chevron-up-circle" : "chevron-down-circle"} size={22} color={isDark ? theme.colors.primary : "#126027"} />
                        </View>

                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 6 }} numberOfLines={1}>
                          {challenge.title}
                        </Text>

                        {/* Summary Badges */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#F0FDF4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: isDark ? theme.colors.cardBorder : '#BBF7D0', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="document-text-outline" size={12} color={isDark ? theme.colors.primary : "#166534"} />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? theme.colors.primary : '#166534' }}>
                              {submissions.length} {submissions.length === 1 ? 'Submission' : 'Submissions'}
                            </Text>
                          </View>

                          {totalQuantity > 0 && (
                            <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: isDark ? theme.colors.cardBorder : '#A7F3D0', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="cube-outline" size={12} color={isDark ? theme.colors.primary : "#047857"} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? theme.colors.primary : '#047857' }}>
                                {totalQuantity} {challenge.quantityUnit || 'items'} Total
                              </Text>
                            </View>
                          )}

                          {approvedCollectionCount > 0 && (
                            <View style={{ backgroundColor: isDark ? '#1E293B' : '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#334155' : '#BFDBFE', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="checkmark-done-circle-outline" size={12} color={isDark ? '#60A5FA' : "#1D4ED8"} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#60A5FA' : '#1D4ED8' }}>
                                {approvedCollectionCount} For Final Approval
                              </Text>
                            </View>
                          )}

                          {pendingCount > 0 && (
                            <View style={{ backgroundColor: isDark ? '#2D2415' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="time-outline" size={12} color={isDark ? '#FBBF24' : "#B45309"} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>
                                {pendingCount} Pending
                              </Text>
                            </View>
                          )}

                          {rejectedCount > 0 && (
                            <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="alert-circle-outline" size={12} color="#EF4444" />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>
                                {rejectedCount} Rejected
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  {/* Expandable Sub-items List (Accordion Content) */}
                  {isExpanded && (
                    <View style={{ backgroundColor: isDark ? theme.colors.surface : '#F8FAFC', borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, padding: 12, gap: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4, marginBottom: 2 }}>
                        Active Submissions ({submissions.length})
                      </Text>

                      {submissions.map((item, subIndex) => {
                        const currentStatus = item.status?.toLowerCase();
                        const isApprovedCollection = currentStatus === 'approved_collection';
                        const isPending = currentStatus === 'pending';
                        const isRejected = currentStatus === 'rejected';
                        const isFinalReview = currentStatus === 'final_review';
                        const quantity = item.detectedQuantity || item.reservedQuantity || 1;

                        const fullChallengeItem: ChallengeWithProgress = {
                          ...challenge,
                          uniqueId: item.uniqueId,
                          progress: {
                            progressPercentage: challenge.progress?.progressPercentage ?? 0,
                            ...challenge.progress,
                            status: item.status,
                            rejectionReason: item.rejectionReason,
                            submissionId: item.sub?.id,
                            submission: item.sub,
                          }
                        };

                        return (
                          <View 
                            key={item.uniqueId}
                            style={{
                              backgroundColor: theme.colors.card,
                              borderRadius: 14,
                              padding: 12,
                              borderWidth: 1,
                              borderColor: isApprovedCollection ? (isDark ? '#3B82F6' : '#93C5FD') : isRejected ? (isDark ? '#EF4444' : '#FCA5A5') : theme.colors.cardBorder,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: isDark ? 0.2 : 0.03,
                              shadowRadius: 3,
                              elevation: 1,
                            }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap' }}>
                                <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#E2E8F0', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: theme.colors.textMuted }}>#{subIndex + 1}</Text>
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary }}>
                                  Entry {subIndex + 1}
                                </Text>
                                <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="cube-outline" size={11} color={theme.colors.textMuted} />
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textMuted }}>
                                    {quantity} {challenge.quantityUnit || 'items'}
                                  </Text>
                                </View>
                              </View>

                              {/* Status Pill */}
                              {isApprovedCollection ? (
                                <View style={{ backgroundColor: isDark ? '#1E293B' : '#DBEAFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#60A5FA' : '#1D4ED8' }}>APPROVED FOR COLLECTION</Text>
                                </View>
                              ) : isPending ? (
                                <View style={{ backgroundColor: isDark ? '#2D2415' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>PENDING APPROVAL</Text>
                                </View>
                              ) : isFinalReview ? (
                                <View style={{ backgroundColor: isDark ? '#2A1B3D' : '#F3E8FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#C084FC' : '#7E22CE' }}>FINAL REVIEW</Text>
                                </View>
                              ) : isRejected ? (
                                <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>REJECTED</Text>
                                </View>
                              ) : null}
                            </View>

                            {/* Submission Proof Image */}
                            {item.sub?.proofUrl && (
                              <TouchableOpacity activeOpacity={0.8} onPress={() => setPreviewImage(item.sub.proofUrl)} style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.cardBorder, backgroundColor: isDark ? theme.colors.surfaceMuted : '#F8FAFC' }}>
                                <Image 
                                  source={{ uri: item.sub.proofUrl }}
                                  style={{ width: '100%', height: 140 }}
                                  resizeMode="cover"
                                />
                                <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>YOUR PROOF</Text>
                                </View>
                              </TouchableOpacity>
                            )}

                            {/* Rejection Message if any */}
                            {isRejected && item.rejectionReason && (
                              <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: isDark ? '#EF4444' : '#FECACA' }}>
                                <Text style={{ fontSize: 12, color: '#EF4444' }}>
                                  Reason: {item.rejectionReason}
                                </Text>
                              </View>
                            )}
                              {/* Action Button for this specific sub-item */}
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 }}>
                              {isApprovedCollection && !item.afterProofUrl ? (
                                <TouchableOpacity 
                                  style={{ backgroundColor: isDark ? '#2563EB' : '#1D4ED8', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                  onPress={() => model.openChallengeMission(fullChallengeItem)}
                                >
                                  <Ionicons name="camera" size={15} color="#FFFFFF" />
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                                    TAKE AFTER PHOTO
                                  </Text>
                                </TouchableOpacity>
                              ) : isRejected ? (
                                <TouchableOpacity 
                                  style={{ backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                  onPress={() => {
                                    setRejectionModal({
                                      visible: true,
                                      reason: item.rejectionReason || 'No reason provided.',
                                      challengeId: challenge.id,
                                      challengeObj: fullChallengeItem,
                                    });
                                  }}
                                >
                                  <Ionicons name="refresh-outline" size={15} color="#FFFFFF" />
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>VIEW & RESUBMIT</Text>
                                </TouchableOpacity>
                              ) : isPending ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
                                  <Ionicons name="time-outline" size={14} color={isDark ? '#FBBF24' : "#B45309"} />
                                  <Text style={{ fontSize: 12, color: isDark ? '#FBBF24' : '#B45309', fontWeight: '600' }}>Admin reviewing Before photo</Text>
                                </View>
                              ) : (isFinalReview || (isApprovedCollection && item.afterProofUrl)) ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
                                  <Ionicons name="hourglass-outline" size={14} color={isDark ? '#C084FC' : "#7E22CE"} />
                                  <Text style={{ fontSize: 12, color: isDark ? '#C084FC' : '#7E22CE', fontWeight: '600' }}>Admin reviewing After photo</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          )
        )}

        {/* === VIEW MODE 3: HISTORY TAB (GROUPED COMPLETED CHALLENGES) === */}
        {viewMode === 'History' && (
          isCardsLoading ? (
            <View style={{ gap: 14 }}>
              {Array.from({ length: Math.max(2, completedGroups.length || 0) }).map((_, idx) => (
                <GroupedChallengeSkeleton key={`history-skel-${idx}`} />
              ))}
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {completedGroups.map((group) => {
                const { challenge, submissions, totalQuantity, totalEarnedExp, totalEarnedCoins, unclaimedCount, claimedCount } = group;
                const isImageMission = !challenge.type || challenge.type === 'AI Image Recognition Challenge' || challenge.type === 'GENERAL';
                const isExpanded = expandedTaskGroups[`history-${challenge.id}`] !== false; // default true

                return (
                  <View 
                  key={challenge.id}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: theme.colors.cardBorder,
                    overflow: 'hidden',
                    shadowColor: '#126027',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isDark ? 0.2 : 0.06,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  {/* Group Header Card (Click to expand/collapse) */}
                  <Pressable 
                    onPress={() => toggleTaskGroup(`history-${challenge.id}`)}
                    style={({ pressed }) => [
                      { padding: 16, backgroundColor: pressed ? (isDark ? theme.colors.surfaceMuted : '#F9FAFB') : theme.colors.card }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                      {/* Image Thumbnail */}
                      <View style={{ width: 68, height: 68, borderRadius: 14, overflow: 'hidden', backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9' }}>
                        {challenge.imageUrl ? (
                          <Image source={{ uri: getValidImageUrl(challenge.imageUrl) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                        ) : (
                          <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="trophy" size={30} color={isDark ? theme.colors.primary : "#126027"} />
                          </View>
                        )}
                      </View>

                      {/* Main Group Content */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Text style={[styles.taskMetaLabel, { color: isDark ? theme.colors.primary : '#126027' }]}>{challenge.difficulty.toUpperCase()}</Text>
                            <Text style={[styles.taskMetaLabel, { color: isDark ? theme.colors.primary : '#047857', backgroundColor: isDark ? theme.colors.surfaceMuted : '#D1FAE5' }]}>{((challenge as any).category || 'GENERAL').toUpperCase()}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Ionicons name="leaf" size={12} color={theme.colors.primary} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: theme.colors.primary }}>+{totalEarnedExp} Pts</Text>
                            </View>
                            {totalEarnedCoins > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#2D2415' : '#FEF3C7', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5, gap: 3 }}>
                                <Image source={require('../../../assets/coin.png')} style={{ width: 10, height: 10, resizeMode: 'contain' }} />
                                <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>+{totalEarnedCoins}</Text>
                              </View>
                            )}
                          </View>
                          <Ionicons name={isExpanded ? "chevron-up-circle" : "chevron-down-circle"} size={22} color={isDark ? theme.colors.primary : "#126027"} />
                        </View>

                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 6 }} numberOfLines={1}>
                          {challenge.title}
                        </Text>

                        {/* Summary Badges */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#F0FDF4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: isDark ? theme.colors.cardBorder : '#BBF7D0', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="checkmark-circle-outline" size={12} color={isDark ? theme.colors.primary : "#166534"} />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? theme.colors.primary : '#166534' }}>
                              {submissions.length} Completed {submissions.length === 1 ? 'Submission' : 'Submissions'}
                            </Text>
                          </View>

                          {totalQuantity > 0 && (
                            <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: isDark ? theme.colors.cardBorder : '#A7F3D0', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="cube-outline" size={12} color={isDark ? theme.colors.primary : "#047857"} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? theme.colors.primary : '#047857' }}>
                                {totalQuantity} {challenge.quantityUnit || 'items'} Total
                              </Text>
                            </View>
                          )}

                          {unclaimedCount > 0 && (
                            <View style={{ backgroundColor: isDark ? '#2D2415' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#854D0E' : '#FDE68A', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="gift-outline" size={12} color={isDark ? '#FBBF24' : "#B45309"} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>
                                {unclaimedCount} Unclaimed Reward{unclaimedCount === 1 ? '' : 's'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  {/* Expandable Completed Sub-items List */}
                  {isExpanded && (
                    <View style={{ backgroundColor: isDark ? theme.colors.surface : '#F8FAFC', borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, padding: 12, gap: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4, marginBottom: 2 }}>
                        Completed Submissions ({submissions.length})
                      </Text>

                      {submissions.map((item, subIndex) => {
                        const quantity = item.detectedQuantity || item.reservedQuantity || 1;

                        return (
                          <View 
                            key={item.uniqueId}
                            style={{
                              backgroundColor: theme.colors.card,
                              borderRadius: 14,
                              padding: 12,
                              borderWidth: 1,
                              borderColor: item.isApproved ? (isDark ? '#854D0E' : '#FDE68A') : theme.colors.cardBorder,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: isDark ? 0.2 : 0.03,
                              shadowRadius: 3,
                              elevation: 1,
                            }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap' }}>
                                <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#E2E8F0', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: theme.colors.textMuted }}>#{subIndex + 1}</Text>
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary }}>
                                  Entry {subIndex + 1}
                                </Text>
                                <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="cube-outline" size={11} color={theme.colors.textMuted} />
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textMuted }}>
                                    {quantity} {challenge.quantityUnit || 'items'}
                                  </Text>
                                </View>
                              </View>

                              {/* Status Pill */}
                              {item.isApproved ? (
                                <View style={{ backgroundColor: isDark ? '#2D2415' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#854D0E' : '#FDE68A' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>APPROVED (READY TO CLAIM)</Text>
                                </View>
                              ) : (
                                <View style={{ backgroundColor: isDark ? theme.colors.surfaceMuted : '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: isDark ? theme.colors.cardBorder : '#A7F3D0' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? theme.colors.primary : '#059669' }}>COMPLETED & CLAIMED</Text>
                                </View>
                              )}
                            </View>

                            {/* Submission Proof Image */}
                            {item.sub?.proofUrl && (
                              <TouchableOpacity activeOpacity={0.8} onPress={() => setPreviewImage(item.sub.proofUrl)} style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.cardBorder, backgroundColor: isDark ? theme.colors.surfaceMuted : '#F8FAFC' }}>
                                <Image 
                                  source={{ uri: item.sub.proofUrl }}
                                  style={{ width: '100%', height: 140 }}
                                  resizeMode="cover"
                                />
                                <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>YOUR PROOF</Text>
                                </View>
                              </TouchableOpacity>
                            )}

                            {/* Rewards / Claim Button */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="leaf" size={13} color={theme.colors.primary} />
                                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>+{item.earnedExp} Eco Points</Text>
                                </View>
                                {item.earnedCoins > 0 && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#2D2415' : '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 }}>
                                    <Image source={require('../../../assets/coin.png')} style={{ width: 12, height: 12, resizeMode: 'contain' }} />
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>+{item.earnedCoins} COINS</Text>
                                  </View>
                                )}
                              </View>

                              {item.isApproved ? (
                                <TouchableOpacity 
                                  style={{ backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                  onPress={(e) => {
                                    void model.handleClaimChallengeReward(challenge.id, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }, item.sub?.id);
                                  }}
                                >
                                  <Ionicons name="gift" size={14} color="#FFFFFF" />
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>CLAIM REWARD</Text>
                                </TouchableOpacity>
                              ) : (
                                <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#059669' }}>CLAIMED</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          )
        )}

        {model.challenges.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
            <Ionicons name="trophy-outline" size={48} color="#126027" />
            <Text style={[styles.sectionHeadline, { marginTop: 16 }]}>Check back soon!</Text>
            <Text style={styles.pageSubtitle}>Admins are preparing new challenges for the community.</Text>
          </View>
        )}



        <View style={{ height: 100 }} />
      </View>

      <RejectionModal
        visible={rejectionModal.visible}
        title="Submission Rejected"
        reason={rejectionModal.reason}
        onClose={() => setRejectionModal(prev => ({ ...prev, visible: false }))}
        onResubmit={rejectionModal.challengeObj ? () => {
          model.openChallengeMission(rejectionModal.challengeObj!);
        } : undefined}
      />

      <Modal visible={!!previewImage} transparent={true} animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 }} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
          {previewImage && (
            <Image 
              source={{ uri: previewImage }} 
              style={{ width: '90%', height: '80%', resizeMode: 'contain' }} 
            />
          )}
        </View>
      </Modal>
    </>
  );
}

export function TrackerView({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
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

  // Brief tab switch skeleton loading transition for Tracker cards
  const [tabLoading, setTabLoading] = useState(true);

  useEffect(() => {
    setTabLoading(true);
    const timer = setTimeout(() => {
      setTabLoading(false);
    }, 550);
    return () => clearTimeout(timer);
  }, [model.activeTab]);

  const isCardsLoading = tabLoading || model.initializing || model.booting || (model.refreshing && !model.tracker);

  const trackerMonth = model.tracker?.month ?? liveMonth;
  const completedDays = model.tracker?.completedDays ?? [];
  const calendarCells = buildCalendarCells(trackerMonth, completedDays);

  // ── Derived gamification state ─────────────────────────────────────────────
  const totalPoints = model.tracker?.points ?? model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0;
  const ecoLevel = getEcoLevel(totalPoints);
  const streak = getVisibleStreak(getDisplayStreak(model));

  // Last 7 days progress dots (oldest → newest). A day counts if it's in the
  // completed set; today is always the rightmost dot.
  const lastSevenDays = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - offset));
    return date;
  });

  // ── Segmented switch: Activity Calendar / Leaderboard ──────────────────────
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
  const rankListItems = lbCurrentItems;

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

  const intensityStyle = (cell: (typeof calendarCells)[number]) => {
    if (!cell.dateKey || !cell.completed) {
      return [trackerStyles.cellEmpty, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#F0F5F2', borderColor: isDark ? theme.colors.border : '#E8F0EC' }];
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
      <TopNavbar model={model} showBack={false} title="Tracker" />

      <View style={styles.homeContent}>
        {isCardsLoading ? (
          <TrackerCardsSkeleton />
        ) : (
          <>
            {/* ── Current Streak Card wrapped in CoachMarkTarget ── */}
            <CoachMarkTarget
              name="ecoStreak"
              borderRadius={moderateScale(24)}
              active={model.coachMarksVisible && model.coachMarksCurrentStep === 2}
              onMeasure={(rect) => {
                model.setSpotlightTargetRect?.(rect);
              }}
              style={{ marginBottom: verticalScale(20) }}
            >
              <SummaryCards
                currentStreak={getDisplayStreak(model)}
                ecoPoints={model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0}
                onPressRewards={() => model.setActiveOverlay('streakRewards')}
                onOpenStreakOverlay={() => model.setActiveOverlay('streakUnlocked')}
                style={{ marginBottom: 0 }}
              />
            </CoachMarkTarget>


        {/* ── Level Progress Card ────────────────────────────────────────── */}
        <View style={{ marginTop: 24 }}>
          <LevelCard ecoPoints={totalPoints} />
        </View>

        {/* ── Segmented Switch ─────────────────────────────────────────────── */}
        <View style={trackerStyles.segmentWrap}>
          <View
            style={[trackerStyles.segmentTrack, { backgroundColor: theme.colors.surfaceMuted }]}
            onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                trackerStyles.segmentThumb,
                {
                  backgroundColor: theme.colors.card,
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={key === 'calendar' ? 'calendar-outline' : 'trophy-outline'}
                    size={14}
                    color={segment === key ? (isDark ? theme.colors.primary : '#126027') : theme.colors.textMuted}
                  />
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      trackerStyles.segmentText,
                      { color: theme.colors.textMuted },
                      segment === key && [trackerStyles.segmentTextActive, { color: isDark ? theme.colors.primary : '#126027' }],
                    ]}
                  >
                    {key === 'calendar' ? 'Activity Calendar' : 'Leaderboard'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Activity Calendar View ───────────────────────────────────────── */}
        {segment === 'calendar' && (
          <View style={[trackerStyles.surfaceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder, borderWidth: 1, shadowOpacity: isDark ? 0.2 : 0.06 }]}>
            <View style={[styles.rowBetween, { gap: 8 }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[trackerStyles.surfaceTitle, { color: theme.colors.textPrimary, flexShrink: 1 }]}>Activity Calendar</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[trackerStyles.surfaceSubtitle, { color: theme.colors.textMuted, flexShrink: 1 }]}>{formatMonthLabel(trackerMonth)}</Text>
            </View>

            <View style={trackerStyles.calNavRow}>
              <TouchableOpacity
                onPress={() => void model.loadTrackerMonth(-1)}
                style={[trackerStyles.calNavBtn, { backgroundColor: theme.colors.surfaceMuted }]}
              >
                <Feather name="chevron-left" size={20} color={theme.colors.icon} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                {(() => {
                  const currentStreak = getDisplayStreak(model);
                  const isStreakActive = currentStreak >= 3;
                  
                  return isStreakActive ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? theme.colors.primary : '#169070', letterSpacing: 0.5 }}>
                        BUILDING STREAK: {currentStreak}
                      </Text>
                      <Ionicons name="flame" size={14} color="#F97316" />
                    </View>
                  ) : (
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 }}>
                      Count {currentStreak}/3 to show the streak
                    </Text>
                  );
                })()}
                <View style={trackerStyles.calLegendRow}>
                  <View style={[trackerStyles.legendChip, trackerStyles.cellEmpty, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#F0F5F2' }]} />
                  <Text style={[trackerStyles.legendText, { color: theme.colors.textMuted }]}>None</Text>
                  <View style={[trackerStyles.legendChip, trackerStyles.cellActive]} />
                  <Text style={[trackerStyles.legendText, { color: theme.colors.textMuted }]}>Active</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => void model.loadTrackerMonth(1)}
                style={[trackerStyles.calNavBtn, { backgroundColor: theme.colors.surfaceMuted }]}
              >
                <Feather name="chevron-right" size={20} color={theme.colors.icon} />
              </TouchableOpacity>
            </View>

            <View style={trackerStyles.calWeekRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <Text key={i} style={[trackerStyles.calWeekLabel, { color: theme.colors.textMuted }]}>
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
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  {cell.dateKey ? (
                    <View
                      style={[
                        trackerStyles.heatmapCell,
                        intensityStyle(cell),
                        cell.isToday && [trackerStyles.heatmapToday, { borderColor: theme.colors.primary }],
                      ]}
                    >
                      <Text
                        style={[
                          trackerStyles.heatmapText,
                          { color: theme.colors.textMuted },
                          cell.completed && trackerStyles.heatmapTextDone,
                          cell.isToday && [trackerStyles.heatmapTextToday, { color: isDark ? theme.colors.primary : '#126027' }],
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
          <View style={[trackerStyles.surfaceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder, borderWidth: 1, shadowOpacity: isDark ? 0.2 : 0.06 }]}>
            <View style={[styles.rowBetween, { gap: 8 }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[trackerStyles.surfaceTitle, { color: theme.colors.textPrimary, flexShrink: 1 }]}>Community Leaderboard</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[trackerStyles.surfaceSubtitle, { color: theme.colors.textMuted, flexShrink: 1 }]}>By Eco Points</Text>
            </View>

            {(model.initializing || model.booting || model.refreshing) && leaderboardItems.length === 0 ? (
              <LeaderboardSkeleton />
            ) : leaderboardItems.length === 0 ? (
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
                      const isUser = entry.isCurrentUser;
                      const userAvatar = isUser
                        ? (entry.avatarUrl || model.profile?.profile?.avatarUrl || model.session?.user.avatarUrl)
                        : entry.avatarUrl;
                      const podiumHeight = entry.rank === 1 ? 78 : entry.rank === 2 ? 62 : 52;
                      return (
                        <View key={entry.id} style={trackerStyles.podiumColumn}>
                          <View style={{ marginBottom: 4 }}>
                            <Ionicons
                              name={entry.rank === 1 ? 'trophy' : entry.rank === 2 ? 'medal' : 'ribbon'}
                              size={22}
                              color={entry.rank === 1 ? '#EAB308' : entry.rank === 2 ? '#94A3B8' : '#D97706'}
                            />
                          </View>
                          <AvatarBubble
                            label={isUser ? model.userDisplayName : entry.displayName}
                            size={48}
                            style={[
                              trackerStyles.podiumAvatar,
                              { backgroundColor: isDark ? theme.colors.surfaceMuted : '#CBEFD6', borderColor: isDark ? theme.colors.border : '#CBEFD6' },
                              isUser && [trackerStyles.podiumAvatarUser, { borderColor: theme.colors.primary }]
                            ]}
                            textStyle={[trackerStyles.podiumAvatarText, { color: isDark ? theme.colors.primary : '#126027' }]}
                            avatarUrl={userAvatar}
                          />
                          <Text style={[trackerStyles.podiumName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                            {isUser ? 'You' : entry.displayName}
                          </Text>
                          <Text style={[trackerStyles.podiumPoints, { color: theme.colors.textMuted }]}>{entry.points} Eco Points</Text>
                          <View
                            style={[
                              trackerStyles.podiumBlock,
                              { height: podiumHeight, backgroundColor: isDark ? theme.colors.surfaceMuted : '#F0F5F2' },
                              entry.rank === 1 && [trackerStyles.podiumBlockGold, isDark && { backgroundColor: '#92400E' }],
                              entry.rank === 2 && [trackerStyles.podiumBlockSilver, isDark && { backgroundColor: '#475569' }],
                              entry.rank === 3 && [trackerStyles.podiumBlockBronze, isDark && { backgroundColor: '#B45309' }],
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Remaining ranks */}
                <View style={trackerStyles.rankList}>
                  {rankListItems.map((entry) => {
                    const isUser = entry.isCurrentUser;
                    const userAvatar = isUser
                      ? (entry.avatarUrl || model.profile?.profile?.avatarUrl || model.session?.user.avatarUrl)
                      : entry.avatarUrl;
                    return (
                      <View
                        key={entry.id}
                        style={[
                          trackerStyles.rankRow,
                          { backgroundColor: isDark ? theme.colors.surfaceMuted : '#F8FAF9', borderBottomColor: theme.colors.border },
                          entry.isCurrentUser && [trackerStyles.rankRowUser, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#F0FDF4' }],
                        ]}
                      >
                        <Text style={[trackerStyles.rankNumber, { color: theme.colors.textMuted }]}>#{entry.rank}</Text>
                        <AvatarBubble
                          label={entry.isCurrentUser ? model.userDisplayName : entry.displayName}
                          size={32}
                          style={[
                            trackerStyles.rankAvatar,
                            { backgroundColor: isDark ? theme.colors.surfaceMuted : '#CBEFD6', borderColor: isDark ? theme.colors.border : '#E6F4EC' },
                            isUser && [trackerStyles.rankAvatarUser, { borderColor: theme.colors.primary }]
                          ]}
                          textStyle={[trackerStyles.rankAvatarText, { color: isDark ? theme.colors.primary : '#126027' }]}
                          avatarUrl={userAvatar}
                        />
                        <Text style={[trackerStyles.rankName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                          {entry.isCurrentUser ? 'You' : entry.displayName}
                        </Text>
                        <Text style={[trackerStyles.rankPoints, { color: isDark ? theme.colors.primary : '#126027' }]}>{entry.points} Eco Points</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Pagination Controls */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}>
                  <TouchableOpacity 
                    disabled={leaderboardPage === 1} 
                    onPress={() => setLeaderboardPage(leaderboardPage - 1)}
                    style={{ padding: 8, opacity: leaderboardPage === 1 ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-back" size={24} color={isDark ? theme.colors.primary : '#126027'} />
                  </TouchableOpacity>
                  <Text style={{ fontWeight: '800', color: isDark ? theme.colors.primary : '#126027', fontSize: 14 }}>
                    Page {leaderboardPage} of {lbTotalPages}
                  </Text>
                  <TouchableOpacity 
                    disabled={leaderboardPage >= lbTotalPages} 
                    onPress={() => setLeaderboardPage(leaderboardPage + 1)}
                    style={{ padding: 8, opacity: leaderboardPage >= lbTotalPages ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={24} color={isDark ? theme.colors.primary : '#126027'} />
                  </TouchableOpacity>
                </View>

                {/* Current user anchor */}
                {currentRank != null && !lbCurrentItems.some((entry) => entry.isCurrentUser) && (
                  <View style={[
                    trackerStyles.currentUserAnchor,
                    { backgroundColor: isDark ? theme.colors.surface : '#F0FDF4', borderTopColor: theme.colors.primary }
                  ]}>
                    <Text style={[trackerStyles.rankNumber, { color: theme.colors.textMuted }]}>#{currentRank}</Text>
                    <AvatarBubble
                      label="You"
                      size={32}
                      style={[trackerStyles.rankAvatar, trackerStyles.rankAvatarUser, { borderWidth: 0, backgroundColor: theme.colors.primary }]}
                      textStyle={[trackerStyles.rankAvatarText, { color: isDark ? '#1A2620' : '#FFF' }]}
                      avatarUrl={model.profile?.profile?.avatarUrl || model.session?.user.avatarUrl}
                    />
                    <Text style={[trackerStyles.rankName, { color: theme.colors.textPrimary }]}>You</Text>
                    <Text style={[trackerStyles.rankPoints, { color: theme.colors.primary }]}>{totalPoints} Eco Points</Text>
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        )}
          </>
        )}

        <View style={{ height: 110 }} />
      </View>

      {/* ── Day Detail Popup ──────────────────────────────────────────────── */}
      {selectedDay && (
        <Modal
          transparent={true}
          visible={!!selectedDay}
          animationType="none"
          onRequestClose={() => setSelectedDay(null)}
        >
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
        </Modal>
      )}
    </>
  );
}

export function ProfileView({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const { width, height } = useWindowDimensions();
  const isSmallDevice = height <= 680 || width < 375;
  const isCompact = height < 750 || width < 380;
  const [isViewingAvatar, setIsViewingAvatar] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to change your profile picture.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await model.handleUpdateProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const rawAvatarUrl = model.profile?.profile?.avatarUrl || model.session?.user.avatarUrl;
  let avatarUrl: string | null = null;
  if (rawAvatarUrl && rawAvatarUrl !== 'null') {
    avatarUrl = resolveMediaUrl(rawAvatarUrl, ecobudApiOrigin) || null;
  }

  const totalPoints = model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0;
  const { currentLevelObj, nextLevelObj } = getLevelFromPoints(totalPoints);
  
  const isMaxLevel = currentLevelObj.level === 10;
  let progressPercent = 100;
  let pointsToNext = 0;

  if (!isMaxLevel) {
    const pointsInCurrentLevel = totalPoints - currentLevelObj.points;
    const pointsNeededForNextLevel = nextLevelObj.points - currentLevelObj.points;
    progressPercent = (pointsInCurrentLevel / pointsNeededForNextLevel) * 100;
    pointsToNext = nextLevelObj.points - totalPoints;
  }

  const avatarSize = isSmallDevice ? scale(58) : scale(68);

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
          style={[
            profileStyles.headerCard,
            isSmallDevice && { padding: moderateScale(14), marginTop: verticalScale(6), marginBottom: verticalScale(12) }
          ]}
        >
          {/* Top Row: Level Badge + Settings Button */}
          <View style={[profileStyles.headerTopRow, isSmallDevice && { marginBottom: verticalScale(8) }]}>
            <View style={[profileStyles.headerBadge, isSmallDevice && { paddingHorizontal: scale(8), paddingVertical: verticalScale(3) }]}>
              <Text style={[profileStyles.headerBadgeText, isSmallDevice && { fontSize: responsiveFontSize(9) }]}>
                LEVEL {currentLevelObj.level}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
              <TouchableOpacity 
                style={[profileStyles.headerSettingsBtn, isSmallDevice && { width: scale(28), height: scale(28), borderRadius: scale(14) }]}
                onPress={() => model.setActiveOverlay('editProfile')}
              >
                <Ionicons name="pencil" size={isSmallDevice ? scale(14) : scale(16)} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[profileStyles.headerSettingsBtn, isSmallDevice && { width: scale(28), height: scale(28), borderRadius: scale(14) }]}
                onPress={() => model.setActiveOverlay('settings')}
              >
                <Ionicons name="settings-sharp" size={isSmallDevice ? scale(15) : scale(18)} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile Main Info (Avatar + User Name/Email/Title) */}
          <View style={[profileStyles.profileMainInfo, isSmallDevice && { gap: scale(10), marginBottom: verticalScale(10) }]}>
            <TouchableOpacity onPress={() => avatarUrl ? setIsViewingAvatar(true) : void pickImage()} style={profileStyles.avatarContainer}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={[profileStyles.avatarImg, isSmallDevice && { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
                />
              ) : (
                <AvatarBubble
                  label={model.userDisplayName}
                  size={avatarSize}
                  style={[profileStyles.avatarImg, isSmallDevice && { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
                  textStyle={{ fontSize: isSmallDevice ? responsiveFontSize(22) : responsiveFontSize(28) }}
                />
              )}
              <TouchableOpacity
                onPress={() => void pickImage()}
                style={[profileStyles.avatarEditBadge, isSmallDevice && { width: scale(18), height: scale(18), borderRadius: scale(9) }]}
              >
                <Ionicons name="camera" size={isSmallDevice ? scale(9) : scale(11)} color="#FFF" />
              </TouchableOpacity>
            </TouchableOpacity>
            
            <View style={profileStyles.profileMeta}>
              <Text
                style={[profileStyles.profileName, isSmallDevice && { fontSize: responsiveFontSize(16), marginBottom: 1 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {model.userDisplayName}
              </Text>
              <Text
                style={[profileStyles.profileEmail, isSmallDevice && { fontSize: responsiveFontSize(11), marginBottom: verticalScale(4) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {model.session?.user.email}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                <View style={[profileStyles.titleBadge, isSmallDevice && { paddingHorizontal: scale(6), paddingVertical: verticalScale(2) }]}>
                  <MaterialCommunityIcons name="shield-crown" size={isSmallDevice ? scale(12) : scale(14)} color="#F59E0B" />
                  <Text
                    style={[profileStyles.titleBadgeText, isSmallDevice && { fontSize: responsiveFontSize(10) }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {currentLevelObj.name}
                  </Text>
                </View>

                {model.profile?.profile?.city ? (
                  <View style={[profileStyles.titleBadge, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }, isSmallDevice && { paddingHorizontal: scale(6), paddingVertical: verticalScale(2) }]}>
                    <Ionicons name="location-sharp" size={isSmallDevice ? scale(11) : scale(13)} color="#A7F3D0" />
                    <Text
                      style={[profileStyles.titleBadgeText, { color: '#E6F4EC' }, isSmallDevice && { fontSize: responsiveFontSize(10) }]}
                      numberOfLines={1}
                    >
                      Brgy. {model.profile?.profile?.city}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Integrated Horizontal Coin Balance Glass Bar wrapped in CoachMarkTarget */}
          <CoachMarkTarget
            name="ecoCoins"
            borderRadius={isSmallDevice ? moderateScale(12) : moderateScale(16)}
            active={model.coachMarksVisible && model.coachMarksCurrentStep === 1}
            onMeasure={(rect) => {
              model.setSpotlightTargetRect?.(rect);
            }}
          >
            <TouchableOpacity 
              style={[
                profileStyles.coinCardHorizontal,
                isSmallDevice && { paddingHorizontal: scale(10), paddingVertical: verticalScale(8), borderRadius: moderateScale(12) }
              ]}
              onPress={() => model.setActiveOverlay('coinsHistory')}
              activeOpacity={0.85}
            >
              <View style={[profileStyles.coinCardLeft, isSmallDevice && { gap: scale(8) }]}>
                <Image
                  source={require('../../../assets/coin.png')}
                  style={[profileStyles.coinBalanceIconHoriz, isSmallDevice && { width: scale(22), height: scale(22) }]}
                  resizeMode="contain"
                />
                <View style={{ justifyContent: 'center', flexShrink: 1 }}>
                  <Text style={[profileStyles.coinBalanceLabelHoriz, isSmallDevice && { fontSize: responsiveFontSize(9) }]}>
                    Eco Coins
                  </Text>
                  <Text
                    style={[profileStyles.coinBalanceAmountHoriz, isSmallDevice && { fontSize: responsiveFontSize(15), lineHeight: responsiveFontSize(18) }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {model.dashboard?.ecoCoins ?? 0}
                  </Text>
                </View>
              </View>
              <View style={[profileStyles.coinHistoryChip, isSmallDevice && { paddingHorizontal: scale(8), paddingVertical: verticalScale(4) }]}>
                <Text style={[profileStyles.coinHistoryChipText, isSmallDevice && { fontSize: responsiveFontSize(10) }]}>
                  Coins History
                </Text>
                <Ionicons name="chevron-forward" size={isSmallDevice ? scale(12) : scale(14)} color="#FDE68A" />
              </View>
            </TouchableOpacity>
          </CoachMarkTarget>
        </LinearGradient>

        {/* Progress Bar Info */}
        <View style={[profileStyles.progressSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder, borderWidth: 1, shadowOpacity: isDark ? 0.2 : 0.04 }, isSmallDevice && { padding: moderateScale(12), marginBottom: verticalScale(14) }]}>
          <View style={[profileStyles.progressInfoRow, isSmallDevice && { marginBottom: verticalScale(6) }]}>
            <Text style={[profileStyles.progressInfoText, { color: theme.colors.textPrimary }, isSmallDevice && { fontSize: responsiveFontSize(12) }]}>
              Journey Progress
            </Text>
            <Text
              style={[profileStyles.progressInfoValue, { color: isDark ? theme.colors.primary : '#126027' }, isSmallDevice && { fontSize: responsiveFontSize(10) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {isMaxLevel ? 'Max Level Reached!' : `${pointsToNext} XP to Lv. ${nextLevelObj.level}`}
            </Text>
          </View>
          <ProgressBar progress={progressPercent} />
        </View>

        {/* Events Quick Card */}
        <View style={profileStyles.sectionContainer}>
          <Text style={[profileStyles.sectionHeadline, { color: theme.colors.textPrimary }]}>My Eco Events</Text>
          <View style={[profileStyles.eventBanner, { borderColor: theme.colors.cardBorder }]}>
            <LinearGradient
              colors={isDark ? [theme.colors.card, theme.colors.cardAlt] : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 253, 244, 0.95)']}
              style={profileStyles.eventBannerGrad}
            >
              <View style={profileStyles.eventBannerTextCol}>
                <Text style={[profileStyles.eventBannerTitle, { color: isDark ? theme.colors.primary : '#126027' }]}>Local Workshops</Text>
                <Text style={[profileStyles.eventBannerDesc, { color: theme.colors.textMuted }]}>Join clean-ups, eco events, and tree plant activities.</Text>
              </View>
              <TouchableOpacity
                onPress={() => model.setActiveOverlay('events')}
                style={[profileStyles.eventBannerBtn, { backgroundColor: isDark ? theme.colors.primary : '#126027' }]}
              >
                <Text style={[profileStyles.eventBannerBtnText, { color: isDark ? '#0E1512' : '#FFF' }]}>Discover</Text>
                <Ionicons name="arrow-forward" size={14} color={isDark ? '#0E1512' : '#FFF'} />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

        {/* Unified Eco Actions List */}
        <View style={profileStyles.sectionContainer}>
          <Text style={[profileStyles.sectionHeadline, { color: theme.colors.textPrimary }]}>Eco Hub</Text>
          <View style={[profileStyles.actionListCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder, borderWidth: 1, shadowOpacity: isDark ? 0.2 : 0.05 }]}>
            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => model.setActiveOverlay('editProfile')}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#E0F2FE' }]}>
                <Ionicons name="person-outline" size={20} color={isDark ? theme.colors.primary : '#0369A1'} />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: theme.colors.textPrimary }]}>Edit Profile</Text>
                <Text style={[profileStyles.actionSub, { color: theme.colors.textMuted }]}>Update username, email & barangay</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.border} />
            </TouchableOpacity>

            <View style={[profileStyles.divider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => model.setActiveOverlay('redeemPoints')}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#FEF3C7' }]}>
                <Image source={require('../../../assets/coin.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: isDark ? '#FBBF24' : '#D97706' }]}>Redeem Coins</Text>
                <Text style={[profileStyles.actionSub, { color: theme.colors.textMuted }]}>Exchange your eco coins for rewards</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.border} />
            </TouchableOpacity>

            <View style={[profileStyles.divider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => model.setActiveOverlay('coinsHistory')}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#EDF6F1' }]}>
                <Ionicons name="time-outline" size={20} color={isDark ? theme.colors.primary : '#126027'} />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: theme.colors.textPrimary }]}>Coins History</Text>
                <Text style={[profileStyles.actionSub, { color: theme.colors.textMuted }]}>Check your points and task completion logs</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.border} />
            </TouchableOpacity>

            <View style={[profileStyles.divider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => model.setActiveOverlay('settings')}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#EDF6F1' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={isDark ? theme.colors.primary : '#126027'} />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: theme.colors.textPrimary }]}>Settings & Security</Text>
                <Text style={[profileStyles.actionSub, { color: theme.colors.textMuted }]}>Manage account security & password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.border} />
            </TouchableOpacity>

            <View style={[profileStyles.divider, { backgroundColor: theme.colors.border }]} />

            {/* App Appearance / Theme Mode Switch */}
            <View style={profileStyles.actionItem}>
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: isDark ? '#262626' : '#F5F3FF' }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={isDark ? '#FBBF24' : '#7C3AED'} />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: theme.colors.textPrimary }]}>App Appearance</Text>
                <Text style={[profileStyles.actionSub, { color: theme.colors.textMuted }]}>
                  {isDark ? 'Dark Mode (Night)' : 'Light Mode (Day)'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', backgroundColor: theme.colors.surfaceMuted, borderRadius: 20, padding: 3, borderWidth: 1, borderColor: theme.colors.border }}>
                <TouchableOpacity
                  onPress={() => {
                    triggerSelectionHaptic();
                    setThemeMode('light');
                  }}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 16,
                    backgroundColor: themeMode === 'light' ? '#126027' : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Ionicons name="sunny" size={13} color={themeMode === 'light' ? '#FFF' : theme.colors.textMuted} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: themeMode === 'light' ? '#FFF' : theme.colors.textMuted }}>Light</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    triggerSelectionHaptic();
                    setThemeMode('dark');
                  }}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 16,
                    backgroundColor: themeMode === 'dark' ? theme.colors.primary : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Ionicons name="moon" size={13} color={themeMode === 'dark' ? '#0E1512' : theme.colors.textMuted} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: themeMode === 'dark' ? '#0E1512' : theme.colors.textMuted }}>Dark</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    triggerSelectionHaptic();
                    setThemeMode('onyx');
                  }}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 16,
                    backgroundColor: themeMode === 'onyx' ? '#FFF' : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Ionicons name="moon-outline" size={13} color={themeMode === 'onyx' ? '#000' : theme.colors.textMuted} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: themeMode === 'onyx' ? '#000' : theme.colors.textMuted }}>Onyx</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[profileStyles.divider, { backgroundColor: theme.colors.border }]} />

            {/* Mascot Chatbot On/Off Switch */}
            <View style={profileStyles.actionItem}>
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#ECFDF5' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={isDark ? theme.colors.primary : '#059669'} />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: theme.colors.textPrimary }]}>Mascot AI Chatbot</Text>
                <Text style={[profileStyles.actionSub, { color: theme.colors.textMuted }]}>
                  {model.isChatbotEnabled ? 'Floating leaf mascot enabled' : 'Hidden from screen'}
                </Text>
              </View>
              <Switch
                value={model.isChatbotEnabled}
                onValueChange={(val) => {
                  triggerSelectionHaptic();
                  void model.setChatbotEnabled(val);
                }}
                trackColor={{
                  false: isDark ? '#374151' : '#E5E7EB',
                  true: isDark ? 'rgba(74, 222, 128, 0.5)' : '#A7F3D0',
                }}
                thumbColor={
                  model.isChatbotEnabled
                    ? (isDark ? theme.colors.primary : '#059669')
                    : (isDark ? '#9CA3AF' : '#F3F4F6')
                }
              />
            </View>

            <View style={[profileStyles.divider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity
              style={profileStyles.actionItem}
              onPress={() => {
                model.setActiveTab('home');
                model.showCoachMarks();
              }}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#F0FDF4' }]}>
                <Ionicons name="help-buoy-outline" size={20} color={isDark ? theme.colors.primary : '#059669'} />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: isDark ? theme.colors.primary : '#059669' }]}>Replay Tutorial</Text>
                <Text style={[profileStyles.actionSub, { color: theme.colors.textMuted }]}>Re-watch the app walkthrough guide</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.border} />
            </TouchableOpacity>

            <View style={[profileStyles.divider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => void model.handleLogout()}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: isDark ? '#3E1D1D' : '#FEE2E2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: '#EF4444' }]}>Sign Out</Text>
                <Text style={[profileStyles.actionSub, { color: theme.colors.textMuted }]}>Logout of your current device session</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FCA5A5" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Rewards & Badges (Moved from Overlay) */}
        <View style={profileStyles.sectionContainer}>
          <Text style={[profileStyles.sectionHeadline, { color: theme.colors.textPrimary }]}>Rewards & Badges</Text>
          <LinearGradient
            colors={['#059669', '#10B981', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: '100%',
              borderRadius: isSmallDevice ? 18 : 24,
              padding: isSmallDevice ? 14 : 20,
              marginBottom: isSmallDevice ? 14 : 20,
              position: 'relative',
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.25)',
              shadowColor: '#059669',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            {/* Background Decorative Circles */}
            <View
              style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: -30,
                left: -10,
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmallDevice ? 10 : 14, flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    width: isSmallDevice ? 42 : 52,
                    height: isSmallDevice ? 42 : 52,
                    borderRadius: isSmallDevice ? 21 : 26,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  <Ionicons name="leaf" size={isSmallDevice ? 20 : 26} color="#FFF" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#D1FAE5', fontSize: isSmallDevice ? 10 : 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    Eco Balance
                  </Text>
                  <Text
                    style={{ fontSize: isSmallDevice ? 22 : 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {model.rewards?.points ?? 0} <Text style={{ fontSize: isSmallDevice ? 14 : 18, fontWeight: '700', color: '#ECFDF5' }}>Points</Text>
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.15)',
                  paddingHorizontal: isSmallDevice ? 8 : 12,
                  paddingVertical: isSmallDevice ? 4 : 6,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  flexShrink: 0,
                }}
              >
                <Ionicons name="sparkles" size={isSmallDevice ? 10 : 12} color="#FDE68A" />
                <Text style={{ color: '#ECFDF5', fontSize: isSmallDevice ? 10 : 11, fontWeight: '600' }}>Available</Text>
              </View>
            </View>
          </LinearGradient>
          
          <Text style={[profileStyles.sectionHeadline, { fontSize: isSmallDevice ? 14 : 16, marginTop: isSmallDevice ? 4 : 8, color: theme.colors.textPrimary }]}>Lifetime Achievements</Text>
          {(model.rewards?.achievements ?? []).length > 0 ? (
            (model.rewards?.achievements ?? []).map((achievement) => {
              const progress = Math.min(100, Math.round((achievement.current / achievement.target) * 100));
              return (
                <View key={achievement.id} style={[profileStyles.achievementCard, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }, isSmallDevice && { padding: moderateScale(12), borderRadius: moderateScale(18) }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: isSmallDevice ? 8 : 12, gap: 8 }}>
                    <Text
                      style={[profileStyles.badgeTitle, { textAlign: 'left', flex: 1, color: theme.colors.textPrimary }, isSmallDevice && { fontSize: responsiveFontSize(12) }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {achievement.label} ({achievement.current}/{achievement.target})
                    </Text>
                    <Text style={[{ color: isDark ? theme.colors.primary : '#10B981', fontWeight: 'bold' }, isSmallDevice && { fontSize: responsiveFontSize(12) }]}>
                      {achievement.reward} pts
                    </Text>
                  </View>
                  <View style={profileStyles.badgeProgressWrap}>
                    <ProgressBar progress={progress} />
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={{ textAlign: 'center', color: theme.colors.textMuted, marginTop: 16 }}>No achievements yet.</Text>
          )}
        </View>

        {/* Collectible Badges Grid */}
        <View style={profileStyles.sectionContainer}>
          <Text style={[profileStyles.sectionHeadline, { color: theme.colors.textPrimary }]}>Collectible Badges</Text>
          <View style={profileStyles.badgesGrid}>
            {(model.rewards?.badges || []).length > 0 ? (
              (model.rewards?.badges || []).map((badge) => {
                const isUnlocked = badge.unlocked;
                return (
                  <TouchableOpacity
                    key={badge.id}
                    activeOpacity={0.8}
                    onPress={() => model.openBadgeOverlay(badge)}
                    style={[profileStyles.badgeCard, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }, !isUnlocked && { opacity: 0.75 }]}
                  >
                    <View style={[profileStyles.badgeIconRing, { borderColor: isUnlocked ? (badge.accentColor || (isDark ? theme.colors.primary : '#10B981')) : (isDark ? theme.colors.border : '#B0C4B8') }]}>
                      {isUnlocked ? (
                        <LinearGradient
                          colors={[badge.accentColor || (isDark ? theme.colors.primary : '#10B981'), badge.accentColor ? badge.accentColor + '99' : (isDark ? '#17A07E' : '#059669')]}
                          style={profileStyles.badgeIconBg}
                        >
                          {badge.iconUrl && badge.iconUrl.startsWith('http') ? (
                            <Image source={{ uri: badge.iconUrl }} style={{ width: 30, height: 30 }} resizeMode="contain" />
                          ) : (
                            <Ionicons name="ribbon-outline" size={26} color="#FFF" />
                          )}
                        </LinearGradient>
                      ) : (
                        <View style={[profileStyles.badgeIconBg, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#F3F4F6' }]}>
                          {badge.iconUrl && badge.iconUrl.startsWith('http') ? (
                            <Image source={{ uri: badge.iconUrl }} style={{ width: 30, height: 30, tintColor: isDark ? theme.colors.textMuted : '#9CA3AF' }} resizeMode="contain" />
                          ) : (
                            <Ionicons name="ribbon-outline" size={26} color={isDark ? theme.colors.textMuted : '#9CA3AF'} />
                          )}
                        </View>
                      )}
                      
                      {!isUnlocked && (
                        <View style={[profileStyles.lockBadgeTag, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                          <Ionicons name="lock-closed" size={10} color="#FFF" />
                        </View>
                      )}
                    </View>
                    <Text style={[isUnlocked ? profileStyles.badgeTitle : profileStyles.badgeTitleLocked, { color: isUnlocked ? theme.colors.textPrimary : theme.colors.textMuted }]}>{badge.name}</Text>
                    <Text style={[profileStyles.badgeDescription, { color: theme.colors.textMuted }]}>{badge.description}</Text>
                    {!isUnlocked && badge.targetProgress ? (
                      <View style={{ marginTop: 8, width: '100%', paddingHorizontal: 4 }}>
                        <ProgressBar progress={(badge.currentProgress ?? 0) / badge.targetProgress} />
                        <Text style={[profileStyles.badgeDescription, { marginTop: 4, textAlign: 'center', fontSize: 10, color: theme.colors.textMuted }]}>
                          {badge.currentProgress} / {badge.targetProgress} completed
                        </Text>
                      </View>
                    ) : !isUnlocked ? (
                      <Text style={[profileStyles.badgeDescription, { marginTop: 4, fontWeight: 'bold', color: isDark ? theme.colors.primary : '#126027' }]}>
                        Unlocks at {badge.requiredPoints} pts
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={{ textAlign: 'center', color: theme.colors.textMuted, marginTop: 16 }}>No badges available.</Text>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </View>
      {isViewingAvatar && (
        <Modal visible={isViewingAvatar} transparent={true} animationType="fade" onRequestClose={() => setIsViewingAvatar(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity style={{ position: 'absolute', top: 60, right: 30, zIndex: 10 }} onPress={() => setIsViewingAvatar(false)}>
              <Ionicons name="close" size={32} color="#FFF" />
            </TouchableOpacity>
            
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '70%', resizeMode: 'contain' }} />
            ) : (
              <AvatarBubble
                label={model.userDisplayName}
                size={200}
                style={{ borderRadius: 100 }}
                textStyle={{ fontSize: 80 }}
              />
            )}
            
            <TouchableOpacity 
              style={{ marginTop: 40, backgroundColor: '#126027', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }} 
              onPress={() => { setIsViewingAvatar(false); void pickImage(); }}
            >
              <Ionicons name="camera" size={20} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Change Picture</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </>
  );
}

const localStyles = StyleSheet.create({
  headerEyebrow: { color: '#4B8A5C', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 },
  headerTitle: { fontSize: 30, fontWeight: '900', color: '#153B22', letterSpacing: -0.7, lineHeight: 36 },
  headerSubtitle: { fontSize: 15, color: '#5F7367', marginTop: 7, lineHeight: 22 },
  challengeSearch: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 15,
    paddingHorizontal: 15, marginTop: 20, marginBottom: 15, minHeight: 52,
    shadowColor: '#126027', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 2, borderWidth: 1, borderColor: '#E5EEE8',
  },
  discoverOverview: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, marginBottom: 8,
    shadowColor: '#126027', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  discoverOverviewIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  discoverOverviewCopy: { flex: 1 },
  discoverOverviewTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  discoverOverviewText: { color: '#D1FAE5', fontSize: 12, lineHeight: 17, marginTop: 2 },
  discoverOverviewCount: { alignItems: 'center', minWidth: 38 },
  discoverOverviewNumber: { color: '#D9F99D', fontSize: 22, fontWeight: '900', lineHeight: 25 },
  discoverOverviewLabel: { color: '#D1FAE5', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  challengeListHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  challengeListTitle: { color: '#153B22', fontSize: 18, fontWeight: '900', letterSpacing: -0.25 },
  challengeListSubtitle: { color: '#688074', fontSize: 12, marginTop: 3 },
  challengeListCount: { color: '#126027', backgroundColor: '#E8F5E9', fontSize: 13, fontWeight: '900', minWidth: 28, textAlign: 'center', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 12 },
  
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

  // Discover cards prioritize a clear visual cue, short scan-friendly content, and one large action.
  discoverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E4EEE6',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  discoverCardPressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  discoverImageWrap: { height: 144, backgroundColor: '#DCFCE7', position: 'relative' },
  discoverImage: { width: '100%', height: '100%' },
  discoverImageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7' },
  discoverImageShade: { ...StyleSheet.absoluteFill as any, backgroundColor: 'rgba(18, 96, 39, 0.12)' },
  discoverNewBadge: {
    position: 'absolute', top: 12, left: 12, backgroundColor: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  discoverNewBadgeText: { color: '#126027', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  discoverBody: { padding: 16, paddingTop: 14 },
  discoverMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  discoverCategoryBadge: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  discoverCategoryText: { color: '#166534', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  discoverDifficulty: { color: '#6B7A75', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  discoverTitle: { color: '#17231B', fontSize: 19, fontWeight: '900', lineHeight: 24, letterSpacing: -0.25 },
  discoverDescription: { color: '#65736C', fontSize: 13, lineHeight: 19, marginTop: 5 },
  discoverFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  discoverRewardLabel: { color: '#89968F', fontSize: 9, fontWeight: '800', letterSpacing: 0.7, marginBottom: 3 },
  discoverRewardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  discoverReward: { color: '#126027', fontSize: 13, fontWeight: '800' },
  discoverStartButton: {
    minHeight: 44, backgroundColor: '#126027', borderRadius: 13, paddingHorizontal: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  discoverStartText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },

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
  // ── Streak Card ────────────────────────────────────────────────────────
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

  // ── Level Card ─────────────────────────────────────────────────────────
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
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: { color: '#6B7A75', fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
    width: '14.28%',
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
    width: '100%',
    aspectRatio: 1,
    maxWidth: 40,
    maxHeight: 40,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#CBEFD6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#CBEFD6',
  },
  podiumAvatarUser: {
    backgroundColor: '#CBEFD6',
    borderColor: '#126027',
    borderWidth: 2,
  },
  podiumAvatarText: { color: '#126027', fontSize: 18, fontWeight: '900' },
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
    backgroundColor: '#CBEFD6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6F4EC',
  },
  rankAvatarUser: {
    backgroundColor: '#CBEFD6',
    borderColor: '#126027',
    borderWidth: 1.5,
  },
  rankAvatarText: { color: '#126027', fontSize: 14, fontWeight: '800' },
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
    top: verticalScale(150),
    left: scale(-40),
    width: scale(200),
    height: scale(200),
    borderRadius: scale(100),
    backgroundColor: 'rgba(74, 222, 128, 0.05)',
  },
  backgroundOrbTwo: {
    position: 'absolute',
    top: verticalScale(400),
    right: scale(-40),
    width: scale(250),
    height: scale(250),
    borderRadius: scale(125),
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  headerCard: {
    borderRadius: moderateScale(26),
    padding: moderateScale(18),
    marginTop: verticalScale(10),
    marginBottom: verticalScale(16),
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: verticalScale(10) },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  headerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerBadgeText: {
    color: '#FFF',
    fontSize: responsiveFontSize(10),
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerSettingsBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
    marginBottom: verticalScale(14),
  },
  avatarContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarImg: {
    width: scale(68),
    height: scale(68),
    borderRadius: scale(34),
    borderWidth: 3,
    borderColor: '#FFF',
    backgroundColor: '#E6F4EC',
  },
  avatarPlaceholder: {
    width: scale(68),
    height: scale(68),
    borderRadius: scale(34),
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
    borderRadius: scale(10),
    width: scale(20),
    height: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  profileMeta: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  profileName: {
    fontSize: responsiveFontSize(18),
    fontWeight: '800',
    color: '#FFF',
    marginBottom: verticalScale(2),
    flexShrink: 1,
  },
  profileEmail: {
    fontSize: responsiveFontSize(12),
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: verticalScale(6),
    flexShrink: 1,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    gap: scale(4),
  },
  titleBadgeText: {
    color: '#FFF',
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    flexShrink: 1,
  },
  coinCardHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  coinCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    flex: 1,
    minWidth: 0,
  },
  coinBalanceIconHoriz: {
    width: scale(28),
    height: scale(28),
    flexShrink: 0,
  },
  coinBalanceLabelHoriz: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: responsiveFontSize(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coinBalanceAmountHoriz: {
    color: '#FDE68A',
    fontSize: responsiveFontSize(18),
    fontWeight: '900',
    lineHeight: responsiveFontSize(22),
  },
  coinHistoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(10),
    gap: scale(4),
  },
  coinHistoryChipText: {
    color: '#FDE68A',
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
    marginBottom: verticalScale(20),
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: moderateScale(20),
    padding: moderateScale(12),
    alignItems: 'center',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: verticalScale(6) },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F5F2',
  },
  statIconBox: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(8),
  },
  coinIcon: {
    width: scale(18),
    height: scale(18),
  },
  statValue: {
    fontSize: responsiveFontSize(15),
    fontWeight: '900',
    color: '#1A211D',
    marginBottom: verticalScale(2),
  },
  statLabel: {
    fontSize: responsiveFontSize(10),
    color: '#6B7A75',
    fontWeight: '600',
    textAlign: 'center',
  },
  progressSection: {
    backgroundColor: '#FFF',
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    marginBottom: verticalScale(20),
    borderWidth: 1,
    borderColor: '#F0F5F2',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: verticalScale(6) },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  progressInfoText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: '#1A211D',
  },
  progressInfoValue: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    color: '#126027',
  },
  sectionContainer: {
    marginBottom: verticalScale(20),
  },
  sectionHeadline: {
    fontSize: responsiveFontSize(16),
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: verticalScale(12),
    letterSpacing: 0.3,
  },
  eventBanner: {
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: verticalScale(8) },
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
    padding: moderateScale(16),
    gap: scale(14),
  },
  eventBannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  eventBannerTitle: {
    fontSize: responsiveFontSize(15),
    fontWeight: '800',
    color: '#126027',
    marginBottom: verticalScale(4),
  },
  eventBannerDesc: {
    fontSize: responsiveFontSize(12),
    color: '#6B7A75',
    lineHeight: responsiveFontSize(16),
  },
  eventBannerBtn: {
    backgroundColor: '#126027',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    flexShrink: 0,
  },
  eventBannerBtnText: {
    color: '#FFF',
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
  },
  actionListCard: {
    backgroundColor: '#FFF',
    borderRadius: moderateScale(24),
    padding: moderateScale(8),
    borderWidth: 1,
    borderColor: '#F0F5F2',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: verticalScale(8) },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(12),
    gap: scale(12),
  },
  actionIconWrapper: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  actionLabel: {
    fontSize: responsiveFontSize(14),
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: verticalScale(2),
  },
  actionSub: {
    fontSize: responsiveFontSize(11),
    color: '#6B7A75',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F5F2',
    marginHorizontal: scale(12),
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  achievementCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: moderateScale(24),
    padding: moderateScale(16),
    alignItems: 'stretch',
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: '#F0F5F2',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: verticalScale(6) },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: moderateScale(24),
    padding: moderateScale(14),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F5F2',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: verticalScale(6) },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeIconRing: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(10),
    position: 'relative',
  },
  badgeIconBg: {
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldBadgeTag: {
    position: 'absolute',
    bottom: verticalScale(-6),
    backgroundColor: '#F59E0B',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
    borderWidth: 1,
    borderColor: '#FFF',
  },
  goldBadgeTagText: {
    color: '#FFF',
    fontSize: responsiveFontSize(7),
    fontWeight: '900',
  },
  lockBadgeTag: {
    position: 'absolute',
    bottom: verticalScale(-4),
    backgroundColor: '#9CA3AF',
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  badgeTitle: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#1A211D',
    textAlign: 'center',
    marginBottom: verticalScale(4),
  },
  badgeTitleLocked: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#6B7A75',
    textAlign: 'center',
    marginBottom: verticalScale(4),
  },
  badgeDescription: {
    fontSize: responsiveFontSize(10),
    color: '#6B7A75',
    textAlign: 'center',
    lineHeight: responsiveFontSize(13),
  },
  badgeProgressWrap: {
    width: '100%',
    marginTop: verticalScale(8),
  },
});
