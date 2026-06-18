import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { type ActiveChallengeCardProps } from '../types/home';

export function ActiveChallengeCard({ dailyChallenge, onComplete, onClaim }: ActiveChallengeCardProps) {
  const status = dailyChallenge.progress?.status?.toLowerCase() || 'not_started';

  let btnContent = (
    <>
      <Ionicons name="checkmark-circle" size={18} color="#126027" />
      <Text style={styles.challengeCompleteBtnText}>Mark as Complete</Text>
    </>
  );
  let btnStyle: any = styles.challengeCompleteBtn;
  let disabled = false;
  let onPress = onComplete;

  if (status === 'pending') {
    btnContent = (
      <>
        <Ionicons name="time" size={18} color="#B45309" />
        <Text style={[styles.challengeCompleteBtnText, { color: '#B45309' }]}>Pending Approval</Text>
      </>
    );
    btnStyle = [styles.challengeCompleteBtn, { backgroundColor: '#FEF3C7' }];
    disabled = true;
  } else if (status === 'approved' || status === 'unclaimed') {
    btnContent = (
      <>
        <Ionicons name="gift" size={18} color="#FFFFFF" />
        <Text style={[styles.challengeCompleteBtnText, { color: '#FFFFFF' }]}>Claim Reward</Text>
      </>
    );
    btnStyle = [styles.challengeCompleteBtn, { backgroundColor: '#F59E0B' }]; // Amber color for claim
    onPress = onClaim || (() => {});
  } else if (status === 'completed') {
    btnContent = (
      <>
        <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
        <Text style={[styles.challengeCompleteBtnText, { color: '#FFFFFF' }]}>Completed</Text>
      </>
    );
    btnStyle = [styles.challengeCompleteBtn, { backgroundColor: '#10B981' }]; // Green color for done
    disabled = true;
  }

  return (
    <View style={styles.todayChallengeCard}>
      <View style={styles.challengeBadge}>
        <Text style={styles.challengeBadgeText}>TODAY'S CHALLENGE</Text>
      </View>
      <Text style={styles.todayChallengeTitle}>{dailyChallenge.title}</Text>
      <Text style={styles.todayChallengeDesc}>{dailyChallenge.description}</Text>
      <TouchableOpacity 
        style={btnStyle} 
        onPress={onPress}
        disabled={disabled}
      >
        {btnContent}
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
