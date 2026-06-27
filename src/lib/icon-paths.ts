export function resolveIconPaths(color: string | null, mode: string | null): Record<string, string> {
  const sizes = [16, 32, 48, 128];
  let suffix: string;
  if (mode === 'direct') suffix = 'direct';
  else if (!color || mode === 'system') suffix = 'inactive';
  else suffix = `active-${color}`;
  return Object.fromEntries(sizes.map(s => [`${s}`, `icons/icon-${suffix}-${s}.png`]));
}
