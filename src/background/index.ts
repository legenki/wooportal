import { readData, writeData, dismissSyncPair, updateGeo } from '../lib/storage';
import { activateProxy, deactivateProxy } from './proxy';
import { refreshIcon } from './icon';
import { attachGeoDebugger, detachAllGeoDebuggers } from './geolocation';
import { detectProxyCountry, detectIpLocation, shouldSuggest, parseSyncSuggestion, clearIpCache } from './sync';
import type { BgMessage, BgState, GeoSettings, SyncSuggestion } from '../types';

let keepAliveTimer: ReturnType<typeof setTimeout> | null = null;

function keepAlive(): void {
  if (keepAliveTimer) clearTimeout(keepAliveTimer);
  keepAliveTimer = setTimeout(() => { keepAliveTimer = null; }, 25_000);
}

async function getState(): Promise<BgState> {
  const data = await readData();
  const activeProfile = data.mode === 'profile' && data.activeProfileId
    ? (data.profiles.find(p => p.id === data.activeProfileId) ?? null)
    : null;

  // GET_STATE returns immediately — sync detection (network fetch) happens
  // separately via CHECK_SYNC so the popup never blocks on a slow request.
  return {
    enabled: data.enabled,
    mode: data.mode,
    profiles: data.profiles,
    activeProfile,
    geo: data.geo,
    suggestion: null,
  };
}

/** Resolve the current outgoing IP's location and apply it as the spoofed geo. */
async function syncToIp(): Promise<{ success: boolean; error?: string; cityName?: string }> {
  clearIpCache(); // always get a fresh reading on explicit user action
  const ip = await detectIpLocation();
  if (!ip) return { success: false, error: 'Could not determine IP location' };

  await updateGeo({
    enabled: true,
    timezone: ip.timezone,
    locale: ip.locale,
    lat: ip.lat,
    lon: ip.lon,
    locationKey: undefined,
    cityName: ip.city,
  });
  const after = await readData();
  await writeData({ ...after, enabled: true });
  await reapplyGeoToActiveTab();
  await refreshIcon();
  return { success: true, cityName: ip.city };
}

/** Master ON: apply geolocation for the chosen location and restore the proxy profile. */
async function enableAll(): Promise<{ success: boolean; error?: string }> {
  const data = await readData();
  // Turn geolocation on (keep whatever location was previously chosen).
  await updateGeo({ ...data.geo, enabled: true });
  await reapplyGeoToActiveTab();

  // Restore the proxy profile that was active before OFF, if any.
  const restoreId = data.activeProfileId ?? data.lastProfileId;
  const restoreValid = restoreId && data.profiles.some(p => p.id === restoreId);
  let result: { success: boolean; error?: string } = { success: true };
  if (restoreValid) {
    result = await activateProxy(restoreId!);
  }

  const after = await readData();
  await writeData({ ...after, enabled: true });
  await refreshIcon();
  return result;
}

/** Master OFF: detach geolocation and put the proxy back to system (dormant). */
async function disableAll(): Promise<{ success: boolean; error?: string }> {
  const data = await readData();
  await detachAllGeoDebuggers();
  await deactivateProxy();
  const after = await readData();
  await writeData({
    ...after,
    enabled: false,
    geo: { ...after.geo, enabled: false },
    lastProfileId: data.activeProfileId ?? data.lastProfileId,
  });
  await refreshIcon();
  return { success: true };
}

/** Re-apply geo overrides to the currently active tab so changes take effect without reload. */
async function reapplyGeoToActiveTab(): Promise<void> {
  const data = await readData();
  if (!data.geo.enabled) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await detachAllGeoDebuggers();
    await attachGeoDebugger(tab.id, data.geo);
  }
}

