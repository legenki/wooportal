import { readData, writeData, dismissSyncPair, updateGeo } from '../lib/storage';
import { activateProxy, deactivateProxy, setDirectMode, updateIcon } from './proxy';
import { attachGeoDebugger, detachAllGeoDebuggers } from './geolocation';
import { detectProxyCountry, shouldSuggest, parseSyncSuggestion, clearIpCache } from './sync';
import type { BgMessage, BgState, GeoSettings } from '../types';

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

  let suggestion = null;
  if (data.mode === 'profile' && activeProfile && data.syncEnabled) {
    const countryCode = await detectProxyCountry();
    if (countryCode && shouldSuggest(countryCode, data.geo.locationKey, data.syncDismissed)) {
      suggestion = parseSyncSuggestion(countryCode);
    }
  }

  return { mode: data.mode, activeProfile, geo: data.geo, suggestion };
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await readData();
  updateIcon(null, data.mode);
});

chrome.runtime.onStartup.addListener(async () => {
  const data = await readData();
  if (data.mode === 'profile' && data.activeProfileId) {
    const profile = data.profiles.find(p => p.id === data.activeProfileId);
    if (profile) updateIcon(profile.color, 'profile');
  } else {
    updateIcon(null, data.mode);
  }
});

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
        case 'ACTIVATE_PROFILE': {
          clearIpCache();
          const r = await activateProxy(msg.payload.id);
          sendResponse(r);
          break;
        }
        case 'DEACTIVATE_PROFILE':
          sendResponse(await deactivateProxy());
          break;
        case 'SET_DIRECT_MODE':
          sendResponse(await setDirectMode());
          break;
        case 'SET_GEO': {
          await detachAllGeoDebuggers();
          await updateGeo(msg.payload);
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
      sendResponse({ success: false, error: (e as Error).message });
    }
  })();
  return true;
});
