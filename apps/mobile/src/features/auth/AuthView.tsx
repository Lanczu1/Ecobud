import React, { useState, useCallback } from 'react';
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

type AuthModeType = 'signin' | 'signup' | 'verify';

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authShell}>
          <View style={styles.topNavbar}>
            <Image source={require('../../../assets/logo.png')} style={styles.topNavAvatar} />
            <Text style={styles.topNavTitle}>ECOBUD</Text>
          </View>

          <View style={styles.contentContainer}>
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

             <View style={styles.authCard}>
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
    </SafeAreaView>
  );
}

// ----------------------------------------------------
// Local UI components specific for AuthView to decouple from App.tsx
// ----------------------------------------------------

function usePressScale(pressedScale = 0.97) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = useCallback((toValue: number) => {
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
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        placeholderTextColor="#9AA8A2"
        style={styles.textInput}
      />
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
      >
        <LinearGradient
          colors={['#126027', '#1E803B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryButtonGradient}
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
      >
        <View style={styles.googleButtonGradient}>
          <Ionicons name="logo-google" size={20} color="#DB4437" style={{ marginRight: 10 }} />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9F7' },
  authShell: { flexGrow: 1, backgroundColor: '#F7F9F7', paddingBottom: 60 },
  topNavbar: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9F7',
    marginTop: 40
  },
  topNavAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#4ADE80',
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
    marginTop: 32
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
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#6B7A75', marginBottom: 8, letterSpacing: 1 },
  textInput: {
    backgroundColor: '#F7F9F7',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1A211D',
    fontWeight: '600'
  },
  authError: { color: '#E53935', fontSize: 14, marginBottom: 16, textAlign: 'center', fontWeight: '500' },
  primaryButton: { height: 56, borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  googleButtonText: { color: '#1A211D', fontSize: 14, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E9E7' },
  dividerText: { marginHorizontal: 16, color: '#6B7A75', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
