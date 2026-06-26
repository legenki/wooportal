# wooPortal Chrome Extension — Design Spec

**Date:** 2026-06-26  
**Status:** Approved  

---

## Overview

wooPortal is a unified Chrome extension that combines geolocation/timezone spoofing (from cloaq-main) and proxy management (from x-proxy-main) into a single modern product. The key differentiator is **bidirectional smart sync**: when a proxy is active, the extension suggests matching geolocation/timezone; when a location is set, it suggests matching the active proxy profile.

---

## Visual Design

- **Style:** Neutral and professional, inspired by GitHub and Anthropic promo pages — clean typography, subtle accents, no neon
- **Theme:** Auto light/dark via `prefers-color-scheme`. Light: `#ffffff` bg, `#0969da` accent. Dark: `#0d1117` bg, `#58a6ff` accent
- **Typography:** System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI"`)
- **Color tokens:** Matching GitHub Primer design tokens (--bg, --border, --text, --accent, --green, --amber)

---

## Architecture

### Tech Stack

- **Build:** Vite + TypeScript (based on x-proxy-main, which already has Vite + Playwright e2e tests)
- **Popup globe:** Canvas 2D + D3-geo (tree-shaken via Vite, ~20KB gzip) + Natural Earth land-110m TopoJSON
- **No React** — vanilla TypeScript with DOM API is sufficient for a single popup page

### File Structure

```
wooportal-extension/
├── manifest.json
├── src/
│   ├── background/
│   │   ├── index.ts          # Service worker entry point
│   │   ├── proxy.ts          # Proxy management (from x-proxy background.js)
│   │   ├── geolocation.ts    # Debugger API spoofing (from cloaq debugger.js)
│   │   └── sync.ts           # Bidirectional proxy ↔ geo sync logic
│   ├── popup/
│   │   ├── index.html
│   │   ├── index.ts          # Popup entry point
│   │   ├── globe.ts          # Canvas globe: D3-geo + fog + rotation animation
│   │   ├── suggestions.ts    # Smart sync suggestion banners
│   │   └── ui.ts             # DOM helpers, city grid, profile cards
│   ├── options/
│   │   ├── index.html
│   │   └── index.ts          # Proxy profile management (from x-proxy options.js)
│   ├── lib/
│   │   ├── storage.ts        # Unified storage schema v3
│   │   ├── locations.ts      # ~50 cities with timezone/locale/lat/lon
│   │   ├── country-locales.ts
│   │   ├── storage-migration.ts  # v1/v2 → v3 migration
│   │   └── icon-paths.ts
│   └── types.ts
├── public/icons/
└── vite.config.{popup,options,background}.ts
```

### Manifest Permissions

```json
{
  "permissions": ["proxy", "storage", "debugger", "webNavigation", "webRequest", "webRequestAuthProvider"],
  "host_permissions": ["<all_urls>"]
}
```

### Unified Storage Schema (v3)

```typescript
interface WooPortalData {
  version: 3;
  // From x-proxy:
  mode: 'direct' | 'system' | 'profile';
  profiles: ProxyProfile[];
  activeProfileId?: string;
  // From cloaq:
  geo: {
    enabled: boolean;
    timezone?: string;
    locale?: string;
    lat?: number;
    lon?: number;
    locationKey?: string;  // e.g. 'tokyo', 'moscow'
  };
  // New:
  syncEnabled: boolean;      // master toggle for auto-sync suggestions
  syncDismissed: string[];   // pairs like "moscow-RU" dismissed this session
}
```

---

## Globe Component (`src/popup/globe.ts`)

- **Renderer:** Canvas 2D, retina (2× DPR), 200px display / 400px internal
- **Data:** Natural Earth land-110m.json (~55KB, bundled as asset)
- **Projection:** `geoOrthographic` from d3-geo, rotates to centre on selected city longitude/latitude
- **Effects (layered, painted in order):**
  1. Ocean — radial gradient (lighter centre → darker edge)
  2. Graticule — 30° grid, low opacity
  3. Land — radial gradient fill + subtle border
  4. Fog — radial gradient from transparent centre → opaque edge (creates sphere depth)
  5. Atmosphere — glowing ring just outside sphere radius
  6. Specular highlight — top-left white ellipse at low opacity
  7. Location dot — pulsing dot with glow at projected city coordinates
