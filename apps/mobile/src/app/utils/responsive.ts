import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 375; // iPhone standard base
const BASE_HEIGHT = 812;

// ─── Static helpers (safe to use inside StyleSheet.create) ───────────────────
export const scale = (size: number) => (SCREEN_WIDTH / BASE_WIDTH) * size;
export const verticalScale = (size: number) => (SCREEN_HEIGHT / BASE_HEIGHT) * size;

/**
 * Moderate scaling with a dampening factor (default 0.4 for smooth adaptation)
 */
export const moderateScale = (size: number, factor = 0.4) =>
  size + (scale(size) - size) * factor;

/**
 * Responsive font size calculation that scales gracefully across small, normal, and large devices.
 * Uses a moderate dampening factor to preserve legibility without causing text overflow.
 */
export const responsiveFontSize = (size: number, factor = 0.35) => {
  const scaled = moderateScale(size, factor);
  return Math.round(scaled);
};

/**
 * Clamps a font-size value between a min and max.
 * Useful when a responsiveFontSize result would be too large/small on edge devices.
 */
export const clampFontSize = (size: number, min: number, max: number) =>
  Math.min(max, Math.max(min, responsiveFontSize(size)));

/**
 * Responsive spacing with light damping so margins/paddings don't blow up on tablets or collapse on compact phones.
 */
export const responsiveSpacing = (size: number, factor = 0.5) =>
  Math.round(size + (scale(size) - size) * factor);

/**
 * Responsive border radius helper.
 */
export const responsiveRadius = (size: number, factor = 0.3) =>
  Math.round(size + (scale(size) - size) * factor);

// ─── Semantic Typography Scale Tokens ────────────────────────────────────────

export const typography = {
  displayLarge: responsiveFontSize(34),
  displayMedium: responsiveFontSize(28),
  displaySmall: responsiveFontSize(24),
  titleLarge: responsiveFontSize(22),
  titleMedium: responsiveFontSize(20),
  titleSmall: responsiveFontSize(18),
  bodyLarge: responsiveFontSize(16),
  bodyMedium: responsiveFontSize(14),
  bodySmall: responsiveFontSize(13),
  captionLarge: responsiveFontSize(12),
  captionMedium: responsiveFontSize(11),
  captionSmall: responsiveFontSize(10),
  micro: responsiveFontSize(9),
};

// ─── Semantic Spacing Tokens ──────────────────────────────────────────────────

export const spacing = {
  xxs: responsiveSpacing(2),
  xs: responsiveSpacing(4),
  sm: responsiveSpacing(8),
  md: responsiveSpacing(12),
  lg: responsiveSpacing(16),
  xl: responsiveSpacing(20),
  xxl: responsiveSpacing(24),
  xxxl: responsiveSpacing(32),
};

// ─── Hook-based helpers (reactive to orientation / display-zoom / accessibility changes) ──

export type ScreenSize = 'small' | 'normal' | 'large' | 'tablet';

export interface ResponsiveMetrics {
  width: number;
  height: number;
  fontScale: number;
  pixelRatio: number;
  isLandscape: boolean;
  isPortrait: boolean;
  isSmall: boolean;       // width < 360 (compact phones, Display Zoom)
  isCompact: boolean;     // width < 375 || height < 700
  isNormal: boolean;      // 360 <= width < 428
  isLarge: boolean;       // 428 <= width < 600
  isTablet: boolean;      // width >= 600
  screenSize: ScreenSize;
  scale: (size: number) => number;
  verticalScale: (size: number) => number;
  moderateScale: (size: number, factor?: number) => number;
  fontSize: (size: number, factor?: number) => number;
  spacing: (size: number, factor?: number) => number;
  radius: (size: number, factor?: number) => number;
  clampFont: (size: number, min: number, max: number) => number;
  maxContentWidth: number;
}

/**
 * Returns reactive screen metrics that update on orientation change,
 * Display Zoom, or system font-size adjustments.
 */
export function useResponsive(): ResponsiveMetrics {
  const { width, height, fontScale } = useWindowDimensions();
  const pixelRatio = PixelRatio.get();

  const isLandscape = width > height;
  const isPortrait = !isLandscape;
  const isSmall = width < 360;
  const isCompact = width < 375 || height < 700;
  const isTablet = width >= 600 || (isLandscape && width >= 800);
  const isLarge = width >= 428 && !isTablet;
  const isNormal = !isSmall && !isLarge && !isTablet;

  const screenSize: ScreenSize = isTablet
    ? 'tablet'
    : isSmall
    ? 'small'
    : isLarge
    ? 'large'
    : 'normal';

  const rScale = (size: number) => (width / BASE_WIDTH) * size;
  const rVerticalScale = (size: number) => (height / BASE_HEIGHT) * size;
  const rModerateScale = (size: number, factor = 0.4) =>
    size + (rScale(size) - size) * factor;
  const rFontSize = (size: number, factor = 0.35) =>
    Math.round(rModerateScale(size, factor));
  const rSpacing = (size: number, factor = 0.5) =>
    Math.round(size + (rScale(size) - size) * factor);
  const rRadius = (size: number, factor = 0.3) =>
    Math.round(size + (rScale(size) - size) * factor);
  const rClampFont = (size: number, min: number, max: number) =>
    Math.min(max, Math.max(min, rFontSize(size)));

  const maxContentWidth = isTablet ? 680 : width;

  return {
    width,
    height,
    fontScale,
    pixelRatio,
    isLandscape,
    isPortrait,
    isSmall,
    isCompact,
    isNormal,
    isLarge,
    isTablet,
    screenSize,
    scale: rScale,
    verticalScale: rVerticalScale,
    moderateScale: rModerateScale,
    fontSize: rFontSize,
    spacing: rSpacing,
    radius: rRadius,
    clampFont: rClampFont,
    maxContentWidth,
  };
}

/**
 * Lightweight hook that returns the current screen size category.
 */
export function useScreenSize(): ScreenSize {
  const { width, height } = useWindowDimensions();
  if (width >= 600 || (width > height && width >= 800)) return 'tablet';
  if (width < 360) return 'small';
  if (width >= 428) return 'large';
  return 'normal';
}
