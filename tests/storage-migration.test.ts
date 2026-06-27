import { describe, it, expect } from 'vitest';
import { migrateData, SCHEMA_VERSION } from '../src/lib/storage-migration';

describe('migrateData', () => {
  it('returns default v3 for null input', () => {
    const result = migrateData(null);
    expect(result.version).toBe(3);
    expect(result.mode).toBe('system');
    expect(result.profiles).toEqual([]);
    expect(result.geo.enabled).toBe(false);
    expect(result.syncEnabled).toBe(true);
    expect(result.syncDismissed).toEqual([]);
  });

  it('migrates cloaq v1 storage (has timezone, lat, lon keys)', () => {
    const cloaqData = {
      timezone: 'Europe/Moscow',
      locale: 'ru-RU',
      lat: 55.76,
      lon: 37.62,
      configuration: 'moscow',
    };
    const result = migrateData(cloaqData);
    expect(result.version).toBe(3);
    expect(result.geo.enabled).toBe(true);
    expect(result.geo.timezone).toBe('Europe/Moscow');
    expect(result.geo.locale).toBe('ru-RU');
    expect(result.geo.lat).toBe(55.76);
    expect(result.geo.lon).toBe(37.62);
    expect(result.geo.locationKey).toBe('moscow');
    expect(result.mode).toBe('system');
  });

  it('migrates x-proxy v2 storage (has x-proxy-data shape)', () => {
    const xproxyData = {
      version: 2,
      mode: 'profile',
      profiles: [{
        id: 'p1', name: 'Test', color: '#ff0000',
        config: { type: 'http', host: '1.2.3.4', port: 8080, auth: { username: '', password: '' }, pacUrl: '', bypassList: [], routingRules: { enabled: false, mode: 'whitelist', domains: [] } },
        description: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tags: [],
      }],
      activeProfileId: 'p1',
      settings: {},
    };
    const result = migrateData(xproxyData);
    expect(result.version).toBe(3);
    expect(result.mode).toBe('profile');
    expect(result.activeProfileId).toBe('p1');
    expect(result.profiles).toHaveLength(1);
    expect(result.geo.enabled).toBe(false);
  });

  it('passes through v3 data unchanged', () => {
    const v3 = {
      version: 3,
      mode: 'direct',
      profiles: [],
      geo: { enabled: true, timezone: 'Asia/Tokyo', locale: 'ja-JP', lat: 35.69, lon: 139.69, locationKey: 'tokyo' },
      syncEnabled: false,
      syncDismissed: ['JP-tokyo'],
      settings: { notifyChange: true, notifyError: true },
    };
    const result = migrateData(v3);
    expect(result.mode).toBe('direct');
    expect(result.geo.locationKey).toBe('tokyo');
    expect(result.syncEnabled).toBe(false);
  });

  it('resets mode to system when activeProfileId is stale in v3', () => {
    const stale = {
      version: 3,
      mode: 'profile',
      profiles: [],
      activeProfileId: 'ghost',
      geo: { enabled: false },
      syncEnabled: true,
      syncDismissed: [],
      settings: {},
    };
    const result = migrateData(stale);
    expect(result.mode).toBe('system');
    expect(result.activeProfileId).toBeUndefined();
  });
});
