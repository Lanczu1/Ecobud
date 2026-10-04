import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text, TouchableOpacity } from '../accessibility/primitives';
import { useTheme } from '../theme/ThemeContext';

export function PaginationFooter({ loading, error, hasMore, onLoad }: { loading: boolean; error: string | null; hasMore: boolean; onLoad: () => void }) {
  const { theme } = useTheme();
  if (!loading && !error && !hasMore) return null;
  return <View style={{ padding: 8, alignItems: 'center', gap: 12 }}>
    {loading ? <ActivityIndicator color={theme.colors.primary} /> : <>
      {error && <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>{error}</Text>}
      {(error || hasMore) && <TouchableOpacity accessibilityRole="button" onPress={onLoad} style={{ padding: 12 }}>
        <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{error ? 'Try again' : 'Load more'}</Text>
      </TouchableOpacity>}
    </>}
  </View>;
}
