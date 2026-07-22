import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
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
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';

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
  userAvatarUrl,
  notificationCount,
  hasUsableInternet,
  showBack,
  title,
  onBack,
  onEventsPress,
}: HeaderProps) {
  const getAvatarSource = () => {
    if (!userAvatarUrl || userAvatarUrl === 'null') return null;
    let cleanUrl = userAvatarUrl.replace(/\\/g, '/');
    if (cleanUrl.includes('localhost:3000')) {
      cleanUrl = cleanUrl.replace('http://localhost:3000', ecobudApiOrigin);
    } else if (!cleanUrl.startsWith('http')) {
      cleanUrl = `${ecobudApiOrigin}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
    }
    return { uri: cleanUrl };
  };

  const avatarSource = getAvatarSource();

  return (
    <View style={styles.topNavbar}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color="#1A211D" />
          </TouchableOpacity>
        ) : (
          <View style={styles.avatarWrap}>
            {avatarSource ? (
              <Image
                source={avatarSource}
                style={[styles.topNavAvatar, { width: 44, height: 44, borderRadius: 22 }]}
              />
            ) : (
              <AvatarBubble
                label={userDisplayName}
                size={44}
                style={styles.topNavAvatar}
                textStyle={styles.topNavAvatarText}
              />
            )}
            <ConnectionStatusIndicator
              hasUsableInternet={hasUsableInternet}
              size={11}
              style={styles.connectionIndicator}
            />
          </View>
        )}
      </View>
      {title ? (
        <Text style={[styles.topNavTitle, styles.topNavTitleDark]}>{title}</Text>
      ) : (
        <View style={styles.brandTitleContainer}>
          <Image
            source={require('../../../assets/logo.png')}
            style={{ width: 160, height: 50, resizeMode: 'contain' }}
          />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {onEventsPress && (
          <TouchableOpacity onPress={onEventsPress}>
            <Ionicons name="calendar-outline" size={24} color="#126027" />
          </TouchableOpacity>
        )}
        <TouchableOpacity>
          <Ionicons name="notifications" size={24} color="#126027" />
          {notificationCount > 0 && <View style={styles.topNavBadge} />}
        </TouchableOpacity>
      </View>
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
  brandTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 6,
  },
  brandLogo: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  brandText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(20, 83, 45, 0.18)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
