import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { type CommunityImpactCardProps } from '../types/home';

export function CommunityImpactCard({ co2Saved, treesPlanted, communityMembers }: CommunityImpactCardProps) {
  return (
    <View style={styles.communityCard}>
      <View style={styles.communityHeader}>
        <Ionicons name="earth" size={20} color="#126027" />
        <Text style={styles.communityLabel}>COMMUNITY IMPACT</Text>
      </View>
      <View style={styles.communityStatsRow}>
        <View style={styles.communityStat}>
          <Text style={styles.communityStatValue}>{co2Saved}</Text>
          <Text style={styles.communityStatLabel}>CO₂ SAVED</Text>
        </View>
        <View style={styles.communityDivider} />
        <View style={styles.communityStat}>
          <Text style={styles.communityStatValue}>{treesPlanted.toLocaleString()}</Text>
          <Text style={styles.communityStatLabel}>TREES PLANTED</Text>
        </View>
        <View style={styles.communityDivider} />
        <View style={styles.communityStat}>
          <Text style={styles.communityStatValue}>{communityMembers.toLocaleString()}</Text>
          <Text style={styles.communityStatLabel}>MEMBERS</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  communityCard: {
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
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  communityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1.5,
  },
  communityStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  communityStat: {
    flex: 1,
    alignItems: 'center',
  },
  communityStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 4,
  },
  communityStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 0.8,
  },
  communityDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E4E9E6',
  },
});
