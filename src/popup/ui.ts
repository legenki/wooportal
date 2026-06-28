import { LOCATIONS, DEFAULT_LOCATION_KEYS } from '../lib/locations';
import type { Location } from '../lib/locations';
import type { BgState, SyncSuggestion } from '../types';

export function renderCityGrid(
  container: HTMLElement,
  filter: string,
  activeKey: string | undefined,
  onSelect: (loc: Location) => void,
): void {
  const q = filter.toLowerCase();
  let filtered: Location[];
  if (q) {
    filtered = LOCATIONS.filter(l =>
      l.name.toLowerCase().includes(q) || l.country.toLowerCase().includes(q)
    );
  } else {
    const defaults = DEFAULT_LOCATION_KEYS.map(k => LOCATIONS.find(l => l.key === k)!).filter(Boolean);
    // Also include active location if it's not in defaults
    const active = activeKey ? LOCATIONS.find(l => l.key === activeKey) : null;
    filtered = active && !DEFAULT_LOCATION_KEYS.includes(activeKey!)
      ? [...defaults, active]
      : defaults;
  }
  container.innerHTML = filtered.map(loc => `
    <button class="city-btn ${loc.key === activeKey ? 'active' : ''}" data-key="${loc.key}">
      <span class="city-flag">${loc.flag}</span>
      <span>
        <div class="city-name">${escHtml(loc.name)}</div>
        <div class="city-tz">${escHtml(loc.country)}</div>
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
  onActivate?: (id: string) => void,
  onDeactivate?: () => void,
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
    card.onclick = onDeactivate ? () => onDeactivate() : null;
  } else if (state.profiles && state.profiles.length > 0) {
    card.style.display = 'none';
    emptyEl.style.display = 'block';
    emptyEl.innerHTML = state.profiles.map(p => `
      <div class="proxy-card" data-id="${p.id}" style="cursor:pointer;margin-bottom:5px;">
        <div class="proxy-color" style="background:${p.color}"></div>
        <div class="proxy-info">
          <div class="proxy-name">${escHtml(p.name)}</div>
          <div class="proxy-meta">${escHtml(p.config.type.toUpperCase())} · ${escHtml(p.config.type === 'pac' ? truncate(p.config.pacUrl, 22) : `${p.config.host}:${p.config.port}`)}</div>
        </div>
        <span class="active-badge" style="background:var(--bg-3);color:var(--text-3);">Use</span>
      </div>`).join('') +
      `<div style="text-align:center;margin-top:4px;"><span class="section-link" id="addProxyBtn">+ Add profile</span></div>`;
    emptyEl.querySelectorAll<HTMLElement>('.proxy-card').forEach(el => {
      el.addEventListener('click', () => onActivate?.(el.dataset.id!));
    });
  } else {
    card.style.display = 'none';
    emptyEl.style.display = 'flex';
    emptyEl.innerHTML = 'No proxy configured <span class="section-link" id="addProxyBtn">+ Add</span>';
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
  state: BgState,
): void {
  const geoOn = state.enabled && state.geo.enabled;
  geoActivePill.style.display = geoOn ? 'inline-flex' : 'none';
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
