import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVideoPlayer, VideoView } from '../../shared/platform/VideoCompat';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LoadingScreenVisual } from '../../shared/ui/OptimizedLoading';
import { ecoTheme } from '../../shared/theme/ecoTheme';

type AuthModeType = 'signin' | 'signup' | 'verify';
type FieldName = 'username' | 'email' | 'password' | 'verificationCode';
type FieldErrors = Partial<Record<FieldName, string>>;
type UsernameCheckState = 'idle' | 'checking' | 'available' | 'taken';

const isAndroid = Platform.OS === 'android';
const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : 0;
const isLegacyAndroid = isAndroid && androidVersion > 0 && androidVersion < 29;
const showEnhancedChrome = !isLegacyAndroid;

interface AuthViewProps {
  authLoading: boolean;
  authError: string | null;
  onLogin: (email: string, pass: string) => void;
  onGoogleSignIn: () => void;
  onContinueAsGuest: () => void;
  onSignUp: (username: string, email: string, pass: string, otpCode: string) => void;
  onSendOTP: (email: string) => Promise<{ success: boolean; message: string }>;
  onCheckUsernameAvailability: (displayName: string) => Promise<{ available: boolean; message: string }>;
}

const palette = {
  canvas: '#F9FAF5',
  title: '#163A24',
  subtitle: '#4B5563',
  primary: '#163A24',
  primaryBright: '#0F2919',
  primarySoft: '#F0F4EC',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  surface: '#FFFFFF',
  inputFill: '#FFFFFF',
  fieldIcon: '#9CA3AF',
  fieldIconActive: '#163A24',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  textStrong: '#163A24',
  textMuted: '#6B7280',
  separator: '#E5E7EB',
  googleBorder: '#E5E7EB',
  guestBorder: '#F0F4EC',
  glowTop: 'transparent',
  glowBottom: 'transparent',
};

const AUTH_COPY: Record<
  AuthModeType,
  {
    title: string;
    subtitle: string;
    primaryLabel: string;
    loadingLabel: string;
  }
