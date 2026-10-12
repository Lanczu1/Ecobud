import { useEffect, useState } from 'react';
import { ecobudApi } from '../api/ecobudApi';
import { mobileStorage } from '../storage/mobileStorage';
import { BARANGAYS } from './barangays';

const STORAGE_KEY = 'ecobud.mobile.barangays';

const parseList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim())
    ? value as string[]
    : null;

const readSaved = (): string[] | null => {
  try {
    return parseList(JSON.parse(mobileStorage.getItemSync(STORAGE_KEY) ?? 'null'));
  } catch {
    return null;
  }
};

// The API owns the barangay list. The last fetched copy is kept on the device, and
// the built-in list covers a first launch with no connection.
export function useBarangays(): readonly string[] {
  const [barangays, setBarangays] = useState<readonly string[]>(() => readSaved() ?? BARANGAYS);

  useEffect(() => {
    let disposed = false;
    void ecobudApi.fetchBarangays().then((response) => {
      const items = parseList(response?.items);
      if (!items) return;
      const serialized = JSON.stringify(items);
      try { mobileStorage.setItemSync(STORAGE_KEY, serialized); } catch {}
      void mobileStorage.setItem(STORAGE_KEY, serialized).catch(() => {});
      if (!disposed) setBarangays((current) => (JSON.stringify(current) === serialized ? current : items));
    }).catch(() => {});
    return () => { disposed = true; };
  }, []);

  return barangays;
}
