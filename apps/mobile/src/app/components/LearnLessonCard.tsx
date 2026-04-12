import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { type LessonWithProgress } from '../../shared/api/ecobudApi';

interface LearnLessonCardProps {
  lesson: LessonWithProgress;
  onPress: () => void;
}

const getActionLabel = (status: LessonWithProgress['status']) => {
  if (status === 'completed') {
    return 'Review Lesson';
  }

  if (status === 'seen') {
    return 'Continue Learning';
  }

  return 'Start Learning';
};

const getStatusLabel = (status: LessonWithProgress['status']) => {
  if (status === 'completed') {
    return 'Completed';
  }

  if (status === 'seen') {
    return 'Seen';
  }

  return 'Not Started';
};

export function LearnLessonCard({ lesson, onPress }: LearnLessonCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          <Ionicons name="book-outline" size={18} color="#126027" />
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{getStatusLabel(lesson.status)}</Text>
        </View>
      </View>

      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.description}>{lesson.description}</Text>

      {lesson.author && (
        <View style={styles.authorRow}>
          <Ionicons name="person-circle-outline" size={16} color="#6B7A75" />
          <Text style={styles.authorText}>Verified by {lesson.author.displayName}</Text>
        </View>
      )}

      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>Progress</Text>
        <Text style={styles.progressValue}>{lesson.progress}%</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, lesson.progress))}%` }]} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.actionText}>{getActionLabel(lesson.status)}</Text>
        <Ionicons name="arrow-forward" size={18} color="#126027" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    backgroundColor: '#E6F4EC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: '#126027',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B7A75',
    marginBottom: 18,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 0.6,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#126027',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E4E9E6',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#249D7A',
    borderRadius: 999,
  },
  footer: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#126027',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    opacity: 0.8,
  },
  authorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7A75',
  },
});
