import { readData } from '../lib/storage';
import { resolveIconPaths } from '../lib/icon-paths';
import { nearestIconColor } from '../lib/icon-color';
import { findLocationByKey } from '../lib/locations';

/**
 * Sync the toolbar icon and badge to the current stored state:
 * - colour: grey when OFF, profile-tinted (or green) when ON
 * - badge: the location's country code when ON, empty when OFF
 */
export async function refreshIcon(): Promise<void> {
  const data = await readData();
  const enabled = data.enabled && data.geo.enabled;

  const activeProfile = data.mode === 'profile' && data.activeProfileId
    ? data.profiles.find(p => p.id === data.activeProfileId)
    : undefined;
  const proxyColor = enabled ? nearestIconColor(activeProfile?.color) : null;

  chrome.action.setIcon({ path: resolveIconPaths(enabled, proxyColor) }).catch(() => {});

  // Badge: country code of the current location (preset city or IP-resolved).
  let badge = '';
  if (enabled) {
    const loc = data.geo.locationKey ? findLocationByKey(data.geo.locationKey) : null;
    badge = loc?.countryCode ?? countryCodeFromGeo(data.geo.cityName, data.geo.locale);
  }
  chrome.action.setBadgeText({ text: badge }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: '#1a7f37' }).catch(() => {});
  chrome.action.setBadgeTextColor?.({ color: '#ffffff' }).catch(() => {});
}

/** Derive a 2-letter code for IP-resolved locations (no preset countryCode). */
function countryCodeFromGeo(cityName?: string, locale?: string): string {
  // locale like "es-AR" → "AR"
  const fromLocale = locale?.split('-')[1];
  if (fromLocale && fromLocale.length === 2) return fromLocale.toUpperCase();
  return cityName ? cityName.slice(0, 2).toUpperCase() : '';
}
