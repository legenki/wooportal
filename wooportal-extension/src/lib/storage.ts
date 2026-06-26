import type { WooPortalData, GeoSettings, ProxyProfile } from '../types';
import { migrateData, SCHEMA_VERSION } from './storage-migration';

const STORAGE_KEY = 'wooportal-data';

export async function readData(): Promise<WooPortalData> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return migrateData(result[STORAGE_KEY]);
}

export async function writeData(data: WooPortalData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...data, version: SCHEMA_VERSION } });
}

export async function updateGeo(geo: GeoSettings): Promise<void> {
  const data = await readData();
  await writeData({ ...data, geo });
}

export async function updateProfiles(profiles: ProxyProfile[]): Promise<void> {
  const data = await readData();
  await writeData({ ...data, profiles });
}

export async function dismissSyncPair(pair: string): Promise<void> {
  const data = await readData();
  const dismissed = [...new Set([...data.syncDismissed, pair])];
  await writeData({ ...data, syncDismissed: dismissed });
}