> = {
  signin: {
    title: 'Welcome back',
    subtitle: 'Sign in to continue your eco goals, streaks, and verified impact.',
    primaryLabel: 'Log In',
    loadingLabel: 'Signing In...',
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Join ECOBUD and start building greener habits with guided rewards.',
    primaryLabel: 'Send Verification Code',
    loadingLabel: 'Sending Code...',
  },
  verify: {
    title: 'Verify your email',
    subtitle: 'Enter the 6-digit code we sent to secure your account and finish setup.',
    primaryLabel: 'Verify & Sign Up',
    loadingLabel: 'Verifying...',
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_EMAIL_ERROR_FRAGMENT = 'account already exists for this email';

function validateFields(
  mode: AuthModeType,
  values: {
    username: string;
    email: string;
    password: string;
    verificationCode: string;
  },
): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedUsername = values.username.trim();
  const trimmedEmail = values.email.trim().toLowerCase();
  const trimmedCode = values.verificationCode.trim();

  if (mode !== 'signin') {
    if (!trimmedUsername) {
      errors.username = 'Enter a username so your profile can be created.';
    } else if (trimmedUsername.length < 3) {
      errors.username = 'Username must be at least 3 characters.';
    }
  }

  if (!trimmedEmail) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  } else if (mode !== 'signin' && !trimmedEmail.endsWith('@gmail.com')) {
    errors.email = 'Use a @gmail.com address for sign up.';
  }

  if (!values.password) {
    errors.password = mode === 'signin' ? 'Password is required.' : 'Create a password.';
  } else if (mode !== 'signin' && values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  if (mode === 'verify') {
    if (!trimmedCode) {
      errors.verificationCode = 'Enter the 6-digit verification code.';
    } else if (!/^\d{6}$/.test(trimmedCode)) {
      errors.verificationCode = 'Verification code must be exactly 6 digits.';
    }
  }

  return errors;
}

function getRequiredFields(mode: AuthModeType): FieldName[] {
  if (mode === 'signin') {
    return ['email', 'password'];
  }

  if (mode === 'signup') {
    return ['username', 'email', 'password'];
  }

  return ['username', 'email', 'password', 'verificationCode'];
}



export function AuthView({
  authLoading,
  authError,
  onLogin,
  onGoogleSignIn,
  onContinueAsGuest,
  onSignUp,
  onSendOTP,
  onCheckUsernameAvailability,
}: AuthViewProps) {
  const player = useVideoPlayer(require('../../../assets/mobile-bg.mp4'), p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const [mode, setMode] = useState<AuthModeType>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [usernameCheckState, setUsernameCheckState] = useState<UsernameCheckState>('idle');
  const [usernameCheckMessage, setUsernameCheckMessage] = useState<string | null>(null);
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const isLoading = authLoading || isSendingCode;
  const [renderLoadingOverlay, setRenderLoadingOverlay] = useState(isLoading);

  const copy = AUTH_COPY[mode];
  const fieldErrors = useMemo(
    () =>
      validateFields(mode, {
        username,
        email,
        password,
        verificationCode,
      }),
    [email, mode, password, username, verificationCode],
  );

  const visibleFieldErrors = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(fieldErrors).filter(([field]) => touched[field as FieldName]),
      ) as FieldErrors,
    [fieldErrors, touched],
  );

  useEffect(() => {
    setUsernameCheckState('idle');
    setUsernameCheckMessage(null);
  }, [username]);

  useEffect(() => {
    if (
      mode === 'verify' &&
      authError?.toLowerCase().includes(DUPLICATE_EMAIL_ERROR_FRAGMENT)
    ) {
      setMode('signup');
      setVerificationCode('');
      setTouched({});
      setLocalError(authError);
    }
  }, [authError, mode]);

  const backgroundPalette = useMemo(
    () =>
      mode === 'signup'
        ? {
          base: ['#E6F5EC', '#FAFAF7', '#FEFCE8'] as const,
          topGlow: 'rgba(52, 211, 153, 0.25)',
          bottomGlow: 'rgba(250, 204, 21, 0.18)',
        }
        : mode === 'verify'
          ? {
            base: ['#ECFDF5', '#FAFAF9', '#FEFCE8'] as const,
            topGlow: 'rgba(16, 185, 129, 0.22)',
            bottomGlow: 'rgba(250, 204, 21, 0.18)',
          }
          : {
            base: ['#E6F4EA', '#FAFAF7', '#FEFCE8'] as const,
            topGlow: palette.glowTop,
            bottomGlow: palette.glowBottom,
          },
    [mode],
  );

  const loadingCopy = useMemo(
    () =>
      mode === 'signin'
        ? {
          label: 'Signing in',
          message: 'Unlocking your dashboard and restoring your EcoBud progress.',
        }
        : mode === 'verify'
          ? {
            label: 'Verifying account',
            message: 'Finishing your account setup with a secure verification check.',
          }
          : {
            label: 'Sending code',
            message: 'Preparing your email verification so you can continue sign up.',
          },
    [mode],
  );

  useEffect(() => {
    if (isLoading) {
      setRenderLoadingOverlay(true);
      loadingOpacity.stopAnimation();
      Animated.timing(loadingOpacity, {
        toValue: 1,
        duration: isLegacyAndroid ? 120 : 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!renderLoadingOverlay) {
      return;
    }

    loadingOpacity.stopAnimation();
    Animated.timing(loadingOpacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRenderLoadingOverlay(false);
      }
    });
  }, [isLoading, loadingOpacity, renderLoadingOverlay]);

  const markTouched = useCallback((field: FieldName) => {
    setTouched((current) => ({ ...current, [field]: true }));
  }, []);

  const switchMode = useCallback((nextMode: AuthModeType) => {
    setLocalError(null);
    setTouched({});
    setMode(nextMode);
    setUsernameCheckState('idle');
    setUsernameCheckMessage(null);
    if (nextMode !== 'verify') {
      setVerificationCode('');
    }
  }, []);

  const handleCheckUsername = useCallback(async () => {
    setLocalError(null);
    setTouched((current) => ({ ...current, username: true }));

    if (fieldErrors.username) {
      setUsernameCheckState('idle');
      setUsernameCheckMessage(null);
      return;
    }

    setIsCheckingUsername(true);
    setUsernameCheckState('checking');

    try {
      const response = await onCheckUsernameAvailability(username.trim());
      setUsernameCheckState(response.available ? 'available' : 'taken');
      setUsernameCheckMessage(response.message);
    } catch (error) {
      setUsernameCheckState('idle');
      setUsernameCheckMessage(
        error instanceof Error ? error.message : 'Unable to check that username right now.',
      );
    } finally {
      setIsCheckingUsername(false);
    }
  }, [fieldErrors.username, onCheckUsernameAvailability, username]);

  const handleAction = useCallback(async () => {
    setLocalError(null);

    const requiredFields = getRequiredFields(mode);
    setTouched((current) => ({
      ...current,
      ...Object.fromEntries(requiredFields.map((field) => [field, true])),
    }));

    const hasErrors = requiredFields.some((field) => Boolean(fieldErrors[field]));
    if (hasErrors) {
      return;
    }

    if (mode === 'signin') {
      onLogin(email.trim(), password);
      return;
    }

    if (mode === 'signup') {
      if (usernameCheckState === 'taken') {
        setLocalError('That username is already taken. Please choose another one.');
        return;
      }

      setIsSendingCode(true);
      try {
        await onSendOTP(email.trim());
        setMode('verify');
        setTouched({});
      } catch (error) {
        setLocalError(
          error instanceof Error ? error.message : 'Failed to send verification code.',
        );
      } finally {
        setIsSendingCode(false);
      }
      return;
    }

    onSignUp(username.trim(), email.trim(), password, verificationCode.trim());
  }, [email, fieldErrors, mode, onLogin, onSendOTP, onSignUp, password, username, usernameCheckState, verificationCode]);

  const bannerMessage = localError || authError;
  const verifySubtitle =
    mode === 'verify' && email
      ? `Enter the 6-digit code we sent to ${email.trim()} to finish your account setup.`
      : copy.subtitle;

  return (
    <View style={{ flex: 1 }}>
      <VideoView style={StyleSheet.absoluteFill} player={player as any} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(249, 250, 245, 0.4)' }]} />
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
          contentContainerStyle={[styles.authShell, isLegacyAndroid && styles.authShellLegacy]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topNavbar}>
            <Image
              source={require('../../../assets/logo.png')}
              style={[styles.topNavAvatar, isLegacyAndroid && styles.topNavAvatarLegacy]}
              fadeDuration={0}
            />
            <Text style={styles.topNavTitle}>ECOBUD</Text>
          </View>

          <View style={styles.contentContainer}>
            {showEnhancedChrome ? <View pointerEvents="none" style={styles.titleAura} /> : null}

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' }}>
              <Text style={styles.welcomeTitle}>{copy.title}</Text>
              <Ionicons name="leaf" size={18} color={palette.primary} style={{ marginTop: 2, marginLeft: 2 }} />
            </View>
            <Text style={styles.welcomeSubtitle}>{verifySubtitle}</Text>

            <View
              style={[styles.authCard, isLegacyAndroid ? styles.authCardLegacy : styles.authCardModern]}
              renderToHardwareTextureAndroid={isAndroid}
            >
              {bannerMessage ? <InlineBanner message={bannerMessage} /> : null}

              {mode !== 'signin' ? (
                <CustomInputField
                  label="Username"
                  labelIcon="person-outline"
                  value={username}
                  onChangeText={setUsername}
                  onBlur={() => markTouched('username')}
                  iconName="person-outline"
                  helperText={usernameCheckMessage}
                  helperTone={
                    usernameCheckState === 'available'
                      ? 'success'
                      : usernameCheckState === 'taken'
                        ? 'danger'
                        : 'neutral'
                  }
                  autoCapitalize="words"
                  autoComplete="username"
                  textContentType="username"
                  error={visibleFieldErrors.username}
                  returnKeyType="next"
                  actionLabel={mode === 'signup' ? 'Check' : undefined}
                  onActionPress={mode === 'signup' ? () => void handleCheckUsername() : undefined}
                  actionLoading={mode === 'signup' ? isCheckingUsername : false}
                  actionDisabled={mode !== 'signup' || isLoading || username.trim().length < 2}
                />
              ) : null}

              <CustomInputField
                label="Email Address"
                labelIcon="leaf-outline"
                value={email}
                onChangeText={setEmail}
                onBlur={() => markTouched('email')}
                iconName="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                error={visibleFieldErrors.email}
                returnKeyType="next"
                placeholder="nature@ecobud.com"
              />

              <CustomInputField
                label="Password"
                labelIcon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                onBlur={() => markTouched('password')}
                iconName="lock-closed-outline"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                error={visibleFieldErrors.password}
                returnKeyType={mode === 'verify' ? 'next' : 'done'}
                trailingIconName={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onTrailingPress={() => setShowPassword((current) => !current)}
                placeholder="Enter your password"
              />

              {mode === 'verify' ? (
                <CustomInputField
                  label="Verification Code"
                  labelIcon="key-outline"
                  value={verificationCode}
                  onChangeText={(value) => setVerificationCode(value.replace(/[^\d]/g, '').slice(0, 6))}
                  onBlur={() => markTouched('verificationCode')}
                  iconName="key-outline"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  error={visibleFieldErrors.verificationCode}
                  returnKeyType="done"
                />
              ) : null}

              {mode !== 'signin' ? (
                <Text style={styles.supportingCopy}>
                  {mode === 'signup'
                    ? 'We’ll send a one-time code to confirm your email before creating your account.'
                    : 'If the code does not arrive, return to sign up and request a fresh one.'}
                </Text>
              ) : null}

              <PrimaryButton
                label={isLoading ? copy.loadingLabel : copy.primaryLabel}
                onPress={() => {
                  void handleAction();
                }}
                disabled={isLoading}
                loading={isLoading}
              />

              {mode !== 'verify' ? (
                <>
                  <AuthSeparator label="OR" />

                  <SocialButton
                    label="Continue with Google"
                    iconName="logo-google"
                    onPress={onGoogleSignIn}
                    disabled={isLoading}
                  />

                  <SecondaryButton
                    label="Continue as Guest Viewer"
                    iconName="eye-outline"
                    onPress={onContinueAsGuest}
                    disabled={isLoading}
                    tone="soft"
                  />

                  <Text style={styles.guestViewerHint}>
                    Guests can browse public events and transparency updates only.
                  </Text>
                </>
              ) : null}
            </View>

            <View style={styles.footerSwitchRow}>
              <Text style={styles.footerSwitchText}>
                {mode === 'signin'
                  ? 'Need an account?'
                  : mode === 'verify'
                    ? 'Want to update your email?'
                    : 'Already have an account?'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (mode === 'signin') {
                    switchMode('signup');
                  } else if (mode === 'verify') {
                    switchMode('signup');
                  } else {
                    switchMode('signin');
                  }
                }}
                style={({ pressed }) => [styles.footerSwitchLink, pressed && styles.footerSwitchLinkPressed]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.footerSwitchLinkText}>
                    {mode === 'signin'
                      ? 'Create account'
                      : mode === 'verify'
                        ? 'Back to sign up'
                        : 'Log in'}
                  </Text>
                  {mode === 'signin' && (
                    <Ionicons name="leaf-outline" size={14} color={palette.primary} style={{ marginLeft: 4, marginTop: 4 }} />
                  )}
                </View>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {renderLoadingOverlay ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 1000,
              opacity: loadingOpacity,
            },
          ]}
          pointerEvents={isLoading ? 'auto' : 'none'}
        >
          <LoadingScreenVisual label={loadingCopy.label} message={loadingCopy.message} />
        </Animated.View>
      ) : null}
    </View>
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
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle-outline" size={18} color={palette.danger} />
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

