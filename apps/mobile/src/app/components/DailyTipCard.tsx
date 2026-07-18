import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export function DailyTipCard({ title, description }: { title?: string, description?: string }) {
  return (
    <View style={styles.dailyTipCard}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <MaterialCommunityIcons name="lightbulb-on" size={12} color="#126027" />
          <Text style={[styles.welcomeLabel, { marginLeft: 4 }]}>DAILY TIP</Text>
        </View>
        <Text style={styles.tipTitle}>{title || "Cold Wash Advantage"}</Text>
        <Text style={styles.tipDesc}>{description || "Washing clothes at 30°C instead of 40°C can save up to 40% of energy usage over a year."}</Text>
      </View>
      <Image source={{ uri: 'https://images.unsplash.com/photo-1582735689369-dbcf0e2c8a7b?q=80&w=400&auto=format&fit=crop' }} style={styles.tipImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  dailyTipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  welcomeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1.5,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A211D',
    marginBottom: 4,
  },
  tipDesc: {
    fontSize: 14,
    color: '#6B7A75',
    lineHeight: 20,
  },
  tipImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
});
