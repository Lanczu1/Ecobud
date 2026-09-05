import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/theme/ecoTheme';

import LottieView from 'lottie-react-native';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../utils/haptics';
import type { AppTab, EcoBudMobileModel } from '../types/home';

export type MascotPose = 'wave' | 'idle' | 'left_point' | 'right_point' | 'celebrate';

const MASCOT_SOURCES: Record<MascotPose, any> = {
  wave: require('../../../assets/Ecobud Mascot/New Lottie files/Wave.lottie'),
  right_point: require('../../../assets/Ecobud Mascot/New Lottie files/Right Point.lottie'),
  idle: require('../../../assets/Ecobud Mascot/New Lottie files/Idle.lottie'),
  left_point: require('../../../assets/Ecobud Mascot/New Lottie files/Left Point.lottie'),
  celebrate: require('../../../assets/Ecobud Mascot/New Lottie files/Celebrate.lottie'),
};

export interface CoachMarksOverlayProps {
  visible: boolean;
  onFinish: () => void;
  onSkip?: () => void;
  initialStep?: number;
  activeTab?: AppTab;
  onTabChange?: (tab: AppTab) => void;
  onScrollTo?: (y: number, animated?: boolean) => void;
  model?: EcoBudMobileModel;
}

interface StepConfig {
  stepNumber: number;
  totalSteps: number;
  targetTab: AppTab;
  title: string;
  titleIcon?: string;
  description: string;
  pose: MascotPose;
  mascotPosition: 'center' | 'left' | 'right' | 'top';
  cardVerticalAlign: 'top' | 'center' | 'bottom';
  arrowDirection: 'top' | 'bottom' | 'none';
}

