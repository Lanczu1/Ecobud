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
    return sqliteStorage.getItemAsync(key);
  },

  async setItem(key: string, value: string) {
    await migrateLegacyKey(key);
    await sqliteStorage.setItemAsync(key, value);
  },

  async removeItem(key: string) {
    await migrateLegacyKey(key);
    await sqliteStorage.removeItemAsync(key);
  },
};
