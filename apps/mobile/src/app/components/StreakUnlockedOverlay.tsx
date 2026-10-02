import React from 'react';
import {
  AccessibilityInfo,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Modal } from '../../shared/accessibility/primitives';
import { Pressable, Text } from '../../shared/accessibility/primitives';
import { Animated } from '../../shared/accessibility/animations';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import LottieView from '../../shared/accessibility/AccessibleLottie';
import { useAudioPlayer } from 'expo-audio';
import type { EcoBudMobileModel } from '../types/home';
import { isStreakFlameActive } from '../../shared/api/streakSummary';
import { StreakFlame } from './StreakFlame';
import { triggerSuccessHaptic, triggerSelectionHaptic } from '../utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccessibility } from '../../shared/accessibility/AccessibilityContext';

interface BurstParticleProps {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}

interface FloatingSparkProps {
  id: number;
  startX: number;
  startY: number;
  drift: number;
  riseDistance: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}

function generateBurstParticles(count: number, active: boolean): BurstParticleProps[] {
  const colors = active
    ? ['#FFDE00', '#FBBF24', '#F59E0B', '#F97316', '#EF4444', '#FFFFFF', '#FDE047']
    : ['#34D399', '#10B981', '#6EE7B7', '#FBBF24', '#F59E0B', '#A7F3D0', '#FFFFFF'];

  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.35;
    const distance = 75 + Math.random() * 125;
    const size = 5 + Math.random() * 7;
    const color = colors[i % colors.length];
    const delay = Math.random() * 160;
    const duration = 650 + Math.random() * 450;
    return {
      id: i,
      angle,
      distance,
      size,
      color,
      delay,
      duration,
    };
  });
}

function generateFloatingSparks(count: number, width: number, height: number, active: boolean): FloatingSparkProps[] {
  const colors = active
    ? ['#FDE047', '#FBBF24', '#F59E0B', '#F97316', 'rgba(255, 222, 0, 0.95)', 'rgba(251, 191, 36, 0.85)']
    : ['#34D399', '#10B981', '#6EE7B7', '#FBBF24', 'rgba(52, 211, 153, 0.9)', 'rgba(251, 191, 36, 0.8)'];

  return Array.from({ length: count }, (_, i) => {
    const size = 4 + Math.random() * 6;
    const color = colors[i % colors.length];
    const startX = Math.random() * width;
    const startY = height * 0.55 + Math.random() * (height * 0.45);
    const riseDistance = height * 0.45 + Math.random() * (height * 0.4);
    const drift = (Math.random() - 0.5) * (width * 0.35);
    const delay = Math.random() * 2200;
    const duration = 3400 + Math.random() * 2200;

    return {
      id: i,
      startX,
      startY,
      drift,
      riseDistance,
      size,
      color,
      delay,
      duration,
    };
  });
}

function BurstParticle({
  particle,
  centerX,
  centerY,
}: {
  particle: BurstParticleProps;
  centerX: number;
  centerY: number;
}) {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.delay(particle.delay),
      Animated.timing(anim, {
        toValue: 1,
        duration: particle.duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [anim, particle.delay, particle.duration]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.cos(particle.angle) * particle.distance],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.sin(particle.angle) * particle.distance],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.2, 0.65, 1],
    outputRange: [0.2, 1.4, 0.9, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.7, 1],
    outputRange: [0, 1, 0.8, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: centerX - particle.size / 2,
        top: centerY - particle.size / 2,
        width: particle.size,
        height: particle.size,
        borderRadius: particle.size / 2,
        backgroundColor: particle.color,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
        shadowColor: particle.color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
        elevation: 4,
      }}
    />
  );
}

function FloatingSpark({
  spark,
  reduced,
}: {
  spark: FloatingSparkProps;
  reduced: boolean;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spark.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: spark.duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduced, spark.delay, spark.duration]);

  if (reduced) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [spark.startY, spark.startY - spark.riseDistance],
  });

  const translateX = progress.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: [
      spark.startX,
      spark.startX + spark.drift * 0.5 + ((spark.id % 2 === 0 ? 1 : -1) * 16),
      spark.startX + spark.drift * 0.8 - ((spark.id % 2 === 0 ? 1 : -1) * 12),
      spark.startX + spark.drift,
    ],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.2, 0.75, 1],
    outputRange: [0, 0.85, 0.65, 0],
  });

  const scale = progress.interpolate({
    inputRange: [0, 0.25, 0.6, 1],
    outputRange: [0.4, 1.2, 0.9, 0.2],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: spark.size,
        height: spark.size,
        borderRadius: spark.size / 2,
        backgroundColor: spark.color,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
        shadowColor: spark.color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
        elevation: 3,
      }}
    />
  );
}

