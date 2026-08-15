import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Animated,
  Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type ActiveChallengeCardProps } from '../types/home';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { styles } from '../styles/appStyles';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';

const getValidImageUrl = (url: string | null | undefined) => {
  if (!url) return undefined;
  let cleanUrl = url.replace(/\\/g, '/');
  if (cleanUrl.includes('localhost:3000')) {
    cleanUrl = cleanUrl.replace('http://localhost:3000', ecobudApiOrigin);
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = `${ecobudApiOrigin}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
  }
  return cleanUrl;
};

export function ActiveChallengeCard({ dailyChallenge, onComplete, onClaim, isViewed, isCycleActive = true }: ActiveChallengeCardProps) {
  const status = dailyChallenge.progress?.status?.toLowerCase() || 'not_started';
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isPressing, setIsPressing] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const isAI = dailyChallenge.type === 'AI Image Recognition Challenge';
  const isApproved = status === 'approved' || status === 'unclaimed';
  const isApprovedCollection = status === 'approved_collection';
  const isCompleted = status === 'completed';
  const isWeekendLocked = !isCycleActive && !isApproved && !isApprovedCollection;
  let isPending = false;
  let btnText = 'MARK AS COMPLETE';

  if (isApproved) {
    btnText = isPressing ? 'CLAIMING...' : 'CLAIM REWARD';
  } else if (isApprovedCollection) {
    btnText = 'SCAN WEEKEND QR';
  } else if (status === 'pending') {
    btnText = 'PENDING APPROVAL';
    isPending = true;
  } else if (isCompleted) {
    btnText = 'CHALLENGE FINISHED';
  } else if (isWeekendLocked) {
    btnText = 'LOCKED (WEEKEND - MON-FRI ONLY)';
    isPending = true;
  } else if (isAI) {
    btnText = isViewed ? (isPressing ? 'CONTINUING...' : 'CONTINUE MISSION') : (isPressing ? 'STARTING...' : 'START MISSION');
  } else {
    btnText = 'MARK AS COMPLETE';
  }

  const handlePress = (e: any) => {
    // Capture the click coordinates to emit particles from the exact location
    const { pageX, pageY } = e.nativeEvent;
    
    setIsPressing(true);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.05, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setIsPressing(false);
      if (isApproved) {
        if (onClaim) onClaim({ x: pageX, y: pageY });
      } else {
        if (onComplete) onComplete();
      }
    });
  };

  const shouldPulse = isAI && !isCompleted && !isPending && !isApproved;

  return (
    <Animated.View style={localStyles.cardContainer}>
      {/* Header Banner / Thumbnail */}
      <View style={localStyles.bannerContainer}>
        {dailyChallenge.imageUrl ? (
          <Image
            source={{ uri: getValidImageUrl(dailyChallenge.imageUrl) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#14532D', '#166534', '#15803D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            <View style={localStyles.placeholderIconBox}>
              <Ionicons name="trophy-outline" size={scale(48)} color="rgba(255,255,255,0.25)" />
            </View>
          </LinearGradient>
        )}

        {/* Gradient Overlay for Top Contrast */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.5)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Badges Row */}
        <View style={localStyles.bannerTopRow}>
          <View style={localStyles.badgeRowLeft}>
            {dailyChallenge.isFeatured ? (
              <View style={[localStyles.pillPrimary, { backgroundColor: '#F59E0B' }]}>
                <Ionicons name="star" size={scale(11)} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={localStyles.pillPrimaryText}>FEATURED</Text>
              </View>
            ) : (
              <View style={localStyles.pillPrimary}>
                <Ionicons name="flash" size={scale(11)} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={localStyles.pillPrimaryText}>TODAY</Text>
              </View>
            )}
            {dailyChallenge.difficulty && (
              <View style={localStyles.pillGlass}>
                <Text style={localStyles.pillGlassText}>
                  {dailyChallenge.difficulty.toLowerCase() === 'easy' ? '🟢 Easy' : dailyChallenge.difficulty.toLowerCase() === 'medium' ? '🟡 Medium' : '🔴 Hard'}
                </Text>
              </View>
            )}
          </View>

          <View style={localStyles.badgeRowRight}>
            {isViewed ? (
              <View style={[localStyles.pillGlass, { backgroundColor: 'rgba(59, 130, 246, 0.45)' }]}>
                <Ionicons name="eye-outline" size={scale(11)} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={localStyles.pillGlassText}>Viewed</Text>
              </View>
            ) : (
              <View style={[localStyles.pillGlass, { backgroundColor: 'rgba(239, 68, 68, 0.55)' }]}>
                <Text style={[localStyles.pillGlassText, { fontWeight: '800' }]}>NEW</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Banner Info (Schedule / Cycle Tag) */}
        <View style={localStyles.bannerBottomRow}>
          <View style={localStyles.pillSchedule}>
            <Ionicons name="calendar-outline" size={scale(11)} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={localStyles.pillScheduleText}>Mon – Fri</Text>
          </View>
          {dailyChallenge.cycle && (
            <View style={localStyles.pillSchedule}>
              <Ionicons name="time-outline" size={scale(11)} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={localStyles.pillScheduleText}>
                Ends {new Date(dailyChallenge.cycle.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Card Content Body */}
      <View style={localStyles.bodyContent}>
        {/* Category Pill Tag above Title */}
        {(dailyChallenge as any).category && (
          <View style={localStyles.categoryChip}>
            <Text style={localStyles.categoryChipText}>
              {((dailyChallenge as any).category).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Title */}
        <Text style={localStyles.titleText}>{dailyChallenge.title}</Text>

        {/* Description */}
        <Text style={localStyles.descriptionText} numberOfLines={3}>
          {dailyChallenge.description}
        </Text>

        {/* Reward Badges */}
        <View style={localStyles.rewardRow}>
          <View style={localStyles.xpBadge}>
            <Ionicons name="leaf" size={scale(13)} color="#15803D" />
            <Text style={localStyles.xpBadgeText}>+{dailyChallenge.expReward} XP</Text>
          </View>

          {dailyChallenge.ecoCoinReward > 0 && (
            <View style={localStyles.coinBadge}>
              <Image
                source={require('../../../assets/coin.png')}
                style={{ width: scale(14), height: scale(14), resizeMode: 'contain' }}
              />
              <Text style={localStyles.coinBadgeText}>+{dailyChallenge.ecoCoinReward} Coins</Text>
            </View>
          )}
        </View>

        {/* AI Mission Box (if AI challenge) */}
        {isAI && dailyChallenge.aiDetectionTargets && dailyChallenge.aiDetectionTargets.length > 0 && (
          <View style={localStyles.aiBox}>
            <View style={localStyles.aiHeaderRow}>
              <Ionicons name="scan-circle" size={scale(16)} color="#15803D" />
              <Text style={localStyles.aiLabel}>AI CAMERA MISSION</Text>
            </View>
            <Text style={localStyles.aiTargetText}>
              Snap photo of:{' '}
              <Text style={localStyles.aiTargetHighlight}>
                {dailyChallenge.aiDetectionTargets.join(', ')}
              </Text>
            </Text>
            {dailyChallenge.availableQuantity !== undefined && (
              <View style={localStyles.quantityPill}>
                <Ionicons name="cube-outline" size={scale(11)} color="#15803D" />
                <Text style={localStyles.quantityPillText}>
                  {dailyChallenge.availableQuantity} {dailyChallenge.quantityUnit || 'items'} left
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Progress Bar (if Non-AI) */}
        {!isAI && (
          <View style={localStyles.progressContainer}>
            <View style={localStyles.progressLabelRow}>
              <Text style={localStyles.progressLabel}>PROGRESS</Text>
              <Text style={localStyles.progressValue}>{dailyChallenge.progress?.progressPercentage || 0}%</Text>
            </View>
            <View style={localStyles.progressTrack}>
              <View
                style={[
                  localStyles.progressFill,
                  { width: `${Math.min(100, dailyChallenge.progress?.progressPercentage || 0)}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Action Button */}
        <Animated.View
          style={
            shouldPulse
              ? { transform: [{ scale: Animated.multiply(pulseAnim, scaleAnim) }] }
              : { transform: [{ scale: scaleAnim }] }
          }
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={(e) => handlePress(e)}
            disabled={isPressing || isPending || isCompleted}
            style={[
              localStyles.actionButton,
              isApproved
                ? localStyles.approvedBtn
                : isCompleted
                ? localStyles.completedBtn
                : isWeekendLocked || isPending
                ? localStyles.disabledBtn
                : localStyles.primaryBtn,
            ]}
          >
            {isApproved ? (
              <Ionicons name="gift-outline" size={scale(16)} color="#FFF" style={{ marginRight: 6 }} />
            ) : isCompleted ? (
              <Ionicons name="checkmark-circle" size={scale(16)} color="#9CA3AF" style={{ marginRight: 6 }} />
            ) : isWeekendLocked ? (
              <Ionicons name="lock-closed-outline" size={scale(16)} color="#FFF" style={{ marginRight: 6 }} />
            ) : isAI ? (
              <Ionicons name="camera-outline" size={scale(16)} color={isApproved ? '#FFF' : '#FFF'} style={{ marginRight: 6 }} />
            ) : (
              <Ionicons name="checkmark-done-outline" size={scale(16)} color="#FFF" style={{ marginRight: 6 }} />
            )}
            <Text
              style={[
                localStyles.actionButtonText,
                isCompleted && { color: '#6B7280' },
              ]}
            >
              {btnText}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    marginBottom: verticalScale(20),
    borderWidth: 1,
    borderColor: '#EEF2F0',
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  bannerContainer: {
    height: verticalScale(140),
    position: 'relative',
    backgroundColor: '#14532D',
    justifyContent: 'space-between',
    padding: scale(14),
  },
  placeholderIconBox: {
    ...StyleSheet.absoluteFill as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  badgeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  badgeRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  bannerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    zIndex: 2,
  },
  pillPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: scale(9),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(10),
  },
  pillPrimaryText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pillGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillGlassText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(10),
    fontWeight: '700',
  },
  pillSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  pillScheduleText: {
    color: '#E5E7EB',
    fontSize: responsiveFontSize(10),
    fontWeight: '600',
  },
  bodyContent: {
    padding: scale(18),
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(6),
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: verticalScale(8),
  },
  categoryChipText: {
    color: '#15803D',
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  titleText: {
    fontSize: responsiveFontSize(18),
    fontWeight: '800',
    color: '#111827',
    marginBottom: verticalScale(6),
    lineHeight: responsiveFontSize(24),
  },
  descriptionText: {
    fontSize: responsiveFontSize(13),
    color: '#4B5563',
    lineHeight: responsiveFontSize(19),
    marginBottom: verticalScale(14),
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: verticalScale(14),
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: '#DCFCE7',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  xpBadgeText: {
    color: '#15803D',
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: '#FEF3C7',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  coinBadgeText: {
    color: '#B45309',
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
  },
  aiBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: moderateScale(14),
    padding: scale(12),
    marginBottom: verticalScale(14),
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    marginBottom: verticalScale(4),
  },
  aiLabel: {
    color: '#15803D',
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  aiTargetText: {
    color: '#374151',
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(17),
  },
  aiTargetHighlight: {
    fontWeight: '800',
    color: '#166534',
  },
  quantityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(6),
    marginTop: verticalScale(6),
  },
  quantityPillText: {
    color: '#15803D',
    fontSize: responsiveFontSize(10),
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: verticalScale(14),
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(5),
  },
  progressLabel: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    color: '#15803D',
  },
  progressTrack: {
    height: verticalScale(6),
    backgroundColor: '#E5E7EB',
    borderRadius: moderateScale(3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: moderateScale(3),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(13),
    borderRadius: moderateScale(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtn: {
    backgroundColor: '#126027',
  },
  approvedBtn: {
    backgroundColor: '#D97706',
  },
  completedBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledBtn: {
    backgroundColor: '#9CA3AF',
    opacity: 0.85,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});


