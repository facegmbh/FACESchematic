const NAV_EVENT = "docs:navigate";

/**
 * Where the docs are served from: "/" on their own host, "/handbuch/" when they ride along
 * with the app (FACE image — DOCS_BASE in docs/vite.config.ts). Always ends in a slash.
 */
export const BASE = import.meta.env.BASE_URL;

/** A site-absolute path ("/racks", "/favicon.svg") as it is served under BASE. */
export function withBase(path: string): string {
  return BASE + path.replace(/^\//, "");
}

export function navigateTo(path: string) {
  window.history.pushState({}, "", withBase(path));
  window.dispatchEvent(new CustomEvent(NAV_EVENT));
}

export function getPath() {
  const { pathname } = window.location;
  // "/handbuch" without the slash is still the docs' front page.
  const inBase = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, "");
  return pathname + "/" === BASE ? "" : inBase.replace(/\/$/, "");
}

export function onNavigate(callback: () => void): () => void {
  // Listen for both our custom event (link clicks) and popstate (back/forward)
  window.addEventListener(NAV_EVENT, callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener(NAV_EVENT, callback);
    window.removeEventListener("popstate", callback);
  };
}
