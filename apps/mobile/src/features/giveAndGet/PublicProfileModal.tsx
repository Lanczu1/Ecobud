import React from 'react';
import { View, Text, Modal, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';

function getValidImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  let cleanUrl = url.replace(/\\/g, '/');
  if (cleanUrl.includes('localhost:3000')) {
    cleanUrl = cleanUrl.replace('http://localhost:3000', ecobudApiOrigin);
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = `${ecobudApiOrigin}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
  }
  return cleanUrl;
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

type PublicProfileModalProps = {
  visible: boolean;
  onClose: () => void;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    isVerified?: boolean;
  };
};

export function PublicProfileModal({ visible, onClose, user }: PublicProfileModalProps) {
  if (!user) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#6B7A75" />
          </TouchableOpacity>
          
          <View style={styles.avatarContainer}>
            {user.avatarUrl ? (
              <Image source={{ uri: getValidImageUrl(user.avatarUrl) }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{getInitials(user.displayName)}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user.displayName}</Text>
            {user.isVerified && (
              <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
            )}
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={16} color="#6B7A75" />
            <Text style={styles.infoText}>EcoBud Community Member</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    padding: 32,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F5F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E4E9E6',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#6B7A75',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#131F19',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7A75',
  },
});
