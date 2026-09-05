import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { triggerImpactLight } from '../utils/haptics';
import { type EcoBudMobileModel } from '../types/home';
import { useTheme } from '../../shared/theme/ecoTheme';

export interface QuickActionsProps {
  model?: EcoBudMobileModel;
  onPressHabits?: () => void;
  onPressRedeemCoins?: () => void;
  onPressMarketplace?: () => void;
  onPressEvents?: () => void;
  isHabitPending?: boolean;
}

interface ActionItem {
  id: string;
  label: string;
  subLabel: string;
  iconType: 'ionicons' | 'material' | 'image';
  iconName?: string;
  imageSource?: any;
  bgColor: string;
  iconColor: string;
  borderColor: string;
  badge?: string;
  onPress: () => void;
}

export function QuickActions({
  model,
  onPressHabits,
  onPressRedeemCoins,
  onPressMarketplace,
  onPressEvents,
  isHabitPending,
}: QuickActionsProps) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const habitPending = isHabitPending !== undefined
    ? isHabitPending
    : (model ? (model.todaysCompletedHabits === 0) : false);

  const handleHabits = () => {
    triggerImpactLight();
    if (onPressHabits) {
      onPressHabits();
    } else if (model) {
      model.setActiveTab('tracker');
    }
  };

  const handleRedeemCoins = () => {
    triggerImpactLight();
    if (onPressRedeemCoins) {
      onPressRedeemCoins();
    } else if (model) {
      model.setActiveOverlay('redeemPoints');
    }
  };

  const handleMarketplace = () => {
    triggerImpactLight();
    if (onPressMarketplace) {
      onPressMarketplace();
    } else if (model) {
      model.setActiveTab('marketplace');
    }
  };

  const handleEvents = () => {
    triggerImpactLight();
    if (onPressEvents) {
      onPressEvents();
    } else if (model) {
      model.setActiveOverlay('events');
    }
  };

  const actions: ActionItem[] = [
    {
      id: 'habits',
      label: 'Log Habit',
      subLabel: 'Track daily',
      iconType: 'material',
      iconName: 'leaf-circle',
      bgColor: '#E8F5E9',
      iconColor: '#126027',
      borderColor: '#D4EBD9',
      onPress: handleHabits,
    },
    {
      id: 'redeem_coins',
      label: 'Redeem Coins',
      subLabel: 'Get rewards',
      iconType: 'image',
      imageSource: require('../../../assets/coin.png'),
      bgColor: '#FEF3C7',
      iconColor: '#D97706',
      borderColor: '#FDE68A',
      onPress: handleRedeemCoins,
    },
    {
      id: 'give_and_get',
      label: 'Give & Get',
      subLabel: 'Swap items',
      iconType: 'material',
      iconName: 'swap-horizontal-bold',
      bgColor: '#E0F2FE',
      iconColor: '#0284C7',
      borderColor: '#BAE6FD',
      onPress: handleMarketplace,
    },
    {
      id: 'events',
      label: 'Eco Events',
      subLabel: 'Join drives',
      iconType: 'ionicons',
      iconName: 'calendar',
      bgColor: '#EDE9FE',
      iconColor: '#7C3AED',
      borderColor: '#DDD6FE',
      onPress: handleEvents,
    },
  ];

  return (
    <View style={styles.wrapper}>
      <View style={styles.grid}>
        {actions.map((action) => {
          const isPrimary = action.id === 'habits' && habitPending;

          return (
            <TouchableOpacity
              key={action.id}
              activeOpacity={0.78}
              onPress={action.onPress}
              style={[
                styles.card,
                {
                  backgroundColor: isPrimary ? (isDark ? '#142E1F' : '#EBF7EE') : theme.colors.card,
                  borderColor: isPrimary ? (isDark ? theme.colors.primary : '#126027') : (isDark ? theme.colors.cardBorder : action.borderColor),
                  borderWidth: isPrimary ? 2 : 1,
                  width: isTablet ? '23.5%' : '23%',
                  shadowOpacity: isPrimary ? (isDark ? 0.35 : 0.16) : (isDark ? 0.2 : 0.05),
                  transform: isPrimary ? [{ scale: 1.02 }] : undefined,
                },
              ]}
            >
              {isPrimary && (
                <View style={[styles.primaryBadge, { backgroundColor: isDark ? theme.colors.primary : '#126027' }]}>
                  <Text style={[styles.primaryBadgeText, { color: isDark ? '#0E1512' : '#FFFFFF' }]}>TODAY</Text>
                </View>
              )}
              <View style={[styles.iconCircle, { backgroundColor: isDark ? theme.colors.surfaceMuted : action.bgColor }]}>
                {action.iconType === 'image' ? (
                  <Image
                    source={action.imageSource}
                    style={{ width: scale(22), height: scale(22) }}
                    resizeMode="contain"
                  />
                ) : action.iconType === 'material' ? (
                  <MaterialCommunityIcons
                    name={action.iconName as any}
                    size={scale(22)}
                    color={isDark ? theme.colors.primary : action.iconColor}
                  />
                ) : (
                  <Ionicons
                    name={action.iconName as any}
                    size={scale(20)}
                    color={isDark ? theme.colors.primary : action.iconColor}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.actionLabel,
                  { color: isPrimary ? (isDark ? theme.colors.primary : '#126027') : theme.colors.textPrimary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {action.label}
              </Text>
              <Text style={[styles.actionSub, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {action.subLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: verticalScale(16),
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: scale(6),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(6),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#126027',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    position: 'relative',
  },
  primaryBadge: {
    position: 'absolute',
    top: -verticalScale(7),
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(1.5),
    borderRadius: moderateScale(6),
    zIndex: 10,
    elevation: 3,
  },
  primaryBadgeText: {
    fontSize: responsiveFontSize(7.5),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(6),
  },
  actionLabel: {
    fontSize: responsiveFontSize(11.5),
    fontWeight: '800',
    color: '#1A211D',
    textAlign: 'center',
    marginBottom: verticalScale(2),
  },
  actionSub: {
    fontSize: responsiveFontSize(9.5),
    fontWeight: '500',
    color: '#6B7A75',
    textAlign: 'center',
  },
});
