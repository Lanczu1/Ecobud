import React, { forwardRef, useContext } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, TouchableOpacity as NativeTouchableOpacity, Pressable as NativePressable, Modal as NativeModal, StyleSheet, type TextProps, type TextInputProps, type TouchableOpacityProps, type PressableProps, type ModalProps } from 'react-native';
import { useAccessibility } from './AccessibilityContext';

const NestedText = React.createContext(false);
export const TextSizeMultiplierContext = React.createContext<number | null>(null);
export type TextInput = NativeTextInput;
function useTextStyle(style: TextProps['style'], nested = false) {
  const { preferences } = useAccessibility();
  const overrideMultiplier = useContext(TextSizeMultiplierContext);
  const flat = StyleSheet.flatten(style) || {};
  const multiplier = overrideMultiplier ?? { Small: 1, Medium: 1.15, Large: 1.35 }[preferences.size];
  return { ...(typeof flat.fontSize === 'number' ? { fontSize: flat.fontSize * multiplier } : nested ? {} : { fontSize: 14 * multiplier }), ...(typeof flat.lineHeight === 'number' ? { lineHeight: flat.lineHeight * multiplier } : {}), ...(preferences.bold ? { fontWeight: '700' as const } : {}) };
}
export const Text = forwardRef<NativeText, TextProps>((props, ref) => {
  const nested = useContext(NestedText);
  const accessibilityStyle = useTextStyle(props.style, nested);
  const { preferences } = useAccessibility();
  const overrideMultiplier = useContext(TextSizeMultiplierContext);
  const largeText = overrideMultiplier === null ? preferences.size === 'Large' : overrideMultiplier > 1;
  return <NestedText.Provider value={true}><NativeText {...props} ref={ref} allowFontScaling={props.allowFontScaling ?? true} numberOfLines={largeText && !nested ? undefined : props.numberOfLines} adjustsFontSizeToFit={largeText ? false : props.adjustsFontSizeToFit} style={[props.style, accessibilityStyle]} /></NestedText.Provider>;
});
export const TextInput = Object.assign(forwardRef<NativeTextInput, TextInputProps>((props, ref) => <NativeTextInput {...props} ref={ref} allowFontScaling={props.allowFontScaling ?? true} style={[props.style, useTextStyle(props.style)]} />), { State: NativeTextInput.State });
type AccessibleTouchableProps = TouchableOpacityProps & { preserveVisualSize?: boolean };
export const TouchableOpacity = forwardRef<React.ElementRef<typeof NativeTouchableOpacity>, AccessibleTouchableProps>(({ preserveVisualSize, ...props }, ref) => {
  const { preferences } = useAccessibility();
  const flat = StyleSheet.flatten(props.style) || {};
  const expandHitArea = preferences.largeTargets && preserveVisualSize;
  const horizontal = expandHitArea && typeof flat.width === 'number' ? Math.max(0, (48 - flat.width) / 2) : 0;
  const vertical = expandHitArea && typeof flat.height === 'number' ? Math.max(0, (48 - flat.height) / 2) : 0;
  const existing = typeof props.hitSlop === 'number' ? { top: props.hitSlop, bottom: props.hitSlop, left: props.hitSlop, right: props.hitSlop } : props.hitSlop;
  const hitSlop = expandHitArea ? { top: Math.max(existing?.top ?? 0, vertical), bottom: Math.max(existing?.bottom ?? 0, vertical), left: Math.max(existing?.left ?? 0, horizontal), right: Math.max(existing?.right ?? 0, horizontal) } : props.hitSlop;
  return <NativeTouchableOpacity {...props} ref={ref} hitSlop={hitSlop} style={[props.style, preferences.largeTargets && !preserveVisualSize && { minWidth: 48, minHeight: 48 }]} />;
});
export const Pressable = forwardRef<React.ElementRef<typeof NativePressable>, PressableProps>((props, ref) => {
  const { preferences } = useAccessibility();
  return <NativePressable {...props} ref={ref} style={state => [typeof props.style === 'function' ? props.style(state) : props.style, preferences.largeTargets && { minWidth: 48, minHeight: 48 }]} />;
});
export function Modal(props: ModalProps) {
  const { preferences } = useAccessibility();
  return <NativeModal {...props} animationType={preferences.performance ? 'none' : props.animationType} />;
}
