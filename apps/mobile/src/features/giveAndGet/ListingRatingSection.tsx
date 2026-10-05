import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';
import { useInAppNotification } from '../../shared/ui/InAppNotification';
import { triggerSelectionHaptic } from '../../app/utils/haptics';
import { swapService } from './swapService';
import type { ListingRatingSummary } from './types';

const STARS = [1, 2, 3, 4, 5];
const STAR_COLOR = '#F59E0B';

export function ListingRatingSection({ listingId, isOwnListing, onOwnerRating }: {
  listingId: string;
  isOwnListing: boolean;
  onOwnerRating?: (rating: number) => void;
}) {
  const { theme } = useTheme();
  const { showNotification } = useInAppNotification();
  const [summary, setSummary] = useState<ListingRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    swapService.fetchListingRating(listingId)
      .then(result => { if (alive) { setSummary(result); setError(''); onOwnerRating?.(result.ownerRating); } })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Could not load ratings.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [listingId, retry]);

  const canRate = !isOwnListing && !summary?.isOwner && !loading && !error;
  const myRating = summary?.myRating ?? 0;

  const rate = async (stars: number) => {
    if (!canRate || saving || stars === myRating) return;
    triggerSelectionHaptic();
    setSaving(true);
    try {
      const result = await swapService.rateListing(listingId, stars);
      setSummary(result);
      onOwnerRating?.(result.ownerRating);
      showNotification({ title: 'Rating saved', message: `You rated this listing ${stars} out of 5.`, tone: 'success' });
    } catch (err) {
      showNotification({ title: 'Could not save rating', message: err instanceof Error ? err.message : 'Please try again.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.textPrimary }]}>Rate this listing</Text>
        {summary && (
          <View style={styles.average}>
            <Ionicons name="star" size={14} color={STAR_COLOR} />
            <Text style={[styles.averageText, { color: theme.colors.textPrimary }]}>{summary.count ? summary.average.toFixed(1) : '0.0'}</Text>
            <Text style={[styles.countText, { color: theme.colors.textMuted }]}>({summary.count} {summary.count === 1 ? 'rating' : 'ratings'})</Text>
          </View>
        )}
      </View>

      <View style={styles.starsRow}>
        {STARS.map(star => (
          <TouchableOpacity
            key={star}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} out of 5`}
            accessibilityState={{ disabled: !canRate || saving, selected: star <= myRating }}
            disabled={!canRate || saving}
            onPress={() => void rate(star)}
            activeOpacity={0.7}
            style={[styles.starButton, { borderColor: theme.colors.border, opacity: canRate ? 1 : 0.45 }]}
          >
            <Ionicons name={star <= myRating ? 'star' : 'star-outline'} size={26} color={STAR_COLOR} />
          </TouchableOpacity>
        ))}
        {(loading || saving) && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </View>

      {error ? (
        <TouchableOpacity accessibilityRole="button" onPress={() => setRetry(value => value + 1)}>
          <Text style={[styles.caption, { color: theme.colors.error }]}>{error} Tap to retry.</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.caption, { color: theme.colors.textMuted }]}>
          {isOwnListing || summary?.isOwner
            ? 'You can’t rate your own listing. Other members can rate it.'
            : myRating
              ? `Your rating: ${myRating} out of 5. Tap a star to change it.`
              : 'Tap a star to rate this listing.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10, marginTop: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '800' },
  average: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  averageText: { fontSize: 14, fontWeight: '800' },
  countText: { fontSize: 12 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  starButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 12, lineHeight: 18 },
});
