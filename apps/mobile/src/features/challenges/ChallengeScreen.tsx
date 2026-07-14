import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// NOTE: This represents a React Native (Expo) Component utilizing a modern
// "Eco" design language inspired by Google Material You and Duolingo.

const ChallengeCard = ({ title, progress, isCompleted, category }: { title: string, progress: number, isCompleted: boolean, category?: string }) => {
  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.cardTitle}>{title}</Text>
          {category && <Text style={styles.categoryTag}>{category}</Text>}
        </View>
        {isCompleted && <Text style={styles.completedBadge}>Done ✓</Text>}
      </View>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>{progress}% Completed</Text>
    </View>
  );
};

const DiscoverCard = ({ title, category, reward, participants }: { title: string, category: string, reward: number, participants: number }) => {
  return (
    <TouchableOpacity style={styles.discoverCard}>
      <View style={styles.discoverCardHeader}>
        <Text style={styles.categoryTag}>{category}</Text>
        <View style={styles.rewardPill}>
          <Text style={styles.rewardText}>+{reward} pts</Text>
        </View>
      </View>
      <Text style={styles.discoverCardTitle}>{title}</Text>
      <View style={styles.discoverCardFooter}>
        <Ionicons name="people-outline" size={16} color="#666" />
        <Text style={styles.participantsText}>{participants} joined</Text>
      </View>
    </TouchableOpacity>
  );
};

export const ChallengeScreen = () => {
  // Sample State
  const [points, setPoints] = useState(120);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Recycling', 'Energy', 'Water', 'Community'];

  const completeAction = () => {
    // In production: Call API -> GamificationService -> Update UI
    setPoints(prev => prev + 10);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Challenges</Text>
        <View style={styles.pointsPill}>
          <Text style={styles.pointsText}>🌱 {points} pts</Text>
        </View>
      </View>

      {/* Discovery & Filtering Section */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search challenges..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryList} contentContainerStyle={styles.categoryListContent}>
        {categories.map((cat, index) => (
          <TouchableOpacity 
            key={index} 
            style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipSelected]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextSelected]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Active Challenges</Text>
      
      <ChallengeCard title="Use a Reusable Water Bottle" progress={100} isCompleted={true} category="Waste" />
      <ChallengeCard title="7-Day Waste Segregation" progress={43} isCompleted={false} category="Recycling" />
      
      <TouchableOpacity style={styles.actionButton} onPress={completeAction}>
        <Text style={styles.actionButtonText}>Log Eco-Action (+10 pts)</Text>
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Discover More</Text>
        <TouchableOpacity>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoverList} contentContainerStyle={styles.discoverListContent}>
        <DiscoverCard title="Meatless Monday" category="Diet" reward={50} participants={1240} />
        <DiscoverCard title="Plant a Tree" category="Community" reward={200} participants={85} />
        <DiscoverCard title="Zero Waste Week" category="Recycling" reward={150} participants={432} />
      </ScrollView>
      
      <View style={{ height: 40 }} /> {/* Bottom padding */}
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
    marginBottom: 20,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  categoryList: {
    marginBottom: 25,
    maxHeight: 40,
  },
  categoryListContent: {
    paddingRight: 20,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'center',
  },
  categoryChipSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  categoryChipText: {
    color: '#666',
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15, // For sections without header right side
  },
  seeAllText: {
    color: '#2E7D32',
    fontWeight: '600',
    marginBottom: 15, // Match section title margin
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
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  categoryTag: {
    fontSize: 12,
    color: '#66BB6A',
    fontWeight: '600',
    textTransform: 'uppercase',
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
    marginTop: 10,
    shadowColor: '#2E7D32',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  discoverList: {
    marginHorizontal: -20, // Negative margin to allow full-width scroll
  },
  discoverListContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  discoverCard: {
    backgroundColor: '#FFFFFF',
    width: 220,
    borderRadius: 16,
    padding: 15,
    marginRight: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  discoverCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rewardPill: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardText: {
    color: '#E65100',
    fontSize: 12,
    fontWeight: 'bold',
  },
  discoverCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  discoverCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  }
});

export default ChallengeScreen;
