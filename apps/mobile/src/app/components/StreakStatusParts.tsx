import React from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, Text } from '../../shared/accessibility/primitives';

export function streakStatusPalette(dark: boolean, tone: 'green' | 'yellow' | 'red' = 'green') {
  if (tone === 'red') return dark
    ? { background: '#260F12', ink: '#FECACA', muted: '#E5B3B7', accent: '#FDA4AF', border: '#77343E', inset: '#40171D', buttonInk: '#450A0A' }
    : { background: '#FFF5F5', ink: '#881337', muted: '#9F354C', accent: '#9F1239', border: '#EDB6C1', inset: '#FFE4E9', buttonInk: '#FFFFFF' };
  if (tone === 'yellow') return dark
    ? { background: '#261F10', ink: '#FDE68A', muted: '#DDC98F', accent: '#FCD34D', border: '#79602E', inset: '#3C3015', buttonInk: '#422D0A' }
    : { background: '#FFFBEB', ink: '#713F12', muted: '#805B24', accent: '#854D0E', border: '#E6CF93', inset: '#FEF0BF', buttonInk: '#FFFFFF' };
  return dark
    ? { background: '#10251D', ink: '#D1FAE5', muted: '#A9CCBB', accent: '#6EE7B7', border: '#345B49', inset: '#1B382C', buttonInk: '#092419' }
    : { background: '#F2FBF6', ink: '#14532D', muted: '#456B55', accent: '#166534', border: '#C3DFCE', inset: '#E0F2E7', buttonInk: '#FFFFFF' };
}

export type StreakStatusPalette = ReturnType<typeof streakStatusPalette>;

export function StreakStatusAction({ label = 'View challenges', onPress, colors }: { label?: string; onPress: () => void; colors: StreakStatusPalette }) {
  const [focused, setFocused] = React.useState(false);
  return <Pressable accessibilityRole="button" onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[streakStatusStyles.button, { backgroundColor: colors.accent, borderColor: focused ? colors.ink : 'transparent' }]}>
    <Text style={[streakStatusStyles.buttonText, { color: colors.buttonInk }]}>{label}</Text>
  </Pressable>;
}

export const streakStatusStyles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 400, alignSelf: 'center', minWidth: 0, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  button: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
