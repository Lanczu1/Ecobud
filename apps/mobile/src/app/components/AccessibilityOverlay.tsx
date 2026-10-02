import React, { useState } from 'react';
import { View, ScrollView, Switch, StyleSheet } from 'react-native';
import { Text, Pressable } from '../../shared/accessibility/primitives';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccessibility } from '../../shared/accessibility/AccessibilityContext';
import { useTheme } from '../../shared/theme/ecoTheme';
import { styles } from '../styles/appStyles';
import { EcoBudMobileModel } from '../types/home';
import { TopNavbar } from './CommonComponents';

function SettingsCard({ icon, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; children: React.ReactNode }) {
  const { theme, isDark } = useTheme();
  return (
    <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.cardBorder, overflow: 'hidden' }}>
      <View style={{ height: 140, backgroundColor: isDark ? theme.colors.surfaceMuted : '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={48} color={isDark ? theme.colors.primary : '#126027'} accessible={false} />
      </View>
      <View style={{ padding: 16 }}>{children}</View>
    </View>
  );
}

export function AccessibilityOverlay({ model }: { model: EcoBudMobileModel }) {
  const { theme, isDark } = useTheme();
  const { preferences, update, storageError } = useAccessibility();
  const { size, performance, contrast, bold, largeTargets } = preferences;
  const setSize = (size: typeof preferences.size) => update({ size });
  const setPerformance = (performance: boolean) => update({ performance });
  const setContrast = (contrast: boolean) => update({ contrast });
  const setBold = (bold: boolean) => update({ bold });
  const setLargeTargets = (largeTargets: boolean) => update({ largeTargets });
  const [activeTab, setActiveTab] = useState<'settings' | 'preview'>('settings');
  const accent = isDark ? theme.colors.primary : '#126027';
  const selectedText = isDark ? '#0E1512' : '#FFFFFF';
  const fontSize = 18;
  const options = [
    { icon: 'speedometer-outline' as const, title: 'Optimize performance', description: 'Reduce motion, turn off animations, and simplify visual effects.', value: performance, change: setPerformance },
    { icon: 'contrast-outline' as const, title: 'High contrast', description: 'Make text stand out from the background.', value: contrast, change: setContrast },
    { icon: 'text-outline' as const, title: 'Bold text', description: 'Use thicker letters for easier reading.', value: bold, change: setBold },
    { icon: 'hand-left-outline' as const, title: 'Larger tap areas', description: 'Give buttons more space for comfortable tapping.', value: largeTargets, change: setLargeTargets },
  ];
  const previewForeground = contrast ? (isDark ? '#FFFFFF' : '#111111') : theme.colors.textPrimary;
  const previewBackground = contrast ? (isDark ? '#000000' : '#FFFFFF') : theme.colors.surfaceMuted;

  return (
    <View style={[styles.fullscreenOverlay, { backgroundColor: theme.colors.background }]}>
      <TopNavbar model={model} showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.homeContent, { paddingBottom: 100 }]}>
        <Text style={[styles.welcomeLabel, { color: theme.colors.textMuted }]}>PREFERENCES</Text>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: theme.colors.textPrimary }]}>Accessibility</Text>
        <LinearGradient colors={['#059669', '#10B981', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={localStyles.banner}>
          <View pointerEvents="none" style={localStyles.orbRight} />
          <View pointerEvents="none" style={localStyles.orbLeft} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Ionicons name="accessibility-outline" size={34} color="#FFFFFF" accessible={false} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#D1FAE5', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>DISPLAY & COMFORT</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: 4 }}>Your preferences</Text>
            </View>
          </View>
        </LinearGradient>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginTop: 20, gap: 8 }}>
          {(['settings', 'preview'] as const).map(tab => (
            <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }} onPress={() => setActiveTab(tab)} style={({ pressed }) => ({ flex: 1, minHeight: 48, padding: 10, borderRadius: 12, backgroundColor: activeTab === tab ? accent : isDark ? theme.colors.surfaceMuted : '#F3F4F6', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: activeTab === tab ? selectedText : theme.colors.textMuted, fontSize: 16, fontWeight: '700' }}>{tab === 'settings' ? 'Settings' : 'Preview'}</Text>
            </Pressable>
          ))}
        </View>
        <Text accessibilityLiveRegion="polite" style={[localStyles.body, { color: theme.colors.textMuted, marginTop: 12 }]}>{storageError ? 'Changes are active. Could not save them on this device. Please try again.' : 'Changes apply throughout EcoBud and are saved on this device.'}</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          {activeTab === 'settings' ? <>
          <SettingsCard icon="text-outline">
            <Text accessibilityRole="header" style={[localStyles.title, { color: theme.colors.textPrimary }]}>Text size</Text>
            <Text style={[localStyles.body, { color: theme.colors.textSecondary, marginTop: 6 }]}>Select the size that is easiest to read.</Text>
            <View accessibilityRole="radiogroup" style={localStyles.sizeRow}>
              {(['Small', 'Medium', 'Large'] as const).map(value => (
                <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} text`} accessibilityState={{ checked: size === value }} onPress={() => setSize(value)} style={({ pressed }) => [localStyles.sizeButton, { backgroundColor: size === value ? accent : theme.colors.surfaceMuted, borderColor: size === value ? accent : theme.colors.border, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={[localStyles.title, { color: size === value ? selectedText : theme.colors.textPrimary }]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </SettingsCard>
          {options.map(option => (
            <SettingsCard key={option.title} icon={option.icon}>
              <View style={localStyles.settingRow}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[localStyles.title, { color: theme.colors.textPrimary }]}>{option.title}</Text>
                  <Text style={[localStyles.body, { color: theme.colors.textSecondary }]}>{option.description}</Text>
                </View>
                <Switch accessibilityLabel={option.title} accessibilityHint={option.description} value={option.value} onValueChange={option.change} trackColor={{ false: '#767676', true: '#126027' }} thumbColor="#FFFFFF" />
              </View>
            </SettingsCard>
          ))}
          </> : <SettingsCard icon="eye-outline">
            <Text accessibilityRole="header" style={[localStyles.title, { color: theme.colors.textPrimary }]}>Your display preview</Text>
            <View style={[localStyles.preview, { backgroundColor: previewBackground, borderColor: contrast ? previewForeground : theme.colors.border }]}>
              <Text style={{ fontSize, lineHeight: fontSize * 1.5, fontWeight: bold ? '700' : '400', color: previewForeground }}>Check your Eco Coins and daily activities in Eco Hub.</Text>
              <View style={[localStyles.sampleButton, { minHeight: largeTargets ? 64 : 48, backgroundColor: accent }]}>
                <Text style={{ fontSize, fontWeight: bold ? '700' : '600', color: selectedText, textAlign: 'center' }}>Sample button</Text>
              </View>
              <Text accessibilityLiveRegion="polite" style={[localStyles.body, { color: previewForeground }]}>{performance ? 'Reduced motion selected. Static display.' : 'Standard display selected.'}</Text>
            </View>
          </SettingsCard>}
        </View>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  banner: { width: '100%', borderRadius: 24, padding: 20, marginTop: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', shadowColor: '#059669', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  orbRight: { position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  orbLeft: { position: 'absolute', bottom: -30, left: -10, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)' },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  sizeButton: { minWidth: 80, flexGrow: 1, minHeight: 52, padding: 10, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  preview: { marginTop: 16, padding: 16, gap: 16, borderWidth: 1, borderRadius: 12 },
  sampleButton: { padding: 12, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
