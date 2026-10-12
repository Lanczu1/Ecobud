import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, TouchableOpacity } from '../accessibility/primitives';
import { useTheme } from '../theme/ThemeContext';

/** Card shown where a list could not load, with a retry button. */
export function ConnectionErrorCard({
  title = "Couldn't load this list",
  message = 'Unable to load. Check your connection and try again.',
  onRetry,
  style,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }, style]}
    >
      <View style={[styles.icon, { backgroundColor: `${theme.colors.warning}22` }]}>
        <Ionicons name="cloud-offline-outline" size={26} color={theme.colors.warning} />
      </View>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onRetry}
        activeOpacity={0.85}
        style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
      >
        <Ionicons name="refresh" size={17} color="#FFFFFF" />
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
    marginVertical: 8,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  icon: { alignItems: 'center', borderRadius: 26, height: 52, justifyContent: 'center', marginBottom: 12, width: 52 },
  title: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 300, textAlign: 'center' },
  retryButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
    minWidth: 160,
    paddingHorizontal: 20,
  },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
