import React, { useEffect, useRef, useState } from 'react';
import { AppState, Easing, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';
import { ecobudApi } from '../../shared/api/ecobudApi';
import { getOtpCountdown, getOtpDeadline } from './otpTimer';
import { Animated } from '../../shared/accessibility/animations';
import { AuthBackgroundVideo } from './AuthBackgroundVideo';
import { responsiveFontSize, verticalScale } from '../../app/utils/responsive';
import { isAndroid, isLegacyAndroid, palette, AnimatedThemeToggle, InlineBanner, PrimaryButton, authSharedStyles } from './authShared';

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

const styles = StyleSheet.create({
  ...authSharedStyles,
  resendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: verticalScale(8) },
  resendText: { fontSize: responsiveFontSize(13), color: palette.textMuted },
  resendButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  resendLink: { fontSize: responsiveFontSize(13), fontWeight: '700' },
  backLink: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: verticalScale(18) },
  backText: { fontSize: responsiveFontSize(13), fontWeight: '700' },
  successIcon: { alignItems: 'center', marginBottom: verticalScale(14) }

});
