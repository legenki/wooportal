import type { GeoSettings } from '../types';

export async function attachGeoDebugger(tabId: number, geo: GeoSettings): Promise<void> {
  if (!geo.enabled) return;
  if (!geo.timezone && !geo.locale && geo.lat === undefined) return;

  await new Promise<void>((resolve) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) { resolve(); return; }

      const cmds: Promise<void>[] = [];

      if (geo.timezone) {
        cmds.push(new Promise(r => chrome.debugger.sendCommand(
          { tabId }, 'Emulation.setTimezoneOverride', { timezoneId: geo.timezone }, () => {
            if (chrome.runtime.lastError?.message?.includes('Timezone override is already in effect')) {
              chrome.debugger.detach({ tabId });
            }
            r();
          }
        )));
      }

      if (geo.lat !== undefined && geo.lon !== undefined) {
        cmds.push(new Promise(r => chrome.debugger.sendCommand(
          { tabId }, 'Emulation.setGeolocationOverride',
          { latitude: geo.lat, longitude: geo.lon, accuracy: 1 },
          () => r()
        )));
      }

      if (geo.locale) {
        cmds.push(new Promise(r => chrome.debugger.sendCommand(
          { tabId }, 'Emulation.setLocaleOverride', { locale: geo.locale }, () => r()
        )));
      }

      Promise.all(cmds).then(() => resolve());
    });
  });
}

export async function detachAllGeoDebuggers(): Promise<void> {
  const targets = await new Promise<chrome.debugger.TargetInfo[]>(r =>
    chrome.debugger.getTargets(r)
  );
  for (const target of targets) {
    if (target.attached && target.tabId) {
      await new Promise<void>(r => chrome.debugger.sendCommand(
        { tabId: target.tabId! },
        'Emulation.clearGeolocationOverride', {}, () => r()
      ));
      await new Promise<void>(r => chrome.debugger.detach({ tabId: target.tabId! }, () => r()));
    }
  }
}
