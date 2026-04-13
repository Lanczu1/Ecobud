import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { type HeaderProps } from '../types/home';

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

function PresenceDot({ isOnline }: { isOnline: boolean }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isOnline) {
      scale.stopAnimation();
      opacity.stopAnimation();
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.22,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [isOnline, opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.presenceDot,
        isOnline ? styles.presenceDotOnline : styles.presenceDotOffline,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

export function Header({ userDisplayName, notificationCount, isUserOnline, showBack, title, onBack }: HeaderProps) {
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
            <PresenceDot isOnline={isUserOnline} />
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
  presenceDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    borderColor: '#F7F9F7',
  },
  presenceDotOnline: {
    backgroundColor: '#22C55E',
  },
  presenceDotOffline: {
    backgroundColor: '#EF4444',
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
