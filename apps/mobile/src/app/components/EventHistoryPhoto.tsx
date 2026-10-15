import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Modal, Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { useTheme } from '../../shared/theme/ecoTheme';
import { resolveMediaUrl } from '../utils/appUtils';

export function EventHistoryPhoto({ imageUrl, eventTitle }: {
  imageUrl?: string | null;
  eventTitle: string;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [viewing, setViewing] = React.useState(false);
  const uri = resolveMediaUrl(imageUrl, ecobudApiOrigin);

  if (!uri) {
    return <Text style={{ color: theme.colors.textSecondary }}>No attendance photo available.</Text>;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Attendance photo</Text>
      <View style={[photoStyles.frame, { backgroundColor: theme.colors.surfaceMuted }]}>
        <PhotoImage uri={uri} eventTitle={eventTitle} onPress={() => setViewing(true)} />
      </View>
      <Modal visible={viewing} transparent animationType="fade" onRequestClose={() => setViewing(false)}>
        <View style={[photoStyles.backdrop, {
          paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16),
          paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16),
        }]}>
          <View style={[photoStyles.modalCard, { backgroundColor: theme.colors.card }]} accessibilityViewIsModal>
            <View style={photoStyles.header}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 18 }}>Attendance photo</Text>
                <Text numberOfLines={2} style={{ color: theme.colors.textSecondary }}>{eventTitle}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close attendance photo"
                onPress={() => setViewing(false)}
                style={[photoStyles.retry, { borderColor: theme.colors.cardBorder }]}
              >
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={[photoStyles.viewer, { backgroundColor: theme.colors.surfaceMuted }]}>
              {viewing && <PhotoImage uri={uri} eventTitle={eventTitle} />}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PhotoImage({ uri, eventTitle, onPress }: { uri: string; eventTitle: string; onPress?: () => void }) {
  const { theme } = useTheme();
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const image = (
    <>
      <Image
        source={{ uri }}
        accessibilityLabel={`Attendance photo submitted for ${eventTitle}`}
        accessible={!onPress}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true); }}
      />
      {loading && (
        <View style={photoStyles.feedback} pointerEvents="none">
          <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Loading attendance photo" />
        </View>
      )}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
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
        ) : onPress ? (
          <TouchableOpacity
            style={{ flex: 1 }}
            accessibilityRole="button"
            accessibilityLabel={`View attendance photo for ${eventTitle}`}
            accessibilityHint="Opens the full photo in a dialog"
            onPress={onPress}
          >
            {image}
          </TouchableOpacity>
        ) : <View style={{ flex: 1 }}>{image}</View>}
    </View>
  );
}

const photoStyles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, overflow: 'hidden' },
  feedback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, gap: 8 },
  retry: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderRadius: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 800, flex: 1, maxHeight: '90%', borderRadius: 18, padding: 16, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewer: { flex: 1, borderRadius: 12, overflow: 'hidden' },
});
