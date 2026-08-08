import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';

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
        <Ionicons name="people-outline" size={scale(16)} color="#666" />
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
        <Ionicons name="search-outline" size={scale(20)} color="#666" style={styles.searchIcon} />
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
      
      <View style={{ height: verticalScale(40) }} /> {/* Bottom padding */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6', // Neutral eco background
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(50),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  headerTitle: {
    fontSize: responsiveFontSize(24),
    fontWeight: '700',
    color: '#2E7D32', // Primary Dark Green
    flexShrink: 1,
  },
  pointsPill: {
    backgroundColor: '#E8F5E9',
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(14),
    borderRadius: moderateScale(20),
  },
  pointsText: {
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: responsiveFontSize(13),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(12),
    minHeight: verticalScale(44),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchIcon: {
    marginRight: scale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: responsiveFontSize(14),
    color: '#333',
  },
  categoryList: {
    marginBottom: verticalScale(20),
    maxHeight: verticalScale(42),
  },
  categoryListContent: {
    paddingRight: scale(16),
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(18),
    marginRight: scale(8),
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
    fontSize: responsiveFontSize(12),
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: verticalScale(24),
    marginBottom: verticalScale(12),
  },
  sectionTitle: {
    fontSize: responsiveFontSize(16),
    fontWeight: '600',
    color: '#333',
    marginBottom: verticalScale(12),
  },
  seeAllText: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: responsiveFontSize(13),
    marginBottom: verticalScale(12),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    marginBottom: verticalScale(12),
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
    marginBottom: verticalScale(12),
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    paddingRight: scale(8),
  },
  cardTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: verticalScale(4),
  },
  categoryTag: {
    fontSize: responsiveFontSize(11),
    color: '#66BB6A',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  completedBadge: {
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: responsiveFontSize(12),
  },
  progressBarContainer: {
    height: verticalScale(7),
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: verticalScale(6),
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#66BB6A', // Secondary Green
  },
  progressText: {
    fontSize: responsiveFontSize(11),
    color: '#666',
    textAlign: 'right',
  },
  actionButton: {
    backgroundColor: '#2E7D32',
    minHeight: verticalScale(48),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(8),
    shadowColor: '#2E7D32',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: 'bold',
  },
  discoverList: {
    marginHorizontal: -scale(16),
  },
  discoverListContent: {
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(8),
  },
  discoverCard: {
    backgroundColor: '#FFFFFF',
    width: scale(200),
    borderRadius: moderateScale(16),
    padding: moderateScale(14),
    marginRight: scale(12),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  discoverCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  rewardPill: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(10),
  },
  rewardText: {
    color: '#E65100',
    fontSize: responsiveFontSize(11),
    fontWeight: 'bold',
  },
  discoverCardTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: '#333',
    marginBottom: verticalScale(12),
    flexShrink: 1,
  },
  discoverCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsText: {
    fontSize: responsiveFontSize(11),
    color: '#666',
    marginLeft: scale(4),
  }
});

export default ChallengeScreen;

