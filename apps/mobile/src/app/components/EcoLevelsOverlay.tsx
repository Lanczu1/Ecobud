import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OverlayScaffold, SurfaceCard } from './CommonComponents';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { type EcoBudMobileModel } from '../types/home';
import { getLevelFromPoints } from './LevelCard';
import { triggerImpactLight } from '../utils/haptics';
import { useTheme } from '../../shared/theme/ThemeContext';

export const ECO_LEVELS_ROADMAP = [
  {
    level: 1,
    name: 'Eco Seedling',
    icon: 'sprout',
    points: 0,
    subtitle: 'The journey begins with a single seed',
    badgeColor: '#10B981',
    perks: [
      'Daily habit tracker & streak logging',
      'Learn & Grow Eco Academy courses',
      'Basic Eco Coins rewards',
    ],
  },
  {
    level: 2,
    name: 'Eco Learner',
    icon: 'book-open-variant',
    points: 100,
    subtitle: 'Building daily knowledge and habits',
    badgeColor: '#14B8A6',
    perks: [
      '1.1x coins multiplier on habit completions',
      'Unlock quiz bonus rewards',
      'Community leaderboard participation',
    ],
  },
  {
    level: 3,
    name: 'Eco Advocate',
    icon: 'bullhorn',
    points: 300,
    subtitle: 'Spreading green awareness to others',
    badgeColor: '#06B6D4',
    perks: [
      'Unlock Community Missions & local challenges',
      'Access to Give & Get marketplace deals',
      'Advocate profile frame and title',
    ],
  },
  {
    level: 4,
    name: 'Eco Warrior',
    icon: 'recycle',
    points: 600,
    subtitle: 'Active champion for zero-waste lifestyle',
    badgeColor: '#3B82F6',
    perks: [
      'Official Eco Warrior Badge on profile',
      'Exclusive discounts in Rewards Shop',
      'Early RSVP access to local eco workshops',
    ],
  },
  {
    level: 5,
    name: 'Eco Champion',
    icon: 'trophy',
    points: 1000,
    subtitle: 'Halfway to legend with notable impact',
    badgeColor: '#8B5CF6',
    perks: [
      'VIP Leaderboard gold highlight frame',
      'Special Champion event badge',
      '1.25x coins multiplier on all actions',
    ],
  },
  {
    level: 6,
    name: 'Eco Guardian',
    icon: 'tree',
    points: 1500,
    subtitle: 'Dedicated guardian of local ecosystems',
    badgeColor: '#059669',
    perks: [
      'Bonus monthly eco points & coins drop',
      'Featured community volunteer spotlight',
      'Priority verification on mission submissions',
    ],
  },
  {
    level: 7,
    name: 'Eco Leader',
    icon: 'earth',
    points: 2200,
    subtitle: 'Leading community sustainability drives',
    badgeColor: '#0284C7',
    perks: [
      'Create and host community eco challenges',
      'Exclusive Eco Leader merchandise rewards',
      'Special coordinator badge in Give & Get',
    ],
  },
  {
    level: 8,
    name: 'Eco Ambassador',
    icon: 'heart',
    points: 3000,
    subtitle: 'Role model for sustainable city living',
    badgeColor: '#EC4899',
    perks: [
      'Official EcoBud Ambassador status',
      '1.5x coins multiplier on all verified events',
      'Invitation to exclusive eco webinars and summits',
    ],
  },
  {
    level: 9,
    name: 'Eco Hero',
    icon: 'shield-star',
    points: 4000,
    subtitle: 'Top-tier hero transforming communities',
    badgeColor: '#F59E0B',
    perks: [
      'Custom profile banner and Hero crown badge',
      'Top priority voucher redemption in Rewards Shop',
      'Exclusive Hero recognition in monthly digest',
    ],
  },
  {
    level: 10,
    name: 'Eco Legend',
    icon: 'crown',
    points: 5500,
    subtitle: 'The pinnacle of ecological excellence',
    badgeColor: '#EAB308',
    perks: [
      'Max Tier: Permanent EcoBud Legend Golden Trophy',
      'Permanent 2.0x coins multiplier on all actions',
      'Hall of Fame permanent profile placement',
    ],
  },
];

