import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const SESSION_STORAGE_KEY = 'ecobud.mobile.session';

export const mobileStorage = {
  getItem(key: string) {
    if (key === SESSION_STORAGE_KEY) return SecureStore.getItemAsync(key);
    return AsyncStorage.getItem(key);
  },

  setItem(key: string, value: string) {
    if (key === SESSION_STORAGE_KEY) return SecureStore.setItemAsync(key, value);
    return AsyncStorage.setItem(key, value);
  },

  getItemSync(key: string): string | null {
    if (key === SESSION_STORAGE_KEY) return null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Ignore
    }
    return null;
  },

  setItemSync(key: string, value: string) {
    if (key === SESSION_STORAGE_KEY) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore
    }
  },

  removeItem(key: string) {
    if (key === SESSION_STORAGE_KEY) return SecureStore.deleteItemAsync(key);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
    return AsyncStorage.removeItem(key);
  },
};
