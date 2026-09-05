import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  StyleSheet,
  Pressable,
  Easing,
  TextInput,
  ImageBackground,
  StyleProp,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/appStyles';
import { ecoTheme, useTheme } from '../../shared/theme/ecoTheme';
import { LoadingGlyph, LoadingScreenVisual } from '../../shared/ui/OptimizedLoading';
import { AppTab, EcoBadge, EcoBudMobileModel } from '../types/home';
import { initialsFromLabel, usePressScale, resolveMediaUrl } from '../utils/appUtils';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { triggerSelectionHaptic, triggerWarningHaptic } from '../utils/haptics';
import LottieView from 'lottie-react-native';
import { Header } from './Header';

export function ChatbotFAB({
  onPress,
  onLongPress,
}: {
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { theme, isDark } = useTheme();

  // Responsive device classifications
  const isSmallDevice = screenWidth < 375 || screenHeight <= 680;
  const isLargeDevice = screenWidth >= 600 || screenHeight >= 900;
  const { scale: pressScale, onPressIn, onPressOut } = usePressScale(0.92);

  // Dynamic sizing derived directly from screen dimensions via responsive scaling:
  // Base scale is 108dp, scaled by device density and capped gracefully on tablets
  const mascotSize = scale(isSmallDevice ? 94 : isLargeDevice ? 130 : 108);

  // Dynamic bottom offset calculated from tab bar height (64) + safe area insets + responsive clearance
  const bottomBarHeight = verticalScale(64);
  const bottomOffset = insets.bottom + bottomBarHeight + verticalScale(12);

  // Max width of speech bubble dynamically bound to screen width (never overflows)
  const bubbleMaxWidth = Math.min(screenWidth * 0.58, scale(220));

  // Animated values for speech bubble (fade + gentle float up/down)
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleTranslateY = useRef(new Animated.Value(6)).current;
  // Continuous gentle breathing animation (gentle scale + vertical hover)
  const breathAnim = useRef(new Animated.Value(0)).current;

  // Continuous breathing loop (syncs with mascot's idle rhythm)
  useEffect(() => {
    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breathingLoop.start();

    return () => {
      breathingLoop.stop();
    };
  }, [breathAnim]);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const runCycle = () => {
      if (!isMounted) return;

      // Animate IN (show)
      Animated.parallel([
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(bubbleTranslateY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Stay visible for 5 seconds, then animate OUT (show off)
      timer = setTimeout(() => {
        if (!isMounted) return;

        Animated.parallel([
          Animated.timing(bubbleOpacity, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bubbleTranslateY, {
            toValue: 6,
            duration: 320,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Stay hidden for 5 seconds before showing again
          if (isMounted) {
            timer = setTimeout(runCycle, 5000);
          }
        });
      }, 5000);
    };

    // Initial brief delay before first entrance
    const initialDelay = setTimeout(runCycle, 1200);

    return () => {
      isMounted = false;
      if (initialDelay) clearTimeout(initialDelay);
      if (timer) clearTimeout(timer);
    };
  }, [bubbleOpacity, bubbleTranslateY]);

  // Interpolated breathing transforms
  const breathScale = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.028], // subtle gentle pulse
  });

  const breathHover = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3.5], // gentle float up and down
  });

  const handleLongPress = () => {
    triggerWarningHaptic();
    Alert.alert(
      'Remove Chatbot?',
      'Do you want to remove the chatbot mascot from your screen? You can turn it back on anytime in your Profile page.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            if (onLongPress) {
              onLongPress();
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.chatbotFabOuter,
        {
          bottom: bottomOffset,
          right: scale(16),
        },
        { transform: [{ scale: pressScale }] },
      ]}
    >
      {/* Speech Bubble: Positioned on the TOP-LEFT of the Mascot with breathing effect */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: mascotSize * 0.52,
          right: mascotSize * 0.55,
          maxWidth: bubbleMaxWidth,
          opacity: bubbleOpacity,
          transform: [
            { translateY: Animated.add(bubbleTranslateY, breathHover) },
            { scale: breathScale },
          ],
          zIndex: 10,
        }}
      >
        <View
          style={{
            backgroundColor: isDark ? '#111D17' : '#FFFFFF',
            borderRadius: moderateScale(18),
            borderBottomRightRadius: moderateScale(4),
            paddingHorizontal: scale(14),
            paddingTop: verticalScale(9),
            paddingBottom: verticalScale(10),
            borderWidth: 1.5,
            borderColor: isDark ? 'rgba(74, 222, 128, 0.45)' : 'rgba(16, 185, 129, 0.28)',
            shadowColor: '#0E5A35',
            shadowOpacity: isDark ? 0.45 : 0.16,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          {/* Top Pill / Badge row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: verticalScale(5),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: isDark ? 'rgba(74, 222, 128, 0.15)' : '#ECFDF5',
                paddingHorizontal: scale(7),
                paddingVertical: verticalScale(2),
                borderRadius: moderateScale(10),
              }}
            >
              <Ionicons name="sparkles" size={scale(10)} color={isDark ? '#4ADE80' : '#059669'} />
              <Text
                style={{
                  fontSize: responsiveFontSize(isSmallDevice ? 9.5 : 10.5),
                  fontWeight: '800',
                  color: isDark ? '#4ADE80' : '#047857',
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                EcoBud AI
              </Text>
            </View>

            {/* Online pulsing indicator */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <View
                style={{
                  width: scale(6),
                  height: scale(6),
                  borderRadius: scale(3),
                  backgroundColor: '#10B981',
                }}
              />
              <Text
                style={{
                  fontSize: responsiveFontSize(isSmallDevice ? 9 : 10),
                  fontWeight: '600',
                  color: isDark ? '#6EE7B7' : '#059669',
                }}
              >
                Online
              </Text>
            </View>
          </View>

          {/* Main Conversational Text */}
          <Text
            style={{
              fontSize: responsiveFontSize(isSmallDevice ? 12.5 : 13.5),
              lineHeight: responsiveFontSize(isSmallDevice ? 17 : 19),
              fontWeight: '700',
              color: isDark ? '#F9FAFB' : '#111827',
              letterSpacing: -0.1,
            }}
          >
            Hi! I’m Ecobud.{' '}
            <Text
              style={{
                fontWeight: '500',
                color: isDark ? '#9CA3AF' : '#4B5563',
              }}
            >
              How can I help?
            </Text>
          </Text>
        </View>

        {/* Bubble Pointer Tail pointing toward Mascot */}
        <View
          style={{
            alignSelf: 'flex-end',
            marginRight: scale(18),
            width: 0,
            height: 0,
            borderTopWidth: verticalScale(8),
            borderTopColor: isDark ? '#111D17' : '#FFFFFF',
            borderLeftWidth: scale(7),
            borderLeftColor: 'transparent',
            borderRightWidth: scale(3),
            borderRightColor: 'transparent',
            marginTop: -0.5,
          }}
        />
      </Animated.View>

      {/* Interactive Mascot FAB */}
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={450}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.chatbotFab}
        accessibilityLabel="Chat with EcoBud AI. Hold to remove mascot."
        accessibilityRole="button"
      >
        <LottieView
          source={require('../../../assets/Ecobud Mascot/New Lottie files/Wave.lottie')}
          autoPlay
          loop
          renderMode="HARDWARE"
          cacheComposition={true}
          hardwareAccelerationAndroid={true}
          style={{ width: mascotSize, height: mascotSize }}
        />
      </Pressable>
    </Animated.View>
  );
}

