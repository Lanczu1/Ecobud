import React from 'react';
import { View } from 'react-native';
import { Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';

export function LeaderboardPagination({ page, totalPages, onPageChange }: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 12 }}>
      {(['Previous', 'Next'] as const).map((label, index) => {
        const disabled = index === 0 ? page <= 1 : page >= totalPages;
        return (
          <React.Fragment key={label}>
            {index === 1 && (
              <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>
                Page {page} of {totalPages}
              </Text>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${label} leaderboard page`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => onPageChange(page + (index === 0 ? -1 : 1))}
              style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, opacity: disabled ? 0.4 : 1 }}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{label}</Text>
            </TouchableOpacity>
          </React.Fragment>
        );
      })}
    </View>
  );
}
