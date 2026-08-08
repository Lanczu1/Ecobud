import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { responsiveFontSize, moderateScale, scale } from '../utils/responsive';

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
  onTrackerPress,
  onNotificationsPress,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  // Use device safe area top inset (notch / status bar) with a minimum of 16px breathing room
  const topPadding = Math.max(insets.top, 16);

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
  const [isViewingAvatar, setIsViewingAvatar] = useState(false);

  return (
    <>
      <View style={[styles.topNavbar, { paddingTop: topPadding }]}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
              <Feather name="arrow-left" size={24} color="#1A211D" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.avatarWrap} onPress={() => { if (avatarSource) setIsViewingAvatar(true); }}>
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
            </TouchableOpacity>
          )}
        </View>
        <View style={{ alignItems: 'center' }}>
          <Image
            source={require('../../../assets/logo.png')}
            style={{ width: scale(130), height: scale(130) * (45 / 140), resizeMode: 'contain' }}
          />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          {onTrackerPress && (
            <TouchableOpacity onPress={onTrackerPress}>
              <Ionicons name="bar-chart-outline" size={24} color="#126027" />
            </TouchableOpacity>
          )}
          {onEventsPress && (
            <TouchableOpacity onPress={onEventsPress}>
              <Ionicons name="calendar-outline" size={24} color="#126027" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onNotificationsPress}>
            <Ionicons name="notifications" size={24} color="#126027" />
            {notificationCount > 0 && <View style={styles.topNavBadge} />}
          </TouchableOpacity>
        </View>
      </View>

      {isViewingAvatar && (
        <Modal visible={isViewingAvatar} transparent={true} animationType="fade" onRequestClose={() => setIsViewingAvatar(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity style={{ position: 'absolute', top: 60, right: 30, zIndex: 10 }} onPress={() => setIsViewingAvatar(false)}>
              <Ionicons name="close" size={32} color="#FFF" />
            </TouchableOpacity>

            {avatarSource ? (
              <Image source={avatarSource} style={{ width: '100%', height: '70%', resizeMode: 'contain' }} />
            ) : (
              <AvatarBubble
                label={userDisplayName}
                size={200}
                style={{ borderRadius: 100 }}
                textStyle={{ fontSize: 80 }}
              />
            )}
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topNavbar: {
    // paddingTop is now applied dynamically via useSafeAreaInsets() in the component
    paddingHorizontal: scale(20),
    paddingBottom: scale(14),
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
    fontSize: responsiveFontSize(18),
  },
  avatarWrap: {
    position: 'relative',
    width: scale(44),
    height: scale(44),
  },
  topNavTitle: {
    fontSize: responsiveFontSize(20),
    fontWeight: '900',
    color: '#126027',
    letterSpacing: 1.5,
    flex: 1,
    flexShrink: 1,
    textAlign: 'center',
  },
  topNavTitleDark: {
    color: '#1A211D',
  },
  topNavBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
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
    fontSize: responsiveFontSize(20),
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
    width: scale(24),
    height: scale(24),
    resizeMode: 'contain',
  },
  brandText: {
    fontSize: responsiveFontSize(20),
    fontWeight: '900',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(20, 83, 45, 0.18)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

