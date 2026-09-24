import React, { useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image/build/Image.types';
import type { ImageStyle } from 'react-native';
import { resolveMediaUrl } from '../../app/utils/appUtils';
import { ecobudApiOrigin } from '../api/ecobudApi';

export interface FastImageProps extends Omit<ExpoImageProps, 'source'> {
  source?: { uri?: string | null } | number | string | null;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  fallback?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  imageQuality?: number;
}

/**
 * FastImage - Ultra-fast cached image component powered by expo-image.
 * Automatically enables memory-disk caching, smooth fade-in transitions,
 * URL resolution for backend assets, and fallback error handling.
 */
export function FastImage({
  source,
  style,
  contentFit,
  resizeMode,
  fallback,
  containerStyle,
  cachePolicy = 'memory-disk',
  transition = 150,
  thumbnailWidth,
  thumbnailHeight,
  imageQuality,
  onError,
  ...props
}: FastImageProps) {
  const [hasError, setHasError] = useState(false);

  const thumbOptions = thumbnailWidth || imageQuality ? {
    width: thumbnailWidth,
    height: thumbnailHeight,
    quality: imageQuality || 80,
  } : undefined;

  let resolvedSource: any = null;

  if (typeof source === 'number') {
    // Local require(...) asset
    resolvedSource = source;
  } else if (typeof source === 'string') {
    resolvedSource = { uri: resolveMediaUrl(source, ecobudApiOrigin, thumbOptions) || source };
  } else if (source && typeof source === 'object' && source.uri) {
    resolvedSource = { uri: resolveMediaUrl(source.uri, ecobudApiOrigin, thumbOptions) || source.uri };
  }

  if (!resolvedSource || (typeof resolvedSource === 'object' && !resolvedSource.uri) || hasError) {
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
      cachePolicy={cachePolicy}
      transition={transition}
      priority="high"
      recyclingKey={typeof resolvedSource === 'object' ? resolvedSource.uri : undefined}
      placeholder={props.placeholder || { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
      placeholderContentFit={fit}
      onError={(e: any) => {
        setHasError(true);
        if (onError) onError(e);
      }}
      {...props}
    />
  );
}

/**
 * Prefetches an array of remote image URLs into disk memory so they display immediately with zero pop-in during scroll.
 */
FastImage.prefetch = (urls: string[]) => {
  if (!urls || urls.length === 0) return Promise.resolve(false);
  const validUrls = urls
    .map(url => resolveMediaUrl(url, ecobudApiOrigin, { width: 500, quality: 80 }))
    .filter((url): url is string => Boolean(url && (url.startsWith('http://') || url.startsWith('https://'))));

  if (validUrls.length === 0) return Promise.resolve(false);
  return ExpoImage.prefetch(validUrls, 'disk');
};