- **Rotation:** Smooth interpolation to target `[−lon, −lat × 0.28, 0]` on city select, to be refined during implementation

---

## Smart Sync Logic (`src/background/sync.ts`)

### Direction 1: Proxy activated → suggest geo sync

1. User activates a proxy profile
2. `sync.ts` calls `ip-api.com` to detect the proxy's country (result cached 10 min in storage)
3. Compares detected country with current `geo.locationKey`
4. If mismatch → sends `{ type: 'SUGGEST_GEO_SYNC', payload: { countryCode, city, timezone, locale, lat, lon } }` to popup
5. Popup renders amber suggestion banner: "Прокси через [Country] обнаружен — синхронизировать геолокацию?"
6. User clicks "Синхронизировать" → geo updated; clicks "Не сейчас" → pair added to `syncDismissed` for session

### Direction 2: Geo location set → suggest proxy

1. User selects a city (e.g. Tokyo)
2. Check active proxy profiles list
3. If a profile exists whose IP resolves to the same country → suggest activating it
4. If no profiles exist → show "Добавьте прокси профиль" nudge
5. If profiles exist but none match → stay silent (no spam)

### Anti-spam rule

Once a user dismisses a suggestion for a given proxy+geo pair, that pair is stored in `syncDismissed` and not shown again in the same browser session.

---

## Popup UI Structure

```
┌─────────────────────────────┐
│ [●] wooPortal      [↺] [⚙] │  ← Header
├─────────────────────────────┤
│                             │
│      [Canvas Globe 200px]   │  ← Globe section
│                             │
│      Tokyo, Japan           │
│      35.69° N · 139.69° E  │
│  ● Геолокация активна  ja-JP│
├─────────────────────────────┤
│ 🔍 Поиск города...          │  ← City selector
│ [🇺🇸 New York] [🇷🇺 Moscow] │
│ [🇯🇵 Tokyo  ] [🇬🇧 London ] │
├─────────────────────────────┤
│ 💡 Прокси через Россию...   │  ← Smart sync banner (conditional)
│    [Синхронизировать] [Нет] │
├─────────────────────────────┤
│ ПРОКСИ ПРОФИЛЬ   Управление │  ← Active proxy card
│ ● Russia — Moscow  [Активен]│
├─────────────────────────────┤
│ [Direct] [System] [Off]  v1 │  ← Footer mode switcher
└─────────────────────────────┘
```

---

## Options Page

Reuses x-proxy-main options.js structure for proxy profile CRUD:
- Add/edit/delete proxy profiles (HTTP, HTTPS, SOCKS5, PAC)
- Per-profile color, name, auth credentials
- Per-domain routing rules (whitelist/blacklist)
- Import/export profiles as JSON

---

## Key Implementation Notes

- **Debugger API** for geo/timezone spoofing (same as cloaq) — more reliable than script injection, works across all frames and web workers. Known limitation: shows debugger notification bar in Chrome. Users can suppress with `--silent-debugger-extension-api` flag.
- **ip-api.com** for proxy country detection — already used in cloaq for "Match IP Address" mode. Rate limit: 45 req/min on free tier; caching prevents hitting limits.
- **Storage migration:** v1 (cloaq) + v2 (x-proxy) → v3 (unified). Migration runs once on install via `chrome.runtime.onInstalled`.
- **Icon states:** Inherit x-proxy's multi-color icon system (active/inactive/direct/error per profile color).
- **No monetization** in v1 — proxy suggestion is purely integration with user's own configured profiles.

---

## Out of Scope (v1)

- Proxy marketplace / paid proxy suggestions
- Mobile / Firefox support  
- Custom map click for lat/lon selection (manual input in options instead)
- Automatic proxy switching by URL rules (existing x-proxy feature, keep as-is)
