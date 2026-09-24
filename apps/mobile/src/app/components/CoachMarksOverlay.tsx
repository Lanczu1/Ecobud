import React, { useRef, useEffect, useState, useSyncExternalStore } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { coachMarkSpotlightStore } from '../utils/coachMarkSpotlightStore';
import type { AppTab, EcoBudMobileModel } from '../types/home';

export type MascotPose = 'wave' | 'idle' | 'left_point' | 'right_point' | 'celebrate';

const MASCOT_SOURCES: Record<MascotPose, any> = {
  wave: require('../../../assets/Ecobud Mascot/New Lottie files/Wave.lottie'),
  right_point: require('../../../assets/Ecobud Mascot/New Lottie files/Right Point.lottie'),
  idle: require('../../../assets/Ecobud Mascot/New Lottie files/Idle.lottie'),
  left_point: require('../../../assets/Ecobud Mascot/New Lottie files/Left Point.lottie'),
  celebrate: require('../../../assets/Ecobud Mascot/New Lottie files/Celebrate.lottie'),
};

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export interface CoachMarksOverlayProps {
  visible: boolean;
  replay?: boolean;
  onFinish: () => void;
  onSkip?: () => void;
  initialStep?: number;
  activeTab?: AppTab;
  onTabChange?: (tab: AppTab) => void;
  onScrollTo?: (y: number, animated?: boolean) => void;
  onScrollBy?: (delta: number, animated?: boolean) => void;
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
  replay = false,
  onFinish,
  onSkip,
  initialStep = 0,
  activeTab,
  onTabChange,
  onScrollTo,
  onScrollBy,
  model,
}: CoachMarksOverlayProps) {
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [pendingRevealStep, setPendingRevealStep] = useState<number | null>(null);
  const spotlightTargetRect = useSyncExternalStore(coachMarkSpotlightStore.subscribe, coachMarkSpotlightStore.getSnapshot);

  const isSmallDevice = height <= 680 || width < 375;
  const isCompact = height < 750 || width < 380;

  // Animation values
  const overlayFade = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const mascotFade = useRef(new Animated.Value(1)).current;
  const mascotSlide = useRef(new Animated.Value(0)).current;
  const nextPressScale = useRef(new Animated.Value(1)).current;
  const backPressScale = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealScheduled = useRef(false);
  const pendingReveal = useRef<{ step: number; show: () => void } | null>(null);

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
    if (visible) {
      coachMarkSpotlightStore.set(null);
      isAnimating.current = false;
      pendingReveal.current = null;
      revealScheduled.current = false;
      setPendingRevealStep(null);
      cardFade.setValue(1);
      cardSlide.setValue(0);
      mascotFade.setValue(1);
      mascotSlide.setValue(0);
      nextPressScale.setValue(1);
      backPressScale.setValue(1);
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

    } else {
      coachMarkSpotlightStore.set(null);
      Animated.timing(overlayFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (revealTimer.current !== null) {
        clearTimeout(revealTimer.current);
        revealTimer.current = null;
      }
    };
  }, [visible, overlayFade, cardFade, cardSlide, mascotFade, mascotSlide, nextPressScale, backPressScale, onTabChange]);

  useEffect(() => {
    const pending = pendingReveal.current;
    if (!visible || !replay || !pending || pending.step !== currentStep ||
        activeTab !== steps[currentStep]?.targetTab) return;

    const needsTarget = currentStep >= 1 && currentStep <= 5;
    if (needsTarget && !spotlightTargetRect) return;
    if (revealScheduled.current) return;

    revealScheduled.current = true;
    if (revealTimer.current !== null) clearTimeout(revealTimer.current);
    if (pendingReveal.current !== pending) return;
    pendingReveal.current = null;
    setPendingRevealStep(null);
    pending.show();
  }, [visible, replay, currentStep, activeTab, spotlightTargetRect]);

  if (!visible) return null;

  const currentStepData = steps[currentStep] || steps[0];

  const animateButton = (value: Animated.Value, pressed: boolean) => {
    Animated.spring(value, {
      toValue: pressed ? 0.96 : 1,
      stiffness: 320,
      damping: 24,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  };

  const animateToStep = (nextIndex: number) => {
    if (isAnimating.current || nextIndex === currentStep) return;
    isAnimating.current = true;
    if (revealTimer.current !== null) clearTimeout(revealTimer.current);
    pendingReveal.current = null;
    revealScheduled.current = false;
    triggerSelectionHaptic();

    const isForward = nextIndex > currentStep;
    const targetStep = steps[nextIndex];

    // Automatically navigate to the REAL live screen in background
    if (!replay && onTabChange && targetStep?.targetTab) {
      onTabChange(targetStep.targetTab);
    }

    // Reset the shared scroll view; the Challenges and Learn lists scroll their own measured cards.
    if (onScrollTo && !replay) {
      if (targetStep?.targetTab !== 'challenges' && targetStep?.targetTab !== 'learn') {
        onScrollTo(0, true);
      }
    } else if (onScrollTo && targetStep?.targetTab !== 'challenges' && targetStep?.targetTab !== 'learn') {
      onScrollTo(0, true);
    }

    // Keep card and mascot movement on the native animation driver.
    Animated.parallel([
      Animated.timing(cardFade, {
        toValue: 0,
        duration: 100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardSlide, {
        toValue: isForward ? -18 : 18,
        duration: 100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(mascotFade, {
        toValue: 0,
        duration: 100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(mascotSlide, {
        toValue: isForward ? -16 : 16,
        duration: 100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        isAnimating.current = false;
        return;
      }

      // Step 2: Switch to next step
      if (model?.setSpotlightTargetRect) {
        model.setSpotlightTargetRect(null);
      }
      if (replay && onTabChange && targetStep?.targetTab) {
        onTabChange(targetStep.targetTab);
      }
      setCurrentStep(nextIndex);
      if (model?.setCoachMarksCurrentStep) {
        model.setCoachMarksCurrentStep(nextIndex);
      }
      cardSlide.setValue(isForward ? 18 : -18);
      mascotSlide.setValue(isForward ? 16 : -16);

      const fadeIn = () => Animated.parallel([
        Animated.timing(cardFade, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardSlide, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(mascotFade, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(mascotSlide, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });

      if (replay && nextIndex !== steps.length - 1) {
        const pending = { step: nextIndex, show: fadeIn };
        pendingReveal.current = pending;
        setPendingRevealStep(nextIndex);
        revealTimer.current = setTimeout(() => {
          revealTimer.current = null;
          if (pendingReveal.current !== pending) return;
          pendingReveal.current = null;
          setPendingRevealStep(null);
          fadeIn();
        }, nextIndex === 3 || nextIndex === 4 ? 450 : 220);
      } else {
        fadeIn();
      }
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

  const targetRect = spotlightTargetRect;
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
  const isStep2 = currentStepData.stepNumber === 2;
  const isStep4 = currentStepData.stepNumber === 4;
  const isStep5 = currentStepData.stepNumber === 5;
  const isStep6 = currentStepData.stepNumber === 6;
  const estimatedTooltipHeight = verticalScale(isStep4 || isStep5 ? (width < 360 ? 245 : 225) : 195);
  const isTargetBottomRight = isStep2 || isStep6;

  const spaceAbove = resolvedTarget.y - safeTop;
  const spaceBelow = safeBottom - (resolvedTarget.y + resolvedTarget.height);

  // Steps 2 and 6 reserve space below the target for the mascot.
  const effectiveTooltipSpace = isTargetBottomRight ? estimatedTooltipHeight + mascotSize - verticalScale(20) : estimatedTooltipHeight;
  const placeTooltipBelow = spaceAbove < effectiveTooltipSpace && spaceBelow >= effectiveTooltipSpace;

  const tooltipTop = placeTooltipBelow
    ? resolvedTarget.y + resolvedTarget.height + (isTargetBottomRight ? mascotSize - verticalScale(15) : verticalScale(14))
    : Math.max(safeTop + verticalScale(8), resolvedTarget.y - estimatedTooltipHeight - verticalScale(16));

  const isBottomRightMascot = isStep4 || isStep5;
  const spotlightMascotSize = isBottomRightMascot
    ? Math.min(isSmallDevice ? 108 : 132, width * 0.3, height * 0.18)
    : mascotSize;

  // Place mascot so it stands clearly above or below the tooltip, avoiding the target cutout completely
  // Steps 4 and 5 anchor the mascot above the bottom navigation.
  // Clamped to screen bounds to ensure it's always visible on smaller devices ("hindi na kita" fix)
  const mascotTop = isBottomRightMascot
    ? Math.max(safeTop, safeBottom - verticalScale(88) - spotlightMascotSize)
    : isTargetBottomRight
    ? resolvedTarget.y + resolvedTarget.height + verticalScale(4) // Right below the target hole
    : placeTooltipBelow
      ? Math.min(tooltipTop + estimatedTooltipHeight + verticalScale(4), height - spotlightMascotSize - verticalScale(10))
      : Math.max(safeTop + verticalScale(4), tooltipTop - spotlightMascotSize - verticalScale(4));

  const cardWidthForMascot = Math.min(width - scale(32), 480);
  const cardLeftForMascot = (width - cardWidthForMascot) / 2;

  const mascotRight = currentStepData.mascotPosition === 'right'
    ? isBottomRightMascot ? Math.max(scale(16), cardLeftForMascot) : cardLeftForMascot
    : undefined;
  
  const mascotLeft = currentStepData.mascotPosition === 'left'
    ? cardLeftForMascot
    : undefined;

  return (
    <Animated.View style={[styles.backdropHost, { opacity: overlayFade }]} pointerEvents="auto">
      <StatusBar style="light" />

      {replay && pendingRevealStep !== null ? (
        <View style={styles.standardDimmedBackdrop} />
      ) : (
      <>

      {/* ── STEP 2, 3, 4, 5 & 6: True Transparent Cutout Spotlight ── */}
      {currentStepData.stepNumber === 2 || currentStepData.stepNumber === 3 || currentStepData.stepNumber === 4 || currentStepData.stepNumber === 5 || currentStepData.stepNumber === 6 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {(() => {
            const holeX = Math.max(0, resolvedTarget.x);
            const holeY = Math.max(0, resolvedTarget.y);
            const holeW = resolvedTarget.width;
            const holeH = resolvedTarget.height;
            const r = targetBorderRadius;

            const radius = Math.max(0, Math.min(r, holeW / 2, holeH / 2));
            const holePath = `M ${holeX + radius} ${holeY} H ${holeX + holeW - radius} Q ${holeX + holeW} ${holeY} ${holeX + holeW} ${holeY + radius} V ${holeY + holeH - radius} Q ${holeX + holeW} ${holeY + holeH} ${holeX + holeW - radius} ${holeY + holeH} H ${holeX + radius} Q ${holeX} ${holeY + holeH} ${holeX} ${holeY + holeH - radius} V ${holeY + radius} Q ${holeX} ${holeY} ${holeX + radius} ${holeY} Z`;

            return (
              <>
                {/* Full-screen mask with a rounded spotlight cutout. */}
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={handleNext}
                  style={StyleSheet.absoluteFill}
                >
                  <Svg width={width} height={height} pointerEvents="none">
                    <Path
                      d={`M 0 0 H ${width} V ${height} H 0 Z ${holePath}`}
                      fill="rgba(10, 28, 22, 0.72)"
                      fillRule="evenodd"
                    />
                  </Svg>
                </TouchableOpacity>

                <View
                  pointerEvents="none"
                  style={[
                    styles.spotlightCutoutBorder,
                    {
                      left: holeX,
                      top: holeY,
                      width: holeW,
                      height: holeH,
                      borderRadius: r,
                      shadowOpacity: replay && (isStep4 || isStep5) ? 0 : 1,
                    },
                  ]}
                >
                  <View style={styles.cutoutSparkle}>
                    <Ionicons name="sparkles" size={scale(16)} color="#4ADE80" />
                  </View>
                </View>
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
                left: currentStepData.mascotPosition === 'center' ? (width - spotlightMascotSize) / 2 : mascotLeft,
                opacity: mascotFade,
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
              style={{ width: spotlightMascotSize, height: spotlightMascotSize }}
            />
          </Animated.View>

          {/* Layer 5 & 6: Coach Mark Tooltip with Centered Arrow dynamically positioned relative to Cutout Hole */}
          {(() => {
            const targetCardStep = isStep4 || isStep5;
            const cardWidth = targetCardStep && isMeasured
              ? Math.min(width - scale(32), 480, Math.max(scale(280), resolvedTarget.width))
              : Math.min(width - scale(32), 480);
            const cardLeft = targetCardStep && isMeasured
              ? Math.max(scale(16), Math.min(resolvedTarget.x, width - cardWidth - scale(16)))
              : (width - cardWidth) / 2;
            const arrowLeft = targetCardStep && isMeasured
              ? Math.max(scale(18), Math.min(resolvedTarget.x + resolvedTarget.width / 2 - cardLeft - 12, cardWidth - scale(42)))
              : undefined;
            const alignedArrow = arrowLeft === undefined ? undefined : { alignSelf: 'flex-start' as const, marginLeft: arrowLeft };

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
                  <View style={[styles.tooltipArrowUp, isDark && { borderBottomColor: theme.colors.card }, alignedArrow]} />
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
                  {/* Step badge */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>
                        STEP {currentStepData.stepNumber} OF {currentStepData.totalSteps}
                      </Text>
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
                    <AnimatedTouchableOpacity
                      onPress={handleBack}
                      onPressIn={() => animateButton(backPressScale, true)}
                      onPressOut={() => animateButton(backPressScale, false)}
                      activeOpacity={0.7}
                      style={[styles.backBtn, isDark && { backgroundColor: theme.colors.surfaceMuted }, { transform: [{ scale: backPressScale }] }]}
                    >
                      <Text style={[styles.backBtnText, isDark && { color: theme.colors.textPrimary }]}>Back</Text>
                    </AnimatedTouchableOpacity>
                    <AnimatedTouchableOpacity onPress={handleNext}
                      onPressIn={() => animateButton(nextPressScale, true)}
                      onPressOut={() => animateButton(nextPressScale, false)}
                      activeOpacity={0.88} style={[styles.nextBtn, { transform: [{ scale: nextPressScale }] }]}>
                      <Text style={styles.nextBtnText}>Next</Text>
                      <Ionicons name="arrow-forward" size={scale(14)} color="#FFF" />
                    </AnimatedTouchableOpacity>
                  </View>
                </View>

                {/* Arrow pointing DOWN when tooltip is above target */}
                {!placeTooltipBelow && (
                  <View style={[styles.tooltipArrowBottom, isDark && { borderTopColor: theme.colors.card }, alignedArrow]} />
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
                      opacity: mascotFade,
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
                {/* Step badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>
                      STEP {currentStepData.stepNumber} OF {currentStepData.totalSteps}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.cardTitle, isDark && { color: theme.colors.textPrimary }]}>
                  {currentStepData.title} {currentStepData.titleIcon || ''}
                </Text>
                <Text style={[styles.cardDesc, isDark && { color: theme.colors.textMuted }]}>{currentStepData.description}</Text>

                {currentStepData.stepNumber === 7 ? (
                  <AnimatedTouchableOpacity onPress={handleNext}
                    onPressIn={() => animateButton(nextPressScale, true)}
                    onPressOut={() => animateButton(nextPressScale, false)}
                    activeOpacity={0.88} style={[styles.startExploringBtn, { transform: [{ scale: nextPressScale }] }]}>
                    <Text style={styles.startExploringBtnText}>Start Exploring EcoBud</Text>
                    <Ionicons name="arrow-forward" size={scale(18)} color="#FFFFFF" />
                  </AnimatedTouchableOpacity>
                ) : (
                  <View style={styles.buttonsRow}>
                    {currentStep === 0 ? (
                      <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipBtn}>
                        <Text style={[styles.skipBtnText, isDark && { color: theme.colors.textMuted }]}>Skip</Text>
                      </TouchableOpacity>
                    ) : (
                      <AnimatedTouchableOpacity
                        onPress={handleBack}
                        onPressIn={() => animateButton(backPressScale, true)}
                        onPressOut={() => animateButton(backPressScale, false)}
                        activeOpacity={0.7}
                        style={[styles.backBtn, isDark && { backgroundColor: theme.colors.surfaceMuted }, { transform: [{ scale: backPressScale }] }]}
                      >
                        <Text style={[styles.backBtnText, isDark && { color: theme.colors.textPrimary }]}>Back</Text>
                      </AnimatedTouchableOpacity>
                    )}
                    <AnimatedTouchableOpacity onPress={handleNext}
                      onPressIn={() => animateButton(nextPressScale, true)}
                      onPressOut={() => animateButton(nextPressScale, false)}
                      activeOpacity={0.88} style={[styles.nextBtn, { transform: [{ scale: nextPressScale }] }]}>
                      <Text style={styles.nextBtnText}>Next</Text>
                      <Ionicons name="arrow-forward" size={scale(15)} color="#FFFFFF" />
                    </AnimatedTouchableOpacity>
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
                    { opacity: mascotFade, transform: [{ translateX: mascotSlide }] },
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
      </>
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
