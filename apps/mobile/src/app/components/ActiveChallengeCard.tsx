import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { type ActiveChallengeCardProps } from '../types/home';

export function ActiveChallengeCard({ dailyChallenge, onComplete }: ActiveChallengeCardProps) {
  return (
    <View style={styles.todayChallengeCard}>
      <View style={styles.challengeBadge}>
        <Text style={styles.challengeBadgeText}>TODAY'S CHALLENGE</Text>
      </View>
      <Text style={styles.todayChallengeTitle}>{dailyChallenge.title}</Text>
      <Text style={styles.todayChallengeDesc}>{dailyChallenge.description}</Text>
      <TouchableOpacity style={styles.challengeCompleteBtn} onPress={onComplete}>
        <Ionicons name="checkmark-circle" size={18} color="#126027" />
        <Text style={styles.challengeCompleteBtnText}>Mark as Complete</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  todayChallengeCard: {
    backgroundColor: '#D4F7D4',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  challengeBadge: {
    backgroundColor: '#126027',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  challengeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  todayChallengeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#126027',
    marginBottom: 8,
  },
  todayChallengeDesc: {
    fontSize: 15,
    color: '#126027',
    opacity: 0.8,
    marginBottom: 24,
  },
  challengeCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  challengeCompleteBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#126027',
  },
});
