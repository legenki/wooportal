export interface ProxyAuth {
  username: string;
  password: string;
}

export interface RoutingRules {
  enabled: boolean;
  mode: 'whitelist' | 'blacklist';
  domains: string[];
}

export interface ProxyConfig {
  type: 'http' | 'https' | 'socks5' | 'pac';
  host: string;
  port: number;
  auth: ProxyAuth;
  pacUrl: string;
  bypassList: string[];
  routingRules: RoutingRules;
}

export interface ProxyProfile {
  id: string;
  name: string;
  description: string;
  color: string;
  config: ProxyConfig;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface GeoSettings {
  enabled: boolean;
  timezone?: string;
  locale?: string;
  lat?: number;
  lon?: number;
  /** Key into LOCATIONS when a preset city is chosen. */
  locationKey?: string;
  /** Display name when the location isn't a preset (e.g. resolved from IP). */
  cityName?: string;
}

export interface WooPortalData {
  version: 3;
  /** Master switch: when false the whole extension is dormant (no geo, proxy=system). */
  enabled: boolean;
  mode: 'direct' | 'system' | 'profile';
  profiles: ProxyProfile[];
  activeProfileId?: string;
  /** Remembers the chosen profile while the extension is OFF, so ON can restore it. */
  lastProfileId?: string;
  geo: GeoSettings;
  syncEnabled: boolean;
  syncDismissed: string[];
  settings: {
    notifyChange: boolean;
    notifyError: boolean;
  };
}

export type ProxyMode = WooPortalData['mode'];

export interface SyncSuggestion {
  countryCode: string;
  locationKey: string;
  city: string;
  timezone: string;
  locale: string;
  lat: number;
  lon: number;
}

/** Full geolocation resolved from the current outgoing IP address. */
export interface IpLocation {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  timezone: string;
  locale: string;
}

// Messages between popup/options and background
export type BgMessage =
  | { type: 'GET_STATE' }
  | { type: 'CHECK_SYNC' }
  | { type: 'SYNC_TO_IP' }
  | { type: 'ENABLE_ALL' }
  | { type: 'DISABLE_ALL' }
  | { type: 'ACTIVATE_PROFILE'; payload: { id: string } }
  | { type: 'DEACTIVATE_PROFILE' }
  | { type: 'SET_GEO'; payload: GeoSettings }
  | { type: 'CLEAR_GEO' }
  | { type: 'DISMISS_SYNC_SUGGESTION'; payload: { pair: string } }
  | { type: 'ACCEPT_SYNC_SUGGESTION'; payload: SyncSuggestion };

export interface BgState {
  enabled: boolean;
  mode: ProxyMode;
  profiles: ProxyProfile[];
  activeProfile: ProxyProfile | null;
  geo: GeoSettings;
  suggestion: SyncSuggestion | null;
}
