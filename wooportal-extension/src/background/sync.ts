import type { SyncSuggestion } from '../types';
import { COUNTRY_TO_LOCATION } from '../lib/country-locales';
import { findLocationByCountry, findLocationByKey } from '../lib/locations';

const IP_API_URL = 'http://ip-api.com/json?fields=status,countryCode,message';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface IpApiCache {
  countryCode: string;
  fetchedAt: number;
}

let ipCache: IpApiCache | null = null;

export function buildSyncPairKey(proxyId: string, countryCode: string): string {
  return `${proxyId}:${countryCode}`;
}

export function shouldSuggest(
  detectedCountry: string,
  currentLocationKey: string | undefined,
  dismissed: string[],
): boolean {
  if (!currentLocationKey) return false;

  // Find location matching detected country
  const suggestedKey = COUNTRY_TO_LOCATION[detectedCountry.toUpperCase()];
  if (!suggestedKey) return false;

  // Already on matching location
  const currentLoc = findLocationByKey(currentLocationKey);
  if (currentLoc?.countryCode.toUpperCase() === detectedCountry.toUpperCase()) return false;

  // Already dismissed this country this session
  const dismissedCountries = dismissed.map(d => d.split(':')[1]).filter(Boolean);
  if (dismissedCountries.includes(detectedCountry.toUpperCase())) return false;

  return true;
}

export function parseSyncSuggestion(countryCode: string): SyncSuggestion | null {
  const key = COUNTRY_TO_LOCATION[countryCode.toUpperCase()];
  if (!key) return null;
  const loc = findLocationByKey(key);
  if (!loc) return null;
  return {
    countryCode: countryCode.toUpperCase(),
    locationKey: loc.key,
    city: loc.name,
    timezone: loc.timezone,
    locale: loc.locale,
    lat: loc.lat,
    lon: loc.lon,
  };
}

export async function detectProxyCountry(): Promise<string | null> {
  if (ipCache && Date.now() - ipCache.fetchedAt < CACHE_TTL_MS) {
    return ipCache.countryCode;
  }
  try {
    const res = await fetch(IP_API_URL);
    const data = await res.json() as { status: string; countryCode?: string; message?: string };
    if (data.status === 'success' && data.countryCode) {
      ipCache = { countryCode: data.countryCode, fetchedAt: Date.now() };
      return data.countryCode;
    }
  } catch {
    // Network error — return null, don't crash
  }
  return null;
}

export function clearIpCache(): void {
  ipCache = null;
}