export function EcobudActionOverlay({ label }: { label: string }) {
  return (
    <LoadingScreenVisual
      label={label}
      message="Optimized for smoother loading on older and newer Android devices."
    />
  );
}

export function ActionOverlayWrapper({ visible, label }: { visible: boolean; label: string }) {
  const [renderVisible, setRenderVisible] = React.useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  React.useEffect(() => {
    if (visible) {
      setRenderVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setRenderVisible(false);
        }
      });
    }
  }, [visible, opacity]);

  if (!renderVisible) return null;

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, elevation: 9999 }, { opacity }]}>
      <EcobudActionOverlay label={label} />
    </Animated.View>
  );
}

export function AiAssistantBar({
  onPress,
  placeholder = 'Ask EcoBud AI a question...',
  badgeText = 'AI',
  style,
}: {
  onPress: () => void;
  placeholder?: string;
  badgeText?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.card,
          borderRadius: moderateScale(22),
          paddingHorizontal: scale(16),
          paddingVertical: verticalScale(10),
          marginBottom: verticalScale(16),
          minHeight: verticalScale(50),
          shadowColor: '#126027',
          shadowOpacity: isDark ? 0.2 : 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
          borderWidth: 1,
          borderColor: theme.colors.cardBorder,
        },
        style,
      ]}
    >
      <View
        style={{
          width: scale(32),
          height: scale(32),
          borderRadius: scale(16),
          backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="sparkles" size={scale(16)} color={isDark ? theme.colors.primary : '#126027'} />
      </View>
      <Text
        style={{
          flex: 1,
          marginLeft: scale(10),
          fontSize: responsiveFontSize(14),
          color: theme.colors.textSecondary,
          fontWeight: '600',
        }}
        numberOfLines={1}
      >
        {placeholder}
      </Text>
      <View
        style={{
          backgroundColor: isDark ? theme.colors.surfaceMuted : '#EDF6F1',
          paddingHorizontal: scale(10),
          paddingVertical: verticalScale(4),
          borderRadius: moderateScale(12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Text style={{ color: isDark ? theme.colors.primary : '#126027', fontSize: responsiveFontSize(11), fontWeight: '800' }}>
          {badgeText}
        </Text>
        <Ionicons name="chevron-forward" size={scale(12)} color={isDark ? theme.colors.primary : '#126027'} />
      </View>
    </TouchableOpacity>
  );
}

export function TopNavbar({
  model,
  title,
  showBack,
  onBack,
  showAssistantInHeader,
}: {
  model: EcoBudMobileModel;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showAssistantInHeader?: boolean;
}) {
  // The user requested to remove the sparkle icon (AI assistant) from the top navigation header on all screens, 
  // since the new floating Chatbot FAB handles this access point.
  const shouldShowAssistantInHeader = showAssistantInHeader !== undefined ? showAssistantInHeader : false;

  return (
    <Header
      userDisplayName={model.userDisplayName}
      userAvatarUrl={model.profile?.profile?.avatarUrl || model.session?.user.avatarUrl || undefined}
      notificationCount={model.notificationCount}
      hasUsableInternet={model.hasUsableInternet}
      showBack={showBack}
      title={title}
      onBack={onBack || (() => model.setActiveOverlay(null))}
      onProfilePress={() => {
        model.setActiveOverlay(null);
        model.setActiveTab('profile');
      }}
      onEventsPress={() => model.setActiveOverlay('events')}
      onTrackerPress={() => {
        model.setActiveOverlay(null);
        model.setActiveTab('tracker');
      }}
      onNotificationsPress={() => model.setActiveOverlay('notifications')}
      onAssistantPress={shouldShowAssistantInHeader ? () => model.setActiveOverlay('assistant') : undefined}
    />
  );
}

export function EcoGlowIllustration() {
  const crownLeaves = [
    { key: 'one', style: styles.illustrationLeafBadgeOne, rotate: '-34deg' as const },
    { key: 'two', style: styles.illustrationLeafBadgeTwo, rotate: '-12deg' as const },
    { key: 'three', style: styles.illustrationLeafBadgeThree, rotate: '10deg' as const },
    { key: 'four', style: styles.illustrationLeafBadgeFour, rotate: '28deg' as const },
    { key: 'five', style: styles.illustrationLeafBadgeFive, rotate: '40deg' as const },
  ];

  const flowers = [
    {
      key: 'left',
      style: styles.illustrationFlowerLeft,
      petalColor: '#FFD8CA',
      coreColor: '#F0A24D',
    },
    {
      key: 'center',
      style: styles.illustrationFlowerCenter,
      petalColor: '#FFD8E0',
      coreColor: '#F0BD4D',
    },
    {
      key: 'right',
      style: styles.illustrationFlowerRight,
      petalColor: '#FFC9D0',
      coreColor: '#E89545',
    },
  ];

  return (
    <View style={styles.illustrationWrap}>
      <View style={styles.illustrationAura} />
      <View style={styles.illustrationAuraSecondary} />
      <LinearGradient
        colors={['rgba(250,255,246,0.9)', 'rgba(228,255,223,0.56)', 'rgba(204,243,187,0.12)']}
        start={{ x: 0.12, y: 0.04 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.illustrationBubble}
      />
      <View style={styles.illustrationGlowDotOne} />
      <View style={styles.illustrationGlowDotTwo} />
      <View style={styles.illustrationGlowDotThree} />
      <View style={[styles.illustrationDewDrop, styles.illustrationDewDropOne]} />
      <View style={[styles.illustrationDewDrop, styles.illustrationDewDropTwo]} />
      <View style={[styles.illustrationDewDrop, styles.illustrationDewDropThree]} />

      {crownLeaves.map((leaf) => (
        <LinearGradient
          key={leaf.key}
          colors={['rgba(255,255,255,0.96)', 'rgba(199,244,174,0.88)', 'rgba(121,203,110,0.96)']}
          start={{ x: 0.08, y: 0.04 }}
          end={{ x: 0.88, y: 0.94 }}
          style={[styles.illustrationLeafBadge, leaf.style, { transform: [{ rotate: leaf.rotate }] }]}
        >
          <View style={styles.illustrationLeafVein} />
        </LinearGradient>
      ))}

      <View style={styles.illustrationStemLeft} />
      <View style={styles.illustrationStemCenter} />
      <View style={styles.illustrationStemRight} />
      <View style={[styles.illustrationSproutLeaf, styles.illustrationSproutLeafLeft]} />
      <View style={[styles.illustrationSproutLeaf, styles.illustrationSproutLeafRight]} />

      {flowers.map((flower) => (
        <View key={flower.key} style={[styles.illustrationFlower, flower.style]}>
          <View style={[styles.illustrationFlowerPetal, styles.illustrationFlowerPetalTop, { backgroundColor: flower.petalColor }]} />
          <View style={[styles.illustrationFlowerPetal, styles.illustrationFlowerPetalRight, { backgroundColor: flower.petalColor }]} />
          <View style={[styles.illustrationFlowerPetal, styles.illustrationFlowerPetalBottom, { backgroundColor: flower.petalColor }]} />
          <View style={[styles.illustrationFlowerPetal, styles.illustrationFlowerPetalLeft, { backgroundColor: flower.petalColor }]} />
          <View style={[styles.illustrationFlowerCore, { backgroundColor: flower.coreColor }]} />
        </View>
      ))}

      <View style={styles.illustrationLeafPodLeft}>
        <View style={styles.illustrationLeafPodInner} />
      </View>
      <View style={styles.illustrationLeafPodRight}>
        <View style={styles.illustrationLeafPodInner} />
      </View>

      <LinearGradient
        colors={['#F5FFD6', '#C7F09C', '#82CF6A']}
        start={{ x: 0.15, y: 0.02 }}
        end={{ x: 0.82, y: 1 }}
        style={styles.illustrationCharacter}
      >
        <View style={styles.illustrationCharacterGlow} />
        <View style={[styles.illustrationArm, styles.illustrationArmLeft]} />
        <View style={[styles.illustrationArm, styles.illustrationArmRight]} />
        <View style={[styles.illustrationLeg, styles.illustrationLegLeft]} />
        <View style={[styles.illustrationLeg, styles.illustrationLegRight]} />

        <View style={styles.illustrationEyeRow}>
          <View style={styles.illustrationEye}>
            <View style={styles.illustrationEyeSpark} />
          </View>
          <View style={styles.illustrationEye}>
            <View style={styles.illustrationEyeSpark} />
          </View>
        </View>
        <View style={styles.illustrationSmile} />
        <View style={[styles.illustrationBlush, styles.illustrationBlushLeft]} />
        <View style={[styles.illustrationBlush, styles.illustrationBlushRight]} />
      </LinearGradient>
    </View>
  );
}

export function EcoLogo({ light = false, emphasis = 'default' }: { light?: boolean; emphasis?: 'default' | 'hero' }) {
  const hero = emphasis === 'hero';
  const size = hero ? 96 : 64;

  return (
    <View style={[styles.logoRow, hero && styles.logoRowHero, { alignItems: 'center', justifyContent: 'center' }]}>
      <Image
        source={require('../../../assets/ecobud_logo_circle.png')}
        style={{ width: size, height: size, borderRadius: size / 2, resizeMode: 'contain' }}
      />
    </View>
  );
}

export function OverlayScaffold({
  title,
  subtitle,
  onBack,
  headerImage,
  topRightAccessory,
  topProgressBar,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  headerImage?: string;
  topRightAccessory?: React.ReactNode;
  topProgressBar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.overlayShell, { backgroundColor: theme.colors.background }]}>
      {headerImage ? (
        <ImageBackground
          source={{ uri: headerImage }}
          style={[styles.overlayHeader, { backgroundColor: '#0C5E54' }]}
          imageStyle={{ opacity: 0.4 }}
        >
          <LinearGradient colors={['rgba(7,28,25,0.6)', 'rgba(12,94,84,0.7)', 'rgba(23,160,126,0.9)']} style={StyleSheet.absoluteFill} />
          {topProgressBar && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>{topProgressBar}</View>}
          <SafeAreaView>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Feather name="arrow-left" size={22} color="#FFF" />
                <Text style={styles.backLabel}>Back</Text>
              </TouchableOpacity>
              {topRightAccessory}
            </View>
            <Text style={styles.overlayTitle}>{title}</Text>
            <Text style={styles.overlaySubtitle}>{subtitle}</Text>
          </SafeAreaView>
        </ImageBackground>
      ) : (
        <LinearGradient colors={['#071C19', '#0C5E54', '#17A07E']} style={styles.overlayHeader}>
          {topProgressBar && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>{topProgressBar}</View>}
          <SafeAreaView>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Feather name="arrow-left" size={22} color="#FFF" />
                <Text style={styles.backLabel}>Back</Text>
              </TouchableOpacity>
              {topRightAccessory}
            </View>
            <Text style={styles.overlayTitle}>{title}</Text>
            <Text style={styles.overlaySubtitle}>{subtitle}</Text>
          </SafeAreaView>
        </LinearGradient>
      )}
      <View style={[styles.overlayBody, { backgroundColor: theme.colors.background }]}>{children}</View>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, disabled && { opacity: 0.5 }, style]}
    >
      <LinearGradient
        colors={['#126027', '#17A07E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButtonGradient}
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondaryButton, disabled && { opacity: 0.5 }, style]}
    >
      <View style={styles.secondaryButtonGradient}>
        <Text style={styles.secondaryButtonText}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function SurfaceCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return <View style={[styles.surfaceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }, style]}>{children}</View>;
}

