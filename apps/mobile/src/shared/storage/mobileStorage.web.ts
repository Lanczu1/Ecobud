import AsyncStorage from '@react-native-async-storage/async-storage';

export const mobileStorage = {
  getItem(key: string) {
    return AsyncStorage.getItem(key);
  },

  setItem(key: string, value: string) {
    return AsyncStorage.setItem(key, value);
  },

  getItemSync(key: string): string | null {
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
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore
    }
  },

  removeItem(key: string) {
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
