import { Globe } from './globe';
import { renderCityGrid, renderProxySection, renderSuggestionBanner, renderStatusPills, renderModeButtons } from './ui';
import type { BgMessage, BgState, SyncSuggestion } from '../types';
import { findLocationByKey } from '../lib/locations';
import type { Location } from '../lib/locations';

function sendMsg(msg: BgMessage): Promise<unknown> {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

const globeCanvas    = $<HTMLCanvasElement>('#globeCanvas');
const locDot         = $<HTMLElement>('#locDot');
const locationName   = $<HTMLElement>('#locationName');
const locationCoords = $<HTMLElement>('#locationCoords');
const geoActivePill  = $<HTMLElement>('#geoActivePill');
const localePill     = $<HTMLElement>('#localePill');
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
const modeButtons    = document.querySelectorAll<HTMLButtonElement>('.mode-btn');

let globe: Globe;
let currentState: BgState;
let activeSuggestion: SyncSuggestion | null = null;

function updateLocationDisplay(loc: Location): void {
  locationName.textContent = loc.name;
  const latStr = `${Math.abs(loc.lat).toFixed(2)}° ${loc.lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(loc.lon).toFixed(2)}° ${loc.lon >= 0 ? 'E' : 'W'}`;
  const tzShort = loc.timezone.split('/').pop()?.replace(/_/g, ' ') ?? '';
  locationCoords.textContent = `${latStr} · ${lonStr} · ${tzShort}`;
}

function applyState(state: BgState): void {
  currentState = state;
  activeSuggestion = state.suggestion;

  const loc = state.geo.locationKey ? findLocationByKey(state.geo.locationKey) : null;
  if (loc) {
    globe.rotateTo(loc.lon, loc.lat);
    updateLocationDisplay(loc);
  } else {
    locationName.textContent = '—';
    locationCoords.textContent = '—';
  }

  renderStatusPills(geoActivePill, localePill, state);
  renderCityGrid(cityGrid, citySearch.value, state.geo.locationKey, handleCitySelect);
  renderProxySection(proxyCard, proxyName, proxyMeta, proxyBadge, proxyColorDot, emptyProxy, state);
  renderSuggestionBanner(suggestionBanner, activeSuggestion, handleAcceptSync, handleDismissSync);
  renderModeButtons(modeButtons, state.mode);
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
}

async function handleAcceptSync(): Promise<void> {
  if (!activeSuggestion) return;
  await sendMsg({ type: 'ACCEPT_SYNC_SUGGESTION', payload: activeSuggestion });
  const loc = findLocationByKey(activeSuggestion.locationKey);
  if (loc) { globe.rotateTo(loc.lon, loc.lat); updateLocationDisplay(loc); }
  activeSuggestion = null;
  renderSuggestionBanner(suggestionBanner, null, handleAcceptSync, handleDismissSync);
  const state = await sendMsg({ type: 'GET_STATE' }) as BgState;
  applyState(state);
}

async function handleDismissSync(): Promise<void> {
  if (!activeSuggestion) return;
  const pair = `${currentState.activeProfile?.id ?? 'unknown'}:${activeSuggestion.countryCode}`;
  await sendMsg({ type: 'DISMISS_SYNC_SUGGESTION', payload: { pair } });
  activeSuggestion = null;
  renderSuggestionBanner(suggestionBanner, null, handleAcceptSync, handleDismissSync);
}

document.addEventListener('DOMContentLoaded', async () => {
  versionText.textContent = `v${chrome.runtime.getManifest().version}`;

  globe = new Globe(globeCanvas, 200);

  globe.onDotPosition = (x, y) => {
    locDot.style.left = `${x}px`;
    locDot.style.top = `${y}px`;
  };

  await globe.loadData(chrome.runtime.getURL('land-110m.json'));

  const state = await sendMsg({ type: 'GET_STATE' }) as BgState;
  applyState(state);

  citySearch.addEventListener('input', () => {
    renderCityGrid(cityGrid, citySearch.value, currentState.geo.locationKey, handleCitySelect);
  });

  modeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      if (mode === 'direct') await sendMsg({ type: 'SET_DIRECT_MODE' });
      else if (mode === 'system') await sendMsg({ type: 'DEACTIVATE_PROFILE' });
      else if (mode === 'off') await sendMsg({ type: 'CLEAR_GEO' });
      const s = await sendMsg({ type: 'GET_STATE' }) as BgState;
      applyState(s);
    });
  });

  $<HTMLButtonElement>('#reloadBtn').addEventListener('click', () => chrome.tabs.reload());
  $<HTMLButtonElement>('#settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $<HTMLElement>('#manageProxyBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $<HTMLElement>('#addProxyBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => globe.draw());

  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      const s = await sendMsg({ type: 'GET_STATE' }) as BgState;
      applyState(s);
    }
  });
});
