/**
 * Version Check — auto-refresh stale PWA deployments.
 *
 * On each build, vite.config.ts writes dist/version.json with a unique hash.
 * This module polls that file and reloads the page when a new deploy is detected,
 * bypassing the aggressive service worker cache.
 */

declare const __BUILD_HASH__: string;

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
let timer: ReturnType<typeof setInterval> | null = null;

export function startVersionCheck() {
  if (timer) return;

  const currentHash = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : '';
  if (!currentHash) return; // dev mode — no hash injected

  timer = setInterval(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.hash && data.hash !== currentHash) {
        console.log(`[Version] New deploy detected (${currentHash} → ${data.hash}). Reloading...`);
        // Unregister service worker so next load gets fresh assets
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        window.location.reload();
      }
    } catch {
      // Network error or offline — skip silently
    }
  }, POLL_INTERVAL);
}

export function stopVersionCheck() {
  if (timer) { clearInterval(timer); timer = null; }
}
