import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ecoTheme } from '../../shared/theme/ecoTheme';

interface RejectionModalProps {
  visible: boolean;
  title: string;
  reason: string;
  onClose: () => void;
  onResubmit?: () => void;
}

export function RejectionModal({
  visible,
  title,
  reason,
  onClose,
  onResubmit,
}: RejectionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle" size={32} color="#DC2626" />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#6B7A75" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.title}>{title}</Text>
          
          <View style={styles.reasonContainer}>
            <Text style={styles.reasonLabel}>Moderator Note:</Text>
            <Text style={styles.reasonText}>{reason || 'No reason provided.'}</Text>
          </View>
          
          <View style={styles.actions}>
            {onResubmit ? (
              <>
                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => {
                  onClose();
                  onResubmit();
                }}>
                  <Text style={styles.primaryBtnText}>Resubmit</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>Understood</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: width - 48,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  reasonContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#126027',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
