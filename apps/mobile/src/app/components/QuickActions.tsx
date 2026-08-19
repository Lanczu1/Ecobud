import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';
import { triggerImpactLight } from '../utils/haptics';
import { type EcoBudMobileModel } from '../types/home';

export interface QuickActionsProps {
  model?: EcoBudMobileModel;
  onPressHabits?: () => void;
  onPressRewards?: () => void;
  onPressMarketplace?: () => void;
  onPressEvents?: () => void;
}

interface ActionItem {
  id: string;
  label: string;
  subLabel: string;
  iconType: 'ionicons' | 'material';
  iconName: string;
  bgColor: string;
  iconColor: string;
  borderColor: string;
  badge?: string;
  onPress: () => void;
}

export function QuickActions({
  model,
  onPressHabits,
  onPressRewards,
  onPressMarketplace,
  onPressEvents,
}: QuickActionsProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const handleHabits = () => {
    triggerImpactLight();
    if (onPressHabits) {
      onPressHabits();
    } else if (model) {
      model.setActiveTab('tracker');
    }
  };

  const handleRewards = () => {
    triggerImpactLight();
    if (onPressRewards) {
      onPressRewards();
    } else if (model) {
      model.setActiveOverlay('rewards');
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
      id: 'rewards',
      label: 'Rewards',
      subLabel: 'Redeem coins',
      iconType: 'ionicons',
      iconName: 'gift',
      bgColor: '#FEF3C7',
      iconColor: '#D97706',
      borderColor: '#FDE68A',
      onPress: handleRewards,
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
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            activeOpacity={0.78}
            onPress={action.onPress}
            style={[
              styles.card,
              { borderColor: action.borderColor, width: isTablet ? '23.5%' : '23%' },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: action.bgColor }]}>
              {action.iconType === 'material' ? (
                <MaterialCommunityIcons
                  name={action.iconName as any}
                  size={scale(22)}
                  color={action.iconColor}
                />
              ) : (
                <Ionicons
                  name={action.iconName as any}
                  size={scale(20)}
                  color={action.iconColor}
                />
              )}
            </View>
            <Text style={styles.actionLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {action.label}
            </Text>
            <Text style={styles.actionSub} numberOfLines={1}>
              {action.subLabel}
            </Text>
          </TouchableOpacity>
        ))}
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
