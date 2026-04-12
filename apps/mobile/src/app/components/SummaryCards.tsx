import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { type SummaryCardsProps } from '../types/home';

export function SummaryCards({ currentStreak, ecoPoints }: SummaryCardsProps) {
  return (
    <View style={styles.homeMetricRow}>
      <View style={styles.homeMetricCard}>
        <View style={styles.homeMetricIconWrapBadge}>
           <MaterialCommunityIcons name="fire" size={20} color="#126027" />
        </View>
        <Text style={styles.homeMetricValue}>{currentStreak}</Text>
        <Text style={styles.homeMetricLabel}>DAY STREAK</Text>
      </View>
      <View style={styles.homeMetricCard}>
        <View style={[styles.homeMetricIconWrapBadge, { backgroundColor: '#F0F5F2' }]}>
           <Ionicons name="leaf" size={18} color="#126027" />
        </View>
        <Text style={styles.homeMetricValue}>{ecoPoints}</Text>
        <Text style={styles.homeMetricLabel}>ECO POINTS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeMetricRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  homeMetricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  homeMetricIconWrapBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  homeMetricValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 4,
  },
  homeMetricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1,
  },
});
