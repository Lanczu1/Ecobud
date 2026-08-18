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

export interface DiscoverChallengeCardProps {
  challenge: ChallengeWithProgress;
  onPress: () => void;
  isCycleActive?: boolean;
  style?: StyleProp<ViewStyle>;
  isTablet?: boolean;
}

export function DiscoverChallengeCard({
  challenge,
  onPress,
  isCycleActive = true,
  style,
  isTablet,
}: DiscoverChallengeCardProps) {
  const category = ((challenge as any).category || 'General').toUpperCase();
  const isImageMission = challenge.type === 'AI Image Recognition Challenge';
  const isWeekendLocked = !isCycleActive;
  const imageUrl = resolveMediaUrl(challenge.imageUrl, ecobudApiOrigin);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Start ${challenge.title}`}
      style={({ pressed }) => [
        cardStyles.discoverCard,
        pressed && !isWeekendLocked && cardStyles.discoverCardPressed,
        isWeekendLocked && { opacity: 0.8 },
        isTablet && { width: '48%' },
        style,
      ]}
      onPress={() => {
        if (isWeekendLocked) return;
        onPress();
      }}
    >
      <View style={cardStyles.discoverImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={cardStyles.discoverImage} resizeMode="cover" />
        ) : (
          <View style={[cardStyles.discoverImage, cardStyles.discoverImageFallback]}>
            <Ionicons
              name={isImageMission ? 'camera-outline' : 'leaf-outline'}
              size={scale(28)}
              color="#126027"
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
          <View style={cardStyles.discoverCategoryBadge}>
            <Text style={cardStyles.discoverCategoryText}>{category}</Text>
          </View>
          {challenge.difficulty && (
            <Text style={cardStyles.discoverDifficulty}>
              {challenge.difficulty.toUpperCase()}
            </Text>
          )}
        </View>

        {/* Schedule tag */}
        <View style={cardStyles.scheduleRow}>
          <View style={cardStyles.scheduleBadge}>
            <Ionicons name="calendar-outline" size={scale(11)} color="#4B5563" />
            <Text style={cardStyles.scheduleText}>MON - FRI ONLY</Text>
          </View>
        </View>

        <Text style={cardStyles.discoverTitle} numberOfLines={2}>
          {challenge.title}
        </Text>
        <Text style={cardStyles.discoverDescription} numberOfLines={2}>
          {challenge.description}
        </Text>

        <View style={cardStyles.discoverFooter}>
          <View style={cardStyles.rewardSection}>
            <Text style={cardStyles.discoverRewardLabel}>REWARD</Text>
            <View style={cardStyles.discoverRewardRow}>
              <Ionicons name="leaf" size={scale(14)} color="#15803D" />
              <Text style={cardStyles.discoverReward}>{challenge.expReward} points</Text>
              {challenge.ecoCoinReward > 0 && (
                <View style={cardStyles.coinRow}>
                  <Image
                    source={require('../../../assets/coin.png')}
                    style={cardStyles.coinIcon}
                  />
                  <Text style={cardStyles.coinText}>+{challenge.ecoCoinReward}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={cardStyles.footerRight}>
            <View style={cardStyles.discoverStartButton}>
              <Text style={cardStyles.discoverStartText}>
                {isImageMission ? 'OPEN' : 'START'}
              </Text>
              <Ionicons name="arrow-forward" size={scale(15)} color="#FFFFFF" />
            </View>
            {challenge.availableQuantity !== undefined && (
              <View style={cardStyles.quantityBadge}>
                <Ionicons name="cube-outline" size={scale(11)} color="#047857" />
                <Text style={cardStyles.quantityText}>
                  {challenge.availableQuantity} items left
                </Text>
              </View>
            )}
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
