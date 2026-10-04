import React, { useEffect, useMemo, useState } from 'react';
import { useAccessibility, getAccessibilityPreferences } from '../accessibility/AccessibilityContext';
import { AppState, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image/build/Image.types';
import type { ImageStyle } from 'react-native';
import { resolveMediaUrl } from '../../app/utils/appUtils';
import { ecobudApiOrigin } from '../api/ecobudApi';
import { createImagePrefetcher } from './imagePrefetch';
import { isLowEndDevice } from '../performance/deviceTier';

export interface FastImageProps extends Omit<ExpoImageProps, 'source'> {
  source?: { uri?: string | null } | number | string | null;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  fallback?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  imageQuality?: number;
}

export function FastImage({
  source,
  style,
  contentFit,
  resizeMode,
  fallback,
  containerStyle,
  cachePolicy,
  transition = 150,
  thumbnailWidth,
  thumbnailHeight,
  imageQuality,
  onError,
  priority = 'normal',
  ...props
}: FastImageProps) {
  const { preferences } = useAccessibility();
  // Decoding a blurhash and cross-fading each cell costs frames while a list scrolls.
  const lite = preferences.performance || isLowEndDevice();
  const [failedSource, setFailedSource] = useState<string | number | null>(null);
  const sourceValue = typeof source === 'object' ? source?.uri : source;
  const resolvedSource = useMemo(() => {
    if (typeof sourceValue === 'number') return sourceValue;
    if (!sourceValue) return null;
    const options = thumbnailWidth || thumbnailHeight || imageQuality ? {
      width: thumbnailWidth, height: thumbnailHeight, quality: imageQuality ?? 80,
    } : undefined;
    return { uri: resolveMediaUrl(sourceValue, ecobudApiOrigin, options) || sourceValue };
  }, [sourceValue, thumbnailWidth, thumbnailHeight, imageQuality]);
  const sourceKey = typeof resolvedSource === 'object' ? resolvedSource?.uri ?? null : resolvedSource;
  useEffect(() => { setFailedSource(null); }, [sourceKey]);

  if (!resolvedSource || failedSource === sourceKey) {
    if (fallback) {
      return <View style={containerStyle || (style as StyleProp<ViewStyle>)}>{fallback}</View>;
    }
    return null;
  }

  // Map legacy resizeMode to Expo Image contentFit
  const fit = contentFit || (resizeMode === 'center' ? 'scale-down' : resizeMode) || 'cover';

  return (
    <ExpoImage
      source={resolvedSource}
      style={style as ImageStyle}
      contentFit={fit}
      cachePolicy={cachePolicy ?? (preferences.performance ? 'disk' : 'memory-disk')}
      transition={lite ? 0 : transition}
      priority={priority}
      allowDownscaling
      enforceEarlyResizing
      recyclingKey={typeof resolvedSource === 'object' ? resolvedSource.uri : undefined}
      placeholder={props.placeholder ?? (lite ? undefined : { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' })}
      placeholderContentFit={fit}
      onError={(e: any) => {
        setFailedSource(sourceKey);
        if (onError) onError(e);
      }}
      {...props}
    />
  );
}

const prefetchImages = createImagePrefetcher(
  url => ExpoImage.prefetch(url, 'disk'),
  () => !getAccessibilityPreferences().performance &&
    (AppState.currentState === null || AppState.currentState === 'active'),
);

FastImage.prefetch = (urls: string[]) => {
  if (!urls || urls.length === 0) return Promise.resolve(false);
  const validUrls = urls
    .map(url => resolveMediaUrl(url, ecobudApiOrigin, { width: 500, quality: 80 }))
    .filter((url): url is string => Boolean(url && (url.startsWith('http://') || url.startsWith('https://'))));

  if (validUrls.length === 0) return Promise.resolve(false);
  return prefetchImages(validUrls);
};
