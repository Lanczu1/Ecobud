import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

const loadingGif = require('../../../assets/Loading.gif');

const isAndroid = Platform.OS === 'android';
const isLegacyAndroid = isAndroid && typeof Platform.Version === 'number' && Platform.Version < 29;

type LoadingGlyphSize = 'sm' | 'md' | 'lg';

interface LoadingScreenVisualProps {
  label?: string;
  message?: string;
  style?: StyleProp<ViewStyle>;
}

interface LoadingGlyphProps {
  size?: LoadingGlyphSize;
  style?: StyleProp<ViewStyle>;
}

function getGlyphSize(size: LoadingGlyphSize): number {
  if (size === 'sm') {
    return isLegacyAndroid ? 42 : 54;
  }

  if (size === 'lg') {
    return isLegacyAndroid ? 124 : 156;
  }

  return isLegacyAndroid ? 64 : 80;
}

export function LoadingScreenVisual({ label, message, style }: LoadingScreenVisualProps) {
  const gifSize = getGlyphSize('lg');

  return (
    <View
      style={[styles.screenRoot, style]}
      renderToHardwareTextureAndroid={isAndroid}
      shouldRasterizeIOS
    >

      <View style={[styles.contentWrap, isLegacyAndroid && styles.contentWrapLegacy]}>
        <Image
          source={loadingGif}
          style={{ width: '100%', height: gifSize, alignSelf: 'center' }}
          contentFit="contain"
          transition={0}
        />
        {label ? <Text style={styles.title}>{label}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

export function LoadingGlyph({ size = 'md', style }: LoadingGlyphProps) {
  const dimension = getGlyphSize(size);

  return (
    <View
      style={[styles.inlineRoot, style]}
      renderToHardwareTextureAndroid={isAndroid}
      shouldRasterizeIOS
    >
      <View style={[styles.inlineGlyph, { width: dimension, height: dimension }]}>
        <ActivityIndicator size={dimension >= 72 ? 'large' : 'small'} color="#126027" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  contentWrapLegacy: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    color: '#184D22',
  },
  message: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#4D6E55',
  },
  inlineRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(18,96,39,0.08)',
  },
});
