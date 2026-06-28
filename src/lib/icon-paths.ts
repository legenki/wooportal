// Known icon color variants shipped in public/icons (icon-active-<color>-<size>.png).
const ICON_COLORS = ['blue', 'gray', 'green', 'orange', 'purple', 'red', 'teal', 'yellow'];

/**
 * Resolve the toolbar icon paths for the current state.
 * - disabled (master OFF)  → grey "inactive" icon
 * - enabled, no proxy      → green "active" icon (geo is working)
 * - enabled, proxy active  → icon tinted with the profile's colour, falling
 *   back to green if the colour isn't one of the prebuilt variants.
 */
export function resolveIconPaths(enabled: boolean, proxyColor: string | null): Record<string, string> {
  const sizes = [16, 32, 48, 128];
  let suffix: string;
  if (!enabled) {
    suffix = 'inactive';
  } else if (proxyColor && ICON_COLORS.includes(proxyColor)) {
    suffix = `active-${proxyColor}`;
  } else {
    suffix = 'active-green';
  }
  return Object.fromEntries(sizes.map(s => [`${s}`, `icons/icon-${suffix}-${s}.png`]));
}
