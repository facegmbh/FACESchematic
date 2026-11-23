import { describe, it, expect, vi } from "vitest";
import { activateUpdateAndReload, UPDATE_RELOAD_FALLBACK_MS, type UpdateEnvironment } from "../swUpdate";

function worker() {
  const listeners: (() => void)[] = [];
  return {
    state: "installed",
    messages: [] as unknown[],
    postMessage(m: unknown) { this.messages.push(m); },
    addEventListener(_type: "statechange", l: () => void) { listeners.push(l); },
    become(state: string) { this.state = state; listeners.forEach((l) => l()); },
  };
}

function environment(waiting: ReturnType<typeof worker> | null) {
  const controllerListeners: (() => void)[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const reload = vi.fn();
  const env: UpdateEnvironment = {
    container: {
      getRegistration: async () => ({ waiting }),
      addEventListener: (_type, l) => { controllerListeners.push(l); },
    },
    reload,
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
  };
  return { env, reload, timers, takeOver: () => controllerListeners.forEach((l) => l()) };
}

describe("the reload-now button", () => {
  it("tells the waiting worker to take over and reloads when it has", async () => {
    const sw = worker();
    const { env, reload, takeOver } = environment(sw);
    await activateUpdateAndReload(env);
    expect(sw.messages).toEqual([{ type: "SKIP_WAITING" }]);
    expect(reload).not.toHaveBeenCalled();
    takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads a page without a controller once the worker is active", async () => {
    // After a hard reload the page is uncontrolled and never hears a takeover.
    const sw = worker();
    const { env, reload } = environment(sw);
    await activateUpdateAndReload(env);
    sw.become("activating");
    expect(reload).not.toHaveBeenCalled();
    sw.become("activated");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("just reloads when nothing is waiting any more", async () => {
    // Another tab already activated the new worker.
    const { env, reload } = environment(null);
    await activateUpdateAndReload(env);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads anyway when the worker never answers", async () => {
    const sw = worker();
    const { env, reload, timers } = environment(sw);
    await activateUpdateAndReload(env);
    expect(timers.map((t) => t.ms)).toEqual([UPDATE_RELOAD_FALLBACK_MS]);
    timers[0].fn();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("a hidden tab's silent update waits for the worker and never reloads onto the old version", async () => {
    const sw = worker();
    const { env, reload } = environment(sw);
    await activateUpdateAndReload({ ...env, setTimeout: undefined });
    expect(sw.messages).toEqual([{ type: "SKIP_WAITING" }]);
    expect(reload).not.toHaveBeenCalled();
    sw.become("activated");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads once, however many signals arrive", async () => {
    const sw = worker();
    const { env, reload, timers, takeOver } = environment(sw);
    await activateUpdateAndReload(env);
    takeOver();
    sw.become("activated");
    timers[0].fn();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads where there is no service worker at all, or asking for it fails", async () => {
    const plain = vi.fn();
    await activateUpdateAndReload({ reload: plain, setTimeout: () => 0 });
    expect(plain).toHaveBeenCalledTimes(1);

    const failing = vi.fn();
    await activateUpdateAndReload({
      container: { getRegistration: async () => { throw new Error("blocked"); }, addEventListener: () => {} },
      reload: failing,
      setTimeout: () => 0,
    });
    expect(failing).toHaveBeenCalledTimes(1);
  });
});
