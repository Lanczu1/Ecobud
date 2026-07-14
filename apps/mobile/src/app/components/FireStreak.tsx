/**
 * FireStreak — Duolingo-style streak flame badge
 *
 * Inspired by Duolingo's streak day indicator:
 * - Bold, clean, cartoon-style flame (NOT realistic or emoji-style)
 * - Official Duolingo streak palette: Orange #F49000, Gold #FFC200, Highlight #FFDE00
 * - Thick dark outline (Duolingo uses #4B4B4B "Eel" for outlines)
 * - Two modes: 'badge' (pill with flame + count) and 'hero' (large flame)
 * - Dynamic states: active (vibrant) and inactive (gray/dormant)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Easing,
  TouchableWithoutFeedback,
} from 'react-native';
import Svg, { Path, Ellipse, Defs, RadialGradient as SvgRadialGradient, Stop } from 'react-native-svg';

// ─────────────────────────────────────────────────────────────
// Duolingo Palette (official brand colors from brandpalettes)
// ─────────────────────────────────────────────────────────────
const DUO = {
  // Active state
  orange:   '#F49000',  // Main flame body
  gold:     '#FFC200',  // Inner bright zone
  highlight:'#FFDE00',  // Hottest highlight
  outline:  '#CE6A00',  // Dark edge to create bold cartoon look
  glowClr:  '#FF9100',  // Glow halo

  // Inactive / dormant state
  grayDark: '#9E9E9E',
  gray:     '#BDBDBD',
  grayMid:  '#D6D6D6',
  grayLight:'#EEEEEE',
  grayGlow: 'transparent',
};

// ─────────────────────────────────────────────────────────────
// Duolingo-style flame SVG
// Clean, chunky, cartoon teardrop with bold inner glow shape
// viewBox: 0 0 80 100
// ─────────────────────────────────────────────────────────────
function FlameSvg({ w, h, isActive }: { w: number; h: number; isActive: boolean }) {
  const c = isActive
    ? { body: DUO.orange, edge: DUO.outline, mid: DUO.gold, hot: DUO.highlight }
    : { body: DUO.gray, edge: DUO.grayDark, mid: DUO.grayMid, hot: DUO.grayLight };

  return (
    <Svg width={w} height={h} viewBox="0 0 80 100">

      {/* ── SHADOW / OUTLINE stroke illusion (slightly larger, darker shape) */}
      <Path
        d="
          M40 3
          C37 9  29 18  22 29
          C15 40  11 53  11 65
          C11 82  23 98  40 98
          C57 98  69 82  69 65
          C69 53  65 40  58 29
          C51 18  43  9  40 3
          Z
        "
        fill={c.edge}
      />

      {/* ── MAIN FLAME BODY ── */}
      <Path
        d="
          M40 7
          C37 13  30 21  24 31
          C18 41  15 54  15 65
          C15 80  26 94  40 94
          C54 94  65 80  65 65
          C65 54  62 41  56 31
          C50 21  43 13  40 7
          Z
        "
        fill={c.body}
      />

      {/* ── INNER GLOW ZONE (teardrop, centered lower-half) ── */}
      <Path
        d="
          M40 44
          C36 51  33 60  32 70
          C31 80  34 91  40 92
          C46 91  49 80  48 70
          C47 60  44 51  40 44
          Z
        "
        fill={c.mid}
      />

      {/* ── HOT HIGHLIGHT (bright core, very bottom of inner shape) ── */}
      <Path
        d="
          M40 65
          C38.2 69  37 74  37 79
          C37 85  38.5 90  40 91
          C41.5 90  43 85  43 79
          C43 74  41.8 69  40 65
          Z
        "
        fill={c.hot}
      />

      {/* ── SPECULAR HIGHLIGHT (small bright oval near tip — Duolingo shine) ── */}
      {isActive && (
        <Ellipse
          cx="33"
          cy="25"
          rx="4"
          ry="6"
          fill="rgba(255,255,255,0.28)"
          transform="rotate(-25 33 25)"
        />
      )}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
