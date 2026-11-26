import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use temp dir for cache to avoid file-locking issues
const cacheDir = path.join(os.tmpdir(), "vite-easyschematic-docs");

// In dev, Vite's SPA fallback eats /dev/ (no file-extension match → serves the
// docs SPA index instead of the TypeDoc index). Production Cloudflare auto-
// resolves directory indexes via html_handling, but local dev doesn't.
// This middleware rewrites /dev/ → /dev/index.html so both modes match.
function serveDevReferenceIndex() {
  return {
    name: "serve-dev-reference-index",
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, _res: unknown, next: () => void) => void) => void } }) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/dev" || req.url === "/dev/") {
          req.url = "/dev/index.html";
        }
        next();
      });
    },
  };
}

// DOCS_LOCALE=de builds the German edition: a page that has a translation in src/pages-de/
// is taken from there, every other page stays English. Done at resolve time so DocsApp.tsx
// keeps its one list of routes — the search index script reads that list too.
const docsLocale = process.env.DOCS_LOCALE === "de" ? "de" : "en";

function localizedPages() {
  const pagesDir = path.join(__dirname, "src", "pages");
  return {
    name: "docs-localized-pages",
    enforce: "pre" as const,
    async resolveId(this: { resolve: (s: string, i?: string, o?: { skipSelf: boolean }) => Promise<{ id: string } | null> }, source: string, importer?: string) {
      if (docsLocale === "en" || !importer || !source.startsWith("./pages/")) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved || path.dirname(resolved.id) !== pagesDir) return null;
      const translated = path.join(__dirname, "src", `pages-${docsLocale}`, path.basename(resolved.id));
      return fs.existsSync(translated) ? translated : null;
    },
    transformIndexHtml(html: string) {
      if (docsLocale !== "de") return html;
      return html
        .replace('<html lang="en">', '<html lang="de">')
        .replace("<title>EasySchematic Docs</title>", "<title>EasySchematic Handbuch</title>");
    },
  };
}

export default defineConfig({
  cacheDir,
  // "/" on the docs' own host. The FACE image serves them next to the app under
  // /handbuch/ (Dockerfile); src/navigate.ts reads this back as BASE.
  base: process.env.DOCS_BASE || "/",
  plugins: [localizedPages(), react(), serveDevReferenceIndex()],
  // Resolve TypeScript sources before .js so stale emitted .js shadows can't silently win.
  resolve: {
    extensions: [".mjs", ".mts", ".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  define: {
    __DOCS_LOCALE__: JSON.stringify(docsLocale),
    __APP_VERSION__: JSON.stringify("docs"),
    __BUILD_HASH__: JSON.stringify("docs"),
  },
});
