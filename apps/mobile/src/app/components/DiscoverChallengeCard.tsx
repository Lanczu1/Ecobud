import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type ChallengeWithProgress, ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { resolveMediaUrl } from '../utils/appUtils';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { useTheme } from '../../shared/theme/ecoTheme';

export interface DiscoverChallengeCardProps {
  challenge: ChallengeWithProgress;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  isTablet?: boolean;
}

export function DiscoverChallengeCard({
  challenge,
  onPress,
  style,
  isTablet,
}: DiscoverChallengeCardProps) {
  const { theme, isDark } = useTheme();
  const category = ((challenge as any).category || 'General').toUpperCase();
  const isImageMission = challenge.type === 'AI Image Recognition Challenge';
  const imageUrl = resolveMediaUrl(challenge.imageUrl, ecobudApiOrigin);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Start ${challenge.title}`}
      style={({ pressed }) => [
        cardStyles.discoverCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.cardBorder,
          shadowOpacity: isDark ? 0.2 : 0.07,
        },
        pressed && cardStyles.discoverCardPressed,
        isTablet && { width: '48%' },
        style,
      ]}
      onPress={onPress}
    >
      <View style={cardStyles.discoverImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={cardStyles.discoverImage} resizeMode="cover" />
        ) : (
          <View style={[cardStyles.discoverImage, cardStyles.discoverImageFallback, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#E8F5E9' }]}>
            <Ionicons
              name={isImageMission ? 'camera-outline' : 'leaf-outline'}
              size={scale(28)}
              color={isDark ? theme.colors.primary : '#126027'}
            />
          </View>
        )}
        <View style={cardStyles.discoverImageShade} />
        {challenge.isFeatured ? (
          <View style={cardStyles.discoverFeaturedBadge}>
            <Ionicons name="star" size={scale(10)} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={cardStyles.discoverFeaturedBadgeText}>FEATURED</Text>
          </View>
        ) : (
          <View style={cardStyles.discoverNewBadge}>
            <Text style={cardStyles.discoverNewBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      <View style={cardStyles.discoverBody}>
        <View style={cardStyles.discoverMetaRow}>
          <View style={[cardStyles.discoverCategoryBadge, { backgroundColor: isDark ? theme.colors.surfaceMuted : '#EDF6F1' }]}>
            <Text style={[cardStyles.discoverCategoryText, { color: isDark ? theme.colors.primary : '#126027' }]}>{category}</Text>
          </View>
          {challenge.difficulty && (
            <Text style={[cardStyles.discoverDifficulty, { color: theme.colors.textMuted }]}>
              {challenge.difficulty.toUpperCase()}
            </Text>
          )}
        </View>

        <Text style={[cardStyles.discoverTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
          {challenge.title}
        </Text>
        <Text style={[cardStyles.discoverDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {challenge.description}
        </Text>

        <View style={[cardStyles.discoverFooter, { borderTopColor: isDark ? theme.colors.border : '#F0FDF4' }]}>
          <View style={cardStyles.rewardSection}>
            <Text style={[cardStyles.discoverRewardLabel, { color: theme.colors.textMuted }]}>REWARD</Text>
            <View style={cardStyles.discoverRewardRow}>
              <Ionicons name="leaf" size={scale(14)} color={theme.colors.primary} />
              <Text style={[cardStyles.discoverReward, { color: isDark ? theme.colors.primary : '#15803D' }]}>{challenge.expReward} points</Text>
              {challenge.ecoCoinReward > 0 && (
                <View style={cardStyles.coinRow}>
                  <Image
                    source={require('../../../assets/coin.png')}
                    style={cardStyles.coinIcon}
                  />
                  <Text style={[cardStyles.coinText, { color: isDark ? '#FBBF24' : '#B45309' }]}>+{challenge.ecoCoinReward}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={cardStyles.footerRight}>
            <View style={[cardStyles.discoverStartButton, { backgroundColor: isDark ? theme.colors.primary : '#126027' }]}>
              <Text style={[cardStyles.discoverStartText, { color: isDark ? '#0E1512' : '#FFFFFF' }]}>
                {isImageMission ? 'OPEN' : 'START'}
              </Text>
              <Ionicons name="arrow-forward" size={scale(15)} color={isDark ? '#0E1512' : '#FFFFFF'} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  discoverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(22),
    overflow: 'hidden',
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: '#E4EEE6',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  discoverCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  discoverImageWrap: {
    height: verticalScale(144),
    backgroundColor: '#DCFCE7',
    position: 'relative',
  },
  discoverImage: {
    width: '100%',
    height: '100%',
  },
  discoverImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
  },
  discoverImageShade: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(18, 96, 39, 0.12)',
  },
  discoverNewBadge: {
    position: 'absolute',
    top: verticalScale(12),
    left: scale(12),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(9),
    paddingVertical: verticalScale(5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  discoverNewBadgeText: {
    color: '#126027',
    fontSize: responsiveFontSize(10),
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  discoverFeaturedBadge: {
    position: 'absolute',
    top: verticalScale(12),
    left: scale(12),
    backgroundColor: '#F59E0B',
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(9),
    paddingVertical: verticalScale(5),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  discoverFeaturedBadgeText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(10),
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  discoverBody: {
    padding: scale(16),
    paddingTop: verticalScale(14),
  },
  discoverMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(9),
  },
  discoverCategoryBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
  },
  discoverCategoryText: {
    color: '#166534',
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  discoverDifficulty: {
    color: '#6B7A75',
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  scheduleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
    marginBottom: verticalScale(8),
    alignItems: 'center',
  },
  scheduleBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(6),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  scheduleText: {
    fontSize: responsiveFontSize(10),
    fontWeight: '700',
    color: '#4B5563',
  },
  discoverTitle: {
    color: '#17231B',
    fontSize: responsiveFontSize(19),
    fontWeight: '900',
    lineHeight: responsiveFontSize(24),
    letterSpacing: -0.25,
  },
  discoverDescription: {
    color: '#65736C',
    fontSize: responsiveFontSize(13),
    lineHeight: responsiveFontSize(19),
    marginTop: verticalScale(5),
  },
  discoverFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: verticalScale(16),
    gap: scale(10),
  },
  rewardSection: {
    flex: 1,
  },
  discoverRewardLabel: {
    color: '#89968F',
    fontSize: responsiveFontSize(9),
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: verticalScale(4),
  },
  discoverRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale(4),
    minHeight: verticalScale(36),
  },
  discoverReward: {
    color: '#126027',
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    marginLeft: scale(4),
  },
  coinIcon: {
    width: scale(13),
    height: scale(13),
    resizeMode: 'contain',
  },
  coinText: {
    color: '#B45309',
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
  },
  footerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: verticalScale(6),
    marginTop: verticalScale(14),
  },
  quantityBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    alignSelf: 'flex-end',
  },
  quantityText: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#047857',
  },
  discoverStartButton: {
    minHeight: verticalScale(36),
    backgroundColor: '#126027',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(7),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  discoverStartText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(12),
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
