import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteStorage } from 'expo-sqlite/kv-store';

const sqliteStorage = new SQLiteStorage('ecobud-mobile-storage');
const migratedKeys = new Set<string>();

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

  async removeItem(key: string) {
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