export function ProgressBar({ progress }: { progress: number }) {
  const { theme, isDark } = useTheme();
  const widthAnim = React.useRef(new Animated.Value(progress)).current;

  React.useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(100, progress)),
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%']
  });

  return (
    <View style={[styles.progressTrack, isDark && { backgroundColor: theme.colors.surfaceMuted }]}>
      <Animated.View style={[styles.progressFill, { width }, isDark && { backgroundColor: theme.colors.primary }]} />
    </View>
  );
}

export function LessonMedia({
  imageUrl,
  iconName,
  large = false,
}: {
  imageUrl?: string | null;
  iconName: string;
  large?: boolean;
}) {
  const height = large ? 200 : 140;
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.lessonMedia, { height }]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.lessonMediaFallback, { height }]}>
      <Ionicons name={(iconName as any) || 'book'} size={40} color={ecoTheme.colors.primaryDark} />
    </View>
  );
}

export function TinyBadge({ label, gold = false }: { label: string; gold?: boolean }) {
  return (
    <View style={[styles.tinyBadge, gold && styles.tinyBadgeGold]}>
      <Text style={[styles.tinyBadgeText, gold && styles.tinyBadgeTextGold]}>{label}</Text>
    </View>
  );
}

export function ChallengeMeta({
  icon,
  label,
}: {
  icon: string;
  label: string;
}) {
  return (
    <View style={styles.challengeMetaWrap}>
      <Ionicons name={icon as any} size={16} color={ecoTheme.colors.textSoft} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

export function AvatarBubble({
  label,
  size,
  style,
  textStyle,
  avatarUrl,
}: {
  label: string;
  size: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  avatarUrl?: string | null;
}) {
  let parsedUrl = null;
  if (avatarUrl && avatarUrl !== 'null') {
    parsedUrl = resolveMediaUrl(avatarUrl, ecobudApiOrigin);
  }

  if (parsedUrl) {
    return (
      <View style={[styles.avatarBubble, style, { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }]}>
        <Image source={{ uri: parsedUrl }} style={{ width: size, height: size, resizeMode: 'cover' }} />
      </View>
    );
  }

  return (
    <View style={[styles.avatarBubble, style, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, textStyle]}>{initialsFromLabel(label)}</Text>
    </View>
  );
}

export function BadgeCard({ badge, fullWidth = false }: { badge: EcoBadge & { unlocked?: boolean }; fullWidth?: boolean }) {
  const { theme, isDark } = useTheme();
  const unlocked = Boolean(badge.unlocked);

  return (
    <View style={[styles.badgeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }, fullWidth && styles.badgeCardFull, !unlocked && [styles.badgeCardLocked, { backgroundColor: theme.colors.surfaceMuted }]]}>
      <View style={[styles.badgeIconWrap, !unlocked && styles.badgeIconWrapLocked]}>
        <Ionicons
          name={unlocked ? 'ribbon' : 'lock-closed'}
          size={28}
          color={unlocked ? (isDark ? theme.colors.primary : theme.colors.primaryDark) : (isDark ? '#5A6B62' : '#777777')}
        />
      </View>
      <Text style={[styles.badgeName, { color: theme.colors.textPrimary }]}>{badge.name}</Text>
      <Text style={[styles.badgeRequirement, { color: theme.colors.textMuted }]}>
        {unlocked ? `${badge.requiredPoints} pts unlocked` : `Requires ${badge.requiredPoints} ECO Points`}
      </Text>
    </View>
  );
}

export function ProgressRing({ value }: { value: number }) {
  return (
    <View style={styles.progressRingOuter}>
      <View style={styles.progressRingInner}>
        <Text style={styles.progressRingValue}>{value}%</Text>
      </View>
    </View>
  );
}

export function ProfileMetric({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.profileMetric}>
      <Text style={[styles.profileMetricValue, { color: theme.colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.profileMetricLabel, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function BottomTabBar({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const isNarrow = screenWidth < 380;
  const isVeryNarrow = screenWidth < 340;
  const isTablet = screenWidth >= 600;

  const items: { key: AppTab; label: string; shortLabel: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'home', label: 'Home', shortLabel: 'Home', icon: 'home-outline' },
    { key: 'learn', label: 'Learn', shortLabel: 'Learn', icon: 'book-outline' },
    { key: 'challenges', label: 'Tasks', shortLabel: 'Tasks', icon: 'trophy-outline' },
    { key: 'marketplace', label: 'G&G', shortLabel: 'G&G', icon: 'cart-outline' },
    { key: 'profile', label: 'Profile', shortLabel: 'Profile', icon: 'person-outline' },
  ];

  const activeIndex = items.findIndex((item) => item.key === activeTab);
  const hasActiveTab = activeIndex >= 0;
  const slideAnim = useRef(new Animated.Value(hasActiveTab ? activeIndex : 0)).current;
  const opacityAnim = useRef(new Animated.Value(hasActiveTab ? 1 : 0)).current;

  React.useEffect(() => {
    if (hasActiveTab) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: activeIndex,
          useNativeDriver: true,
          tension: 130,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, hasActiveTab, opacityAnim, slideAnim]);

  const bottomMargin = insets.bottom > 0 ? insets.bottom : (isNarrow ? 10 : 14);
  const horizontalMargin = isVeryNarrow ? 8 : isNarrow ? 12 : 16;
  const barWidth = isTablet ? Math.min(540, screenWidth - 48) : screenWidth - horizontalMargin * 2;
  const barHeight = isNarrow ? 58 : 64;

  const slotWidth = (barWidth - 8) / items.length;
  const pillWidth = Math.min(64, Math.max(46, slotWidth - (isNarrow ? 4 : 8)));
  const pillHeight = barHeight - 12;
  const pillBaseLeft = 4 + (slotWidth - pillWidth) / 2;
  const pillTop = 6;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [0, slotWidth, 2 * slotWidth, 3 * slotWidth, 4 * slotWidth],
  });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: bottomMargin,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 90,
      }}
    >
      <View
        style={[
          styles.bottomBar,
          {
            width: barWidth,
            height: barHeight,
            paddingHorizontal: 4,
            backgroundColor: theme.colors.tabBarBackground,
            borderColor: theme.colors.tabBarBorder,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabActivePill,
            {
              width: pillWidth,
              height: pillHeight,
              top: pillTop,
              left: pillBaseLeft,
              borderRadius: moderateScale(16),
              opacity: opacityAnim,
              transform: [{ translateX }],
              backgroundColor: isDark ? theme.colors.surfaceMuted : '#EDF6F1',
              borderColor: isDark ? theme.colors.border : 'rgba(18, 96, 39, 0.14)',
            },
          ]}
        />
        {items.map((item) => {
          const displayLabel = isVeryNarrow ? item.shortLabel : isNarrow ? item.shortLabel : item.label;
          return (
            <TabItem
              key={item.key}
              item={{ ...item, label: displayLabel }}
              isActive={item.key === activeTab}
              onPress={() => {
                triggerSelectionHaptic();
                onChange(item.key);
              }}
              isNarrow={isNarrow}
              isVeryNarrow={isVeryNarrow}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  item,
  isActive,
  onPress,
  isNarrow = false,
  isVeryNarrow = false,
}: {
  item: { key: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap };
  isActive: boolean;
  onPress: () => void;
  isNarrow?: boolean;
  isVeryNarrow?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(isActive ? 1.05 : 1)).current;
  const activeIconName = isActive
    ? (item.icon.replace('-outline', '') as any)
    : item.icon;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1.05 : 1.0,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start();
  }, [isActive, scaleAnim]);

  const iconSize = isVeryNarrow ? 18 : isNarrow ? 20 : 22;
  const fontSize = isVeryNarrow ? 8.5 : isNarrow ? 9.5 : 11;
  const activeColor = isDark ? theme.colors.primary : theme.colors.primaryDark;
  const inactiveColor = isDark ? theme.colors.textMuted : '#8A959F';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={styles.bottomBarItem}
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Ionicons
          name={activeIconName}
          size={iconSize}
          color={isActive ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.bottomBarLabel,
            { color: inactiveColor },
            isActive && [styles.bottomBarLabelActive, { color: activeColor }],
            { fontSize },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {item.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
