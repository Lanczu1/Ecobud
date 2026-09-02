import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { responsiveFontSize, moderateScale, scale } from '../utils/responsive';

import { type HeaderProps } from '../types/home';
import { ConnectionStatusIndicator } from '../../shared/ui/ConnectionStatusIndicator';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { useTheme } from '../../shared/theme/ecoTheme';

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
      <Text style={[styles.avatarInitials, textStyle, { fontSize: Math.round(size * 0.42) }]}>
        {initialsFromLabel(label)}
      </Text>
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
  onProfilePress,
  onEventsPress,
  onTrackerPress,
  onNotificationsPress,
}: HeaderProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isSmallDevice = height <= 680 || width < 375;
  const isTablet = width >= 600;

  // Use device safe area top inset (notch / status bar) with breathing room
  const topPadding = Math.max(insets.top, isSmallDevice ? 10 : 16);

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

  // Keep clean standard avatar & indicator dimensions so it maintains the exact default visual quality
  const avatarSize = isTablet ? 50 : 44;
  const indicatorSize = 11;
  const iconSize = isSmallDevice ? 22 : isTablet ? 26 : 24;
  const actionGap = isSmallDevice ? 10 : isTablet ? 20 : 14;
  const logoSize = isSmallDevice ? scale(42) : isTablet ? scale(52) : scale(46);
  const actionIconColor = isDark ? theme.colors.primary : '#126027';

  return (
    <>
      <View style={[
        styles.topNavbar,
        { paddingTop: topPadding, backgroundColor: theme.colors.navBackground },
        isSmallDevice && { paddingHorizontal: scale(16), paddingBottom: scale(12) }
      ]}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} style={{ marginRight: isSmallDevice ? 8 : 12, padding: 4 }}>
              <Feather name="arrow-left" size={iconSize} color={theme.colors.icon} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}
              activeOpacity={0.7}
              onPress={() => {
                if (onProfilePress) {
                  onProfilePress();
                }
              }}
              onLongPress={() => {
                setIsViewingAvatar(true);
              }}
              delayLongPress={300}
            >
              {avatarSource ? (
                <Image
                  source={avatarSource}
                  style={[styles.topNavAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, borderColor: theme.colors.primary }]}
                />
              ) : (
                <AvatarBubble
                  label={userDisplayName}
                  size={avatarSize}
                  style={[styles.topNavAvatar, { borderColor: theme.colors.primary }]}
                  textStyle={styles.topNavAvatarText}
                />
              )}
              <ConnectionStatusIndicator
                hasUsableInternet={hasUsableInternet}
                size={indicatorSize}
                style={styles.connectionIndicator}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={require('../../../assets/ecobud_logo_circle.png')}
            style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 2, resizeMode: 'contain' }}
          />
        </View>

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: actionGap }}>
          {onTrackerPress && (
            <TouchableOpacity onPress={onTrackerPress} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Ionicons name="bar-chart-outline" size={iconSize} color={actionIconColor} />
            </TouchableOpacity>
          )}
          {onEventsPress && (
            <TouchableOpacity onPress={onEventsPress} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Ionicons name="calendar-outline" size={iconSize} color={actionIconColor} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onNotificationsPress} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <Ionicons name="notifications" size={iconSize} color={actionIconColor} />
            {notificationCount > 0 && (
              <View style={[
                styles.topNavBadge,
                isSmallDevice && { width: scale(8), height: scale(8), borderRadius: scale(4) }
              ]} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isViewingAvatar && (
        <Modal visible={isViewingAvatar} transparent={true} animationType="fade" onRequestClose={() => setIsViewingAvatar(false)}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={1}
            onPress={() => setIsViewingAvatar(false)}
          >
            <TouchableOpacity
              style={{ position: 'absolute', top: Math.max(topPadding, 20), right: 24, zIndex: 10, padding: 8 }}
              onPress={() => setIsViewingAvatar(false)}
            >
              <Ionicons name="close" size={32} color="#FFF" />
            </TouchableOpacity>

            {avatarSource ? (
              <Image source={avatarSource} style={{ width: '85%', height: '70%', resizeMode: 'contain' }} />
            ) : (
              <AvatarBubble
                label={userDisplayName}
                size={200}
                style={{ borderRadius: 100 }}
                textStyle={{ fontSize: 80 }}
              />
            )}
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topNavbar: {
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
    fontWeight: '900',
    color: '#126027',
  },
  avatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
    bottom: -2,
    right: -2,
    zIndex: 10,
    elevation: 4,
  },
  avatarBubble: {
    backgroundColor: '#CBEFD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
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

