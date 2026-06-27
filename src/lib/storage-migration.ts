import type { WooPortalData, GeoSettings } from '../types';

export const SCHEMA_VERSION = 3 as const;

const DEFAULT_GEO: GeoSettings = { enabled: false };

const DEFAULT_DATA: WooPortalData = {
  version: 3,
  mode: 'system',
  profiles: [],
  activeProfileId: undefined,
  geo: DEFAULT_GEO,
  syncEnabled: true,
  syncDismissed: [],
  settings: { notifyChange: true, notifyError: true },
};

function isCloaqV1(raw: Record<string, unknown>): boolean {
  // cloaq stored: timezone, lat, lon, configuration at top level (no version field)
  return !raw.version && (raw.timezone !== undefined || raw.lat !== undefined);
}

function isXProxyV2(raw: Record<string, unknown>): boolean {
  return raw.version === 2 && Array.isArray(raw.profiles);
}

export function migrateData(raw: unknown): WooPortalData {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DATA };

  const data = raw as Record<string, unknown>;

  // Already v3
  if (data.version === SCHEMA_VERSION) {
    const profiles = Array.isArray(data.profiles) ? data.profiles : [];
    const activeIdValid = data.activeProfileId &&
      profiles.some((p: unknown) => (p as Record<string, unknown>)?.id === data.activeProfileId);
    const rawMode = data.mode as string;
    const mode: WooPortalData['mode'] = (['direct', 'system', 'profile'] as const).includes(rawMode as WooPortalData['mode'])
      ? (rawMode === 'profile' && !activeIdValid ? 'system' : rawMode as WooPortalData['mode'])
      : 'system';
    return {
      ...DEFAULT_DATA,
      ...(data as Partial<WooPortalData>),
      version: 3,
      mode,
      profiles: profiles as WooPortalData['profiles'],
      activeProfileId: mode === 'profile' ? data.activeProfileId as string : undefined,
    };
  }

  // Migrate from cloaq v1
  if (isCloaqV1(data)) {
    const geo: GeoSettings = {
      enabled: !!(data.timezone || data.lat),
      timezone: data.timezone as string | undefined,
      locale: data.locale as string | undefined,
      lat: data.lat as number | undefined,
      lon: data.lon as number | undefined,
      locationKey: data.configuration !== 'browserDefault' && data.configuration !== 'custom'
        ? data.configuration as string
        : undefined,
    };
    return { ...DEFAULT_DATA, geo };
  }

  // Migrate from x-proxy v2
  if (isXProxyV2(data)) {
    const profiles = Array.isArray(data.profiles) ? data.profiles : [];
    const activeIdValid = data.activeProfileId &&
      profiles.some((p: unknown) => (p as Record<string, unknown>)?.id === data.activeProfileId);
    const mode: WooPortalData['mode'] = activeIdValid ? 'profile' : 'system';
    return {
      ...DEFAULT_DATA,
      profiles: profiles as WooPortalData['profiles'],
      mode,
      activeProfileId: mode === 'profile' ? data.activeProfileId as string : undefined,
    };
  }

  return { ...DEFAULT_DATA };
}
