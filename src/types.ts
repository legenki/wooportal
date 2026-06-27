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
  locationKey?: string;
}

export interface WooPortalData {
  version: 3;
  mode: 'direct' | 'system' | 'profile';
  profiles: ProxyProfile[];
  activeProfileId?: string;
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

// Messages between popup/options and background
export type BgMessage =
  | { type: 'GET_STATE' }
  | { type: 'ACTIVATE_PROFILE'; payload: { id: string } }
  | { type: 'DEACTIVATE_PROFILE' }
  | { type: 'SET_DIRECT_MODE' }
  | { type: 'SET_GEO'; payload: GeoSettings }
  | { type: 'CLEAR_GEO' }
  | { type: 'DISMISS_SYNC_SUGGESTION'; payload: { pair: string } }
  | { type: 'ACCEPT_SYNC_SUGGESTION'; payload: SyncSuggestion };

export interface BgState {
  mode: ProxyMode;
  activeProfile: ProxyProfile | null;
  geo: GeoSettings;
  suggestion: SyncSuggestion | null;
}
