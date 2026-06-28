import type { SyncSuggestion, IpLocation } from '../types';
import { COUNTRY_TO_LOCATION } from '../lib/country-locales';
import { findLocationByKey } from '../lib/locations';
import { localeForCountry } from '../lib/country-locales';

// ipwho.is: free, HTTPS, no API key. (ip-api.com only allows HTTPS on paid
// plans and returns 403 otherwise.)
const IP_API_BASE = 'https://ipwho.is/';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Raw ipwho.is response (subset we use). */
interface IpWhoResponse {
  success?: boolean;
  message?: string;
  ip?: string;
  country?: string;
  country_code?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: { id?: string };
}

/** Provider-agnostic, normalized IP info used by the rest of this module. */
interface IpInfo {
  ip?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
}

function normalize(raw: IpWhoResponse): IpInfo | null {
  if (!raw.success) return null;
  return {
    ip: raw.ip,
    country: raw.country,
    countryCode: raw.country_code,
    city: raw.city,
    lat: raw.latitude,
    lon: raw.longitude,
    timezone: raw.timezone?.id,
  };
}

interface IpApiCache {
  data: IpInfo;
  fetchedAt: number;
}

let ipCache: IpApiCache | null = null;

async function fetchIpApi(): Promise<IpInfo | null> {
  if (ipCache && Date.now() - ipCache.fetchedAt < CACHE_TTL_MS) {
    return ipCache.data;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Cache-buster + no-store so neither Chrome's HTTP cache nor a CDN serves a
    // stale answer captured before the proxy was active.
    const url = `${IP_API_BASE}?_=${Date.now()}`;
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    const info = normalize(await res.json() as IpWhoResponse);
    console.log('[wooPortal] ipwho (sw) resolved IP:', info?.ip, '| country:', info?.countryCode, '| city:', info?.city);
    if (info) {
      ipCache = { data: info, fetchedAt: Date.now() };
      return info;
    }
  } catch (e) {
    console.error('[wooPortal] ipwho fetch failed:', e);
  }
  return null;
}

/**
 * Fetch from inside the active tab's page context. The tab's network traffic is
 * routed through the extension's proxy (and its auth), so this sees the proxy's
 * IP — unlike a fetch from the service worker, which bypasses it.
 * Returns null if there's no scriptable tab (e.g. chrome:// page).
 */
async function fetchIpApiViaTab(): Promise<IpInfo | null> {
  let tab: chrome.tabs.Tab | undefined;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    return null;
  }
  if (!tab?.id || !tab.url || /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
    return null;
  }
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: async (apiUrl: string) => {
        try {
          const r = await fetch(apiUrl, { cache: 'no-store' });
          return await r.json();
        } catch {
          return null;
        }
      },
      args: [`${IP_API_BASE}?_=${Date.now()}`],
    });
    const info = injection?.result ? normalize(injection.result as IpWhoResponse) : null;
    if (info) {
      console.log('[wooPortal] ipwho (via tab) resolved IP:', info.ip, '| country:', info.countryCode, '| city:', info.city);
      ipCache = { data: info, fetchedAt: Date.now() };
      return info;
    }
  } catch (e) {
    console.error('[wooPortal] ipwho via tab failed:', e);
  }
  return null;
}

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
  const data = await fetchIpApi();
  return data?.countryCode ?? null;
}

/** Full geolocation of the current outgoing IP (proxy IP if proxy is active). */
export async function detectIpLocation(): Promise<IpLocation | null> {
  // Prefer the in-tab fetch (goes through the proxy); fall back to the
  // service-worker fetch if there's no scriptable tab available.
  const data = (await fetchIpApiViaTab()) ?? (await fetchIpApi());
  if (!data || data.lat === undefined || data.lon === undefined) return null;
  return {
    city: data.city || data.country || 'Unknown',
    country: data.country || '',
    countryCode: data.countryCode || '',
    lat: data.lat,
    lon: data.lon,
    timezone: data.timezone || 'UTC',
    locale: localeForCountry(data.countryCode || ''),
  };
}

export function clearIpCache(): void {
  ipCache = null;
}
