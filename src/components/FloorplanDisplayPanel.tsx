import { useSchematicStore } from "../store";
import {
  PROJECTION_ASPECTS,
  defaultDisplayFor,
  pictureSize,
  resizeSurface,
  resolveProjection,
} from "../projection";
import { DEFAULT_VIEWING } from "../projectionViewing";
import { useT } from "../i18n";
import { FIELD, NumberField, ROW, ViewingMoreRows, ViewingRows } from "./ProjectionViewingRows";
import type { FloorplanPage, FloorplanProjection, FloorplanSymbol } from "../types";

interface Props {
  page: FloorplanPage;
  symbol: FloorplanSymbol;
}

/** Diagonals displays are actually sold in, inches. */
export const DISPLAY_DIAGONALS_IN = [43, 50, 55, 65, 75, 86, 98];
/** Vertical pixel counts worth offering; they decide the farthest seat for detail work. */
const RESOLUTIONS: { label: string; pixelsV: number }[] = [
  { label: "HD 720", pixelsV: 720 },
  { label: "FHD 1080", pixelsV: 1080 },
  { label: "UHD 2160", pixelsV: 2160 },
];
const DISPLAY_ASPECTS = ["16:9", ...PROJECTION_ASPECTS.filter((a) => a !== "16:9")];

/**
 * A display on the plan: how large it is, and from where it can be read. The display
 * hangs where its symbol stands and faces the way that is turned, so there is nothing to
 * place here — size, resolution and the people in front of it are all there is to say.
 */
export default function FloorplanDisplayPanel({ page, symbol }: Props) {
  const t = useT();
  const addFloorplanProjection = useSchematicStore((s) => s.addFloorplanProjection);
  const updateFloorplanProjection = useSchematicStore((s) => s.updateFloorplanProjection);
  const removeFloorplanProjection = useSchematicStore((s) => s.removeFloorplanProjection);

  const stored = (page.projections ?? []).find((pr) => pr.kind === "display" && pr.symbolId === symbol.id);
  if (!stored) {
    return (
      <div className="flex items-center gap-2">
        <button
          className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-cyan-500 hover:text-cyan-700"
          data-testid="display-create"
          onClick={() => addFloorplanProjection(page.id, defaultDisplayFor(symbol))}
          title={t("Draw the display in its true size and work out from where it can be read")}
        >
          ▭ {t("Plan display")}
        </button>
      </div>
    );
  }

  // The picture is wherever the symbol is now.
  const projection = resolveProjection(stored, symbol);
  const picture = pictureSize(projection.widthM, projection.heightM, projection.aspect);
  const patch = (p: Partial<Omit<FloorplanProjection, "id">>) => updateFloorplanProjection(page.id, projection.id, p);
  const viewing = projection.viewing ?? DEFAULT_VIEWING;
  const diagonal = Math.round(picture.diagonalIn);
  const listed = DISPLAY_DIAGONALS_IN.includes(diagonal);
  const aspects = DISPLAY_ASPECTS.includes(projection.aspect) ? DISPLAY_ASPECTS : [projection.aspect, ...DISPLAY_ASPECTS];

  return (
    <div className="flex flex-col gap-1.5 pt-1.5 mt-0.5 border-t border-[var(--color-border)]" data-testid="display-panel">
      <div className="font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>{t("Display size")}</div>

      <div className={ROW}>
        <span className="shrink-0 w-12">{t("Diagonal")}</span>
        <select
          className={FIELD}
          value={listed ? String(diagonal) : ""}
          data-testid="display-diagonal-preset"
          onChange={(e) => e.target.value && patch(resizeSurface(projection, { diagonalIn: Number(e.target.value) }))}
        >
          {!listed && <option value="">—</option>}
          {DISPLAY_DIAGONALS_IN.map((d) => <option key={d} value={d}>{d}″</option>)}
        </select>
        <NumberField className={`w-12 ${FIELD}`} digits={0} min={10} value={picture.diagonalIn} testId="display-diagonal"
          title={t("Picture diagonal in inches")}
          onCommit={(v) => v && patch(resizeSurface(projection, { diagonalIn: v }))} />
        <span style={{ fontSize: 10 }}>″</span>
      </div>
      {/* Format and what it comes to, on a row of their own: the panel is narrow. */}
      <div className={ROW}>
        <span className="shrink-0 w-12">{t("Format")}</span>
        <select className={FIELD} value={projection.aspect} data-testid="display-aspect" onChange={(e) => patch(resizeSurface(projection, { aspect: e.target.value }))}>
          {aspects.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[var(--color-text)] truncate" data-testid="display-size" title={t("Width × height of the picture")}>
          {picture.widthM.toFixed(2)} × {picture.heightM.toFixed(2)} m
        </span>
      </div>

      <label className={ROW} title={t("The picture's resolution. For detail work it decides how far away the farthest seat may be.")}>
        <span className="shrink-0 w-12">{t("Resolution")}</span>
        <select
          className={`flex-1 min-w-0 ${FIELD}`}
          value={RESOLUTIONS.some((r) => r.pixelsV === viewing.pixelsV) ? String(viewing.pixelsV) : ""}
          data-testid="display-resolution"
          onChange={(e) => patch({ viewing: { ...viewing, pixelsV: e.target.value ? Number(e.target.value) : undefined } })}
        >
          <option value="">{viewing.pixelsV && !RESOLUTIONS.some((r) => r.pixelsV === viewing.pixelsV) ? `${viewing.pixelsV} px` : "—"}</option>
          {RESOLUTIONS.map((r) => <option key={r.pixelsV} value={r.pixelsV}>{r.label}</option>)}
        </select>
      </label>

      <ViewingRows page={page} projection={projection} picture={picture} patch={patch} />

      <details>
        <summary className="cursor-pointer select-none text-[var(--color-text-muted)]">{t("More")}</summary>
        <div className="flex flex-col gap-1.5 pt-1">
          <label className={ROW} title={t("Lower edge of the picture above the floor, m")}>
            <span className="shrink-0 w-16">{t("Lower edge")}</span>
            <NumberField className={`w-14 ${FIELD}`} digits={2} min={0} value={projection.screenBottomM} testId="display-screen-bottom" onCommit={(v) => patch({ screenBottomM: v })} />
            <span style={{ fontSize: 10 }}>m</span>
          </label>
          <ViewingMoreRows projection={projection} patch={patch} />
          {/* A video wall is not a diagonal off a list: type what it measures. */}
          <div className={ROW} title={t("For a video wall or an unusual format: type the picture's width and height")}>
            <span className="shrink-0 w-16">{t("Width")}</span>
            <NumberField className={`w-14 ${FIELD}`} digits={2} value={projection.widthM} testId="display-width"
              onCommit={(v) => v && patch({ widthM: v, lockWidth: true, lockHeight: true })} />
            <span className="shrink-0">{t("Height")}</span>
            <NumberField className={`w-14 ${FIELD}`} digits={2} value={projection.heightM} testId="display-height"
              onCommit={(v) => v && patch({ heightM: v, lockWidth: true, lockHeight: true })} />
            <span style={{ fontSize: 10 }}>m</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex-1" />
            <button className="px-1.5 py-0.5 rounded text-red-500 hover:bg-red-500/10 hover:text-red-700" data-testid="display-remove" onClick={() => removeFloorplanProjection(page.id, projection.id)}>
              {t("Remove display size")}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
