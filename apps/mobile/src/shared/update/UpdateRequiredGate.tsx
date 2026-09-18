import React from 'react';
import { BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/ecoTheme';
import { AppVersionInfo, checkForMandatoryUpdate, getInstalledAppVersion } from './appVersion';

export function UpdateRequiredGate({ children }: { children: React.ReactNode }) {
  const { theme, isDark } = useTheme();
  const [requiredUpdate, setRequiredUpdate] = React.useState<AppVersionInfo | null>(null);
  const [checking, setChecking] = React.useState(true);
  const installedVersion = getInstalledAppVersion();

  React.useEffect(() => {
    let mounted = true;
    void checkForMandatoryUpdate().then((result) => {
      if (mounted) {
        setRequiredUpdate(result);
        setChecking(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    if (!requiredUpdate) return;
    const onBackPress = () => {
      BackHandler.exitApp();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [requiredUpdate]);

  if (checking) {
    return <View style={[styles.fill, { backgroundColor: theme.colors.background }]} />;
  }

  if (!requiredUpdate) return <>{children}</>;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.icon, { backgroundColor: theme.colors.accentMuted }]}>
        <Text style={[styles.iconText, { color: theme.colors.primary }]}>↻</Text>
      </View>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Update Required</Text>
      <Text style={[styles.versionBadge, { color: theme.colors.primary }]}>
        Version {requiredUpdate.latestVersion} is now available
      </Text>
      <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
        Your current version ({installedVersion || 'unknown'}) is no longer supported. Please update to continue using EcoBud.
      </Text>
      
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Update EcoBud now"
        onPress={() => void Linking.openURL(requiredUpdate.updateUrl)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.buttonText}>Update Now</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Exit application"
        onPress={() => BackHandler.exitApp()}
        style={({ pressed }) => [
          styles.exitButton,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.exitButtonText, { color: theme.colors.textSecondary }]}>Exit App</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: { fontSize: 46, fontWeight: '700', lineHeight: 54 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', textAlign: 'center' },
  versionBadge: { marginTop: 6, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  message: { marginTop: 12, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 420 },
  button: {
    marginTop: 28,
    minWidth: 200,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  exitButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  exitButtonText: { fontSize: 15, fontWeight: '600' },
});
