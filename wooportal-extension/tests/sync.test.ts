import { describe, it, expect } from 'vitest';
import { buildSyncPairKey, shouldSuggest, parseSyncSuggestion } from '../src/background/sync';

describe('buildSyncPairKey', () => {
  it('creates deterministic key from proxy id and country code', () => {
    expect(buildSyncPairKey('proxy-1', 'RU')).toBe('proxy-1:RU');
  });
});

describe('shouldSuggest', () => {
  it('returns true when proxy country differs from current geo location country', () => {
    expect(shouldSuggest('RU', 'newYork', ['proxy-1:JP'])).toBe(true);
  });

  it('returns false when proxy country matches current geo location', () => {
    // moscow has countryCode RU
    expect(shouldSuggest('RU', 'moscow', [])).toBe(false);
  });

  it('returns false when pair already dismissed', () => {
    expect(shouldSuggest('JP', 'newYork', ['proxy-1:JP'])).toBe(false);
  });

  it('returns false when no geo location is set', () => {
    expect(shouldSuggest('RU', undefined, [])).toBe(false);
  });
});

describe('parseSyncSuggestion', () => {
  it('returns null for unknown country code', () => {
    expect(parseSyncSuggestion('ZZ')).toBeNull();
  });

  it('returns SyncSuggestion for known country code', () => {
    const result = parseSyncSuggestion('JP');
    expect(result).not.toBeNull();
    expect(result?.locationKey).toBe('tokyo');
    expect(result?.countryCode).toBe('JP');
    expect(result?.timezone).toContain('Tokyo');
  });
});
