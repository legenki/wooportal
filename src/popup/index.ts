import { Globe } from './globe';
import { renderCityGrid, renderProxySection, renderSuggestionBanner, renderStatusPills } from './ui';
import type { BgMessage, BgState, SyncSuggestion } from '../types';
import { findLocationByKey } from '../lib/locations';
import type { Location } from '../lib/locations';

function sendMsg(msg: BgMessage, retries = 3): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const attempt = (n: number) => {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          if (n > 0) setTimeout(() => attempt(n - 1), 200);
          else reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    };
    attempt(retries);
  });
}

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

const globeCanvas    = $<HTMLCanvasElement>('#globeCanvas');
const locDot         = $<HTMLElement>('#locDot');
const masterToggle   = $<HTMLInputElement>('#masterToggle');
const locationName   = $<HTMLElement>('#locationName');
const locationCoords = $<HTMLElement>('#locationCoords');
const clockTime      = $<HTMLElement>('#clockTime');
const clockLocale    = $<HTMLElement>('#clockLocale');
const geoActivePill  = $<HTMLElement>('#geoActivePill');
const ipSyncBtn      = $<HTMLButtonElement>('#ipSyncBtn');
const citySearch     = $<HTMLInputElement>('#citySearch');
const cityGrid       = $<HTMLElement>('#cityGrid');
const suggestionBanner = $<HTMLElement>('#suggestionBanner');
const proxyCard      = $<HTMLElement>('#proxyCard');
const proxyName      = $<HTMLElement>('#proxyName');
const proxyMeta      = $<HTMLElement>('#proxyMeta');
const proxyBadge     = $<HTMLElement>('#proxyBadge');
const proxyColorDot  = $<HTMLElement>('#proxyColorDot');
const emptyProxy     = $<HTMLElement>('#emptyProxy');
const versionText    = $<HTMLElement>('#versionText');

let globe: Globe;
let currentState: BgState;
let activeSuggestion: SyncSuggestion | null = null;
let clockTimezone: string | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

function updateLocationDisplay(loc: Location): void {
  showLocation(loc.name, loc.lat, loc.lon, loc.locale, loc.timezone);
}

/** Render a location from any source (preset city or resolved IP). */
function showLocation(name: string, lat: number, lon: number, locale: string, timezone: string): void {
  locationName.textContent = name;
  const latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
  locationCoords.textContent = `${latStr} · ${lonStr}`;
  clockLocale.textContent = locale;
  startClock(timezone);
}

/** Live clock showing the current time in the selected location's timezone. */
function startClock(timezone: string): void {
  clockTimezone = timezone;
  if (clockTimer) clearInterval(clockTimer);
  tickClock();
  clockTimer = setInterval(tickClock, 1000);
}

function tickClock(): void {
  if (!clockTimezone) { clockTime.textContent = '—'; return; }
  try {
    clockTime.textContent = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: clockTimezone,
    }).format(new Date());
  } catch {
    clockTime.textContent = '—';
  }
}

function clearClock(): void {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  clockTimezone = null;
  clockTime.textContent = '—';
  clockLocale.textContent = '—';
}

function applyState(state: BgState | null | undefined): void {
  if (!state) return;
  currentState = state;
  activeSuggestion = state.suggestion;

  masterToggle.checked = state.enabled;
  document.body.classList.toggle('is-disabled', !state.enabled);

  const g = state.geo;
  const loc = g.locationKey ? findLocationByKey(g.locationKey) : null;
  if (loc) {
    globe.rotateTo(loc.lon, loc.lat);
    updateLocationDisplay(loc);
  } else if (g.lat !== undefined && g.lon !== undefined && g.cityName) {
    // Location resolved from IP (not a preset city)
    globe.rotateTo(g.lon, g.lat);
    showLocation(g.cityName, g.lat, g.lon, g.locale ?? '', g.timezone ?? 'UTC');
  } else {
    locationName.textContent = '—';
    locationCoords.textContent = '—';
    clearClock();
  }

  renderStatusPills(geoActivePill, state);
  renderCityGrid(cityGrid, citySearch.value, state.geo.locationKey, handleCitySelect);
  renderProxySection(proxyCard, proxyName, proxyMeta, proxyBadge, proxyColorDot, emptyProxy, state,
    handleActivateProfile, handleDeactivateProfile);
  wireAddProxyBtn();
  renderSuggestionBanner(suggestionBanner, activeSuggestion, handleAcceptSync, handleDismissSync);
}

async function refresh(): Promise<void> {
  const s = await sendMsg({ type: 'GET_STATE' }) as BgState;
  applyState(s);
}

