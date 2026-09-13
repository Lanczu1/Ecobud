import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ecoTheme';

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { theme } = useTheme();
  const accent = destructive ? theme.colors.error : theme.colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onCancel}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close confirmation" style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} />
        <View accessibilityRole="alert" style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={[styles.icon, { backgroundColor: `${accent}1F` }]}>
            <Ionicons name={destructive ? 'warning' : 'help-circle'} size={25} color={accent} />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [styles.button, { borderColor: theme.colors.cardBorder }, pressed && styles.pressed]}
            >
              <Text style={[styles.cancelText, { color: theme.colors.textPrimary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void onConfirm()}
              style={({ pressed }) => [styles.button, styles.confirm, { backgroundColor: accent }, pressed && styles.pressed, busy && styles.disabled]}
            >
              <Text style={styles.confirmText}>{busy ? 'Please wait…' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.52)', flex: 1, justifyContent: 'center', padding: 24 },
  card: { borderRadius: 20, borderWidth: 1, maxWidth: 420, padding: 22, width: '100%' },
  icon: { alignItems: 'center', borderRadius: 14, height: 48, justifyContent: 'center', marginBottom: 16, width: 48 },
  title: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  message: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  button: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 },
  confirm: { borderWidth: 0 },
  cancelText: { fontSize: 14, fontWeight: '700' },
  confirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.6 },
});
