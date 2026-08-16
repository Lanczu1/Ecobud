declare module 'expo-camera' {
  export const CameraView: any;
  export function useCameraPermissions(): [any, () => Promise<any>];
}

declare module 'expo-sqlite' {
  export interface SQLiteDatabase {
    execAsync(sql: string): Promise<void>;
    runAsync(sql: string, ...params: any[]): Promise<any>;
    getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]>;
    getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null>;
  }
  export function openDatabaseAsync(name: string): Promise<SQLiteDatabase>;
}

declare module 'expo-sqlite/kv-store' {
  export class SQLiteStorage {
    constructor(name?: string);
    getItemAsync(key: string): Promise<string | null>;
    setItemAsync(key: string, value: string): Promise<void>;
    removeItemAsync(key: string): Promise<void>;
    clearAsync(): Promise<void>;
  }
}

declare module 'expo-image' {
  export const Image: any;
}
