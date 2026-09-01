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
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { BARANGAYS } from '../../shared/constants/barangays';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LoadingScreenVisual } from '../../shared/ui/OptimizedLoading';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';

type AuthModeType = 'signin' | 'signup' | 'verify';
type FieldName = 'username' | 'email' | 'password' | 'verificationCode' | 'city';
type FieldErrors = Partial<Record<FieldName, string>>;
type UsernameCheckState = 'idle' | 'checking' | 'available' | 'taken';

export interface FieldRequirement {
  label: string;
  met: boolean;
}

const isAndroid = Platform.OS === 'android';
const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : 0;
const isLegacyAndroid = isAndroid && androidVersion > 0 && androidVersion < 29;
const showEnhancedChrome = !isLegacyAndroid;

interface AuthViewProps {
  authLoading: boolean;
  authError: string | null;
  onLogin: (email: string, pass: string) => void;
  onGoogleSignIn: () => Promise<{
    requiresBarangay: boolean;
    email: string;
    displayName: string;
    avatarUrl: string;
    onConfirmBarangay: (chosenBarangay: string) => Promise<void>;
  } | void> | void;

  onSignUp: (username: string, email: string, pass: string, city: string, otpCode: string) => void;
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

const TRUSTED_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.com.ph',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
]);

function isEduEmailDomain(domain: string): boolean {
  return (
    domain.endsWith('.edu') ||
    domain.endsWith('.edu.ph') ||
    domain.endsWith('.ac.uk') ||
    domain.endsWith('.ac.jp') ||
    domain.endsWith('.edu.au')
  );
}

function isAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) return false;

  const parts = normalized.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];

  // Must be either trusted personal domain OR educational domain (.edu / .edu.ph)
  return TRUSTED_DOMAINS.has(domain) || isEduEmailDomain(domain);
}

function validateFields(
  mode: AuthModeType,
  values: {
    username: string;
    email: string;
    password: string;
    city: string;
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
    
    if (!values.city) {
      errors.city = 'Please select a barangay.';
    }
  }

  if (!trimmedEmail) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  } else if (mode !== 'signin' && !isAllowedEmail(trimmedEmail)) {
    errors.email = 'Only trusted personal (Gmail, Yahoo, etc.) or educational emails (.edu / .edu.ph) are allowed.';
  }

  if (!values.password) {
    errors.password = mode === 'signin' ? 'Password is required.' : 'Create a password.';
  } else if (mode !== 'signin') {
    if (values.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    } else if (!/[a-zA-Z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      errors.password = 'Password must contain at least one letter and one number.';
    }
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
    return ['username', 'email', 'password', 'city'];
  }

  return ['username', 'email', 'password', 'city', 'verificationCode'];
}



