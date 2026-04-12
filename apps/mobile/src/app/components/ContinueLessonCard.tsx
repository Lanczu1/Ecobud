import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export function ContinueLessonCard() {
  return (
    <View style={styles.articleCard}>
      <Image source={{ uri: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop' }} style={styles.articleImage} />
      <View style={styles.articleContent}>
        <View style={styles.rowBetween}>
          <Text style={styles.articleTitle}>Understanding Carbon Sequestration</Text>
          <Feather name="arrow-right" size={20} color="#126027" />
        </View>
        <Text style={styles.articleDesc}>Learn how our local forests are the unsung heroes of climate stability and how you can...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  articleImage: {
    width: '100%',
    height: 160,
  },
  articleContent: {
    padding: 20,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A211D',
    flex: 1,
    marginRight: 16,
  },
  articleDesc: {
    fontSize: 14,
    color: '#6B7A75',
    lineHeight: 22,
    marginTop: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
