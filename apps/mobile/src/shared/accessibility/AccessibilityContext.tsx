import React, { createContext, useContext, useEffect, useState } from 'react';
import { mobileStorage } from '../storage/mobileStorage';

export type AccessibilityPreferences = {
  size: 'Small' | 'Medium' | 'Large';
  performance: boolean;
  contrast: boolean;
  bold: boolean;
  largeTargets: boolean;
};
export const defaultPreferences: AccessibilityPreferences = { size: 'Medium', performance: false, contrast: false, bold: false, largeTargets: false };
const key = 'ecobud_accessibility';
let current = defaultPreferences;
const listeners = new Set<() => void>();
export const getAccessibilityPreferences = () => current;
export const subscribeAccessibility = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function decode(value: string | null): AccessibilityPreferences {
  try {
    const saved = JSON.parse(value || '{}');
    return { size: ['Small', 'Medium', 'Large'].includes(saved.size) ? saved.size : 'Medium', performance: saved.performance === true, contrast: saved.contrast === true, bold: saved.bold === true, largeTargets: saved.largeTargetsDefaultVersion === 1 && saved.largeTargets === true };
  } catch { return defaultPreferences; }
}
const Context = createContext({ preferences: defaultPreferences, storageError: false, update: (_patch: Partial<AccessibilityPreferences>) => {} });
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(() => {
    try { current = decode(mobileStorage.getItemSync(key)); } catch { current = defaultPreferences; }
    return current;
  });
  const [storageError, setStorageError] = useState(false);
  const edited = React.useRef(false);
  useEffect(() => {
    let mounted = true;
    void mobileStorage.getItem(key).then(saved => { if (mounted && !edited.current) setPreferences(decode(saved)); }).catch(() => setStorageError(true));
    return () => { mounted = false; };
  }, []);
  useEffect(() => { current = preferences; listeners.forEach(listener => listener()); }, [preferences]);
  const update = (patch: Partial<AccessibilityPreferences>) => {
    edited.current = true;
    const next = { ...current, ...patch };
    current = next;
    setPreferences(next);
    const serialized = JSON.stringify({ ...next, largeTargetsDefaultVersion: 1 });
    try { mobileStorage.setItemSync(key, serialized); } catch { setStorageError(true); }
    void mobileStorage.setItem(key, serialized).then(() => setStorageError(false)).catch(() => setStorageError(true));
  };
  return <Context.Provider value={{ preferences, update, storageError }}>{children}</Context.Provider>;
}
export const useAccessibility = () => useContext(Context);
