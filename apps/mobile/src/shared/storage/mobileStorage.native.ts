import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';

const sqliteStorage = new SQLiteStorage('ecobud-mobile-storage');
const migratedKeys = new Set<string>();
const SECURE_STORAGE_KEYS = new Set(['ecobud.mobile.session']);

const isSecureKey = (key: string) => SECURE_STORAGE_KEYS.has(key);

const migrateLegacyKey = async (key: string) => {
  if (migratedKeys.has(key)) {
    return;
  }

  const sqliteValue = await sqliteStorage.getItemAsync(key);

  if (sqliteValue !== null) {
    migratedKeys.add(key);
    return;
  }

  const legacyValue = await AsyncStorage.getItem(key);

  if (legacyValue !== null) {
    await sqliteStorage.setItemAsync(key, legacyValue);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  }

  migratedKeys.add(key);
};

export const mobileStorage = {
  async getItem(key: string) {
    if (isSecureKey(key)) {
      try {
        const secureValue = await SecureStore.getItemAsync(key);
        if (secureValue !== null) return secureValue;
      } catch (err) {
        console.warn('[mobileStorage secure getItem error]:', err);
      }

      // Migrate older session data out of SQLite/AsyncStorage on first read.
      await migrateLegacyKey(key);
      const legacyValue = await sqliteStorage.getItemAsync(key).catch(() => null)
        ?? await AsyncStorage.getItem(key).catch(() => null);
      if (legacyValue !== null) {
        await SecureStore.setItemAsync(key, legacyValue);
        await sqliteStorage.removeItemAsync(key).catch(() => undefined);
        await AsyncStorage.removeItem(key).catch(() => undefined);
      }
      return legacyValue;
    }

    await migrateLegacyKey(key);
    try {
      const sqliteValue = await sqliteStorage.getItemAsync(key);
      if (sqliteValue !== null && sqliteValue !== undefined) {
        return sqliteValue;
      }
    } catch {
      // Fallback below
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string) {
    if (isSecureKey(key)) {
      await SecureStore.setItemAsync(key, value);
      await sqliteStorage.removeItemAsync(key).catch(() => undefined);
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return;
    }

    await migrateLegacyKey(key);
    try {
      await sqliteStorage.setItemAsync(key, value);
    } catch (err) {
      console.warn('[mobileStorage sqlite setItem error]:', err);
    }
    // Also mirror to AsyncStorage for maximum cross-run durability and recovery
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Ignore fallback mirror error
    }
  },

  getItemSync(key: string): string | null {
    if (isSecureKey(key)) return null;
    try {
      if (typeof (sqliteStorage as any).getItemSync === 'function') {
        return (sqliteStorage as any).getItemSync(key);
      }
    } catch {
      // Ignore
    }
    return null;
  },

  setItemSync(key: string, value: string) {
    if (isSecureKey(key)) return;
    try {
      if (typeof (sqliteStorage as any).setItemSync === 'function') {
        (sqliteStorage as any).setItemSync(key, value);
      }
    } catch (err) {
      console.warn('[mobileStorage sqlite setItemSync error]:', err);
    }
  },

  async removeItem(key: string) {
    if (isSecureKey(key)) {
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
      await sqliteStorage.removeItemAsync(key).catch(() => undefined);
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return;
    }

    await migrateLegacyKey(key);
    try {
      await sqliteStorage.removeItemAsync(key);
    } catch {
      // Ignore
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};
