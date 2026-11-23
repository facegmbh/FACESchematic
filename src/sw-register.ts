import { registerSW } from "virtual:pwa-register";
import { useSWStore } from "./swStore";
import { activateUpdateAndReload } from "./swUpdate";

const POLL_MS = 10 * 60_000;

export function initServiceWorkerUpdates(): void {
  if (typeof window === "undefined") return;

  registerSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { reg.update().catch(() => { /* offline / transient */ }); };
      setInterval(check, POLL_MS);
      // Tab returning from background should check immediately, not wait for
      // the next 10-min interval.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
    onNeedRefresh() {
      // Hidden tab → user can't see a pill anyway, just reload silently so
      // their next focus lands on fresh code. Visible tab → show the pill and
      // let the user decide; if they ignore it forever, that's fine, it sits
      // there until they reload manually or click it.
      if (document.visibilityState === "hidden") {
        triggerUpdate(false);
      } else {
        useSWStore.getState().setUpdateAvailable(true);
      }
    },
  });
}

/** The pill's button, and the silent update of a hidden tab. Does not go through the
 *  plugin's `updateSW(true)`, which leaves the button dead whenever its `controlling`
 *  event does not come — see swUpdate.ts. */
export function triggerUpdate(byUser = true): void {
  void activateUpdateAndReload({
    container: "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    reload: () => location.reload(),
    // Only a click gets the "reload anyway" fallback; see UpdateEnvironment.setTimeout.
    setTimeout: byUser ? (fn, ms) => window.setTimeout(fn, ms) : undefined,
  });
}

/** Nuclear option: unregister all SWs + clear the Cache API, then reload.
 *  Does NOT touch localStorage or IndexedDB — schematic data lives there. */
export async function forceFullReset(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    location.reload();
  }
}
