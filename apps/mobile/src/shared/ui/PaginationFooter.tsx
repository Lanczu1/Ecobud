import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text, TouchableOpacity } from '../accessibility/primitives';
import { useTheme } from '../theme/ThemeContext';
import { ConnectionErrorCard } from './ConnectionErrorCard';

export function PaginationFooter({ loading, error, hasMore, onLoad }: { loading: boolean; error: string | null; hasMore: boolean; onLoad: () => void }) {
  const { theme } = useTheme();
  if (!loading && !error && !hasMore) return null;

  if (loading) {
    return <View style={styles.plain}><ActivityIndicator color={theme.colors.primary} /></View>;
  }

  if (error) {
    return <ConnectionErrorCard message={error} onRetry={onLoad} />;
  }

  return (
    <View style={styles.plain}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onLoad}
        activeOpacity={0.85}
        style={[styles.loadMoreButton, { borderColor: theme.colors.cardBorder }]}
      >
        <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Load more</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  plain: { alignItems: 'center', padding: 8 },
  loadMoreButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 20 },
});
