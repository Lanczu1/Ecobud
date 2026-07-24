import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { EcoBudMobileModel } from '../types/home';
import { Header } from './Header';

export function MarketplaceView({ model }: { model: EcoBudMobileModel }) {
  const items = [
    { id: '1', title: 'Eco-Friendly Water Bottle', price: 500, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=300' },
    { id: '2', title: 'Bamboo Toothbrush Set', price: 200, image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&q=80&w=300' },
    { id: '3', title: 'Reusable Grocery Bags', price: 300, image: 'https://images.unsplash.com/photo-1597348989645-46b190ce4918?auto=format&fit=crop&q=80&w=300' },
    { id: '4', title: 'Solar Powered Charger', price: 1500, image: 'https://images.unsplash.com/photo-1592833159155-c62df1b65634?auto=format&fit=crop&q=80&w=300' },
    { id: '5', title: 'Organic Cotton T-Shirt', price: 800, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=300' },
    { id: '6', title: 'Compost Bin for Kitchen', price: 1200, image: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=300' },
  ];

  return (
    <View style={styles.container}>
      <Header
        title="Marketplace"
        userDisplayName={model.userDisplayName}
        notificationCount={model.notificationCount}
        hasUsableInternet={model.hasUsableInternet}
        onEventsPress={() => model.setActiveOverlay('events')}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.pointsBanner}>
          <Ionicons name="leaf" size={24} color={ecoTheme.colors.primaryDark} />
          <Text style={styles.pointsText}>You have {model.dashboard?.ecoPoints || 0} EcoPoints</Text>
        </View>
        <Text style={styles.subtitle}>Redeem your points for sustainable products</Text>
        
        <View style={styles.grid}>
          {items.map(item => (
            <View key={item.id} style={styles.card}>
              <Image source={{ uri: item.image }} style={styles.image} />
              <View style={styles.cardInfo}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.priceRow}>
                  <Ionicons name="leaf-outline" size={16} color={ecoTheme.colors.primaryDark} />
                  <Text style={styles.priceText}>{item.price} pts</Text>
                </View>
                <TouchableOpacity style={styles.redeemButton}>
                  <Text style={styles.redeemText}>Redeem</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  pointsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ecoTheme.colors.surface,
    padding: 16,
    borderRadius: ecoTheme.radius.xl,
    marginBottom: 8,
    shadowColor: ecoTheme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pointsText: {
    fontSize: 20,
    fontWeight: '600',
    color: ecoTheme.colors.text,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    color: ecoTheme.colors.textSoft,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: ecoTheme.colors.surface,
    borderRadius: ecoTheme.radius.xl,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: ecoTheme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: ecoTheme.colors.surfaceMuted,
  },
  cardInfo: {
    padding: 12,
  },
  itemTitle: {
    fontSize: 14,
    color: ecoTheme.colors.text,
    height: 40,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 12,
    color: ecoTheme.colors.primaryDark,
    fontWeight: '600',
    marginLeft: 4,
  },
  redeemButton: {
    backgroundColor: ecoTheme.colors.primaryDark,
    paddingVertical: 8,
    borderRadius: ecoTheme.radius.md,
    alignItems: 'center',
  },
  redeemText: {
    color: ecoTheme.colors.surface,
    fontWeight: '600',
    fontSize: 12,
  },
});
