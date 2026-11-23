/**
 * Activating a waiting service worker and reloading onto it.
 *
 * vite-plugin-pwa's own `updateSW(true)` only posts SKIP_WAITING and then reloads from a
 * `controlling` event, and only when the page was controlled at load. That leaves the
 * button dead in ordinary situations: a page opened by a hard reload has no controller
 * and never gets the event; a worker another tab already activated is no longer waiting,
 * so nothing is posted at all. Here every path ends in a reload.
 *
 * Kept free of `virtual:pwa-register` so it can be tested with stand-ins.
 */

interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: "statechange", listener: () => void): void;
}

export interface UpdateEnvironment {
  /** `navigator.serviceWorker`, or undefined where the browser has none. */
  container?: {
    getRegistration(): Promise<{ waiting?: WorkerLike | null } | undefined>;
    addEventListener(type: "controllerchange", listener: () => void): void;
  };
  reload(): void;
  /** Leave out for an update nobody asked for (a hidden tab): without a person waiting
   *  for the click to do something there is no reason to reload onto the old version,
   *  and doing so would repeat with every load while the worker stays stuck. */
  setTimeout?(fn: () => void, ms: number): unknown;
}

/** How long to wait for the new worker before reloading anyway. */
export const UPDATE_RELOAD_FALLBACK_MS = 4000;

export async function activateUpdateAndReload(env: UpdateEnvironment): Promise<void> {
  let done = false;
  const reload = () => {
    if (done) return;
    done = true;
    env.reload();
  };
  if (!env.container) return reload();

  let waiting: WorkerLike | null | undefined;
  try {
    waiting = (await env.container.getRegistration())?.waiting;
  } catch {
    return reload();
  }
  // Nothing waiting: the new worker is already in charge (another tab activated it) or
  // gone. A plain reload is then all that is left to do, and all that is needed.
  if (!waiting) return reload();

  // A controlled page hears the takeover; an uncontrolled one (hard reload) only sees the
  // worker itself become active. Either is the moment to reload.
  env.container.addEventListener("controllerchange", reload);
  const worker = waiting;
  worker.addEventListener("statechange", () => {
    if (worker.state === "activated") reload();
  });
  worker.postMessage({ type: "SKIP_WAITING" });
  // A worker that never answers must not leave the button without effect.
  env.setTimeout?.(reload, UPDATE_RELOAD_FALLBACK_MS);
}