export function StreakUnlockedOverlay({ model }: { model: EcoBudMobileModel }) {
  const count = Math.max(0, model.dashboard?.streak ?? 0);
  const active = isStreakFlameActive(count, model.dashboard?.streakSummary?.active ?? false);
  const [focused, setFocused] = React.useState<string | null>(null);
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { preferences } = useAccessibility();
  const textMultiplier = { Small: 1, Medium: 1.15, Large: 1.35 }[preferences.size] * fontScale;
  const compactLayout = textMultiplier >= 1.3 || height - insets.top - insets.bottom < 700;
  const [reduceMotion, setReduceMotion] = React.useState(false);

  // Audio player for trigger celebration sound
  const popAudio = useAudioPlayer(require('../../../assets/sound sfx/pop.mp3'));
  const playPopSound = () => {
    try {
      popAudio.seekTo(0);
      popAudio.play();
    } catch {}
  };

  React.useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  // Animation values
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const contentScale = React.useRef(new Animated.Value(0.85)).current;
  const contentOpacity = React.useRef(new Animated.Value(0)).current;
  const flameScale = React.useRef(new Animated.Value(0.35)).current;
  const flameBounce = React.useRef(new Animated.Value(1)).current;
  const shockwaveScale = React.useRef(new Animated.Value(0.6)).current;
  const shockwaveOpacity = React.useRef(new Animated.Value(0.85)).current;
  const glowAnim = React.useRef(new Animated.Value(0.95)).current;
  const itemsSlide = React.useRef(new Animated.Value(20)).current;

  // Generate particles once on mount
  const burstParticles = React.useMemo(() => active ? generateBurstParticles(10, active) : [], [active]);
  const floatingSparks = React.useMemo(() => active ? generateFloatingSparks(6, width, height, active) : [], [active, width, height]);

  React.useEffect(() => {
    triggerSuccessHaptic();
    playPopSound();

    // Trigger entrance sequence
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(contentScale, {
        toValue: 1,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(itemsSlide, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Punchy flame pop-in
      Animated.sequence([
        Animated.delay(100),
        Animated.spring(flameScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
      ]),
      // Shockwave burst radiating from flame
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(shockwaveScale, {
            toValue: 2.2,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(shockwaveOpacity, {
            toValue: 0,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // Continuous subtle breathing idle animation for flame
    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameBounce, {
          toValue: 1.05,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(flameBounce, {
          toValue: 0.98,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    if (active) breathingLoop.start();

    // Continuous glowing aura behind flame
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.25,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.95,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    if (active) glowLoop.start();

    return () => {
      breathingLoop.stop();
      glowLoop.stop();
    };
  }, []);

  const milestones = model.dashboard?.streakSummary?.milestones ?? [];
  const earned = [...milestones].reverse().find(item => item.awarded);
  const reward = earned ?? milestones.find(item => !item.awarded);

  const handleClose = () => {
    triggerSelectionHaptic();
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      model.setActiveOverlay(null);
    });
  };

  const handleViewRewards = () => {
    triggerSelectionHaptic();
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      model.setActiveOverlay('streakRewards');
    });
  };

  const flameSize = compactLayout ? Math.min(112, width * 0.3) : Math.min(180, width * 0.46);
  const flameCenter = flameSize / 2;

  return (
    <Modal transparent animationType="none" visible onRequestClose={handleClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} accessibilityViewIsModal>
        {/* Full-Screen Ambient Floating Sparks */}
        {!reduceMotion && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {floatingSparks.map((spark) => (
              <FloatingSpark key={spark.id} spark={spark} reduced={reduceMotion} />
            ))}
          </View>
        )}

        {/* Celebration Confetti for Active Streak */}
        {active && !reduceMotion && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LottieView
              source={require('../../../assets/Celebrate.lottie')}
              autoPlay
              loop={false}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, {
            paddingTop: insets.top + (compactLayout ? 20 : 48),
            paddingBottom: insets.bottom + 24,
          }]}
          showsVerticalScrollIndicator
        >
          <Animated.View
            style={[
              styles.animatedContainer,
              compactLayout && styles.compactContainer,
              {
                opacity: contentOpacity,
                transform: [{ scale: contentScale }],
              },
            ]}
          >
            {/* Center Flame Hero Container with Radial Particles & Glow */}
            <View style={[styles.flameWrapper, { width: flameSize, height: flameSize }]}>
              {/* Expanding Shockwave Ring on Trigger */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shockwaveRing,
                  {
                    width: flameSize,
                    height: flameSize,
                    borderRadius: flameSize / 2,
                    borderColor: active ? '#F59E0B' : '#10B981',
                    transform: [{ scale: shockwaveScale }],
                    opacity: shockwaveOpacity,
                  },
                ]}
              />

              {/* Pulsing Glowing Aura Behind Flame */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.glowAura,
                  {
                    width: flameSize * 1.1,
                    height: flameSize * 1.1,
                    borderRadius: (flameSize * 1.1) / 2,
                    backgroundColor: active ? 'rgba(245, 158, 11, 0.22)' : 'rgba(16, 185, 129, 0.18)',
                    transform: [{ scale: Animated.multiply(flameScale, glowAnim) }],
                  },
                ]}
              />

              {/* Burst Particles Radiating from Flame Center on Trigger */}
              {!reduceMotion &&
                burstParticles.map((particle) => (
                  <BurstParticle
                    key={particle.id}
                    particle={particle}
                    centerX={flameCenter}
                    centerY={flameCenter}
                  />
                ))}

              {/* The Flame with Pop Spring & Subtle Breathing */}
              <Animated.View
                style={{
                  transform: [
                    { scale: Animated.multiply(flameScale, flameBounce) },
                  ],
                }}
              >
                <StreakFlame count={count} active={active} size={flameSize} />
              </Animated.View>
            </View>

            {/* Badges & Content with Slide-In Entrance */}
            <Animated.View style={[styles.detailsSection, compactLayout && styles.compactDetails, { transform: [{ translateY: itemsSlide }] }]}>
              <View style={[styles.countBadge, !active && styles.inactiveBadge]}>
                <Text style={[styles.count, !active && { color: '#FFFFFF' }]}>
                  {count} {count === 1 ? 'CHALLENGE' : 'CHALLENGES'}
                </Text>
              </View>

              <Text style={[styles.title, compactLayout && styles.compactTitle]}>
                {count < 3 ? 'Light your streak' : active ? 'Streak Unlocked!' : 'Your streak is resting'}
              </Text>

              <Text style={styles.description}>
                {count < 3
                  ? `Complete ${3 - count} more ${3 - count === 1 ? 'challenge' : 'challenges'} to light the flame and earn your first milestone reward.`
                  : active
                    ? `You've completed ${count} challenges. Keep going to grow your streak and earn bigger rewards.`
                    : 'Your challenge count is saved. Complete a challenge or use Restore Streak to bring back the flame.'}
              </Text>

              {reward ? (
                <View style={styles.rewardSection}>
                  <Text style={styles.rewardCaption}>
                    {earned ? `Earned at ${reward.challenges} challenges` : `Next reward at ${reward.challenges} challenges`}
                  </Text>
                  <View style={styles.rewardRow}>
                    <View style={styles.rewardItem}>
                      <Svg width={24} height={24} viewBox="0 0 24 24">
                        <Path fill="#34D399" d="M3 2c1 4 4 3 10 5 7 2 9 8 6 12C8 23 2 17 3 2Z" />
                        <Path d="m6 8 14 13" stroke="#071C19" strokeWidth={2} />
                      </Svg>
                      <Text style={styles.rewardText}>{reward.points.toLocaleString()} points</Text>
                    </View>
                    {reward.ecoCoins > 0 ? (
                      <View style={styles.rewardItem}>
                        <Image source={require('../../../assets/coin.png')} style={{ width: 24, height: 24 }} />
                        <Text style={styles.rewardText}>{reward.ecoCoins} eco coins</Text>
                      </View>
                    ) : null}
                  </View>
                  {reward.badge ? <Text style={styles.rewardCaption}>{reward.badge} badge</Text> : null}
                </View>
              ) : (
                <Text style={styles.milestones}>Rewards at 3 · 10 · 30 · 100 challenges</Text>
              )}

              <Pressable
                accessibilityRole="button"
                onPress={handleClose}
                onFocus={() => setFocused('close')}
                onBlur={() => setFocused(null)}
                style={[styles.button, focused === 'close' && styles.focus]}
              >
                <LinearGradient
                  colors={['#166534', '#087F68']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonFill}
                >
                  <Text style={styles.buttonText}>Keep it up!</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleViewRewards}
                onFocus={() => setFocused('rewards')}
                onBlur={() => setFocused(null)}
                style={[styles.close, focused === 'rewards' && styles.focus]}
              >
                <Text style={styles.closeText}>
                  {count >= 3 && !active ? 'View rewards & restore' : 'View streak rewards'}
                </Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5, 24, 20, 0.94)' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, paddingVertical: 48 },
  animatedContainer: { width: '100%', alignItems: 'center', gap: 20 },
  compactContainer: { gap: 12 },
  compactDetails: { gap: 12 },
  compactTitle: { fontSize: 28, lineHeight: 34 },
  flameWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  shockwaveRing: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  glowAura: {
    position: 'absolute',
  },
  detailsSection: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  countBadge: { backgroundColor: '#FF7900', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 9, marginBottom: 4 },
  inactiveBadge: { backgroundColor: '#41534D' },
  count: { color: '#071C19', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  title: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', textAlign: 'center', maxWidth: 420 },
  description: { color: '#A7F3D0', fontSize: 16, lineHeight: 25, textAlign: 'center', maxWidth: 360 },
  milestones: { color: '#A7F3D0', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 10 },
  rewardSection: {
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: '100%',
    maxWidth: 380,
  },
  rewardCaption: { color: '#C6DDD5', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 },
  rewardItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' },
  rewardText: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  button: { width: '100%', maxWidth: 400, minHeight: 56, borderRadius: 30, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  buttonFill: { minHeight: 56, padding: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  close: { minHeight: 48, minWidth: 100, width: '100%', maxWidth: 400, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  closeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  focus: { borderColor: '#FBBF24' },
});