async function handleMasterToggle(): Promise<void> {
  const enable = masterToggle.checked;
  document.body.classList.toggle('is-disabled', !enable);
  await sendMsg({ type: enable ? 'ENABLE_ALL' : 'DISABLE_ALL' });
  await refresh();
  if (enable) void checkSyncInBackground();
}

async function handleCitySelect(loc: Location): Promise<void> {
  globe.rotateTo(loc.lon, loc.lat);
  updateLocationDisplay(loc);
  renderCityGrid(cityGrid, citySearch.value, loc.key, handleCitySelect);
  await sendMsg({
    type: 'SET_GEO',
    payload: {
      enabled: true,
      timezone: loc.timezone,
      locale: loc.locale,
      lat: loc.lat,
      lon: loc.lon,
      locationKey: loc.key,
    },
  });
  // Selecting a city implies the extension should be ON.
  if (!masterToggle.checked) {
    masterToggle.checked = true;
    await sendMsg({ type: 'ENABLE_ALL' });
  }
  await refresh();
}

async function handleIpSync(): Promise<void> {
  const label = ipSyncBtn.querySelector<HTMLElement>('.ip-sync-label')!;
  const original = label.textContent;
  ipSyncBtn.disabled = true;
  ipSyncBtn.classList.add('is-loading');
  label.textContent = 'Detecting…';
  try {
    const r = await sendMsg({ type: 'SYNC_TO_IP' }) as { success: boolean; error?: string; cityName?: string };
    if (r?.success) {
      if (!masterToggle.checked) masterToggle.checked = true;
      await refresh();
    } else {
      label.textContent = r?.error ?? 'Failed';
      setTimeout(() => { label.textContent = original; }, 2000);
    }
  } catch {
    label.textContent = 'Network error';
    setTimeout(() => { label.textContent = original; }, 2000);
  } finally {
    ipSyncBtn.disabled = false;
    ipSyncBtn.classList.remove('is-loading');
    if (label.textContent === 'Detecting…') label.textContent = original;
  }
}

async function handleAcceptSync(): Promise<void> {
  if (!activeSuggestion) return;
  await sendMsg({ type: 'ACCEPT_SYNC_SUGGESTION', payload: activeSuggestion });
  const loc = findLocationByKey(activeSuggestion.locationKey);
  if (loc) { globe.rotateTo(loc.lon, loc.lat); updateLocationDisplay(loc); }
  activeSuggestion = null;
  renderSuggestionBanner(suggestionBanner, null, handleAcceptSync, handleDismissSync);
  await refresh();
}

async function handleDismissSync(): Promise<void> {
  if (!activeSuggestion) return;
  const pair = `${currentState.activeProfile?.id ?? 'unknown'}:${activeSuggestion.countryCode}`;
  await sendMsg({ type: 'DISMISS_SYNC_SUGGESTION', payload: { pair } });
  activeSuggestion = null;
  renderSuggestionBanner(suggestionBanner, null, handleAcceptSync, handleDismissSync);
}

async function handleActivateProfile(id: string): Promise<void> {
  await sendMsg({ type: 'ACTIVATE_PROFILE', payload: { id } });
  await refresh();
  void checkSyncInBackground();
}

async function handleDeactivateProfile(): Promise<void> {
  await sendMsg({ type: 'DEACTIVATE_PROFILE' });
  await refresh();
}

function wireAddProxyBtn(): void {
  const btn = document.getElementById('addProxyBtn');
  if (btn) btn.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

async function checkSyncInBackground(): Promise<void> {
  try {
    const r = await sendMsg({ type: 'CHECK_SYNC' }) as { suggestion: SyncSuggestion | null };
    if (r?.suggestion) {
      activeSuggestion = r.suggestion;
      renderSuggestionBanner(suggestionBanner, activeSuggestion, handleAcceptSync, handleDismissSync);
    }
  } catch {
    // Sync check failed (network) — non-critical, ignore
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  versionText.textContent = `v${chrome.runtime.getManifest().version}`;

  globe = new Globe(globeCanvas, 200);

  globe.onDotPosition = (x, y) => {
    locDot.style.left = `${x}px`;
    locDot.style.top = `${y}px`;
  };

  await globe.loadData(chrome.runtime.getURL('land-110m.json'));

  await refresh();
  if (currentState?.enabled) void checkSyncInBackground();

  masterToggle.addEventListener('change', handleMasterToggle);
  ipSyncBtn.addEventListener('click', handleIpSync);

  citySearch.addEventListener('input', () => {
    renderCityGrid(cityGrid, citySearch.value, currentState.geo.locationKey, handleCitySelect);
  });

  $<HTMLElement>('#settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $<HTMLElement>('#manageProxyBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => globe.draw());

  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) await refresh();
  });
});
