import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
  Animated,
  TextInput,
  Image,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LoadingScreenVisual } from '../../shared/ui/OptimizedLoading';

type AuthModeType = 'signin' | 'signup' | 'verify';

const isAndroid = Platform.OS === 'android';
const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : 0;
const isLegacyAndroid = isAndroid && androidVersion > 0 && androidVersion < 29;
const showEnhancedChrome = !isLegacyAndroid;

interface AuthViewProps {
  authLoading: boolean;
  authError: string | null;
  onLogin: (email: string, pass: string) => void;
  onGoogleSignIn: () => void;
  onSignUp: (username: string, email: string, pass: string, otpCode: string) => void;
  onSendOTP: (email: string) => Promise<{ success: boolean; message: string }>;
}

export function AuthView({
  authLoading,
  authError,
  onLogin,
  onGoogleSignIn,
  onSignUp,
  onSendOTP,
}: AuthViewProps) {
  const [mode, setMode] = useState<AuthModeType>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const loadingOpacity = React.useRef(new Animated.Value(0)).current;
  const isLoading = authLoading || isSendingCode;
  const [renderLoadingOverlay, setRenderLoadingOverlay] = useState(isLoading);

  const handleAction = async () => {
    setLocalError(null);
    if (mode === 'signin') {
      onLogin(email, password);
    } else if (mode === 'signup') {
      if (!email.toLowerCase().endsWith('@gmail.com')) {
        setLocalError('Please use a @gmail.com email address to sign up.');
        return;
      }
      if (!isStrongPassword) {
        setLocalError('Password must be at least 8 characters.');
        return;
      }
      setIsSendingCode(true);
      try {
        await onSendOTP(email);
        setIsSendingCode(false);
        setMode('verify');
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : 'Failed to send verification code.');
        setIsSendingCode(false);
      }
    } else if (mode === 'verify') {
      if (verificationCode.length !== 6) {
        setLocalError('Please enter the 6-digit verification code.');
        return;
      }
      onSignUp(username, email, password, verificationCode);
    }
  };

  const isStrongPassword = password.length >= 8;
  const backgroundPalette = useMemo(
    () =>
    mode === 'signup'
      ? {
        base: ['#CFF4D8', '#F6FFF8', '#D8EEE0'] as const,
        topGlow: 'rgba(74, 222, 128, 0.22)',
        bottomGlow: 'rgba(18, 96, 39, 0.12)',
      }
      : mode === 'verify'
        ? {
          base: ['#D7EFE0', '#F7FBF8', '#E2F0E7'] as const,
          topGlow: 'rgba(18, 96, 39, 0.16)',
          bottomGlow: 'rgba(74, 222, 128, 0.14)',
        }
        : {
          base: ['#DFF4E4', '#F9FCFA', '#E4F1E8'] as const,
          topGlow: 'rgba(74, 222, 128, 0.18)',
          bottomGlow: 'rgba(18, 96, 39, 0.08)',
        },
    [mode],
  );
  const loadingCopy = useMemo(
    () =>
      mode === 'signin'
        ? {
            label: 'Signing in',
            message: 'Opening your EcoBud dashboard with a lighter Android-safe loader.',
          }
        : mode === 'verify'
          ? {
              label: 'Verifying your account',
              message: 'Confirming your code with a low-overhead loading flow.',
            }
          : {
              label: 'Sending your code',
              message: 'Preparing your sign-up step with a smoother mobile loading screen.',
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
      duration: 120,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRenderLoadingOverlay(false);
      }
    });
  }, [isLoading, loadingOpacity, renderLoadingOverlay]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={backgroundPalette.base}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={styles.backgroundGradient}
      />
      {showEnhancedChrome ? (
        <>
          <View pointerEvents="none" style={[styles.backgroundBloomTop, { backgroundColor: backgroundPalette.topGlow }]} />
          <View pointerEvents="none" style={[styles.backgroundBloomBottom, { backgroundColor: backgroundPalette.bottomGlow }]} />
        </>
      ) : null}
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.authShell, isLegacyAndroid && styles.authShellLegacy]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topNavbar}>
            <Image source={require('../../../assets/logo.png')} style={[styles.topNavAvatar, isLegacyAndroid && styles.topNavAvatarLegacy]} fadeDuration={0} />
            <Text style={styles.topNavTitle}>ECOBUD</Text>
          </View>

          <View style={styles.contentContainer}>
            {showEnhancedChrome ? <View pointerEvents="none" style={styles.titleAura} /> : null}
            <Text style={styles.welcomeTitle}>
              {mode === 'signin' ? 'Welcome Back!' : mode === 'signup' ? 'Create Account' : 'Verify Email'}
            </Text>
            <Text style={styles.welcomeSubtitle}>
              {mode === 'signin'
                ? 'Continue your eco journey today.'
                : mode === 'signup'
                  ? 'Join our community of planet savers.'
                  : `We sent a 6-digit code to ${email}`}
            </Text>

            <View
              style={[styles.authCard, isLegacyAndroid ? styles.authCardLegacy : styles.authCardModern]}
              renderToHardwareTextureAndroid={isAndroid}
            >
              {mode === 'verify' ? (
                <LabelledInput label="VERIFICATION CODE" value={verificationCode} onChangeText={setVerificationCode} keyboardType="numeric" />
              ) : (
                <>
                  {mode === 'signup' && (
                    <LabelledInput label="USERNAME" value={username} onChangeText={setUsername} />
                  )}

                  <LabelledInput label="EMAIL" value={email} onChangeText={setEmail} keyboardType="email-address" />
                  <LabelledInput label="PASSWORD" value={password} onChangeText={setPassword} secureTextEntry />

                  {mode === 'signup' && password.length > 0 && !isStrongPassword && (
                    <Text style={{ color: '#E53935', fontSize: 12, marginTop: -10, marginBottom: 10 }}>
                      Password must be at least 8 characters.
                    </Text>
                  )}
                </>
              )}

              {(authError || localError) ? <Text style={styles.authError}>{localError || authError}</Text> : null}

              <PrimaryButton
                label={
                  authLoading || isSendingCode
                    ? (mode === 'signin' ? 'Signing in...' : mode === 'verify' ? 'Verifying...' : 'Sending Code...')
                    : (mode === 'signin' ? 'LOG IN' : mode === 'verify' ? 'VERIFY & SIGN UP' : 'SIGN UP')
                }
                onPress={handleAction}
                disabled={authLoading || isSendingCode || (mode === 'signup' && !isStrongPassword)}
              />

              {mode !== 'verify' && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <GoogleSignInButton onPress={onGoogleSignIn} disabled={authLoading || isSendingCode} />
                </>
              )}
            </View>

            <Pressable
              onPress={() => {
                setLocalError(null);
                if (mode === 'verify') setMode('signup');
                else setMode(mode === 'signin' ? 'signup' : 'signin');
              }}
              style={{ marginTop: 32, alignSelf: 'center' }}
            >
              <Text style={{ color: '#6B7A75', fontSize: 14, fontWeight: '600' }}>
                {mode === 'signin' ? 'Need an account? ' : mode === 'verify' ? 'Back to sign up' : 'Already have an account? '}
                {mode !== 'verify' && <Text style={{ color: '#126027', fontWeight: '800' }}>{mode === 'signin' ? 'Sign up' : 'Log in'}</Text>}
              </Text>
            </Pressable>
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

