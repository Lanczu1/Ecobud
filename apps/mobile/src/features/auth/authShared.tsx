import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { Animated } from '../../shared/accessibility/animations';
import { useTheme } from '../../shared/theme/ecoTheme';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';

export const isAndroid = Platform.OS === 'android';
export const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : 0;
export const isLegacyAndroid = isAndroid && androidVersion > 0 && androidVersion < 29;

export const palette = {
  canvas: '#F9FAF5',
  title: '#163A24',
  subtitle: '#4B5563',
  primary: '#163A24',
  primaryBright: '#0F2919',
  primarySoft: '#F0F4EC',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  surface: '#FFFFFF',
  inputFill: '#F8FAF8',
  fieldIcon: '#9CA3AF',
  fieldIconActive: '#163A24',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  textStrong: '#163A24',
  textMuted: '#6B7280',
  separator: '#E5E7EB',
  googleBorder: '#E2E8F0',
  glowTop: 'transparent',
  glowBottom: 'transparent',
};

export function AnimatedThemeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean;
  onToggle: () => void;
}) {
  const spinAnim = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(spinAnim, {
        toValue: isDark ? 1 : 0,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      ]),
    ]).start();
  }, [isDark, spinAnim, scaleAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityLabel="Toggle Theme Mode"
      style={{
        position: 'absolute',
        top: 0,
        right: 20,
        zIndex: 20,
      }}
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingHorizontal: 13,
          paddingVertical: 7,
          borderRadius: 22,
          backgroundColor: isDark ? 'rgba(31, 51, 39, 0.94)' : 'rgba(255, 255, 255, 0.95)',
          borderWidth: 1.5,
          borderColor: isDark ? 'rgba(93, 223, 135, 0.35)' : 'rgba(18, 96, 39, 0.15)',
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 5,
        }}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons
            name={isDark ? 'moon' : 'sunny'}
            size={16}
            color={isDark ? '#5DDF87' : '#D97706'}
          />
        </Animated.View>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 0.3,
            color: isDark ? '#F3F7F5' : '#163A24',
          }}
        >
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export function usePressScale(pressedScale = 0.98) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (toValue: number) => {
      if (isLegacyAndroid && toValue !== 1) {
        return;
      }

      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        friction: 8,
        tension: 180,
      }).start();
    },
    [scale],
  );

  const onPressIn = useCallback(() => animateTo(pressedScale), [animateTo, pressedScale]);
  const onPressOut = useCallback(() => animateTo(1), [animateTo]);

  return { scale, onPressIn, onPressOut };
}

export function InlineBanner({ message }: { message: string }) {
  const { theme, isDark } = useTheme();
  return (
    <View style={[styles.errorBanner, isDark && { backgroundColor: '#3D1414', borderColor: '#7F1D1D' }]}>
      <Ionicons name="alert-circle-outline" size={18} color={isDark ? '#F87171' : palette.danger} />
      <Text style={[styles.errorBannerText, isDark && { color: '#FECACA' }]}>{message}</Text>
    </View>
  );
}

export interface AuthButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
}

export function PrimaryButton({ label, onPress, disabled, loading }: AuthButtonProps) {
  const { theme, isDark } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(0.985);

  return (
    <Animated.View style={[styles.buttonWrap, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={disabled ? undefined : { color: 'rgba(255,255,255,0.16)' }}
        style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      >
        <View
          style={[styles.primaryButtonGradient, { backgroundColor: isDark ? theme.colors.primary : palette.primary }]}
        >
          {loading ? (
            <ActivityIndicator color={isDark ? '#0E1512' : "#FFFFFF"} />
          ) : (
            <>
              <Text style={[styles.primaryButtonText, isDark && { color: '#0E1512' }]}>{label}</Text>
              <Ionicons name="arrow-forward-outline" size={18} color={isDark ? '#0E1512' : "#FFFFFF"} />
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const authSharedStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  authShell: {
    flexGrow: 1,
    paddingBottom: 52,
  },
  authShellLegacy: {
    paddingBottom: 34,
  },
  topNavbar: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    position: 'relative',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  welcomeTitle: {
    fontFamily: 'serif',
    fontSize: responsiveFontSize(30),
    lineHeight: responsiveFontSize(38),
    fontWeight: '600',
    color: palette.textStrong,
    marginBottom: verticalScale(8),
    textAlign: 'center',
    flexShrink: 1,
  },
  welcomeSubtitle: {
    fontSize: responsiveFontSize(14),
    lineHeight: responsiveFontSize(22),
    color: palette.subtitle,
    marginBottom: verticalScale(22),
    textAlign: 'center',
  },
  authCard: {
    borderRadius: moderateScale(24),
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(24),
  },
  authCardModern: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(22, 58, 36, 0.07)',
    shadowColor: '#163A24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  authCardLegacy: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 3,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: palette.dangerSoft,
    borderColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    marginBottom: verticalScale(18),
  },
  errorBannerText: {
    flex: 1,
    color: palette.danger,
    fontSize: responsiveFontSize(13),
    lineHeight: responsiveFontSize(19),
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: responsiveFontSize(13),
    lineHeight: responsiveFontSize(18),
    fontWeight: '700',
    color: palette.textStrong,
    letterSpacing: 0.3,
    flex: 1,
  },
  inputOuter: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: moderateScale(12),
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 10,
  },
  inputIcon: {
    marginRight: 12,
  },
  trailingIconButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: verticalScale(48),
    fontSize: responsiveFontSize(15),
    lineHeight: responsiveFontSize(20),
    fontWeight: '600',
    color: palette.textStrong,
    paddingVertical: 0,
    paddingLeft: scale(8),
  },
  textInputSecure: {
    fontSize: responsiveFontSize(18),
    letterSpacing: 3,
  },
  supportingCopy: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.textMuted,
    marginTop: -2,
    marginBottom: 8,
  },
  buttonWrap: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    minHeight: verticalScale(54),
    borderRadius: moderateScale(28),
    overflow: 'hidden',
    marginTop: verticalScale(10),
  },
  primaryButtonDisabled: {
    opacity: 0.62,
  },
  primaryButtonGradient: {
    flex: 1,
    minHeight: verticalScale(54),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: scale(16),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(15),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  verifyEmailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3FAF5',
    borderWidth: 1,
    borderColor: '#D3ECD9',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    marginBottom: verticalScale(20),
    gap: 8,
  },
  verifyEmailText: {
    flex: 1,
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: palette.textStrong,
  },
  changeEmailButton: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
  },
  changeEmailText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
    color: palette.primary,
    textDecorationLine: 'underline',
  },
  otpTimer: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: scale(220),
    marginBottom: verticalScale(14),
    gap: verticalScale(6),
  },
  otpTimerText: {
    fontSize: responsiveFontSize(11),
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  otpTimerTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  otpPromptLabel: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: palette.textStrong,
    marginBottom: verticalScale(12),
    textAlign: 'center',
  },
  otpWrapper: {
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scale(8),
    width: '100%',
  },
  otpBox: {
    flex: 1,
    maxWidth: scale(46),
    height: verticalScale(54),
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: '#FAFCFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: palette.primary,
    backgroundColor: '#FFFFFF',
    transform: [{ scale: 1.04 }],
  },
  otpBoxFilled: {
    borderColor: '#86EFAC',
    backgroundColor: '#FFFFFF',
  },
  otpDigitText: {
    fontSize: responsiveFontSize(22),
    fontWeight: '800',
    color: palette.textStrong,
  },
  hiddenOtpInput: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.01,
  },
});

const styles = authSharedStyles;