async function checkSync(): Promise<SyncSuggestion | null> {
  const data = await readData();
  const activeProfile = data.mode === 'profile' && data.activeProfileId
    ? (data.profiles.find(p => p.id === data.activeProfileId) ?? null)
    : null;
  if (!(data.mode === 'profile' && activeProfile && data.syncEnabled)) return null;

  const countryCode = await detectProxyCountry();
  if (countryCode && shouldSuggest(countryCode, data.geo.locationKey, data.syncDismissed)) {
    return parseSyncSuggestion(countryCode);
  }
  return null;
}

chrome.proxy.onProxyError.addListener((details) => {
  console.error('[wooPortal] PROXY ERROR:', details.error, '| fatal:', details.fatal, '| details:', details.details);
});

// Keep the toolbar icon in sync with any state change (e.g. profile colour
// edited on the options page).
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') void refreshIcon();
});

// Sync the icon whenever the service worker (re)starts.
void refreshIcon();

chrome.runtime.onInstalled.addListener(() => { void refreshIcon(); });
chrome.runtime.onStartup.addListener(() => { void refreshIcon(); });

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const data = await readData();
  if (data.geo.enabled) {
    const targets = await new Promise<chrome.debugger.TargetInfo[]>(r =>
      chrome.debugger.getTargets(r)
    );
    const already = targets.find(t => t.tabId === details.tabId && t.attached);
    if (!already) await attachGeoDebugger(details.tabId, data.geo);
  }
});

chrome.webRequest.onAuthRequired.addListener(
  (details, callback) => {
    if (!details.isProxy) { callback!({}); return; }
    readData().then(data => {
      if (data.mode === 'profile' && data.activeProfileId) {
        const profile = data.profiles.find(p => p.id === data.activeProfileId);
        const auth = profile?.config.auth;
        if (auth?.username) {
          callback!({ authCredentials: { username: auth.username, password: auth.password } });
          return;
        }
      }
      callback!({});
    });
  },
  { urls: ['<all_urls>'] },
  ['asyncBlocking'],
);

chrome.runtime.onMessage.addListener((msg: BgMessage, _sender, sendResponse) => {
  keepAlive();
  (async () => {
    try {
      switch (msg.type) {
        case 'GET_STATE':
          sendResponse(await getState());
          break;
        case 'CHECK_SYNC':
          sendResponse({ suggestion: await checkSync() });
          break;
        case 'SYNC_TO_IP':
          sendResponse(await syncToIp());
          break;
        case 'ACTIVATE_PROFILE': {
          clearIpCache();
          const r = await activateProxy(msg.payload.id);
          sendResponse(r);
          break;
        }
        case 'DEACTIVATE_PROFILE':
          sendResponse(await deactivateProxy());
          break;
        case 'ENABLE_ALL':
          sendResponse(await enableAll());
          break;
        case 'DISABLE_ALL':
          sendResponse(await disableAll());
          break;
        case 'SET_GEO': {
          await updateGeo(msg.payload);
          await reapplyGeoToActiveTab();
          sendResponse({ success: true });
          break;
        }
        case 'CLEAR_GEO': {
          await detachAllGeoDebuggers();
          await updateGeo({ enabled: false });
          sendResponse({ success: true });
          break;
        }
        case 'DISMISS_SYNC_SUGGESTION':
          await dismissSyncPair(msg.payload.pair);
          sendResponse({ success: true });
          break;
        case 'ACCEPT_SYNC_SUGGESTION': {
          const geo: GeoSettings = {
            enabled: true,
            timezone: msg.payload.timezone,
            locale: msg.payload.locale,
            lat: msg.payload.lat,
            lon: msg.payload.lon,
            locationKey: msg.payload.locationKey,
          };
          await detachAllGeoDebuggers();
          await updateGeo(geo);
          sendResponse({ success: true });
          break;
        }
        default:
          sendResponse({ success: true });
      }
    } catch (e) {
      console.error('[wooPortal] message handler error:', e);
      sendResponse({ success: false, error: (e as Error).message });
    }
  })();
  return true;
});
