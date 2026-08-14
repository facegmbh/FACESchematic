/**
 * Embedded viewer mode — used by Odoo to show the real drawing next to the
 * imported devices and cabling.
 *
 * The drawing never travels over the network for this. The Odoo page already has
 * the .schematic file (it is stored as an attachment on the installation), reads
 * it same-origin, and hands it to this frame with postMessage. So there is no
 * endpoint to secure, no token to leak, and no CORS to open on the Odoo side —
 * the data only moves between two frames in one browser.
 *
 * Protocol:
 *   child -> parent   { type: "face-schematic:ready" }        once mounted
 *   parent -> child   { type: "face-schematic:load", schematic: <file> }
 *   child -> parent   { type: "face-schematic:loaded" | "face-schematic:error" }
 */

/** Origins allowed to embed and to send a drawing. Build-time, not user input. */
const ALLOWED_ORIGINS: string[] = (
  (import.meta.env?.VITE_EMBED_ALLOWED_ORIGINS as string | undefined) ??
  "https://portal.face-gmbh.com"
)
  .split(",")
  .map((origin: string) => origin.trim())
  .filter(Boolean);

export const READY = "face-schematic:ready";
export const LOAD = "face-schematic:load";
export const LOADED = "face-schematic:loaded";
export const ERROR = "face-schematic:error";

/** True when the app runs as an embedded viewer (?embed=1). */
export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

function post(message: unknown): void {
  // Answer only the frame that embedded us, and only to an allowed origin.
  for (const origin of ALLOWED_ORIGINS) {
    window.parent?.postMessage(message, origin);
  }
}

/**
 * Listen for a drawing from the embedding page. Returns a cleanup function.
 * `onSchematic` receives the parsed file exactly as importFromJSON expects it.
 */
export function listenForEmbeddedSchematic(
  onSchematic: (data: unknown) => void,
): () => void {
  const handler = (event: MessageEvent) => {
    // Origin check first: everything below trusts the payload's shape only.
    if (!ALLOWED_ORIGINS.includes(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    const { type, schematic } = data as { type?: string; schematic?: unknown };
    if (type !== LOAD) return;
    if (!schematic || typeof schematic !== "object") {
      post({ type: ERROR, reason: "no schematic in message" });
      return;
    }
    try {
      onSchematic(schematic);
      post({ type: LOADED });
    } catch (err) {
      post({ type: ERROR, reason: err instanceof Error ? err.message : "import failed" });
    }
  };

  window.addEventListener("message", handler);
  post({ type: READY });
  return () => window.removeEventListener("message", handler);
}