interface CustomInputFieldProps {
  label: string;
  labelIcon?: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  onChangeText: (value: string) => void;
  onBlur: () => void;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  error?: string;
  helperText?: string | null;
  helperTone?: 'neutral' | 'success' | 'danger';
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  secureTextEntry?: boolean;
  placeholder?: string;
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  textContentType?: React.ComponentProps<typeof TextInput>['textContentType'];
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  trailingIconName?: React.ComponentProps<typeof Ionicons>['name'];
  onTrailingPress?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
  actionLoading?: boolean;
  actionDisabled?: boolean;
}

function CustomInputField({
  label,
  labelIcon,
  value,
  onChangeText,
  onBlur,
  iconName,
  error,
  helperText,
  helperTone = 'neutral',
  keyboardType = 'default',
  secureTextEntry,
  placeholder,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  returnKeyType = 'done',
  trailingIconName,
  onTrailingPress,
  actionLabel,
  onActionPress,
  actionLoading = false,
  actionDisabled = false,
}: CustomInputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const focusValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusValue, {
      toValue: isFocused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focusValue, isFocused]);

  const borderColor = focusValue.interpolate({
    inputRange: [0, 1],
    outputRange: [palette.border, palette.borderStrong],
  });

  const fillColor = focusValue.interpolate({
    inputRange: [0, 1],
    outputRange: [palette.inputFill, palette.surface],
  });

  const shadowOpacity = focusValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.16],
  });

  return (
    <View style={styles.inputGroup}>
      <View style={styles.inputLabelRow}>
        {labelIcon ? <Ionicons name={labelIcon} size={14} color={palette.primary} style={{ marginRight: 6, marginTop: 1 }} /> : null}
        <Text style={[styles.inputLabel, isFocused && styles.inputLabelActive]}>{label}</Text>
        {actionLabel && onActionPress ? (
          <Pressable
            accessibilityRole="button"
            disabled={actionDisabled || actionLoading}
            onPress={onActionPress}
            style={({ pressed }) => [
              styles.inputActionButton,
              (actionDisabled || actionLoading) && styles.inputActionButtonDisabled,
              pressed && !(actionDisabled || actionLoading) && styles.inputActionButtonPressed,
            ]}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <Text style={styles.inputActionButtonText}>{actionLabel}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
      <Animated.View
        style={[
          styles.inputOuter,
          {
            borderColor: error ? palette.danger : borderColor,
            backgroundColor: fillColor,
            shadowOpacity: error ? 0 : shadowOpacity,
          },
          error ? styles.inputOuterError : null,
          !showEnhancedChrome && styles.inputOuterFallback,
        ]}
      >
        <View style={styles.inputRow}>
          <Ionicons
            name={iconName}
            size={18}
            color={isFocused ? palette.fieldIconActive : palette.fieldIcon}
            style={styles.inputIcon}
          />
          <TextInput
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            spellCheck={false}
            autoComplete={autoComplete}
            textContentType={textContentType}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            selectionColor={palette.primary}
            underlineColorAndroid="transparent"
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              onBlur();
            }}
            style={[
              styles.textInput,
              secureTextEntry && Boolean(value) && styles.textInputSecure,
            ]}
            returnKeyType={returnKeyType}
            accessibilityLabel={label}
          />
          {trailingIconName && onTrailingPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={secureTextEntry ? 'Show password' : 'Hide password'}
              hitSlop={12}
              onPress={onTrailingPress}
              style={({ pressed }) => [
                styles.trailingIconButton,
                pressed && styles.trailingIconButtonPressed,
              ]}
            >
              <Ionicons
                name={trailingIconName}
                size={18}
                color={isFocused ? palette.fieldIconActive : palette.fieldIcon}
              />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
      {error ? <Text style={styles.inlineErrorText}>{error}</Text> : null}
      {!error && helperText ? (
        <Text
          style={[
            styles.helperText,
            helperTone === 'success' && styles.helperTextSuccess,
            helperTone === 'danger' && styles.helperTextDanger,
          ]}
        >
          {helperText}
        </Text>
      ) : null}
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
          style={[styles.primaryButtonGradient, { backgroundColor: palette.primary }]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>{label}</Text>
              <Ionicons name="arrow-forward-outline" size={18} color="#FFFFFF" />
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SocialButton({ label, onPress, disabled, iconName }: AuthButtonProps) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.99);

  return (
    <Animated.View style={[styles.buttonWrap, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={disabled ? undefined : { color: 'rgba(18,96,39,0.08)' }}
        style={[styles.secondaryButton, styles.googleButton, disabled && styles.secondaryButtonDisabled]}
      >
        {iconName ? <Ionicons name={iconName} size={20} color="#DB4437" /> : null}
        <Text style={styles.secondaryButtonText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
  iconName,
  tone = 'outline',
}: AuthButtonProps & { tone?: 'outline' | 'soft' }) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.99);

  return (
    <Animated.View style={[styles.buttonWrap, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={disabled ? undefined : { color: 'rgba(18,96,39,0.08)' }}
        style={[
          styles.secondaryButton,
          tone === 'soft' ? styles.softButton : styles.outlineButton,
          disabled && styles.secondaryButtonDisabled,
        ]}
      >
        {iconName ? <Ionicons name={iconName} size={18} color={palette.primary} /> : null}
        <Text style={styles.secondaryButtonText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function AuthSeparator({ label }: { label: string }) {
  return (
    <View style={styles.separatorRow}>
      <View style={styles.separatorLine} />
      <Text style={styles.separatorText}>{label}</Text>
      <View style={styles.separatorLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFill,
  },
  backgroundBloomTop: {
    position: 'absolute',
    top: -86,
    right: -66,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  backgroundBloomBottom: {
    position: 'absolute',
    bottom: 90,
    left: -84,
    width: 280,
    height: 280,
    borderRadius: 140,
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
  topNavAvatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  topNavAvatarLegacy: {
    borderWidth: 1,
  },
  topNavTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: palette.primary,
  },
  topNavSpacer: {
    width: 46,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    position: 'relative',
  },
  titleAura: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 82,
    height: 124,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  welcomeTitle: {
    fontFamily: 'serif',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
    color: palette.textStrong,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: palette.subtitle,
    marginBottom: 26,
    textAlign: 'center',
  },
  authCard: {
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
  },
  authCardModern: {
    backgroundColor: palette.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  authCardLegacy: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.border,
    elevation: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: palette.dangerSoft,
    borderColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  errorBannerText: {
    flex: 1,
    color: palette.danger,
    fontSize: 13,
    lineHeight: 19,
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: palette.textStrong,
    letterSpacing: 0.3,
    flex: 1,
  },
  inputLabelActive: {
    color: palette.primary,
  },
  inputActionButton: {
    minHeight: 32,
    minWidth: 68,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E8DC',
    backgroundColor: '#F6FBF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputActionButtonDisabled: {
    opacity: 0.6,
  },
  inputActionButtonPressed: {
    backgroundColor: '#EEF6F1',
  },
  inputActionButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.primary,
    letterSpacing: 0.2,
  },
  inputOuter: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  inputOuterFallback: {
    shadowOpacity: 0,
    elevation: 0,
  },
  inputOuterError: {
    borderColor: palette.danger,
    shadowOpacity: 0,
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
  trailingIconButtonPressed: {
    backgroundColor: 'rgba(16, 91, 41, 0.06)',
  },
  textInput: {
    flex: 1,
    minHeight: 54,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: palette.textStrong,
    paddingVertical: 0,
    paddingLeft: 8,
  },
  textInputSecure: {
    fontSize: 20,
    letterSpacing: 3,
  },
  inlineErrorText: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.danger,
    marginTop: 7,
    marginLeft: 2,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.textMuted,
    marginTop: 7,
    marginLeft: 2,
    fontWeight: '600',
  },
  helperTextSuccess: {
    color: '#16A34A',
  },
  helperTextDanger: {
    color: palette.danger,
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
    minHeight: 54,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.62,
  },
  primaryButtonGradient: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.separator,
  },
  separatorText: {
    marginHorizontal: 14,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: palette.textMuted,
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  googleButton: {
    borderWidth: 1,
    borderColor: palette.googleBorder,
    backgroundColor: '#FFFFFF',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: palette.guestBorder,
    backgroundColor: '#FFFFFF',
  },
  softButton: {
    borderWidth: 0,
    backgroundColor: palette.primarySoft,
    marginTop: 14,
  },
  secondaryButtonDisabled: {
    opacity: 0.56,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textStrong,
  },
  guestViewerHint: {
    marginTop: 10,
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  footerSwitchRow: {
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSwitchText: {
    fontSize: 15,
    lineHeight: 20,
    color: palette.textStrong,
    marginBottom: 4,
  },
  footerSwitchLink: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  footerSwitchLinkPressed: {
    opacity: 0.68,
  },
  footerSwitchLinkText: {
    fontSize: 16,
    lineHeight: 20,
    color: palette.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