export function CoachMarksOverlay({
  visible,
  onFinish,
  onSkip,
  initialStep = 0,
  activeTab,
  onTabChange,
  onScrollTo,
  model,
}: CoachMarksOverlayProps) {
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(initialStep);

  const isSmallDevice = height <= 680 || width < 375;
  const isCompact = height < 750 || width < 380;

  // Animation values
  const overlayFade = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const pulseGlow = useRef(new Animated.Value(1)).current;
  const mascotSlide = useRef(new Animated.Value(0)).current;
  const particlesAnim = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  // Step configs tailored to guide through the REAL live screens
  const steps: StepConfig[] = [
    {
      stepNumber: 1,
      totalSteps: 7,
      targetTab: 'home',
      title: 'Welcome to ECOBUD!',
      titleIcon: '🌱',
      description: 'Your journey toward a greener lifestyle starts here on your Home Dashboard. Let\'s take a quick tour!',
      pose: 'wave',
      mascotPosition: 'center',
      cardVerticalAlign: 'center',
      arrowDirection: 'bottom',
    },
    {
      stepNumber: 2,
      totalSteps: 7,
      targetTab: 'profile',
      title: 'Your Eco-Coins',
      titleIcon: '🪙',
      description: 'Earn coins from verified eco-actions and trade rewards!',
      pose: 'right_point',
      mascotPosition: 'right',
      cardVerticalAlign: 'bottom',
      arrowDirection: 'top',
    },
    {
      stepNumber: 3,
      totalSteps: 7,
      targetTab: 'tracker',
      title: 'Maintain Your Streak!',
      titleIcon: '🔥',
      description: 'Track your daily activity! Log your eco-actions every day to build your streak and earn bonus XP rewards.',
      pose: 'left_point',
      mascotPosition: 'left',
      cardVerticalAlign: 'bottom',
      arrowDirection: 'top',
    },
    {
      stepNumber: 4,
      totalSteps: 7,
      targetTab: 'challenges',
      title: 'Discover Eco-Tasks',
      titleIcon: '🎯',
      description: 'Explore the Discover challenges section! Complete real-world missions, submit proof, and level up.',
      pose: 'right_point',
      mascotPosition: 'right',
      cardVerticalAlign: 'bottom',
      arrowDirection: 'top',
    },
    {
      stepNumber: 5,
      totalSteps: 7,
      targetTab: 'learn',
      title: 'Learn & Earn Hub',
      titleIcon: '📚',
      description: 'Master climate solutions with short lessons and interactive quizzes to earn additional Eco-Coins.',
      pose: 'right_point',
      mascotPosition: 'right',
      cardVerticalAlign: 'bottom',
      arrowDirection: 'top',
    },
    {
      stepNumber: 6,
      totalSteps: 7,
      targetTab: 'marketplace',
      title: 'Give & Get Hub',
      titleIcon: '♻️',
      description: 'Exchange pre-loved eco items, join community giveaways, and reduce waste in your local neighborhood.',
      pose: 'right_point',
      mascotPosition: 'right',
      cardVerticalAlign: 'bottom',
      arrowDirection: 'top',
    },
    {
      stepNumber: 7,
      totalSteps: 7,
      targetTab: 'home',
      title: 'You\'re All Set!',
      titleIcon: '🎉',
      description: 'You\'re ready to explore ECOBUD! Start completing habits, earn coins, and build a greener world today.',
      pose: 'celebrate',
      mascotPosition: 'center',
      cardVerticalAlign: 'center',
      arrowDirection: 'none',
    },
  ];

  useEffect(() => {
    let pulseAnim: Animated.CompositeAnimation | null = null;
    let particleLoop: Animated.CompositeAnimation | null = null;

    if (visible) {
      setCurrentStep(0);
      if (model?.setCoachMarksCurrentStep) {
        model.setCoachMarksCurrentStep(0);
      }
      if (onTabChange) onTabChange('home');

      Animated.timing(overlayFade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      pulseAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseGlow, {
            toValue: 0.4,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseGlow, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnim.start();

      particleLoop = Animated.loop(
        Animated.timing(particlesAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      particleLoop.start();
    } else {
      Animated.timing(overlayFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (pulseAnim) pulseAnim.stop();
      if (particleLoop) particleLoop.stop();
    };
  }, [visible, overlayFade, particlesAnim, onTabChange]);

  if (!visible) return null;

  const currentStepData = steps[currentStep] || steps[0];

  const animateToStep = (nextIndex: number) => {
    if (isAnimating.current || nextIndex === currentStep) return;
    isAnimating.current = true;
    triggerSelectionHaptic();

    const isForward = nextIndex > currentStep;
    const targetStep = steps[nextIndex];

    // Automatically navigate to the REAL live screen in background
    if (onTabChange && targetStep?.targetTab) {
      onTabChange(targetStep.targetTab);
    }

    // Auto-scroll screen so target card is fully visible and nicely framed
    if (onScrollTo) {
      if (targetStep?.targetTab === 'challenges') {
        // Scroll down smoothly so the entire Discover featured card is comfortably in clear view
        // On small / compact devices, scroll further down so the full card and OPEN button are cleanly exposed
        const challengesScrollOffset = isSmallDevice
          ? verticalScale(370)
          : isCompact
            ? verticalScale(340)
            : verticalScale(310);

        setTimeout(() => {
          onScrollTo(challengesScrollOffset, true);
        }, 120);
      } else if (targetStep?.targetTab === 'learn') {
        // Scroll down smoothly so the entire Learn featured lesson card is comfortably in clear view
        const learnScrollOffset = isSmallDevice
          ? verticalScale(260)
          : isCompact
            ? verticalScale(240)
            : verticalScale(220);

        setTimeout(() => {
          onScrollTo(learnScrollOffset, true);
        }, 120);
      } else {
        onScrollTo(0, true);
      }
    }

    // Step 1: Smoothly fade and slide out current card (snappy 100ms for high responsiveness)
    Animated.parallel([
      Animated.timing(cardFade, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardSlide, {
        toValue: isForward ? -6 : 6,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(mascotSlide, {
        toValue: isForward ? -10 : 10,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Step 2: Switch to next step
      setCurrentStep(nextIndex);
      if (model?.setSpotlightTargetRect) {
        model.setSpotlightTargetRect(null);
      }
      if (model?.setCoachMarksCurrentStep) {
        model.setCoachMarksCurrentStep(nextIndex);
      }
      cardSlide.setValue(isForward ? 6 : -6);
      mascotSlide.setValue(isForward ? 10 : -10);

      // Step 3: Snappy ease-in for new card and mascot
      Animated.parallel([
        Animated.timing(cardFade, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardSlide, {
          toValue: 0,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(mascotSlide, {
          toValue: 0,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    });
  };

  const handleNext = () => {
    if (isAnimating.current) return;
    if (currentStep < steps.length - 1) {
      animateToStep(currentStep + 1);
    } else {
      triggerSuccessHaptic();
      if (onTabChange) onTabChange('home');
      Animated.timing(overlayFade, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }
  };

  const handleBack = () => {
    if (isAnimating.current) return;
    if (currentStep > 0) {
      animateToStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    triggerSelectionHaptic();
    if (onTabChange) onTabChange('home');
    Animated.timing(overlayFade, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (onSkip) onSkip();
      else onFinish();
    });
  };

  const mascotSize = isSmallDevice ? scale(140) : isCompact ? scale(165) : scale(180);

  // Dynamic mascot container alignment based on step pose & position
  const getMascotAlignStyle = () => {
    switch (currentStepData.mascotPosition) {
      case 'left':
        return { alignSelf: 'flex-start', marginLeft: scale(16) };
      case 'right':
        return { alignSelf: 'flex-end', marginRight: scale(16) };
      case 'center':
      default:
        return { alignSelf: 'center' };
    }
  };

  const getContainerJustify = () => {
    switch (currentStepData.cardVerticalAlign) {
      case 'top':
        return 'flex-start';
      case 'bottom':
        return 'flex-end';
      case 'center':
      default:
        return 'center';
    }
  };

  const targetRect = model?.spotlightTargetRect;
  const isMeasured = Boolean(targetRect && targetRect.width > 0 && targetRect.height > 0);

  // Safe fallback if target hasn't reported measurement yet
  const resolvedTarget = targetRect || {
    x: scale(20),
    y: verticalScale(260),
    width: width - scale(40),
    height: verticalScale(60),
    borderRadius: moderateScale(16),
  };

  const targetBorderRadius = resolvedTarget.borderRadius ?? moderateScale(16);

  // Calculate available space above and below the target card within Safe Area
  const safeTop = insets.top || verticalScale(20);
  const safeBottom = height - (insets.bottom || verticalScale(20));
  const estimatedTooltipHeight = verticalScale(195);

  const isStep2 = currentStepData.stepNumber === 2;
  const isStep4 = currentStepData.stepNumber === 4;
  const isStep5 = currentStepData.stepNumber === 5;
  const isStep6 = currentStepData.stepNumber === 6;
  const isTargetBottomRight = isStep2 || isStep4 || isStep5 || isStep6;

  const spaceAbove = resolvedTarget.y - safeTop;
  const spaceBelow = safeBottom - (resolvedTarget.y + resolvedTarget.height);

  // For Steps 2, 4, 5, and 6, we want to put the mascot right below the target, so we need more space below
  const effectiveTooltipSpace = isTargetBottomRight ? estimatedTooltipHeight + mascotSize - verticalScale(20) : estimatedTooltipHeight;
  const placeTooltipBelow = spaceAbove < effectiveTooltipSpace && spaceBelow >= effectiveTooltipSpace;

  const tooltipTop = placeTooltipBelow
    ? resolvedTarget.y + resolvedTarget.height + (isTargetBottomRight ? mascotSize - verticalScale(15) : verticalScale(14))
    : Math.max(safeTop + verticalScale(8), resolvedTarget.y - estimatedTooltipHeight - verticalScale(16));

  // Place mascot so it stands clearly above or below the tooltip, avoiding the target cutout completely
  // For Steps 2, 4, 5, and 6, place it cleanly just below the right side of the target hole
  // Clamped to screen bounds to ensure it's always visible on smaller devices ("hindi na kita" fix)
  const mascotTop = isTargetBottomRight
    ? resolvedTarget.y + resolvedTarget.height + verticalScale(4) // Right below the target hole
    : placeTooltipBelow
      ? Math.min(tooltipTop + estimatedTooltipHeight + verticalScale(4), height - mascotSize - verticalScale(10))
      : Math.max(safeTop + verticalScale(4), tooltipTop - mascotSize - verticalScale(4));

  const cardWidthForMascot = Math.min(width - scale(32), 480);
  const cardLeftForMascot = (width - cardWidthForMascot) / 2;

  const mascotRight = currentStepData.mascotPosition === 'right'
    ? cardLeftForMascot
    : undefined;
  
  const mascotLeft = currentStepData.mascotPosition === 'left'
    ? cardLeftForMascot
    : undefined;

  return (
    <Animated.View style={[styles.backdropHost, { opacity: overlayFade }]} pointerEvents="auto">
      <StatusBar style="light" />

      {/* ── STEP 2, 3, 4, 5 & 6: True Transparent Cutout Spotlight ── */}
      {currentStepData.stepNumber === 2 || currentStepData.stepNumber === 3 || currentStepData.stepNumber === 4 || currentStepData.stepNumber === 5 || currentStepData.stepNumber === 6 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {(() => {
            const holeX = Math.max(0, resolvedTarget.x);
            const holeY = Math.max(0, resolvedTarget.y);
            const holeW = resolvedTarget.width;
            const holeH = resolvedTarget.height;
            const r = targetBorderRadius;

            // Extra outer thickness to cover entire screen around the cutout
            const overlayThickness = Math.max(width, height) * 1.5;

            return (
              <>
                {/* Clean Full-Screen Dimmed Mask with exact Rounded Hole (Tapping advances to next step) */}
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={handleNext}
                  style={{
                    position: 'absolute',
                    left: holeX - overlayThickness,
                    top: holeY - overlayThickness,
                    width: holeW + overlayThickness * 2,
                    height: holeH + overlayThickness * 2,
                    borderRadius: overlayThickness + r,
                    borderWidth: overlayThickness,
                    borderColor: 'rgba(10, 28, 22, 0.72)',
                  }}
                />

                {/* Subtle Pulsing Glowing Border locked exactly around the Hole */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.spotlightCutoutBorder,
                    {
                      left: holeX,
                      top: holeY,
                      width: holeW,
                      height: holeH,
                      borderRadius: r,
                      opacity: pulseGlow,
                    },
                  ]}
                >
                  <View style={styles.cutoutSparkle}>
                    <Ionicons name="sparkles" size={scale(16)} color="#4ADE80" />
                  </View>
                </Animated.View>
              </>
            );
          })()}

          {/* Layer 4: ECOBUD Mascot – positioned cleanly relative to tooltip */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.spotlightMascotWrap,
              {
                top: mascotTop,
                right: mascotRight,
                left: currentStepData.mascotPosition === 'center' ? (width - mascotSize) / 2 : mascotLeft,
                transform: [{ translateX: mascotSlide }],
              },
            ]}
          >
            <LottieView
              key={currentStepData.pose}
              source={MASCOT_SOURCES[currentStepData.pose] || MASCOT_SOURCES.idle}
              autoPlay
              loop
              renderMode="HARDWARE"
              cacheComposition={true}
              hardwareAccelerationAndroid={true}
              style={{ width: mascotSize, height: mascotSize }}
            />
          </Animated.View>

          {/* Layer 5 & 6: Coach Mark Tooltip with Centered Arrow dynamically positioned relative to Cutout Hole */}
          {(() => {
            const cardWidth = Math.min(width - scale(32), 480);
            const cardLeft = (width - cardWidth) / 2;

            return (
              <Animated.View
                style={[
                  styles.spotlightTooltipCard,
                  {
                    top: tooltipTop,
                    left: cardLeft,
                    width: cardWidth,
                    opacity: cardFade,
                    transform: [{ translateY: cardSlide }],
                  },
                ]}
              >
                {/* Arrow pointing UP when tooltip is below target */}
                {placeTooltipBelow && (
                  <View style={[styles.tooltipArrowUp, isDark && { borderBottomColor: theme.colors.card }]} />
                )}

                {/* Tooltip Content Body */}
                <View
                  style={[
                    styles.tooltipInner,
                    isDark && {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.cardBorder,
                      borderWidth: 1,
                    },
                  ]}
                >
                  {/* Step Badge + Settings Icon */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>
                        STEP {currentStepData.stepNumber} OF {currentStepData.totalSteps}
                      </Text>
                    </View>
                    <View style={[styles.cardSettingsIconWrap, isDark && { backgroundColor: theme.colors.surfaceMuted }]}>
                      <Ionicons name="settings-sharp" size={scale(15)} color={isDark ? theme.colors.textMuted : '#9CA3AF'} />
                    </View>
                  </View>

                  <Text style={[styles.tooltipTitle, isDark && { color: theme.colors.textPrimary }]}>
                    {currentStepData.title} {currentStepData.titleIcon || ''}
                  </Text>
                  <Text style={[styles.tooltipDesc, isDark && { color: theme.colors.textMuted }]}>
                    {currentStepData.description}
                  </Text>

                  {/* Navigation Buttons */}
                  <View style={styles.tooltipBtnsRow}>
                    <TouchableOpacity
                      onPress={handleBack}
                      activeOpacity={0.7}
                      style={[styles.backBtn, isDark && { backgroundColor: theme.colors.surfaceMuted }]}
                    >
                      <Text style={[styles.backBtnText, isDark && { color: theme.colors.textPrimary }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleNext} activeOpacity={0.88} style={styles.nextBtn}>
                      <Text style={styles.nextBtnText}>Next</Text>
                      <Ionicons name="arrow-forward" size={scale(14)} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Arrow pointing DOWN when tooltip is above target */}
                {!placeTooltipBelow && (
                  <View style={[styles.tooltipArrowBottom, isDark && { borderTopColor: theme.colors.card }]} />
                )}
              </Animated.View>
            );
          })()}
        </View>
      ) : (
        /* ─── ALL OTHER STEPS: Standard Dimmed Overlay Layout ─── */
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleNext}
          style={styles.standardDimmedBackdrop}
        >
          {/* Full-Screen Celebration Confetti for final step */}
          {currentStepData.stepNumber === 7 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <LottieView
                source={require('../../../assets/Celebrate.lottie')}
                autoPlay
                loop
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            </View>
          )}
          <SafeAreaView
            style={[
              styles.container,
              {
                justifyContent: getContainerJustify() as any,
                paddingTop: currentStepData.cardVerticalAlign === 'center' ? 0 : verticalScale(20),
                paddingBottom: currentStepData.cardVerticalAlign === 'center' ? 0 : verticalScale(30),
              },
            ]}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.contentWrap,
                currentStepData.cardVerticalAlign === 'center' ? { justifyContent: 'center' } : {},
              ]}
              pointerEvents="box-none"
            >
              {/* Mascot above card */}
              {currentStepData.arrowDirection === 'top' && (
                <Animated.View
                  style={[
                    styles.mascotContainer,
                    getMascotAlignStyle() as any,
                    {
                      transform: [{ translateX: mascotSlide }],
                      marginBottom: verticalScale(10),
                      zIndex: 20,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <LottieView
                    key={currentStepData.pose}
                    source={MASCOT_SOURCES[currentStepData.pose] || MASCOT_SOURCES.idle}
                    autoPlay
                    loop
                    renderMode="HARDWARE"
                    cacheComposition={true}
                    hardwareAccelerationAndroid={true}
                    style={{ width: mascotSize, height: mascotSize }}
                  />
                </Animated.View>
              )}

              {/* Main Speech / Prompt Card */}
              <Animated.View
                style={[
                  styles.speechCard,
                  { opacity: cardFade, transform: [{ translateY: cardSlide }] },
                  isDark && {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.cardBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                {/* Top Row: Step Pill Header + Settings Icon */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>
                      STEP {currentStepData.stepNumber} OF {currentStepData.totalSteps}
                    </Text>
                  </View>
                  <View style={[styles.cardSettingsIconWrap, isDark && { backgroundColor: theme.colors.surfaceMuted }]}>
                    <Ionicons name="settings-sharp" size={scale(15)} color={isDark ? theme.colors.textMuted : '#9CA3AF'} />
                  </View>
                </View>

                <Text style={[styles.cardTitle, isDark && { color: theme.colors.textPrimary }]}>
                  {currentStepData.title} {currentStepData.titleIcon || ''}
                </Text>
                <Text style={[styles.cardDesc, isDark && { color: theme.colors.textMuted }]}>{currentStepData.description}</Text>

                {currentStepData.stepNumber === 7 ? (
                  <TouchableOpacity onPress={handleNext} activeOpacity={0.88} style={styles.startExploringBtn}>
                    <Text style={styles.startExploringBtnText}>Start Exploring EcoBud</Text>
                    <Ionicons name="arrow-forward" size={scale(18)} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.buttonsRow}>
                    {currentStep === 0 ? (
                      <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipBtn}>
                        <Text style={[styles.skipBtnText, isDark && { color: theme.colors.textMuted }]}>Skip</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={handleBack}
                        activeOpacity={0.7}
                        style={[styles.backBtn, isDark && { backgroundColor: theme.colors.surfaceMuted }]}
                      >
                        <Text style={[styles.backBtnText, isDark && { color: theme.colors.textPrimary }]}>Back</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleNext} activeOpacity={0.88} style={styles.nextBtn}>
                      <Text style={styles.nextBtnText}>Next</Text>
                      <Ionicons name="arrow-forward" size={scale(15)} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Arrow indicators */}
                {currentStepData.arrowDirection === 'top' && (
                  <View
                    style={[
                      styles.speechArrowTop,
                      isDark && { borderBottomColor: theme.colors.card },
                      currentStepData.mascotPosition === 'left'
                        ? { left: scale(50), alignSelf: 'flex-start' }
                        : currentStepData.mascotPosition === 'right'
                          ? { right: scale(50), alignSelf: 'flex-end' }
                          : { alignSelf: 'center' },
                    ]}
                  />
                )}
                {currentStepData.arrowDirection === 'bottom' && (
                  <View
                    style={[
                      styles.speechArrowBottom,
                      isDark && { borderTopColor: theme.colors.card },
                      currentStepData.mascotPosition === 'left'
                        ? { left: scale(50), alignSelf: 'flex-start' }
                        : currentStepData.mascotPosition === 'right'
                          ? { right: scale(50), alignSelf: 'flex-end' }
                          : { alignSelf: 'center' },
                    ]}
                  />
                )}
              </Animated.View>

              {/* Mascot below card */}
              {currentStepData.arrowDirection !== 'top' && (
                <Animated.View
                  style={[
                    styles.mascotContainer,
                    getMascotAlignStyle() as any,
                    currentStepData.cardVerticalAlign === 'center'
                      ? {
                          marginTop: verticalScale(16),
                          zIndex: 25,
                        }
                      : { marginTop: verticalScale(10) },
                    { transform: [{ translateX: mascotSlide }] },
                  ]}
                  pointerEvents="none"
                >
                  <LottieView
                    key={currentStepData.pose}
                    source={MASCOT_SOURCES[currentStepData.pose] || MASCOT_SOURCES.idle}
                    autoPlay
                    loop
                    renderMode="HARDWARE"
                    cacheComposition={true}
                    hardwareAccelerationAndroid={true}
                    style={{
                      width: mascotSize,
                      height: mascotSize,
                    }}
                  />
                </Animated.View>
              )}

            </View>
          </SafeAreaView>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdropHost: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  standardDimmedBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 28, 22, 0.68)',
  },

  /* ── Step 2 Cutout & Tooltip Overlay Elements ── */
  spotlightCutoutBorder: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#4ADE80',
    shadowColor: '#4ADE80',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 10000,
  },
  cutoutSparkle: {
    position: 'absolute',
    top: -12,
    right: 8,
  },
  spotlightMascotWrap: {
    position: 'absolute',
    zIndex: 10001,
  },
  spotlightTooltipCard: {
    position: 'absolute',
    zIndex: 10002,
  },
  tooltipArrowUp: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  tooltipArrowBottom: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -1,
  },
  tooltipInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(22),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(16),
    paddingHorizontal: scale(18),
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: verticalScale(5) },
    elevation: 10,
  },
  tooltipTitle: {
    fontSize: responsiveFontSize(19),
    fontWeight: '900',
    color: '#1A211D',
    textAlign: 'center',
    marginBottom: verticalScale(6),
  },
  tooltipDesc: {
    fontSize: responsiveFontSize(13),
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: moderateScale(19),
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(4),
  },
  tooltipBtnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  /* ── General Component Styles ── */
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingBottom: verticalScale(30),
    paddingTop: verticalScale(20),
  },
  contentWrap: {
    width: '92%',
    maxWidth: 390,
    alignItems: 'center',
  },
  speechCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(24),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(16),
    paddingHorizontal: scale(18),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: verticalScale(6) },
    elevation: 8,
    position: 'relative',
    zIndex: 10,
    marginVertical: verticalScale(6),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    marginBottom: verticalScale(8),
  },
  stepBadge: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(14),
  },
  cardSettingsIconWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(11),
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: responsiveFontSize(20),
    fontWeight: '900',
    color: '#1A211D',
    textAlign: 'center',
    marginBottom: verticalScale(6),
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: responsiveFontSize(13),
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: moderateScale(19),
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(4),
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: verticalScale(2),
  },
  skipBtn: {
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
  },
  skipBtnText: {
    fontSize: responsiveFontSize(13.5),
    fontWeight: '700',
    color: '#6B7280',
  },
  backBtn: {
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
  },
  backBtnText: {
    fontSize: responsiveFontSize(13.5),
    fontWeight: '700',
    color: '#6B7280',
  },
  nextBtn: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(14),
    shadowColor: '#16A34A',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: verticalScale(2) },
    elevation: 3,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: '800',
  },
  startExploringBtn: {
    width: '100%',
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: verticalScale(13),
    borderRadius: moderateScale(16),
    shadowColor: '#16A34A',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: verticalScale(3) },
    elevation: 4,
    marginTop: verticalScale(2),
  },
  startExploringBtnText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(15.5),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  speechArrowTop: {
    position: 'absolute',
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    alignSelf: 'center',
  },
  speechArrowBottom: {
    position: 'absolute',
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    alignSelf: 'center',
  },
  mascotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animatedParticle: {
    position: 'absolute',
    top: 40,
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    elevation: 4,
  },
  celebrateBadgeEmoji: {
    fontSize: responsiveFontSize(14),
  },
  celebrateBadgeText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '900',
    color: '#1A211D',
  },
});
