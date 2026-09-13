import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ecoTheme';

export type InAppNotificationTone = 'success' | 'warning' | 'error' | 'info';

export interface InAppNotificationOptions {
  title: string;
  message: string;
  tone?: InAppNotificationTone;
  durationMs?: number;
}

interface InAppNotificationContextValue {
  showNotification: (options: InAppNotificationOptions) => void;
  dismissNotification: () => void;
}

const InAppNotificationContext = createContext<InAppNotificationContextValue | null>(null);

export function InAppNotificationProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [notification, setNotification] = useState<InAppNotificationOptions | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissNotification = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = null;
    setNotification(null);
  }, []);

  const showNotification = useCallback((options: InAppNotificationOptions) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setNotification(options);
    dismissTimer.current = setTimeout(() => {
      dismissTimer.current = null;
      setNotification(null);
    }, options.durationMs ?? (options.tone === 'error' ? 6000 : 4500));
  }, []);

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  const value = useMemo(
    () => ({ showNotification, dismissNotification }),
    [dismissNotification, showNotification],
  );

  const tone = notification?.tone ?? 'info';
  const accentColor = tone === 'success'
    ? theme.colors.success
    : tone === 'warning'
      ? theme.colors.warning
      : tone === 'error'
        ? theme.colors.error
        : theme.colors.primary;
  const iconName = tone === 'success'
    ? 'checkmark-circle'
    : tone === 'warning'
      ? 'cloud-offline-outline'
      : tone === 'error'
        ? 'alert-circle'
        : 'information-circle';

  return (
    <InAppNotificationContext.Provider value={value}>
      {children}
      {notification ? (
        <View pointerEvents="box-none" style={[styles.host, { top: Math.max(insets.top, 12) + 8 }]}>
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.cardBorder,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${accentColor}1F` }]}>
              <Ionicons name={iconName} size={23} color={accentColor} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{notification.title}</Text>
              <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{notification.message}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              hitSlop={10}
              onPress={dismissNotification}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Ionicons name="close" size={20} color={theme.colors.iconMuted} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotification() {
  const context = useContext(InAppNotificationContext);
  if (!context) throw new Error('useInAppNotification must be used inside InAppNotificationProvider.');
  return context;
}

const styles = StyleSheet.create({
  host: { left: 16, right: 16, position: 'absolute', zIndex: 100, elevation: 12 },
  card: {
    alignItems: 'flex-start', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12,
    padding: 14, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12,
  },
  iconWrap: { alignItems: 'center', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  copy: { flex: 1, gap: 3, paddingTop: 1 },
  title: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  message: { fontSize: 13, lineHeight: 18 },
  closeButton: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  closeButtonPressed: { opacity: 0.55 },
});
