import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

// NOTE: This represents a React Native (Expo) Component utilizing a modern
// "Eco" design language inspired by Google Material You and Duolingo.

const ChallengeCard = ({ title, progress, isCompleted }: { title: string, progress: number, isCompleted: boolean }) => {
  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {isCompleted && <Text style={styles.completedBadge}>Done ✓</Text>}
      </View>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>{progress}% Completed</Text>
    </View>
  );
};

export const ChallengeScreen = () => {
  // Sample State
  const [points, setPoints] = useState(120);

  const completeAction = () => {
    // In production: Call API -> GamificationService -> Update UI
    setPoints(prev => prev + 10);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Daily Quests</Text>
        <View style={styles.pointsPill}>
          <Text style={styles.pointsText}>🌱 {points} pts</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Active Challenges</Text>
      
      <ChallengeCard title="Use a Reusable Water Bottle" progress={100} isCompleted={true} />
      <ChallengeCard title="7-Day Waste Segregation" progress={43} isCompleted={false} />
      
      <TouchableOpacity style={styles.actionButton} onPress={completeAction}>
        <Text style={styles.actionButtonText}>Log Eco-Action (+10 pts)</Text>
      </TouchableOpacity>
      
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6', // Neutral eco background
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2E7D32', // Primary Dark Green
  },
  pointsPill: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  pointsText: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardCompleted: {
    borderColor: '#A5D6A7',
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  completedBadge: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#66BB6A', // Secondary Green
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  actionButton: {
    backgroundColor: '#2E7D32',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#2E7D32',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default ChallengeScreen;
