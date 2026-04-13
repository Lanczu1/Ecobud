import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { type HeaderProps } from '../types/home';
import { ConnectionStatusIndicator } from '../../shared/ui/ConnectionStatusIndicator';

function initialsFromLabel(label: string) {
  return label.trim().slice(0, 1).toUpperCase() || 'E';
}

function AvatarBubble({
  label,
  size,
  style,
  textStyle,
}: {
  label: string;
  size: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.avatarBubble, style, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, textStyle]}>{initialsFromLabel(label)}</Text>
    </View>
  );
}

export function Header({
  userDisplayName,
  notificationCount,
  hasUsableInternet,
  showBack,
  title,
  onBack,
}: HeaderProps) {
  return (
    <View style={styles.topNavbar}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color="#1A211D" />
          </TouchableOpacity>
        ) : (
          <View style={styles.avatarWrap}>
            <AvatarBubble
              label={userDisplayName}
              size={44}
              style={styles.topNavAvatar}
              textStyle={styles.topNavAvatarText}
            />
            <ConnectionStatusIndicator
              hasUsableInternet={hasUsableInternet}
              size={11}
              style={styles.connectionIndicator}
            />
          </View>
        )}
      </View>
      <Text style={[styles.topNavTitle, title ? styles.topNavTitleDark : {}]}>{title || 'ECOBUD'}</Text>
      <TouchableOpacity>
        <Ionicons name="notifications" size={24} color="#126027" />
        {notificationCount > 0 && <View style={styles.topNavBadge} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topNavbar: {
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F9F7',
  },
  topNavAvatar: {
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  topNavAvatarText: {
    fontSize: 18,
  },
  avatarWrap: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  topNavTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#126027',
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
  },
  topNavTitleDark: {
    color: '#1A211D',
  },
  topNavBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  connectionIndicator: {
    position: 'absolute',
    top: 1,
    right: 1,
  },
  avatarBubble: {
    backgroundColor: '#CBEFD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '900',
    color: '#126027',
  },
});
