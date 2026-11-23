import { useEffect, useState } from "react";
import { resizeSurface, type PictureSize } from "../projection";
import {
  DEFAULT_ELEMENT_PCT,
  DEFAULT_EYE_HEIGHT_M,
  DEFAULT_VIEWING,
  MAX_OFF_AXIS_DEG,
  VIEWING_KEY_LIMIT_AT,
  viewingKeyColors,
  defaultAudienceFor,
  viewingOnSheet,
  type ViewingIssue,
} from "../projectionViewing";
import { useT } from "../i18n";
import type { FloorplanPage, FloorplanProjection, ProjectionViewing } from "../types";

/**
 * The viewing-distance rows of the inspector, shared by projectors and displays: both are
 * a picture people look at, and the recommendation does not care how it gets on the wall.
 */

export const FIELD = "border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400";
export const ROW = "flex items-center gap-2 text-[var(--color-text-muted)]";

type Patch = (p: Partial<Omit<FloorplanProjection, "id">>) => void;

/** A number field that only commits a usable value, so half-typed input ("2,") does not
 *  collapse the picture to nothing. Accepts a decimal comma. */
export function NumberField({ value, digits, onCommit, className, title, min = 0.01, testId }: {
  value: number | undefined;
  digits: number;
  onCommit: (v: number | undefined) => void;
  className: string;
  title?: string;
  min?: number;
  testId?: string;
}) {
  const shown = value === undefined ? "" : value.toFixed(digits);
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(shown); }, [shown, editing]);
  const commit = (raw: string) => {
    if (raw.trim() === "") { onCommit(undefined); return; }
    const v = Number(raw.replace(",", "."));
    if (Number.isFinite(v) && v >= min) onCommit(v);
  };
  return (
    <input
      className={className}
      inputMode="decimal"
      value={text}
      title={title}
      data-testid={testId}
      onFocus={() => setEditing(true)}
      onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
      onBlur={() => { setEditing(false); setText(shown); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

interface RowsProps {
  page: FloorplanPage;
  /** For a display: resolved to where its symbol is (`resolveProjection`). */
  projection: FloorplanProjection;
  picture: PictureSize;
  patch: Patch;
}

/** Task, audience area, the recommendation and what does not fit it. */
export function ViewingRows({ page, projection, picture, patch }: RowsProps) {
  const t = useT();
  // Viewing distances after AVIXA: a recommendation shown beside the projector's limits.
  const viewing = projection.viewing ?? DEFAULT_VIEWING;
  const view = viewingOnSheet(projection, picture, page.scaleDenominator).result;
  const patchViewing = (p: Partial<ProjectionViewing>) => patch({ viewing: { ...viewing, ...p } });
  const m2 = (v: number) => v.toFixed(2);
  const viewingText = (): string => {
    const { farthestM, closestM } = view.limits;
    if (farthestM === null) return t("Enter the picture's vertical pixel count under More");
    const recommended = closestM !== null
      ? t("recommended {a} – {b} m", { a: m2(closestM), b: m2(farthestM) })
      : t("recommended up to {b} m", { b: m2(farthestM) });
    if (!view.zone || view.issues.some((i) => i.kind === "behind")) return recommended;
    return `${m2(view.zone.nearestM)} – ${m2(view.zone.farthestM)} m · ${recommended}`;
  };
  const heatmapOn = Boolean(projection.audience) && viewing.heatmap !== false;
  const viewingIssueText = (i: ViewingIssue): string => {
    switch (i.kind) {
      case "behind": return t("The audience area reaches behind the picture");
      case "too-near": return t("Front row {m} m too near", { m: m2(i.byM ?? 0) });
      case "too-oblique": return t("Seats too far to the side — {deg}° > {limit}°", { deg: Math.round(i.deg ?? 0), limit: MAX_OFF_AXIS_DEG });
      case "too-far": return view.requiredHeightM !== undefined
        ? t("Last row {m} m too far — picture height at least {h} m", { m: m2(i.byM ?? 0), h: m2(Math.ceil(view.requiredHeightM * 100) / 100) })
        : t("Last row {m} m too far", { m: m2(i.byM ?? 0) });
    }
  };

  return (
    <>
      <div className={ROW}>
        <span className="shrink-0 w-12">{t("Viewing task")}</span>
        <select
          className={`flex-1 min-w-0 ${FIELD}`}
          value={viewing.task}
          data-testid="projection-viewing-task"
          title={t("What the picture is for decides from how far away it can still be read (AVIXA DISCAS)")}
          onChange={(e) => patchViewing({ task: e.target.value === "adm" ? "adm" : "bdm" })}
        >
          <option value="bdm">{t("Presentation (BDM)")}</option>
          <option value="adm">{t("Detail work (ADM)")}</option>
        </select>
        {projection.audience ? (
          <button className="px-1 text-[var(--color-text-muted)] hover:text-red-600" title={t("Remove the audience area")} data-testid="projection-audience-remove" onClick={() => patch({ audience: undefined })}>✕</button>
        ) : (
          <button
            className="px-1.5 py-0.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-hover)] text-[var(--color-text)]"
            title={t("Puts a rectangle in front of the picture. Drag it to where people sit — it is checked against the recommended viewing distances.")}
            data-testid="projection-audience-add"
            onClick={() => patch({
              audience: defaultAudienceFor(
                { pictureWidthM: picture.widthM, pictureHeightM: picture.heightM, screenCenterMm: projection.screenCenterMm, screenRotationDeg: projection.screenRotationDeg },
                view.limits,
                page.scaleDenominator,
              ),
            })}
          >
            {t("Audience area")}
          </button>
        )}
      </div>
      <div className="text-[var(--color-text)]" data-testid="projection-viewing">
        <span className="text-[var(--color-text-muted)]">{t("Viewing")} </span>
        {viewingText()}
      </div>
      {heatmapOn && (
        <div data-testid="projection-viewing-key" className="text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
          <div style={{ height: 6, borderRadius: 2, opacity: 0.8, background: `linear-gradient(to right, ${viewingKeyColors(16).join(", ")})` }} />
          <div className="relative" style={{ height: 13 }}>
            <span className="absolute left-0">{t("good")}</span>
            <span className="absolute" style={{ left: `${VIEWING_KEY_LIMIT_AT * 100}%`, transform: "translateX(-50%)" }}>{t("limit")}</span>
            <span className="absolute right-0">{t("outside")}</span>
          </div>
        </div>
      )}
      {view.issues.map((i, n) => (
        <div key={n} className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800" data-testid="projection-viewing-issue">
          <span className="flex-1 min-w-0">{viewingIssueText(i)}</span>
          {i.kind === "too-far" && view.requiredHeightM !== undefined && (
            <button
              className="shrink-0 px-1.5 rounded border border-amber-300 bg-white hover:bg-amber-100"
              title={t("Enlarge the picture to this height")}
              data-testid="projection-viewing-apply"
              onClick={() => patch(resizeSurface(projection, { heightM: Math.ceil(view.requiredHeightM! * 100) / 100 }))}
            >
              {t("Apply")}
            </button>
          )}
        </div>
      ))}
    </>
  );
}

/** The settings behind the recommendation, for the panel's "More" section. */
export function ViewingMoreRows({ projection, patch }: { projection: FloorplanProjection; patch: Patch }) {
  const t = useT();
  const viewing = projection.viewing ?? DEFAULT_VIEWING;
  const patchViewing = (p: Partial<ProjectionViewing>) => patch({ viewing: { ...viewing, ...p } });
  return (
    <>
          {viewing.task === "bdm" ? (
            <label className={ROW} title={t("Height of the smallest character that must be read, in percent of the picture height. 3 % lets the farthest viewer sit 6 picture heights away.")}>
              <span className="shrink-0 w-16">{t("Character")}</span>
              <NumberField className={`w-12 ${FIELD}`} digits={1} min={0.1} value={viewing.elementPct ?? DEFAULT_ELEMENT_PCT} testId="projection-viewing-element"
                onCommit={(v) => patchViewing({ elementPct: v && v !== DEFAULT_ELEMENT_PCT ? v : undefined })} />
              <span style={{ fontSize: 10 }}>%</span>
            </label>
          ) : (
            <label className={ROW} title={t("Vertical pixel count of the picture, e.g. 1200 for WUXGA")}>
              <span className="shrink-0 w-16">{t("Pixels V")}</span>
              <NumberField className={`w-14 ${FIELD}`} digits={0} min={1} value={viewing.pixelsV} testId="projection-viewing-pixels"
                onCommit={(v) => patchViewing({ pixelsV: v })} />
            </label>
          )}
          {projection.audience && (
            <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]" title={t("Colours the audience area by how well each seat sees the picture")}>
              <input type="checkbox" checked={viewing.heatmap !== false} data-testid="projection-viewing-heatmap"
                onChange={(e) => patchViewing({ heatmap: e.target.checked ? undefined : false })} />
              <span>{t("Heatmap of the audience area")}</span>
            </label>
          )}
          {projection.audience && (
            <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]" title={t("The dash-dotted outline in front of the picture: within 60° to the side, between the closest and the farthest seat. Switch it off for a calmer plan — the recommendation stays in this panel.")}>
              <input type="checkbox" checked={viewing.outline !== false} data-testid="projection-viewing-outline"
                onChange={(e) => patchViewing({ outline: e.target.checked ? undefined : false })} />
              <span>{t("Outline of the recommended area")}</span>
            </label>
          )}
          <label className={ROW} title={t("Eyes of a seated viewer above the floor, m. With the picture's lower edge it gives the closest seat.")}>
            <span className="shrink-0 w-16">{t("Eye height")}</span>
            <NumberField className={`w-14 ${FIELD}`} digits={2} min={0.1} value={viewing.eyeHeightM ?? DEFAULT_EYE_HEIGHT_M} testId="projection-viewing-eye"
              onCommit={(v) => patchViewing({ eyeHeightM: v && v !== DEFAULT_EYE_HEIGHT_M ? v : undefined })} />
            <span style={{ fontSize: 10 }}>m</span>
          </label>
    </>
  );
}