// ----------------------------------------------------
// Local UI components specific for AuthView to decouple from App.tsx
// ----------------------------------------------------

function usePressScale(pressedScale = 0.97) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = useCallback((toValue: number) => {
    if (isLegacyAndroid && toValue !== 1) {
      return;
    }

    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 150,
    }).start();
  }, [scale]);

  const onPressIn = useCallback(() => {
    animateTo(pressedScale);
  }, [animateTo, pressedScale]);

  const onPressOut = useCallback(() => {
    animateTo(1);
  }, [animateTo]);

  return { scale, onPressIn, onPressOut };
}

function LabelledInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}) {
  const [isFocused, setIsFocused] = useState(false);
  const isActive = isFocused || value.trim().length > 0;
  const borderColors = isActive ? (['#91E0A6', '#126027'] as const) : (['#DDEAE1', '#EAF2ED'] as const);
  const inputField = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      placeholderTextColor="#9AA8A2"
      selectionColor="#126027"
      underlineColorAndroid="transparent"
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={styles.textInput}
    />
  );

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, isActive && styles.inputLabelActive]}>{label}</Text>
      {showEnhancedChrome ? (
        <LinearGradient
          colors={borderColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.inputBorder, isActive && styles.inputBorderActive]}
        >
          <View style={[styles.inputInner, isActive && styles.inputInnerActive]}>{inputField}</View>
        </LinearGradient>
      ) : (
        <View style={[styles.inputBorderFallback, isActive && styles.inputBorderFallbackActive]}>
          <View style={[styles.inputInner, styles.inputInnerLegacy, isActive && styles.inputInnerActive]}>{inputField}</View>
        </View>
      )}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
        android_ripple={disabled ? undefined : { color: 'rgba(255,255,255,0.16)' }}
      >
        <LinearGradient
          colors={isLegacyAndroid ? ['#126027', '#126027'] : ['#126027', '#1E803B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.primaryButtonGradient, isLegacyAndroid && styles.primaryButtonGradientLegacy]}
        >
          <Text style={styles.primaryButtonText}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function GoogleSignInButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.985);

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={disabled ? undefined : { color: 'rgba(18,96,39,0.08)' }}
      >
        <View style={[styles.googleButtonGradient, isLegacyAndroid && styles.googleButtonGradientLegacy]}>
          <Ionicons name="logo-google" size={20} color="#DB4437" style={{ marginRight: 10 }} />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E9F6EC' },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundBloomTop: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  backgroundBloomBottom: {
    position: 'absolute',
    bottom: 80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  authShell: { flexGrow: 1, paddingBottom: 60 },
  authShellLegacy: { paddingBottom: 36 },
  topNavbar: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginTop: 40
  },
  topNavAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  topNavAvatarLegacy: {
    borderWidth: 1,
  },
  topNavTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A211D',
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
    marginRight: 44 // to balance avatar width and keep it centered
  },
  contentContainer: {
    paddingHorizontal: 24,
    marginTop: 32,
    position: 'relative',
  },
  titleAura: {
    position: 'absolute',
    top: -18,
    left: 4,
    right: 64,
    height: 132,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6B7A75',
    marginBottom: 32,
    lineHeight: 24
  },
  authCard: {
    borderRadius: 32,
    padding: 24,
  },
  authCardModern: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#126027',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  authCardLegacy: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1EADF',
    shadowOpacity: 0,
    elevation: 1,
  },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#6B7A75', marginBottom: 8, letterSpacing: 1 },
  inputLabelActive: { color: '#126027' },
  inputBorder: {
    borderRadius: 18,
    padding: 1.25,
    overflow: 'hidden',
  },
  inputBorderActive: {
    shadowColor: '#126027',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  inputBorderFallback: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDE7DF',
    backgroundColor: '#EEF4EF',
    overflow: 'hidden',
  },
  inputBorderFallbackActive: {
    borderColor: '#2F8B45',
    backgroundColor: '#FFFFFF',
  },
  inputInner: {
    minHeight: 58,
    borderRadius: 17,
    backgroundColor: 'rgba(247, 249, 247, 0.96)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inputInnerLegacy: {
    backgroundColor: '#FFFFFF',
  },
  inputInnerActive: {
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    height: 56,
    paddingHorizontal: 20,
    paddingVertical: 0,
    fontSize: 16,
    lineHeight: 20,
    color: '#1A211D',
    fontWeight: '600',
    textAlignVertical: 'center',
    borderWidth: 0,
  },
  authError: { color: '#E53935', fontSize: 14, marginBottom: 16, textAlign: 'center', fontWeight: '500' },
  primaryButton: { height: 56, borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryButtonGradientLegacy: { borderRadius: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  googleButtonGradient: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E9E7',
    backgroundColor: '#FFF'
  },
  googleButtonGradientLegacy: {
    borderColor: '#DEE7E0',
  },
  googleButtonText: { color: '#1A211D', fontSize: 14, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E9E7' },
  dividerText: { marginHorizontal: 16, color: '#6B7A75', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
