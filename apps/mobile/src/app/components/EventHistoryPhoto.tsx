import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { useTheme } from '../../shared/theme/ecoTheme';
import { resolveMediaUrl } from '../utils/appUtils';

export function EventHistoryPhoto({ imageUrl, eventTitle }: {
  imageUrl?: string | null;
  eventTitle: string;
}) {
  const { theme } = useTheme();
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const uri = resolveMediaUrl(imageUrl, ecobudApiOrigin);

  if (!uri) {
    return <Text style={{ color: theme.colors.textSecondary }}>No attendance photo available.</Text>;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Attendance photo</Text>
      <View style={[photoStyles.frame, { backgroundColor: theme.colors.surfaceMuted }]}>
        {failed ? (
          <View style={photoStyles.feedback} accessibilityLiveRegion="polite">
            <Text style={{ color: theme.colors.textPrimary, textAlign: 'center' }}>Couldn't load the attendance photo.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Retry attendance photo for ${eventTitle}`}
              onPress={() => { setLoading(true); setFailed(false); }}
              style={[photoStyles.retry, { borderColor: theme.colors.cardBorder }]}
            >
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Image
              source={{ uri }}
              accessibilityLabel={`Attendance photo submitted for ${eventTitle}`}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setFailed(true); }}
            />
            {loading && (
              <View style={photoStyles.feedback}>
                <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Loading attendance photo" />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const photoStyles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, overflow: 'hidden' },
  feedback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, gap: 8 },
  retry: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderRadius: 8 },
});