interface FireStreakProps {
  streakCount: number;
  isActive: boolean;
  onPress?: () => void;
  /**
   * 'badge' → Duolingo-style pill (flame + count) — for SummaryCards header
   * 'hero'  → Large centered flame — for StreakUnlockedOverlay
   */
  mode?: 'badge' | 'hero';
  size?: number;
}

// ─────────────────────────────────────────────────────────────
// FireStreak Component
// ─────────────────────────────────────────────────────────────
export function FireStreak({
  streakCount,
  isActive,
  onPress,
  mode = 'hero',
  size = 120,
}: FireStreakProps) {

  // ── Shared animation refs ──────────────────
  const bounceAnim  = useRef(new Animated.Value(1)).current;  // Idle bounce
  const swayAnim    = useRef(new Animated.Value(0)).current;  // Left/right sway
  const flickerAnim = useRef(new Animated.Value(1)).current;  // Vertical flicker
  const glowAnim    = useRef(new Animated.Value(0)).current;  // Glow halo
  const pressAnim   = useRef(new Animated.Value(1)).current;  // Tap feedback

  // Spark embers (hero only)
  const sp0 = useRef(new Animated.Value(0)).current;
  const sp1 = useRef(new Animated.Value(0)).current;
  const sp2 = useRef(new Animated.Value(0)).current;
  const sp3 = useRef(new Animated.Value(0)).current;
  const sparks = [sp0, sp1, sp2, sp3];

  useEffect(() => {
    if (!isActive) {
      bounceAnim.stopAnimation();
      bounceAnim.setValue(1);
      return;
    }

    // Duolingo-style vertical "breathing" bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1.06, duration: 500, easing: Easing.out(Easing.quad),   useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0.96, duration: 400, easing: Easing.in(Easing.quad),    useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 1.02, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 1,    duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Gentle sway
    Animated.loop(
      Animated.sequence([
        Animated.timing(swayAnim, { toValue:  1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(swayAnim, { toValue: -1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(swayAnim, { toValue:  0, duration: 1050, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Subtle vertical flicker (tip elongates)
    Animated.loop(
      Animated.sequence([
        Animated.timing(flickerAnim, { toValue: 1.07, duration: 120, useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 0.94, duration: 160, useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 1.04, duration: 140, useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 0.97, duration: 130, useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ])
    ).start();

    // Glow pulse (hero mode)
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Sparks — Native-driven loop without bridge callbacks
    sparks.forEach((anim, i) => {
      anim.setValue(0);
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    });

    return () => {
      bounceAnim.stopAnimation();
      swayAnim.stopAnimation();
      flickerAnim.stopAnimation();
      glowAnim.stopAnimation();
      sparks.forEach(a => a.stopAnimation());
    };
  }, [isActive, streakCount]);

  const handlePress = () => {
    // Duolingo-style: quick compress then spring back
    pressAnim.setValue(0.8);
    Animated.spring(pressAnim, {
      toValue: 1,
      friction: 3,
      tension: 250,
      useNativeDriver: true,
    }).start();
    onPress?.();
  };

  const rotateStr  = swayAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] });
  const glowOp     = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });
  const glowSc     = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35] });

  // ─────────────────────────────────────────
  // BADGE MODE
  // ─────────────────────────────────────────
  if (mode === 'badge') {
    const flameH = size * 1.45;
    const flameW = flameH * 0.8;
    const countFontSize = size * 0.65;

    return (
      <TouchableWithoutFeedback onPress={handlePress}>
        <Animated.View
          style={[
            styles.badgePill,
            {
              backgroundColor: isActive ? '#FFF3E0' : '#F5F5F5',
              borderColor:     isActive ? '#F49000' : '#BDBDBD',
              shadowColor:     isActive ? DUO.glowClr : 'transparent',
              shadowOpacity:   isActive ? 0.5 : 0,
              shadowRadius:    8,
              shadowOffset:    { width: 0, height: 0 },
              elevation:       isActive ? 4 : 0,
              transform: [
                { scale: pressAnim },
                // Duo-style: only scale on bounce, no constant pulsing
                { scaleY: isActive ? bounceAnim : 1 },
              ],
            },
          ]}
        >
          {/* Flame — sway + flicker */}
          <Animated.View
            style={{
              transform: [
                { rotate: isActive ? rotateStr : '0deg' },
                { scaleY: isActive ? flickerAnim : 1 },
              ],
            }}
          >
            <FlameSvg w={flameW} h={flameH} isActive={isActive} />
          </Animated.View>

          {/* Streak count */}
          <Text
            style={[
              styles.badgeCount,
              {
                fontSize:  countFontSize,
                color:     isActive ? DUO.orange : '#9E9E9E',
              },
            ]}
          >
            {streakCount}
          </Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  }

  // ─────────────────────────────────────────
  // HERO MODE  (large overlay flame)
  // ─────────────────────────────────────────
  const flameH = size * 0.82;
  const flameW = flameH * 0.8;

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <Animated.View style={[styles.heroWrap, { width: size, height: size, transform: [{ scale: pressAnim }] }]}>

        {/* Warm glow halo (Duolingo "burst" style) */}
        {isActive && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: size / 2,
                backgroundColor: 'rgba(244,144,0,0.15)',
                transform: [{ scale: glowSc }],
                opacity: glowOp,
              },
            ]}
          />
        )}

        {/* Flame — bounce + sway + flicker */}
        <Animated.View
          style={{
            transform: [
              { rotate: isActive ? rotateStr : '0deg' },
              { scaleY: isActive ? Animated.multiply(bounceAnim, flickerAnim) : 1 },
            ],
          }}
        >
          <FlameSvg w={flameW} h={flameH} isActive={isActive} />
        </Animated.View>

        {/* Day label below flame */}
        <Text
          style={[
            styles.heroLabel,
            {
              fontSize: size * 0.17,
              color:    isActive ? DUO.orange : '#9E9E9E',
            },
          ]}
        >
          {streakCount} Day{streakCount !== 1 ? 's' : ''}
        </Text>

        {/* Floating spark particles (orange/gold palette) */}
        {isActive && sparks.map((anim, i) => {
          const cx = size * 0.28 + i * (size * 0.15);
          const startRatio = (i * 200) / 1600;
          const endRatio = (i * 200 + 800) / 1600;

          const ty = anim.interpolate({
            inputRange: [0, startRatio, endRatio, 1],
            outputRange: [size * 0.62, size * 0.62, size * 0.04, size * 0.04]
          });

          const tx = anim.interpolate({
            inputRange: [0, startRatio, (startRatio + endRatio) / 2, endRatio, 1],
            outputRange: [
              cx,
              cx,
              cx + (i % 2 === 0 ? 10 : -10),
              cx + (i % 2 === 0 ? -7 : 7),
              cx + (i % 2 === 0 ? -7 : 7)
            ]
          });

          const op = anim.interpolate({
            inputRange: [0, startRatio, startRatio + 0.1, endRatio - 0.1, endRatio, 1],
            outputRange: [0, 0, 1, 0.85, 0, 0]
          });

          const sz = 2.5 + (i % 3);
          const sparkColor = i % 2 === 0 ? DUO.highlight : DUO.gold;

          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                width: sz,
                height: sz,
                borderRadius: sz / 2,
                backgroundColor: sparkColor,
                opacity: op,
                transform: [{ translateX: tx }, { translateY: ty }],
                shadowColor: DUO.gold,
                shadowOpacity: 1,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
                elevation: 3,
              }}
            />
          );
        })}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1.5,
    gap: 2,
  },
  badgeCount: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 4,
    textShadowColor: 'rgba(244,144,0,0.45)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
});
