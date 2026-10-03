import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, ScrollView } from 'react-native';
import { Modal, Pressable, Text, TextInput } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';
const reportNames = ['Fake Listing', 'Misleading Photos', 'Misleading Description', 'Unsafe Item', 'Inappropriate Content', 'Other'];

export function ReportListingDialog({ title, onClose, onSubmit }: {
  title: string;
  onClose: () => void;
  onSubmit: (reason: string, reportName: string) => Promise<void>;
}) {
  const { theme } = useTheme();
  const [reason, setReason] = useState('');
  const [reportName, setReportName] = useState('Fake Listing');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy || reason.trim().length < 5) return;
    setBusy(true);
    setError('');
    try { await onSubmit(reason.trim(), reportName); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not submit your report. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ width: '100%', maxWidth: 420, flexGrow: 0 }} contentContainerStyle={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.textPrimary }]}>Report Listing</Text>
          <Text style={{ color: theme.colors.textSecondary }}>Report “{title}” if it is fake, misleading, unsafe, or inappropriate. A moderator will review it. The listing stays visible unless rejected.</Text>
          <Text style={{ color: theme.colors.textPrimary }}>Report Name</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {reportNames.map(name => <Pressable key={name} accessibilityRole="radio" accessibilityState={{ checked: reportName === name }} disabled={busy} onPress={() => setReportName(name)} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: reportName === name ? theme.colors.primary : theme.colors.cardBorder }}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: reportName === name ? '700' : '400' }}>{name}</Text>
            </Pressable>)}
          </View>
          <Text style={{ color: theme.colors.textPrimary }}>Reason (5–500 characters)</Text>
          <TextInput
            accessibilityLabel="Report reason"
            value={reason}
            onChangeText={setReason}
            editable={!busy}
            multiline
            maxLength={500}
            placeholder="Describe what is wrong with this listing..."
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.cardBorder }]}
          />
          {!!error && <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.button}>
              <Text style={{ color: theme.colors.textPrimary }}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy || reason.trim().length < 5} onPress={() => void submit()} style={[styles.button, { backgroundColor: theme.colors.primary, opacity: busy || reason.trim().length < 5 ? 0.5 : 1 }]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{busy ? 'Submitting…' : 'Submit Report'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.52)' },
  card: { width: '100%', maxWidth: 420, padding: 22, gap: 14, borderRadius: 20, borderWidth: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  input: { minHeight: 110, maxHeight: 180, padding: 12, borderWidth: 1, borderRadius: 12, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
});