export function AuthView({
  authLoading,
  authError,
  onLogin,
  onGoogleSignIn,

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
  const [city, setCity] = useState('');
  const [isBarangayPickerOpen, setIsBarangayPickerOpen] = useState(false);
  const [barangaySearchQuery, setBarangaySearchQuery] = useState('');
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState<{
    requiresBarangay: boolean;
    email: string;
    displayName: string;
    avatarUrl: string;
    onConfirmBarangay: (chosenBarangay: string) => Promise<void>;
  } | null>(null);
  const [isGoogleBarangayModalOpen, setIsGoogleBarangayModalOpen] = useState(false);
  const [selectedGoogleBarangay, setSelectedGoogleBarangay] = useState('');
  const [isConfirmingGoogleBarangay, setIsConfirmingGoogleBarangay] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [usernameCheckState, setUsernameCheckState] = useState<UsernameCheckState>('idle');
  const [usernameCheckMessage, setUsernameCheckMessage] = useState<string | null>(null);
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const isLoading = authLoading || isSendingCode || isConfirmingGoogleBarangay;
  const [renderLoadingOverlay, setRenderLoadingOverlay] = useState(isLoading);

  const copy = AUTH_COPY[mode];
  const fieldErrors = useMemo(
    () =>
      validateFields(mode, {
        username,
        email,
        password,
        city,
        verificationCode,
      }),
    [email, mode, password, username, city, verificationCode],
  );

  const visibleFieldErrors = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(fieldErrors).filter(([field]) => touched[field as FieldName]),
      ) as FieldErrors,
    [fieldErrors, touched],
  );

  const filteredBarangays = useMemo(() => {
    if (!barangaySearchQuery.trim()) return BARANGAYS;
    const query = barangaySearchQuery.toLowerCase().trim();
    return BARANGAYS.filter((b) => b.toLowerCase().includes(query));
  }, [barangaySearchQuery]);

  const usernameRequirements = useMemo<FieldRequirement[]>(() => {
    const trimmed = username.trim();
    return [
      { label: 'At least 3 characters', met: trimmed.length >= 3 },
      { label: 'No spaces allowed', met: Boolean(trimmed) && !/\s/.test(trimmed) },
    ];
  }, [username]);

  const emailRequirements = useMemo<FieldRequirement[]>(() => {
    const trimmed = email.trim().toLowerCase();
    const hasValidFormat = Boolean(trimmed) && EMAIL_REGEX.test(trimmed);
    const domain = trimmed.split('@')[1] || '';
    const isEduOrTrusted = Boolean(domain) && (TRUSTED_DOMAINS.has(domain) || isEduEmailDomain(domain));

    return [
      { label: 'Valid email format (e.g. name@gmail.com)', met: hasValidFormat },
      { label: 'Personal (Gmail, Yahoo) or Educational (.edu / .edu.ph)', met: isEduOrTrusted },
    ];
  }, [email]);

  const passwordRequirements = useMemo<FieldRequirement[]>(() => {
    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'Contains at least one number or symbol', met: /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
    ];
  }, [password]);

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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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
        setResendCooldown(60);
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

    onSignUp(username.trim(), email.trim(), password, city, verificationCode.trim());
  }, [email, fieldErrors, mode, onLogin, onSendOTP, onSignUp, password, username, city, usernameCheckState, verificationCode]);

  const bannerMessage = localError || authError;
  const verifySubtitle =
    mode === 'verify' && email
      ? `Enter the 6-digit code we sent to ${email.trim()} to finish your account setup.`
      : copy.subtitle;

  return (
    <View style={{ flex: 1 }}>
      <VideoView style={StyleSheet.absoluteFill} player={player as any} contentFit="cover" />
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
          contentContainerStyle={[styles.authShell, isLegacyAndroid && styles.authShellLegacy]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.topNavbar, { justifyContent: 'center' }]}>
            <Image
              source={require('../../../assets/ecobud_logo_circle.png')}
              style={{ width: 72, height: 72, borderRadius: 36, resizeMode: 'contain' }}
              fadeDuration={0}
            />
          </View>

          <View style={styles.contentContainer}>
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

              {mode === 'verify' ? (
                <View style={styles.verifyStepBox}>
                  <View style={styles.verifyEmailBadge}>
                    <Ionicons name="mail-outline" size={16} color={palette.primary} />
                    <Text style={styles.verifyEmailText} numberOfLines={1}>
                      {email.trim()}
                    </Text>
                    <Pressable
                      onPress={() => switchMode('signup')}
                      hitSlop={8}
                      style={styles.changeEmailButton}
                    >
                      <Text style={styles.changeEmailText}>Edit</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.otpPromptLabel}>Enter the 6-digit verification code</Text>
                  
                  <SegmentedOtpInput
                    value={verificationCode}
                    onChange={(val) => {
                      setVerificationCode(val);
                      if (val.length === 6) {
                        markTouched('verificationCode');
                      }
                    }}
                    error={visibleFieldErrors.verificationCode}
                  />

                  <View style={styles.resendRow}>
                    <Text style={styles.resendPromptText}>Didn't receive the code?</Text>
                    <Pressable
                      disabled={resendCooldown > 0 || isLoading}
                      onPress={async () => {
                        if (resendCooldown > 0 || isLoading) return;
                        setIsSendingCode(true);
                        setLocalError(null);
                        try {
                          await onSendOTP(email.trim());
                          setResendCooldown(60);
                        } catch (err) {
                          setLocalError(err instanceof Error ? err.message : 'Failed to resend code.');
                        } finally {
                          setIsSendingCode(false);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.resendButton,
                        pressed && styles.resendButtonPressed,
                        (resendCooldown > 0 || isLoading) && styles.resendButtonDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.resendButtonText,
                          resendCooldown > 0 && styles.resendButtonTextDisabled,
                        ]}
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  {mode === 'signup' ? (
                    <CustomInputField
                      label="Username"
                      labelIcon="person-outline"
                      value={username}
                      onChangeText={setUsername}
                      onBlur={() => markTouched('username')}
                      iconName="person-outline"
                      requirements={usernameRequirements}
                      showRequirementsAlways={true}
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
                      actionLabel="Check"
                      onActionPress={() => void handleCheckUsername()}
                      actionLoading={isCheckingUsername}
                      actionDisabled={isLoading || username.trim().length < 2}
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
                    requirements={mode === 'signup' ? emailRequirements : undefined}
                    showRequirementsAlways={mode === 'signup'}
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    error={visibleFieldErrors.email}
                    returnKeyType="next"
                    placeholder="nature@gmail.com or student@univ.edu.ph"
                  />

                  {mode === 'signup' ? (
                    <View style={styles.inputGroup}>
                      <View style={styles.inputLabelRow}>
                        <Text style={styles.inputLabel}>Location (Barangay)</Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setIsBarangayPickerOpen(true)}
                        style={[
                          styles.inputOuter,
                          { height: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 10 },
                          visibleFieldErrors.city ? styles.inputOuterError : null
                        ]}
                      >
                        <View style={styles.inputIcon}>
                          <Ionicons name="location-outline" size={20} color={palette.fieldIcon} />
                        </View>
                        <Text style={[styles.textInput, { color: city ? palette.textStrong : palette.textMuted, textAlignVertical: 'center', minHeight: undefined, flex: 1 }]}>
                          {city ? `Brgy. ${city}` : 'Select Barangay'}
                        </Text>
                      </TouchableOpacity>
                      {visibleFieldErrors.city ? (
                        <Text style={styles.inlineErrorText}>{visibleFieldErrors.city}</Text>
                      ) : null}
                    </View>
                  ) : null}

                  <CustomInputField
                    label="Password"
                    labelIcon="lock-closed-outline"
                    value={password}
                    onChangeText={setPassword}
                    onBlur={() => markTouched('password')}
                    iconName="lock-closed-outline"
                    secureTextEntry={!showPassword}
                    requirements={mode === 'signup' ? passwordRequirements : undefined}
                    showRequirementsAlways={mode === 'signup'}
                    autoCapitalize="none"
                    autoComplete="password"
                    textContentType="password"
                    error={visibleFieldErrors.password}
                    returnKeyType="done"
                    trailingIconName={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onTrailingPress={() => setShowPassword((current) => !current)}
                    placeholder="Enter your password"
                  />
                </>
              )}

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
                    onPress={async () => {
                      try {
                        const result = await onGoogleSignIn();
                        if (result && result.requiresBarangay) {
                          setPendingGoogleAuth(result);
                          setSelectedGoogleBarangay('');
                          setBarangaySearchQuery('');
                          setIsGoogleBarangayModalOpen(true);
                        }
                      } catch (e) {
                        // Handled in parent hook
                      }
                    }}
                    disabled={isLoading}
                  />
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

      <Modal visible={isBarangayPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsBarangayPickerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.textStrong }}>Select Barangay</Text>
            <Pressable onPress={() => setIsBarangayPickerOpen(false)}>
              <Ionicons name="close" size={24} color={palette.textStrong} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.inputFill, borderRadius: 12, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: palette.border }}>
              <Ionicons name="search" size={20} color={palette.fieldIcon} />
              <TextInput
                style={{ flex: 1, marginLeft: 8, fontSize: 16, color: palette.textStrong }}
                placeholder="Search barangay..."
                placeholderTextColor={palette.textMuted}
                value={barangaySearchQuery}
                onChangeText={setBarangaySearchQuery}
              />
            </View>
          </View>
          <FlatList
            data={filteredBarangays}
            keyExtractor={(item) => item}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                  pressed && { backgroundColor: palette.primarySoft }
                ]}
                onPress={() => {
                  setCity(item);
                  setIsBarangayPickerOpen(false);
                  markTouched('city');
                }}
              >
                <Text style={{ fontSize: 16, color: city === item ? palette.primary : palette.textStrong, fontWeight: city === item ? '700' : '400' }}>
                  {item}
                </Text>
                {city === item && <Ionicons name="checkmark" size={20} color={palette.primary} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Modal for Google Sign-In New User Barangay Selection */}
      <Modal
        visible={isGoogleBarangayModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!isConfirmingGoogleBarangay) {
            setIsGoogleBarangayModalOpen(false);
            setPendingGoogleAuth(null);
          }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: palette.textStrong }}>Select Your Barangay</Text>
              <Text style={{ fontSize: 13, color: palette.textMuted, marginTop: 2 }}>
                Welcome to EcoBud! Please choose your barangay to complete your setup.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (!isConfirmingGoogleBarangay) {
                  setIsGoogleBarangayModalOpen(false);
                  setPendingGoogleAuth(null);
                }
              }}
              disabled={isConfirmingGoogleBarangay}
            >
              <Ionicons name="close" size={24} color={palette.textStrong} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.inputFill, borderRadius: 12, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: palette.border }}>
              <Ionicons name="search" size={20} color={palette.fieldIcon} />
              <TextInput
                style={{ flex: 1, marginLeft: 8, fontSize: 16, color: palette.textStrong }}
                placeholder="Search barangay..."
                placeholderTextColor={palette.textMuted}
                value={barangaySearchQuery}
                onChangeText={setBarangaySearchQuery}
              />
            </View>
          </View>
          <FlatList
            data={filteredBarangays}
            keyExtractor={(item) => item}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                  pressed && { backgroundColor: palette.primarySoft }
                ]}
                onPress={() => {
                  setSelectedGoogleBarangay(item);
                }}
              >
                <Text style={{ fontSize: 16, color: selectedGoogleBarangay === item ? palette.primary : palette.textStrong, fontWeight: selectedGoogleBarangay === item ? '700' : '400' }}>
                  {item}
                </Text>
                {selectedGoogleBarangay === item && <Ionicons name="checkmark-circle" size={22} color={palette.primary} />}
              </Pressable>
            )}
          />
          {selectedGoogleBarangay ? (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: palette.surface, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: palette.border }}>
              <PrimaryButton
                label={isConfirmingGoogleBarangay ? 'Setting up account...' : `Continue with ${selectedGoogleBarangay}`}
                disabled={isConfirmingGoogleBarangay}
                loading={isConfirmingGoogleBarangay}
                onPress={async () => {
                  if (!pendingGoogleAuth || !selectedGoogleBarangay) return;
                  setIsConfirmingGoogleBarangay(true);
                  try {
                    setIsGoogleBarangayModalOpen(false);
                    await pendingGoogleAuth.onConfirmBarangay(selectedGoogleBarangay);
                  } catch (err) {
                    setIsGoogleBarangayModalOpen(true);
                  } finally {
                    setIsConfirmingGoogleBarangay(false);
                  }
                }}
              />
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

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
  requirements?: FieldRequirement[];
  showRequirementsAlways?: boolean;
}

