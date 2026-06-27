import { describe, it, expect } from 'vitest';
import { LOCATIONS, findLocationByKey, findLocationByCountry } from '../src/lib/locations';
import { COUNTRY_TO_LOCATION } from '../src/lib/country-locales';

describe('LOCATIONS', () => {
  it('has no duplicate keys', () => {
    const keys = LOCATIONS.map(l => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all entries have required fields', () => {
    for (const loc of LOCATIONS) {
      expect(loc.key).toBeTruthy();
      expect(loc.timezone).toMatch(/\//);
      expect(loc.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(loc.lat).toBeGreaterThanOrEqual(-90);
      expect(loc.lat).toBeLessThanOrEqual(90);
      expect(loc.lon).toBeGreaterThanOrEqual(-180);
      expect(loc.lon).toBeLessThanOrEqual(180);
    }
  });
});

describe('findLocationByKey', () => {
  it('finds tokyo', () => {
    const loc = findLocationByKey('tokyo');
    expect(loc?.name).toBe('Tokyo');
    expect(loc?.countryCode).toBe('JP');
  });

  it('returns undefined for unknown key', () => {
    expect(findLocationByKey('atlantis')).toBeUndefined();
  });
});

describe('findLocationByCountry', () => {
  it('finds location for RU', () => {
    const loc = findLocationByCountry('RU');
    expect(loc?.key).toBe('moscow');
  });

  it('is case-insensitive', () => {
    expect(findLocationByCountry('jp')?.key).toBe('tokyo');
  });
});

describe('COUNTRY_TO_LOCATION', () => {
  it('all values exist in LOCATIONS', () => {
    for (const [code, key] of Object.entries(COUNTRY_TO_LOCATION)) {
      expect(findLocationByKey(key), `${code} → ${key} not found`).toBeDefined();
    }
  });
});
