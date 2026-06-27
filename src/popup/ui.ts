import { LOCATIONS } from '../lib/locations';
import type { Location } from '../lib/locations';
import type { BgState, SyncSuggestion } from '../types';

export function renderCityGrid(
  container: HTMLElement,
  filter: string,
  activeKey: string | undefined,
  onSelect: (loc: Location) => void,
): void {
  const q = filter.toLowerCase();
  const filtered = q ? LOCATIONS.filter(l => l.name.toLowerCase().includes(q)) : LOCATIONS;
  container.innerHTML = filtered.map(loc => `
    <button class="city-btn ${loc.key === activeKey ? 'active' : ''}" data-key="${loc.key}">
      <span class="city-flag">${loc.flag}</span>
      <span>
        <div class="city-name">${escHtml(loc.name)}</div>
        <div class="city-tz">${escHtml(loc.timezone.split('/')[1]?.replace('_', ' ') ?? loc.timezone)}</div>
      </span>
    </button>`).join('');
  container.querySelectorAll<HTMLButtonElement>('.city-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const loc = LOCATIONS.find(l => l.key === btn.dataset.key);
      if (loc) onSelect(loc);
    });
  });
}

export function renderProxySection(
  card: HTMLElement,
  nameEl: HTMLElement,
  metaEl: HTMLElement,
  badgeEl: HTMLElement,
  colorDot: HTMLElement,
  emptyEl: HTMLElement,
  state: BgState,
): void {
  if (state.mode === 'profile' && state.activeProfile) {
    const p = state.activeProfile;
    colorDot.style.background = p.color;
    nameEl.textContent = p.name;
    const cfg = p.config;
    metaEl.textContent = cfg.type === 'pac'
      ? `PAC · ${truncate(cfg.pacUrl, 28)}`
      : `${cfg.type.toUpperCase()} · ${cfg.host}:${cfg.port}`;
    badgeEl.textContent = 'Active';
    card.style.display = 'flex';
    emptyEl.style.display = 'none';
  } else {
    card.style.display = 'none';
    emptyEl.style.display = 'flex';
  }
}

export function renderSuggestionBanner(
  container: HTMLElement,
  suggestion: SyncSuggestion | null,
  onAccept: () => void,
  onDismiss: () => void,
): void {
  if (!suggestion) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  const title = container.querySelector<HTMLElement>('.suggestion-title')!;
  const text = container.querySelector<HTMLElement>('.suggestion-text')!;
  const acceptBtn = container.querySelector<HTMLButtonElement>('.btn-accept')!;
  const dismissBtn = container.querySelector<HTMLButtonElement>('.btn-dismiss')!;
  title.textContent = `Proxy via ${suggestion.city} detected`;
  text.textContent = `Sync geolocation, timezone and locale to match ${suggestion.city}?`;
  acceptBtn.onclick = onAccept;
  dismissBtn.onclick = onDismiss;
}

export function renderStatusPills(
  geoActivePill: HTMLElement,
  localePill: HTMLElement,
  state: BgState,
): void {
  const geoOn = state.geo.enabled;
  geoActivePill.style.display = geoOn ? 'inline-flex' : 'none';
  if (geoOn && state.geo.locale) {
    localePill.textContent = state.geo.locale;
    localePill.style.display = 'inline-flex';
  } else {
    localePill.style.display = 'none';
  }
}

export function renderModeButtons(
  buttons: NodeListOf<HTMLButtonElement>,
  mode: BgState['mode'],
): void {
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