function RequirementChecklist({
  requirements,
  hasValue,
}: {
  requirements: FieldRequirement[];
  hasValue: boolean;
}) {
  return (
    <View style={styles.requirementBox}>
      {requirements.map((req, idx) => {
        const isError = hasValue && !req.met;
        return (
          <View key={idx} style={styles.requirementRow}>
            <View
              style={[
                styles.requirementIconBadge,
                req.met
                  ? styles.requirementIconBadgeMet
                  : isError
                    ? styles.requirementIconBadgeError
                    : styles.requirementIconBadgeUnmet,
              ]}
            >
              <Ionicons
                name={req.met ? 'checkmark' : isError ? 'close' : 'ellipse-outline'}
                size={11}
                color={req.met ? '#16A34A' : isError ? '#DC2626' : '#9CA3AF'}
              />
            </View>
            <Text
              style={[
                styles.requirementText,
                req.met
                  ? styles.requirementTextMet
                  : isError
                    ? styles.requirementTextError
                    : styles.requirementTextUnmet,
              ]}
            >
              {req.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SegmentedOtpInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  error?: string;
}) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  return (
    <View style={styles.otpWrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enter verification code"
        onPress={() => inputRef.current?.focus()}
        style={styles.otpBoxesRow}
      >
        {digits.map((digit, idx) => {
          const isFilled = Boolean(value[idx]);
          const isCurrent = isFocused && idx === Math.min(value.length, 5);

          return (
            <View
              key={idx}
              style={[
                styles.otpBox,
                isFilled && styles.otpBoxFilled,
                isCurrent && styles.otpBoxActive,
                Boolean(error) && styles.otpBoxError,
              ]}
            >
              <Text style={styles.otpDigitText}>{digit}</Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, 6))}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        autoFocus={true}
        style={styles.hiddenOtpInput}
        caretHidden={true}
      />

      {error ? <Text style={styles.inlineErrorText}>{error}</Text> : null}
    </View>
  );
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
  requirements,
  showRequirementsAlways = false,
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
            borderColor: (error && !requirements) ? palette.danger : borderColor,
            backgroundColor: fillColor,
            shadowOpacity: (error && !requirements) ? 0 : shadowOpacity,
          },
          (error && !requirements) ? styles.inputOuterError : null,
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
      {requirements && (showRequirementsAlways || value.length > 0 || isFocused) ? (
        <RequirementChecklist requirements={requirements} hasValue={value.length > 0} />
      ) : null}
      {!requirements && error ? <Text style={styles.inlineErrorText}>{error}</Text> : null}
      {helperText ? (
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
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  titleAura: {
    display: 'none',
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
  requirementBox: {
    marginTop: 8,
    paddingHorizontal: 2,
    gap: 6,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  requirementIconBadgeMet: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  requirementIconBadgeUnmet: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  requirementIconBadgeError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  requirementText: {
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(17),
  },
  requirementTextMet: {
    color: '#15803D',
    fontWeight: '600',
  },
  requirementTextUnmet: {
    color: '#6B7280',
    fontWeight: '500',
  },
  requirementTextError: {
    color: '#DC2626',
    fontWeight: '600',
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
  inputLabelActive: {
    color: palette.primary,
  },
  inputActionButton: {
    minHeight: scale(32),
    minWidth: scale(68),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(12),
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
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
    color: palette.primary,
    letterSpacing: 0.2,
  },
  inputOuter: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: moderateScale(12),
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
  inlineErrorText: {
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(18),
    color: palette.danger,
    marginTop: verticalScale(7),
    marginLeft: scale(2),
    fontWeight: '600',
  },
  helperText: {
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(18),
    color: palette.textMuted,
    marginTop: verticalScale(7),
    marginLeft: scale(2),
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
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: verticalScale(22),
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.separator,
  },
  separatorText: {
    marginHorizontal: scale(14),
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
    letterSpacing: 1.4,
    color: palette.textMuted,
  },
  secondaryButton: {
    minHeight: verticalScale(52),
    borderRadius: moderateScale(28),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: scale(18),
  },
  googleButton: {
    borderWidth: 1,
    borderColor: palette.googleBorder,
    backgroundColor: '#FFFFFF',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: palette.border,
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
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: palette.textStrong,
  },
  footerSwitchRow: {
    marginTop: verticalScale(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSwitchText: {
    fontSize: responsiveFontSize(14),
    lineHeight: responsiveFontSize(20),
    color: palette.textStrong,
    marginBottom: verticalScale(4),
  },
  footerSwitchLink: {
    minHeight: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(12),
  },
  footerSwitchLinkPressed: {
    opacity: 0.68,
  },
  footerSwitchLinkText: {
    fontSize: responsiveFontSize(15),
    lineHeight: responsiveFontSize(20),
    color: palette.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  verifyStepBox: {
    marginVertical: 4,
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
  otpBoxError: {
    borderColor: palette.danger,
    backgroundColor: '#FEF2F2',
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
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: verticalScale(8),
  },
  resendPromptText: {
    fontSize: responsiveFontSize(13),
    color: palette.textMuted,
  },
  resendButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  resendButtonPressed: {
    opacity: 0.7,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: palette.primary,
  },
  resendButtonTextDisabled: {
    color: palette.textMuted,
  },
});

