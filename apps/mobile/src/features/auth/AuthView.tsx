import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  canvas: '#F2FAF5',
  title: ecoTheme.colors.text,
  subtitle: '#60736B',
  primary: ecoTheme.colors.primaryDark,
  primaryBright: '#1E7D38',
  primarySoft: '#E8F5EC',
  border: '#D4E5DA',
  borderStrong: '#2A8454',
  surface: '#FFFFFF',
  inputFill: '#F8FCF9',
  fieldIcon: '#6C8178',
  fieldIconActive: '#126027',
  danger: '#B93834',
  dangerSoft: '#FDF1F0',
  textStrong: ecoTheme.colors.text,
  textMuted: ecoTheme.colors.textSoft,
  separator: '#DCE7E0',
  googleBorder: '#D9E7DE',
  guestBorder: '#CFE4D5',
  glowTop: 'rgba(74, 222, 128, 0.18)',
  glowBottom: 'rgba(18, 96, 39, 0.10)',
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
            base: ['#D6F2DE', '#F8FCF8', '#E4F2E8'] as const,
            topGlow: 'rgba(74, 222, 128, 0.22)',
            bottomGlow: 'rgba(18, 96, 39, 0.12)',
          }
        : mode === 'verify'
          ? {
              base: ['#DDF1E3', '#FBFDFC', '#EAF4EE'] as const,
              topGlow: 'rgba(18, 96, 39, 0.16)',
              bottomGlow: 'rgba(74, 222, 128, 0.14)',
            }
          : {
              base: ['#E3F5E8', '#FCFEFC', '#EAF4EE'] as const,
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
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={backgroundPalette.base}
        start={{ x: 0.04, y: 0 }}
        end={{ x: 0.96, y: 1 }}
        pointerEvents="none"
        style={styles.backgroundGradient}
      />
      {showEnhancedChrome ? (
        <>
          <View
            pointerEvents="none"
            style={[styles.backgroundBloomTop, { backgroundColor: backgroundPalette.topGlow }]}
          />
          <View
            pointerEvents="none"
            style={[styles.backgroundBloomBottom, { backgroundColor: backgroundPalette.bottomGlow }]}
          />
        </>
      ) : null}
      <StatusBar style="dark" />

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
            <View style={styles.topNavSpacer} />
          </View>

          <View style={styles.contentContainer}>
            {showEnhancedChrome ? <View pointerEvents="none" style={styles.titleAura} /> : null}

            <Text style={styles.welcomeTitle}>{copy.title}</Text>
            <Text style={styles.welcomeSubtitle}>{verifySubtitle}</Text>

            <View
              style={[styles.authCard, isLegacyAndroid ? styles.authCardLegacy : styles.authCardModern]}
              renderToHardwareTextureAndroid={isAndroid}
            >
              {bannerMessage ? <InlineBanner message={bannerMessage} /> : null}

              {mode !== 'signin' ? (
                <CustomInputField
                  label="Username"
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
              />

              <CustomInputField
                label="Password"
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
              />

              {mode === 'verify' ? (
                <CustomInputField
                  label="Verification Code"
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
                <Text style={styles.footerSwitchLinkText}>
                  {mode === 'signin'
                    ? 'Create account'
                    : mode === 'verify'
                      ? 'Back to sign up'
                      : 'Log in'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </SafeAreaView>
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
  value: string;
  onChangeText: (value: string) => void;
  onBlur: () => void;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  error?: string;
  helperText?: string | null;
  helperTone?: 'neutral' | 'success' | 'danger';
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  secureTextEntry?: boolean;
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
  value,
  onChangeText,
  onBlur,
  iconName,
  error,
  helperText,
  helperTone = 'neutral',
  keyboardType = 'default',
  secureTextEntry,
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
            placeholderTextColor="#92A39C"
            selectionColor={palette.primary}
            underlineColorAndroid="transparent"
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              onBlur();
            }}
            style={styles.textInput}
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
        <LinearGradient
          colors={[palette.primary, palette.primaryBright]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryButtonGradient}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>{label}</Text>
              <Ionicons name="arrow-forward-outline" size={18} color="#FFFFFF" />
            </>
          )}
        </LinearGradient>
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
    backgroundColor: palette.canvas,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
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
    marginTop: 22,
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topNavAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(18,96,39,0.14)',
    backgroundColor: '#FFFFFF',
  },
  topNavAvatarLegacy: {
    borderWidth: 1,
  },
  topNavTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 3.2,
    color: palette.title,
    marginHorizontal: 12,
  },
  topNavSpacer: {
    width: 46,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 18,
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
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '700',
    color: palette.textStrong,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: palette.subtitle,
    marginBottom: 28,
    maxWidth: 332,
  },
  authCard: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  authCardModern: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#126027',
    shadowOpacity: 0.14,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 7,
  },
  authCardLegacy: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    elevation: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: palette.dangerSoft,
    borderColor: '#F2CECB',
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
    color: palette.textMuted,
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
    borderWidth: 1.25,
    borderRadius: 20,
    backgroundColor: palette.inputFill,
    shadowColor: palette.primary,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
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
    minHeight: 60,
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
    backgroundColor: 'rgba(18,96,39,0.06)',
  },
  textInput: {
    flex: 1,
    minHeight: 58,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: palette.textStrong,
    paddingVertical: 0,
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
    color: '#1C7A43',
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
    minHeight: 58,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#126027',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  primaryButtonDisabled: {
    opacity: 0.62,
  },
  primaryButtonGradient: {
    flex: 1,
    minHeight: 58,
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
    minHeight: 56,
    borderRadius: 18,
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
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: palette.guestBorder,
    backgroundColor: '#FFFFFF',
  },
  softButton: {
    borderWidth: 1,
    borderColor: '#D9EBDD',
    backgroundColor: palette.primarySoft,
    marginTop: 14,
  },
  secondaryButtonDisabled: {
    opacity: 0.56,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primary,
  },
  guestViewerHint: {
    marginTop: 10,
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  footerSwitchRow: {
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSwitchText: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.textMuted,
    marginBottom: 6,
  },
  footerSwitchLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  footerSwitchLinkPressed: {
    opacity: 0.68,
  },
  footerSwitchLinkText: {
    fontSize: 15,
    lineHeight: 20,
    color: palette.primary,
    fontWeight: '800',
  },
});
