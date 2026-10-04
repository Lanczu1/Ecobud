import { Dimensions, PixelRatio, Platform } from 'react-native';
import { useAccessibility } from '../accessibility/AccessibilityContext';

/**
 * Budget Android hardware is identified without a native module: phones on
 * Android 9 or older, or with an HD-class panel (720p phones, 800p tablets).
 */
export function detectLowEndDevice(device: { os: string; version: number | string; shortSidePx: number }): boolean {
  if (device.os !== 'android') return false;
  if (typeof device.version === 'number' && device.version < 29) return true;
  return device.shortSidePx > 0 && device.shortSidePx <= 800;
}

let lowEnd: boolean | undefined;

export function isLowEndDevice(): boolean {
  if (lowEnd === undefined) {
    try {
      const { width, height } = Dimensions.get('screen');
      lowEnd = detectLowEndDevice({
        os: Platform.OS,
        version: Platform.Version,
        shortSidePx: Math.round(Math.min(width, height) * PixelRatio.get()),
      });
    } catch {
      lowEnd = false;
    }
  }
  return lowEnd;
}

/**
 * True when rendering should take the cheaper path: the user enabled
 * "Optimize performance", or the device was detected as low-end. Unlike the
 * user preference, a detected low-end device still plays native animations.
 */
export function useLiteMode(): boolean {
  const { preferences } = useAccessibility();
  return preferences.performance || isLowEndDevice();
}