export function EcoLevelsOverlay({ model }: { model: EcoBudMobileModel }) {
  const { width } = useWindowDimensions();
  const { theme, isDark } = useTheme();
  const isTablet = width >= 600;

  const totalPoints = model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0;
  const { currentLevelObj, nextLevelObj } = getLevelFromPoints(totalPoints);
  const isMaxLevel = currentLevelObj.level === 10;

  const pointsInCurrentLevel = totalPoints - currentLevelObj.points;
  const pointsNeededForNextLevel = nextLevelObj.points - currentLevelObj.points;
  const currentProgressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, (pointsInCurrentLevel / (pointsNeededForNextLevel || 1)) * 100));
  const pointsToNext = Math.max(0, nextLevelObj.points - totalPoints);

  const handleClose = () => {
    triggerImpactLight();
    model.setActiveOverlay(null);
  };

  return (
    <OverlayScaffold
      title="Eco Levels Roadmap"
      subtitle="Complete level ladder (Lv. 1 to Lv. 10)"
      onBack={handleClose}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isTablet && { paddingHorizontal: scale(32) }]}
      >
        {/* Header Hero Banner: Current Standing */}
        <LinearGradient
          colors={['#064E3B', '#047857', '#0D9488']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <View style={styles.heroIconCircle}>
              <MaterialCommunityIcons
                name={currentLevelObj.icon as any}
                size={scale(28)}
                color="#34D399"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroBadgeTag}>CURRENT LEVEL</Text>
              <Text style={styles.heroLevelTitle}>
                Level {currentLevelObj.level} • {currentLevelObj.name}
              </Text>
            </View>
            <View style={styles.pointsPill}>
              <Text style={styles.pointsPillText}>{totalPoints} XP</Text>
            </View>
          </View>

          {/* Progress to next */}
          <View style={styles.heroProgressSection}>
            <View style={styles.heroProgressHeader}>
              <Text style={styles.heroProgressSub}>
                {isMaxLevel
                  ? '👑 You have reached the maximum rank!'
                  : `Progress to Level ${nextLevelObj.level} (${nextLevelObj.name})`}
              </Text>
              {!isMaxLevel && (
                <Text style={styles.heroProgressPts}>{pointsToNext} XP needed</Text>
              )}
            </View>
            <View style={styles.heroProgressBarTrack}>
              <View
                style={[
                  styles.heroProgressBarFill,
                  { width: `${currentProgressPercent}%` },
                ]}
              />
            </View>
          </View>
        </LinearGradient>

        {/* Section Headline */}
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>ALL ECO LEVELS (1 — 10)</Text>
          <Text style={[styles.sectionSub, { color: theme.colors.textMuted }]}>Earn Eco Points (XP) to level up</Text>
        </View>

        {/* Levels List */}
        <View style={styles.levelsList}>
          {ECO_LEVELS_ROADMAP.map((item) => {
            const isUnlocked = totalPoints >= item.points;
            const isCurrent = currentLevelObj.level === item.level;
            const isNext = nextLevelObj.level === item.level && !isCurrent;
            const pointsRequired = item.points;
            const neededToUnlock = Math.max(0, item.points - totalPoints);

            return (
              <View
                key={item.level}
                style={[
                  styles.levelCard,
                  {
                    backgroundColor: isUnlocked ? theme.colors.card : theme.colors.surfaceMuted,
                    borderColor: isUnlocked ? theme.colors.cardBorder : theme.colors.border,
                  },
                  isCurrent && {
                    borderColor: theme.colors.primary,
                    borderWidth: 2,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                {/* Header Row of the Card */}
                <View style={styles.levelCardHeader}>
                  <View style={styles.levelCardHeaderLeft}>
                    <View
                      style={[
                        styles.levelIconCircle,
                        {
                          backgroundColor: isUnlocked
                            ? `${item.badgeColor}20`
                            : theme.colors.surfaceMuted,
                          borderColor: isUnlocked ? item.badgeColor : theme.colors.border,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={scale(24)}
                        color={isUnlocked ? item.badgeColor : '#9CA3AF'}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[styles.levelName, { color: isUnlocked ? theme.colors.textPrimary : theme.colors.textMuted }]}>
                          Level {item.level}: {item.name}
                        </Text>
                        {isCurrent && (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>YOU ARE HERE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.levelSubtitle, { color: theme.colors.textMuted }]}>{item.subtitle}</Text>
                    </View>
                  </View>

                  {/* Status Indicator */}
                  <View style={styles.statusCol}>
                    <Text style={[styles.pointsReqText, { color: theme.colors.textPrimary }]}>
                      {item.points === 0 ? 'Free' : `${pointsRequired.toLocaleString()} XP`}
                    </Text>
                    {isUnlocked ? (
                      <View style={[styles.unlockedTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7' }]}>
                        <Ionicons name="checkmark-circle" size={scale(13)} color={isDark ? '#34D399' : '#059669'} />
                        <Text style={[styles.unlockedTagText, { color: isDark ? '#34D399' : '#059669' }]}>Unlocked</Text>
                      </View>
                    ) : (
                      <View style={[styles.lockedTag, { backgroundColor: theme.colors.surfaceMuted }]}>
                        <Ionicons name="lock-closed" size={scale(11)} color={theme.colors.textMuted} />
                        <Text style={[styles.lockedTagText, { color: theme.colors.textMuted }]}>{neededToUnlock} XP left</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Perks Checklist */}
                <View style={[styles.perksContainer, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <Text style={[styles.perksLabel, { color: theme.colors.textMuted }]}>TIER PERKS & UNLOCKS:</Text>
                  {item.perks.map((perk, idx) => (
                    <View key={idx} style={styles.perkRow}>
                      <Ionicons
                        name={isUnlocked ? 'checkmark' : 'ellipse-outline'}
                        size={scale(14)}
                        color={isUnlocked ? theme.colors.primary : theme.colors.textMuted}
                        style={{ marginTop: 2 }}
                      />
                      <Text
                        style={[
                          styles.perkItemText,
                          { color: isUnlocked ? theme.colors.textSecondary : theme.colors.textMuted },
                        ]}
                      >
                        {perk}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* Motivation Tip Card */}
        <SurfaceCard style={[styles.tipCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: verticalScale(6) }}>
            <Ionicons name="bulb-outline" size={scale(18)} color={theme.colors.primary} />
            <Text style={[styles.tipTitle, { color: theme.colors.textPrimary }]}>How to earn XP fast?</Text>
          </View>
          <Text style={[styles.tipBody, { color: theme.colors.textSecondary }]}>
            Log your daily eco habits (+10 XP), complete academy lessons (+30 XP), verify missions with photo proof (+100 XP), and attend community cleanups (+200 XP).
          </Text>
        </SurfaceCard>

        <View style={{ height: verticalScale(60) }} />
      </ScrollView>
    </OverlayScaffold>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: moderateScale(16),
  },
  heroCard: {
    borderRadius: moderateScale(22),
    padding: moderateScale(18),
    marginBottom: verticalScale(18),
    shadowColor: '#064E3B',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(14),
  },
  heroIconCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroBadgeTag: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 1,
    marginBottom: verticalScale(2),
  },
  heroLevelTitle: {
    fontSize: responsiveFontSize(16),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pointsPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pointsPillText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
  },
  heroProgressSection: {
    marginTop: verticalScale(2),
  },
  heroProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(6),
    flexWrap: 'wrap',
    gap: 4,
  },
  heroProgressSub: {
    fontSize: responsiveFontSize(11.5),
    color: '#E6F4EC',
    fontWeight: '600',
  },
  heroProgressPts: {
    fontSize: responsiveFontSize(11.5),
    color: '#A7F3D0',
    fontWeight: '700',
  },
  heroProgressBarTrack: {
    height: verticalScale(8),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: moderateScale(4),
    overflow: 'hidden',
  },
  heroProgressBarFill: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: moderateScale(4),
  },
  sectionTitleRow: {
    marginBottom: verticalScale(12),
  },
  sectionTitle: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#1A211D',
    letterSpacing: 0.8,
  },
  sectionSub: {
    fontSize: responsiveFontSize(11.5),
    color: '#6B7A75',
    marginTop: verticalScale(2),
  },
  levelsList: {
    gap: verticalScale(12),
  },
  levelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(18),
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: '#E6EFEA',
    shadowColor: '#126027',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  levelCardActive: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#F7FCF9',
  },
  levelCardLocked: {
    backgroundColor: '#FAFBFB',
    borderColor: '#E5E7EB',
  },
  levelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(12),
  },
  levelCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(10),
  },
  levelIconCircle: {
    width: scale(46),
    height: scale(46),
    borderRadius: scale(23),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
    borderWidth: 1.5,
  },
  levelName: {
    fontSize: responsiveFontSize(14.5),
    fontWeight: '800',
    color: '#1A211D',
  },
  levelSubtitle: {
    fontSize: responsiveFontSize(11),
    color: '#6B7A75',
    marginTop: verticalScale(2),
  },
  currentBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
  },
  currentBadgeText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(9),
    fontWeight: '800',
  },
  statusCol: {
    alignItems: 'flex-end',
  },
  pointsReqText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: verticalScale(4),
  },
  unlockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(10),
    gap: scale(3),
  },
  unlockedTagText: {
    fontSize: responsiveFontSize(10),
    fontWeight: '700',
    color: '#059669',
  },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(10),
    gap: scale(3),
  },
  lockedTagText: {
    fontSize: responsiveFontSize(10),
    fontWeight: '600',
    color: '#6B7280',
  },
  perksContainer: {
    backgroundColor: '#F9FAF9',
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    gap: verticalScale(6),
  },
  perksLabel: {
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    color: '#6B7A75',
    letterSpacing: 0.6,
    marginBottom: verticalScale(2),
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(8),
  },
  perkItemText: {
    fontSize: responsiveFontSize(12),
    color: '#2C3A35',
    lineHeight: responsiveFontSize(17),
    flex: 1,
  },
  tipCard: {
    marginTop: verticalScale(18),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(18),
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: '#E2EFE7',
  },
  tipTitle: {
    fontSize: responsiveFontSize(13),
    fontWeight: '800',
    color: '#126027',
  },
  tipBody: {
    fontSize: responsiveFontSize(12),
    color: '#52635C',
    lineHeight: responsiveFontSize(18),
  },
});
