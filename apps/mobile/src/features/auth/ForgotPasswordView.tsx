import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Easing, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, TouchableOpacity } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';
import { ecobudApi } from '../../shared/api/ecobudApi';
import { getOtpCountdown, getOtpDeadline } from './otpTimer';
import { Animated } from '../../shared/accessibility/animations';
import { AuthBackgroundVideo } from './AuthBackgroundVideo';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';

const palette = {
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

const isAndroid = Platform.OS === 'android';
const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : 0;
const isLegacyAndroid = isAndroid && androidVersion > 0 && androidVersion < 29;

type Step = 'email' | 'code' | 'password' | 'success';

export function ForgotPasswordView({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const colors = theme.colors;
  const darkBgOpacity = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const [keyboardSpace, setKeyboardSpace] = useState(0);

  useEffect(() => {
    Animated.timing(darkBgOpacity, { toValue: isDark ? 1 : 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [isDark, darkBgOpacity]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => setKeyboardSpace(event.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardSpace(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail.trim());
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const countdown = getOtpCountdown(deadline, now);

  useEffect(() => {
    if (step !== 'code' && step !== 'password') return;
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 1000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [step, deadline]);

  const setTiming = (response: { expiresAt: string; serverTime: string }) => {
    const current = Date.now();
    setDeadline(getOtpDeadline(response, current));
    setNow(current);
  };
  const sendCode = async () => {
    const response = await ecobudApi.requestPasswordReset(email.trim());
    setMessage(response.message);
    setTiming(response);
    setCode('');
    setStep('code');
  };
  const run = async (action: () => Promise<void>) => {
    Keyboard.dismiss();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not complete the password reset. Try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const restart = () => {
    Keyboard.dismiss();
    setStep('email'); setCode(''); setResetToken(''); setPassword(''); setConfirmation(''); setError(null); setDeadline(null);
  };
  const submit = () => run(async () => {
    if (step === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.');
      await sendCode();
    } else if (step === 'code') {
      if (getOtpCountdown(deadline, Date.now()).expired) throw new Error('Code expired. Request a new code.');
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit reset code.');
      const response = await ecobudApi.verifyPasswordResetCode(email.trim(), code);
      setResetToken(response.resetToken); setTiming(response); setCode(''); setStep('password');
    } else if (step === 'password') {
      if (getOtpCountdown(deadline, Date.now()).expired) throw new Error('Reset session expired. Start again.');
      if (password.length < 8 || password.length > 72 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        throw new Error('Use 8–72 characters with at least one letter and one number.');
      }
      if (password !== confirmation) throw new Error('Passwords do not match.');
      await ecobudApi.completePasswordReset(resetToken, password);
      setPassword(''); setConfirmation(''); setResetToken(''); setStep('success');
    }
  });
  const titles: Record<Step, string> = { email: 'Forgot password?', code: 'Verify reset code', password: 'Set a new password', success: 'Password updated' };
  const subtitles: Record<Step, string> = {
    email: 'Enter your account email to request a password reset code.',
    code: 'Enter the 6-digit reset code to continue.',
    password: 'Use 8–72 characters with at least one letter and one number.',
    success: 'Sign in with your new password. Your previous sessions have been signed out.',
  };
  const buttonLabels: Record<Step, string> = { email: 'Send Reset Code', code: 'Verify Code', password: 'Reset Password', success: 'Back to Login' };
  const buttonDisabled = busy || ((step === 'code' || step === 'password') && countdown.expired);

  return <View style={{ flex: 1, backgroundColor: isDark ? '#0E1512' : '#F9FAF5' }}>
    <AuthBackgroundVideo />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14, 21, 18, 0.90)', opacity: darkBgOpacity }]} />
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.authShell, isLegacyAndroid && styles.authShellLegacy, keyboardSpace > 0 && { paddingBottom: keyboardSpace + 40 }]}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={styles.topNavbar}>
            <AnimatedThemeToggle isDark={isDark} onToggle={toggleTheme} />
            <Image source={require('../../../assets/ecobud_logo_circle.png')} style={{ width: 72, height: 72, borderRadius: 36, resizeMode: 'contain' }} fadeDuration={0} />
          </View>
          <View style={styles.contentContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' }}>
              <Text style={[styles.welcomeTitle, isDark && { color: colors.textPrimary }]}>{titles[step]}</Text>
              <Ionicons name="leaf" size={18} color={isDark ? colors.primary : palette.primary} style={{ marginTop: 2, marginLeft: 2 }} />
            </View>
            <Text style={[styles.welcomeSubtitle, isDark && { color: colors.textMuted }]}>{subtitles[step]}</Text>
            <View style={[styles.authCard, isLegacyAndroid ? styles.authCardLegacy : styles.authCardModern,
              isDark && { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.3 }]}
              renderToHardwareTextureAndroid={isAndroid}>
              {error ? <View accessibilityRole="alert"><InlineBanner message={error} /></View> : null}
              {step === 'email' ? <>
                <ResetField label="Email Address" labelIcon="leaf-outline" icon="mail-outline" value={email} onChangeText={setEmail} editable={!busy}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
                  placeholder="nature@gmail.com or student@univ.edu.ph" returnKeyType="done" onSubmitEditing={() => void submit()} />
                <Text style={[styles.supportingCopy, isDark && { color: colors.textMuted }]}>Signed up with Google? Use Continue with Google on the login screen.</Text>
              </> : null}
              {step === 'code' ? <View style={[styles.verifyEmailBadge, isDark && { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={16} color={isDark ? colors.primary : palette.primary} />
                <Text style={[styles.verifyEmailText, isDark && { color: colors.textPrimary }]} numberOfLines={1}>{email.trim()}</Text>
                <Pressable accessibilityRole="button" disabled={busy} onPress={restart} hitSlop={8} style={styles.changeEmailButton}>
                  <Text style={[styles.changeEmailText, isDark && { color: colors.primary }]}>Edit</Text>
                </Pressable>
              </View> : null}
              {step === 'code' || step === 'password' ? <View style={styles.otpTimer}>
                <Text style={[styles.otpTimerText, { color: countdown.expired ? (isDark ? '#F87171' : palette.danger) : colors.textMuted }]}>
                  {countdown.expired ? (step === 'code' ? 'Code expired. Request a new code.' : 'Reset session expired. Start again.') : `${step === 'code' ? 'Code' : 'Reset session'} expires in ${countdown.label}`}
                </Text>
                <View accessible accessibilityRole="progressbar" accessibilityLabel="Password reset time remaining"
                  accessibilityValue={{ min: 0, max: 300, now: countdown.seconds, text: countdown.label }} style={[styles.otpTimerTrack, { backgroundColor: isDark ? colors.border : palette.separator }]}>
                  <View style={{ height: '100%', width: `${countdown.progress * 100}%`, backgroundColor: isDark ? colors.primary : palette.primary }} />
                </View>
              </View> : null}
              {step === 'code' ? <>
                <Text style={[styles.otpPromptLabel, isDark && { color: colors.textPrimary }]}>Enter the 6-digit reset code</Text>
                <ResetCodeInput value={code} onChange={setCode} disabled={busy} />
                <Text style={[styles.supportingCopy, isDark && { color: colors.textMuted }]}>{message}</Text>
                <View style={styles.resendRow}>
                  <Text style={[styles.resendText, isDark && { color: colors.textMuted }]}>Didn't receive the code?</Text>
                  <Pressable disabled={busy || !countdown.expired} accessibilityRole="button" onPress={() => void run(sendCode)} style={styles.resendButton}>
                    <Text style={[styles.resendLink, { color: busy || !countdown.expired ? colors.textMuted : (isDark ? colors.primary : palette.primary) }]}>
                      {countdown.expired ? 'Resend Code' : `Resend in ${countdown.label}`}
                    </Text>
                  </Pressable>
                </View>
              </> : null}
              {step === 'password' ? <>
                <ResetField label="New Password" labelIcon="lock-closed-outline" icon="lock-closed-outline" editable={!busy} value={password} onChangeText={setPassword}
                  secureTextEntry={!showPasswords} onToggleVisibility={() => setShowPasswords(!showPasswords)} placeholder="Enter your new password"
                  autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={72} />
                <ResetField label="Confirm Password" labelIcon="lock-closed-outline" icon="lock-closed-outline" editable={!busy} value={confirmation} onChangeText={setConfirmation}
                  secureTextEntry={!showPasswords} onToggleVisibility={() => setShowPasswords(!showPasswords)} placeholder="Confirm your new password"
                  autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={72} returnKeyType="done" onSubmitEditing={() => void submit()} />
                {countdown.expired ? <Pressable disabled={busy} onPress={restart} style={styles.backLink}><Text style={{ color: isDark ? colors.primary : palette.primary }}>Start again</Text></Pressable> : null}
              </> : null}
              {step === 'success' ? <View style={styles.successIcon}><Ionicons name="checkmark-circle-outline" size={48} color={isDark ? colors.primary : palette.primary} /></View> : null}
              <PrimaryButton label={buttonLabels[step]} disabled={buttonDisabled} loading={busy}
                onPress={() => { Keyboard.dismiss(); if (step === 'success') onBack(); else void submit(); }} />
            </View>
            {step !== 'success' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { Keyboard.dismiss(); onBack(); }} style={styles.backLink}>
              <Ionicons name="arrow-back-outline" size={16} color={isDark ? colors.primary : palette.primary} />
              <Text style={[styles.backText, { color: isDark ? colors.primary : palette.primary }]}>Back to Login</Text>
            </Pressable> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}

function ResetField({ label, labelIcon, icon, onToggleVisibility, ...props }: React.ComponentProps<typeof TextInput> & {
  label: string; labelIcon: React.ComponentProps<typeof Ionicons>['name']; icon: React.ComponentProps<typeof Ionicons>['name']; onToggleVisibility?: () => void;
}) {
  const { theme, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const accent = isDark ? theme.colors.primary : palette.primary;
  return <View style={styles.inputGroup}>
    <View style={styles.inputLabelRow}>
      <Ionicons name={labelIcon} size={14} color={accent} style={{ marginRight: 6, marginTop: 1 }} />
      <Text style={[styles.inputLabel, isDark && { color: theme.colors.textPrimary }]}>{label}</Text>
    </View>
    <View style={[styles.inputOuter, { borderColor: isDark ? (focused ? accent : theme.colors.inputBorder) : (focused ? palette.borderStrong : palette.border),
      backgroundColor: isDark ? theme.colors.inputBackground : (focused ? palette.surface : palette.inputFill) }]}>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={18} color={focused ? accent : (isDark ? theme.colors.textMuted : palette.fieldIcon)} style={styles.inputIcon} />
        <TextInput {...props} accessibilityLabel={label} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholderTextColor={isDark ? theme.colors.textMuted : palette.fieldIcon} selectionColor={accent} underlineColorAndroid="transparent"
          style={[styles.textInput, isDark && { color: theme.colors.textPrimary }, props.secureTextEntry && Boolean(props.value) && styles.textInputSecure]} />
        {onToggleVisibility ? <Pressable accessibilityRole="button" accessibilityLabel={props.secureTextEntry ? 'Show password' : 'Hide password'}
          disabled={props.editable === false} onPress={onToggleVisibility} hitSlop={12} style={styles.trailingIconButton}>
          <Ionicons name={props.secureTextEntry ? 'eye-outline' : 'eye-off-outline'} size={18} color={focused ? accent : (isDark ? theme.colors.textMuted : palette.fieldIcon)} />
        </Pressable> : null}
      </View>
    </View>
  </View>;
}

function ResetCodeInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const { theme, isDark } = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return <View style={styles.otpWrapper}>
    <View style={styles.otpBoxesRow} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.otpBox,
        isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder },
        Boolean(value[index]) && (isDark ? { borderColor: theme.colors.primary, backgroundColor: theme.colors.card } : styles.otpBoxFilled),
        focused && index === Math.min(value.length, 5) && (isDark ? { borderColor: theme.colors.primary, backgroundColor: theme.colors.card } : styles.otpBoxActive)]}>
        <Text style={[styles.otpDigitText, isDark && { color: theme.colors.textPrimary }]}>{value[index] || ''}</Text>
      </View>)}
    </View>
    <TextInput ref={input} value={value} editable={!disabled} accessibilityLabel="Six-digit password reset code"
      onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, 6))} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} caretHidden style={styles.hiddenOtpInput} />
  </View>;
}

function AnimatedThemeToggle({
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

function usePressScale(pressedScale = 0.98) {
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

function InlineBanner({ message }: { message: string }) {
  const { theme, isDark } = useTheme();
  return (
    <View style={[styles.errorBanner, isDark && { backgroundColor: '#3D1414', borderColor: '#7F1D1D' }]}>
      <Ionicons name="alert-circle-outline" size={18} color={isDark ? '#F87171' : palette.danger} />
      <Text style={[styles.errorBannerText, isDark && { color: '#FECACA' }]}>{message}</Text>
    </View>
  );
}

interface AuthButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
}

function PrimaryButton({ label, onPress, disabled, loading }: AuthButtonProps) {
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

const styles = StyleSheet.create({
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
  resendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: verticalScale(8) },
  resendText: { fontSize: responsiveFontSize(13), color: palette.textMuted },
  resendButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  resendLink: { fontSize: responsiveFontSize(13), fontWeight: '700' },
  backLink: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: verticalScale(18) },
  backText: { fontSize: responsiveFontSize(13), fontWeight: '700' },
  successIcon: { alignItems: 'center', marginBottom: verticalScale(14) }

});
