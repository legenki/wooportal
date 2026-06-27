import type { ProxyProfile, WooPortalData } from '../types';
import { readData, writeData } from '../lib/storage';
import { resolveIconPaths } from '../lib/icon-paths';

function generatePAC(profile: ProxyProfile): string {
  const { type, host, port } = profile.config;
  const { domains, mode } = profile.config.routingRules;
  const proxyStr = type === 'socks5' ? `SOCKS5 ${host}:${port}` : `PROXY ${host}:${port}`;
  const list = JSON.stringify(domains);
  if ((mode ?? 'whitelist') === 'whitelist') {
    return `function FindProxyForURL(url,host){var w=${list};for(var i=0;i<w.length;i++){if(shExpMatch(host,w[i]))return "${proxyStr}";}return "DIRECT";}`;
  }
  return `function FindProxyForURL(url,host){var b=${list};for(var i=0;i<b.length;i++){if(shExpMatch(host,b[i]))return "DIRECT";}return "${proxyStr}";}`;
}

function toPacUrl(input: string): { url: string } | null {
  const t = input.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t) || /^file:\/\//i.test(t)) return { url: t };
  if (/^[a-zA-Z]:[\\\/]/.test(t)) return { url: 'file:///' + t.replace(/\\/g, '/') };
  if (t.startsWith('/')) return { url: 'file://' + t };
  return null;
}

export async function activateProxy(profileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await readData();
    const profile = data.profiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Profile not found');

    await chrome.proxy.settings.clear({ scope: 'regular' });
    await new Promise(r => setTimeout(r, 100));

    const type = profile.config.type;
    let config: chrome.proxy.ProxyConfig;

    if (type === 'pac') {
      const resolved = toPacUrl(profile.config.pacUrl);
      if (!resolved) throw new Error('Invalid PAC URL');
      config = { mode: 'pac_script', pacScript: { url: resolved.url } };
    } else {
      const { host, port, routingRules } = profile.config;
      if (!host || !port) throw new Error('Missing host or port');
      if (routingRules?.enabled && routingRules.domains.length > 0) {
        config = { mode: 'pac_script', pacScript: { data: generatePAC(profile) } };
      } else {
        config = { mode: 'fixed_servers', rules: { singleProxy: { scheme: type, host, port } } };
      }
    }

    await chrome.proxy.settings.set({ value: config, scope: 'regular' });
    const updated: WooPortalData = { ...data, mode: 'profile', activeProfileId: profileId };
    await writeData(updated);
    updateIcon(profile.color, 'profile');
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deactivateProxy(): Promise<{ success: boolean; error?: string }> {
  try {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    await chrome.proxy.settings.set({ value: { mode: 'system' }, scope: 'regular' });
    const data = await readData();
    await writeData({ ...data, mode: 'system', activeProfileId: undefined });
    updateIcon(null, 'system');
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function setDirectMode(): Promise<{ success: boolean; error?: string }> {
  try {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    await chrome.proxy.settings.set({ value: { mode: 'direct' }, scope: 'regular' });
    const data = await readData();
    await writeData({ ...data, mode: 'direct', activeProfileId: undefined });
    updateIcon(null, 'direct');
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function updateIcon(color: string | null, mode: string | null): void {
  chrome.action.setIcon({ path: resolveIconPaths(color, mode) }).catch(() => {});
}
