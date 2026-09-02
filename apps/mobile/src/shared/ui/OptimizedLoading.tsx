import React from 'react';
import { ActivityIndicator, Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTheme } from '../theme/ecoTheme';

const loadingAnimation = require('../../../assets/Loading.json');

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
    return isLegacyAndroid ? 140 : 180;
  }

  return isLegacyAndroid ? 64 : 80;
}

export function LoadingScreenVisual({ label, message, style }: LoadingScreenVisualProps) {
  const { theme, isDark } = useTheme();
  const lottieSize = getGlyphSize('lg');

  return (
    <View
      style={[
        styles.screenRoot,
        { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' },
        style,
      ]}
      renderToHardwareTextureAndroid={isAndroid}
      shouldRasterizeIOS
    >
      <View style={[styles.contentWrap, isLegacyAndroid && styles.contentWrapLegacy]}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {isDark && (
            <View
              style={{
                position: 'absolute',
                width: lottieSize * 0.95,
                height: lottieSize * 0.95,
                borderRadius: lottieSize * 0.5,
                backgroundColor: 'rgba(34, 167, 123, 0.14)',
                shadowColor: '#22A77B',
                shadowOpacity: 0.35,
                shadowRadius: 24,
                elevation: 6,
              }}
            />
          )}
          <LottieView
            source={loadingAnimation}
            autoPlay
            loop
            style={{ width: lottieSize, height: lottieSize, alignSelf: 'center' }}
          />
        </View>
        {label ? (
          <Text style={[styles.title, isDark && { color: theme.colors.textPrimary }]}>
            {label}
          </Text>
        ) : null}
        {message ? (
          <Text style={[styles.message, isDark && { color: theme.colors.textMuted }]}>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function LoadingGlyph({ size = 'md', style }: LoadingGlyphProps) {
  const { theme, isDark } = useTheme();
  const dimension = getGlyphSize(size);

  return (
    <View
      style={[styles.inlineRoot, style]}
      renderToHardwareTextureAndroid={isAndroid}
      shouldRasterizeIOS
    >
      <View
        style={[
          styles.inlineGlyph,
          { width: dimension, height: dimension },
          isDark && {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <ActivityIndicator
          size={dimension >= 72 ? 'large' : 'small'}
          color={isDark ? theme.colors.primary : '#126027'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    ...StyleSheet.absoluteFill,
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
