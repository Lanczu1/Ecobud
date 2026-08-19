import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

const { width: RAW_WIDTH, height: RAW_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 375; // iPhone standard base
const BASE_HEIGHT = 812;

// Detect large screen / tablet statically
export const isStaticTablet =
  Math.min(RAW_WIDTH, RAW_HEIGHT) >= 600 || Math.max(RAW_WIDTH, RAW_HEIGHT) >= 900;

// Maximum container widths for tablets/large screens to prevent excessive horizontal stretching
export const TABLET_MAX_CONTAINER_WIDTH = 640;
export const TABLET_MAX_CARD_WIDTH = 500;

// ─── Static helpers (safe to use inside StyleSheet.create) ───────────────────

/**
 * Intelligent horizontal scale:
 * For phones (<= 430px), scales smoothly with screen width.
 * For tablets/large screens (> 430px), caps aggressive magnification to a gentle ~1.15x - 1.25x max factor
 * so icons, buttons, and layouts remain crisp, ergonomic, and proportioned without blowing up.
 */
export const scale = (size: number): number => {
  if (RAW_WIDTH <= 430) {
    return (RAW_WIDTH / BASE_WIDTH) * size;
  }
  const phoneMaxScale = 430 / BASE_WIDTH; // ~1.147
  const tabletAdditional = Math.min(0.2, (RAW_WIDTH - 430) / 1800);
  return size * (phoneMaxScale + tabletAdditional);
};

/**
 * Intelligent vertical scale:
 * Prevents vertical elements (like massive paddings/heights) from exploding on tall iPad screens.
 */
export const verticalScale = (size: number): number => {
  if (RAW_HEIGHT <= 932) {
    return (RAW_HEIGHT / BASE_HEIGHT) * size;
  }
  const phoneMaxVertical = 932 / BASE_HEIGHT; // ~1.148
  const tabletAdditional = Math.min(0.2, (RAW_HEIGHT - 932) / 2000);
  return size * (phoneMaxVertical + tabletAdditional);
};

/**
 * Moderate scaling with a dampening factor (default 0.35 for smooth adaptation)
 */
export const moderateScale = (size: number, factor = 0.35): number =>
  size + (scale(size) - size) * factor;

/**
 * Responsive font size calculation that scales gracefully across small, normal, and large devices.
 * Implements a strict upper ceiling on tablets (max 1.2x of base size) so text stays elegant and legible.
 */
export const responsiveFontSize = (size: number, factor = 0.3): number => {
  const scaled = moderateScale(size, factor);
  const maxMultiplier = size > 24 ? 1.25 : 1.18;
  const clamped = Math.min(scaled, size * maxMultiplier);
  return Math.round(clamped);
};

/**
 * Clamps a font-size value between a min and max.
 * Useful when a responsiveFontSize result would be too large/small on edge devices.
 */
export const clampFontSize = (size: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, responsiveFontSize(size)));

/**
 * Responsive spacing with light damping so margins/paddings don't blow up on tablets or collapse on compact phones.
 */
export const responsiveSpacing = (size: number, factor = 0.4): number => {
  const scaled = moderateScale(size, factor);
  return Math.round(Math.min(scaled, size * 1.3));
};

/**
 * Responsive border radius helper.
 */
export const responsiveRadius = (size: number, factor = 0.25): number => {
  const scaled = moderateScale(size, factor);
  return Math.round(Math.min(scaled, size * 1.25));
};

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

  const rScale = (size: number) => {
    if (width <= 430) {
      return (width / BASE_WIDTH) * size;
    }
    const phoneMaxScale = 430 / BASE_WIDTH;
    const tabletAdditional = Math.min(0.2, (width - 430) / 1800);
    return size * (phoneMaxScale + tabletAdditional);
  };

  const rVerticalScale = (size: number) => {
    if (height <= 932) {
      return (height / BASE_HEIGHT) * size;
    }
    const phoneMaxVertical = 932 / BASE_HEIGHT;
    const tabletAdditional = Math.min(0.2, (height - 932) / 2000);
    return size * (phoneMaxVertical + tabletAdditional);
  };

  const rModerateScale = (size: number, factor = 0.35) =>
    size + (rScale(size) - size) * factor;

  const rFontSize = (size: number, factor = 0.3) => {
    const scaled = rModerateScale(size, factor);
    const maxMultiplier = size > 24 ? 1.25 : 1.18;
    return Math.round(Math.min(scaled, size * maxMultiplier));
  };

  const rSpacing = (size: number, factor = 0.4) =>
    Math.round(Math.min(rModerateScale(size, factor), size * 1.3));

  const rRadius = (size: number, factor = 0.25) =>
    Math.round(Math.min(rModerateScale(size, factor), size * 1.25));

  const rClampFont = (size: number, min: number, max: number) =>
    Math.min(max, Math.max(min, rFontSize(size)));

  const maxContentWidth = isTablet ? 640 : width;

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
