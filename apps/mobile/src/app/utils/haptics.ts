import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Trigger light selection haptic feedback (ideal for tab changes, toggle switches, chips)
 */
export function triggerSelectionHaptic() {
  if (!isHapticsAvailable) return;
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {}
}

/**
 * Trigger subtle light impact (ideal for buttons, card taps)
 */
export function triggerImpactLight() {
  if (!isHapticsAvailable) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {}
}

/**
 * Trigger medium impact (ideal for modal open, confirm actions)
 */
export function triggerImpactMedium() {
  if (!isHapticsAvailable) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {}
}

/**
 * Trigger success notification haptic (ideal for mission approval, quiz completed, points reward)
 */
export function triggerSuccessHaptic() {
  if (!isHapticsAvailable) return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {}
}

/**
 * Trigger warning notification haptic (ideal for errors or alerts)
 */
export function triggerWarningHaptic() {
  if (!isHapticsAvailable) return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  } catch {}
}
