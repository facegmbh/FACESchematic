/**
 * Drawing a BHE symbol in the group's colour.
 *
 * The symbols are black line art — 3881 black strokes across the CD against 18 white ones.
 * The white ones are not decoration but knockouts: a disc that blanks what lies under it,
 * so a symbol dropped on a hatched wall stays readable. Recolouring everything would fill
 * those in, so only the black is swapped.
 *
 * The result is a data URL, which is what both targets want: the sheet puts it in an
 * <image>, and the PDF export rasterizes it exactly like the plain symbol. Fetched once
 * per symbol and colour and then kept — one plan draws the same camera fifty times.
 *
 * A note on when to use it at all: the BHE symbol is *defined* as a black drawing, and a
 * plan going to a Sachverständiger is read that way. Colour is for the screen and for
 * telling trades apart, so it is switched on per group, not by default.
 */

/** Poppler writes black as rgb(0%, 0%, 0%); the other spellings cost nothing to cover. */
const BLACK = /(?:rgb\(\s*0%\s*,\s*0%\s*,\s*0%\s*\)|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|#000000\b|#000\b)/gi;

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

const keyOf = (url: string, color: string) => `${url}|${color.toLowerCase()}`;

/** The tinted symbol if it has been fetched already — lets a render use it without waiting. */
export function tintedSymbolCached(url: string, color: string): string | undefined {
  return cache.get(keyOf(url, color));
}

/** Fetch and recolour, once per symbol and colour. Falls back to the untinted URL when the
 *  library is not installed or the file will not load: a black symbol beats none. */
export function tintSymbol(url: string, color: string): Promise<string> {
  const key = keyOf(url, color);
  const done = cache.get(key);
  if (done) return Promise.resolve(done);
  const running = pending.get(key);
  if (running) return running;

  const run = fetch(url)
    .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
    .then((svg) => {
      const tinted = `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(BLACK, color))}`;
      cache.set(key, tinted);
      return tinted;
    })
    .catch(() => {
      cache.set(key, url);
      return url;
    })
    .finally(() => { pending.delete(key); });

  pending.set(key, run);
  return run;
}

/** Tests and the PDF export work on the text directly. */
export function tintSvgText(svg: string, color: string): string {
  return svg.replace(BLACK, color);
}
