import type { GeoSettings } from '../types';

/** Read and clear chrome.runtime.lastError so it doesn't surface as "Unchecked runtime.lastError". */
function consumeError(): string | undefined {
  return chrome.runtime.lastError?.message;
}

function isAttached(tabId: number): Promise<boolean> {
  return new Promise(resolve => {
    chrome.debugger.getTargets(targets => {
      consumeError();
      resolve(targets.some(t => t.tabId === tabId && t.attached));
    });
  });
}

function detach(tabId: number): Promise<void> {
  return new Promise(resolve => {
    chrome.debugger.detach({ tabId }, () => { consumeError(); resolve(); });
  });
}

function attach(tabId: number): Promise<boolean> {
  return new Promise(resolve => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      const err = consumeError();
      resolve(!err);
    });
  });
}

function sendCommand(tabId: number, method: string, params: object): Promise<boolean> {
  return new Promise(resolve => {
    chrome.debugger.sendCommand({ tabId }, method, params, () => {
      const err = consumeError();
      resolve(!err);
    });
  });
}

export async function attachGeoDebugger(tabId: number, geo: GeoSettings): Promise<void> {
  if (!geo.enabled) return;
  if (!geo.timezone && !geo.locale && geo.lat === undefined) return;

  // Always start from a clean slate: if a debugger is already attached to this
  // tab (e.g. from a previous navigation), detach it first. This prevents
  // "Another locale override is already in effect" and stale-session errors.
  if (await isAttached(tabId)) {
    await detach(tabId);
  }

  const ok = await attach(tabId);
  if (!ok) return; // can't attach (e.g. chrome:// page, devtools open) — skip silently

  // Send overrides sequentially. If any send fails the debugger may have
  // detached; bail out so we don't spam "Debugger is not attached" errors.
  if (geo.timezone) {
    if (!await sendCommand(tabId, 'Emulation.setTimezoneOverride', { timezoneId: geo.timezone })) return;
  }
  if (geo.lat !== undefined && geo.lon !== undefined) {
    if (!await sendCommand(tabId, 'Emulation.setGeolocationOverride', {
      latitude: geo.lat, longitude: geo.lon, accuracy: 1,
    })) return;
  }
  if (geo.locale) {
    if (!await sendCommand(tabId, 'Emulation.setLocaleOverride', { locale: geo.locale })) return;
  }
}

export async function detachAllGeoDebuggers(): Promise<void> {
  const targets = await new Promise<chrome.debugger.TargetInfo[]>(r =>
    chrome.debugger.getTargets(t => { consumeError(); r(t); })
  );
  for (const target of targets) {
    if (target.attached && target.tabId) {
      // Clear overrides best-effort, then detach. Ignore errors throughout.
      await sendCommand(target.tabId, 'Emulation.clearGeolocationOverride', {});
      await detach(target.tabId);
    }
  }
}
