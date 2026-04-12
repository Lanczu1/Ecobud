import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { type QuickActionsProps } from '../types/home';

export function QuickActions({ weeklyGoal }: QuickActionsProps) {
  return (
    <View style={styles.weeklyGoalCard}>
      <Text style={styles.weeklyGoalLabel}>WEEKLY GOAL</Text>
      <Text style={styles.weeklyGoalTitle}>{weeklyGoal} eco actions</Text>
      <Text style={styles.weeklyGoalText}>Complete {weeklyGoal} verified actions this week.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  weeklyGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  weeklyGoalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1,
    marginBottom: 12,
  },
  weeklyGoalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A211D',
    marginBottom: 12,
  },
  weeklyGoalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7A75',
  },
});
