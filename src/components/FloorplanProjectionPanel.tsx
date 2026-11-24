import { useEffect, useMemo, useRef, useState } from "react";
import { useSchematicStore } from "../store";
import {
  DEFAULT_PERSON_HEIGHT_M,
  PROJECTION_ASPECTS,
  SEATED_PERSON_HEIGHT_M,
  defaultProjectionFor,
  inPictureLabel,
  sectionDrawingFor,
  projectionGeometry,
  resizeSurface,
  symbolPositionForDistance,
  symbolRotationFacing,
  type ProjectionIssue,
} from "../projection";
import {
  findModel,
  guessModel,
  loadProjectionCatalog,
  opticsForModel,
  pixelsVOfResolution,
  searchModels,
  type CatalogModel,
  type ProjectionCatalog,
} from "../projectionData";
import { FIELD, NumberField, ROW, ViewingMoreRows, ViewingRows } from "./ProjectionViewingRows";
import { ContrastMoreRows, ContrastRows } from "./ProjectionContrastRows";
import { clampToSheet } from "../floorplan";
import { useT } from "../i18n";
import ProjectionSectionSvg from "./ProjectionSectionSvg";
import { UNDERLAY_ACCEPT, importUnderlayFile } from "../floorplanUnderlay";
import type { DeviceData, FloorplanPage, FloorplanProjection, FloorplanSymbol, ProjectionOptics, ProjectionSection, ProjectionSectionUnderlay } from "../types";

interface Props {
  page: FloorplanPage;
  symbol: FloorplanSymbol;
  /** The device the symbol stands for, to recognise its model. */
  device?: DeviceData;
}

/** A typed throw ratio to start from when nothing is known about the lens. */
const GENERIC_OPTICS: ProjectionOptics = { throwMin: 1.5, throwMax: 2 };

/** Longest edge an attached section is kept at. It is a backdrop for a handful of lines,
 *  and it travels in the project file. */
const SECTION_UNDERLAY_MAX_PX = 1800;

/** Re-encode any imported picture as a JPEG of bounded size on white — one format the
 *  sheet and the PDF both take, whatever came in (PNG with alpha, WebP, a rasterized PDF). */
async function shrinkToJpeg(src: string, maxEdgePx: number): Promise<{ src: string; widthPx: number; heightPx: number }> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const k = Math.min(1, maxEdgePx / Math.max(w, h, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL("image/jpeg", 0.85), widthPx: canvas.width, heightPx: canvas.height };
}

/**
 * Two clicks on the architect's section: the floor below the picture, then the floor
 * below the projector. Shown large, because the points decide where the beam lands.
 */
function SectionCalibrator({ underlay, onApply, onClose }: {
  underlay: ProjectionSectionUnderlay;
  onApply: (a: { x: number; y: number }, b: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [points, setPoints] = useState<{ x: number; y: number }[]>(
    underlay.floorAtPicturePx && underlay.floorAtProjectorPx ? [underlay.floorAtPicturePx, underlay.floorAtProjectorPx] : [],
  );
  const r = Math.max(underlay.widthPx, underlay.heightPx) / 120;
  const names = [t("Picture"), t("Projector")];
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" data-testid="section-calibrator" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex flex-col gap-2 p-3 rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] shadow-xl" style={{ maxWidth: "92vw", maxHeight: "92vh" }}>
        <div className="font-semibold">
          {points.length === 0 && t("Click the floor directly below the picture")}
          {points.length === 1 && t("Now click the floor directly below the projector's lens")}
          {points.length === 2 && t("Both points are set. Click again to start over.")}
        </div>
        <svg
          viewBox={`0 0 ${underlay.widthPx} ${underlay.heightPx}`}
          style={{ maxWidth: "88vw", maxHeight: "74vh", aspectRatio: `${underlay.widthPx} / ${underlay.heightPx}`, cursor: "crosshair", background: "#fff" }}
          data-testid="section-calibrator-image"
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const at = {
              x: ((e.clientX - box.left) / box.width) * underlay.widthPx,
              y: ((e.clientY - box.top) / box.height) * underlay.heightPx,
            };
            setPoints((cur) => (cur.length >= 2 ? [at] : [...cur, at]));
          }}
        >
          <image href={underlay.src} width={underlay.widthPx} height={underlay.heightPx} />
          {points.length === 2 && <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#d97706" strokeWidth={r / 3} />}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={r} fill="#fff" stroke="#0e7490" strokeWidth={r / 3} />
              <text x={p.x} y={p.y - r * 1.6} fontSize={r * 2.4} textAnchor="middle" fill="#0e7490" fontWeight={700} stroke="#fff" strokeWidth={r / 3} paintOrder="stroke">{names[i]}</text>
            </g>
          ))}
        </svg>
        <div className="flex items-center gap-2 justify-end">
          <button className="px-2 py-1 rounded border border-[var(--color-border)]" onClick={onClose}>{t("Cancel")}</button>
          <button
            className="px-2 py-1 rounded bg-cyan-700 text-white disabled:opacity-40"
            disabled={points.length !== 2}
            data-testid="section-calibrator-apply"
            onClick={() => onApply(points[0], points[1])}
          >
            {t("Apply")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The projection block of a projector symbol: pick the model, say how big the picture is,
 * slide the projector through the distances that work. Only what planning needs is in
 * view — heights, gain and the lens are folded away under "More".
 */
export default function FloorplanProjectionPanel({ page, symbol, device }: Props) {
  const t = useT();
  const addFloorplanProjection = useSchematicStore((s) => s.addFloorplanProjection);
  const updateFloorplanProjection = useSchematicStore((s) => s.updateFloorplanProjection);
  const removeFloorplanProjection = useSchematicStore((s) => s.removeFloorplanProjection);

  const [catalog, setCatalog] = useState<ProjectionCatalog | null>(null);
  useEffect(() => {
    let alive = true;
    loadProjectionCatalog().then((c) => { if (alive) setCatalog(c); });
    return () => { alive = false; };
  }, []);

  const projection = (page.projections ?? []).find((pr) => pr.symbolId === symbol.id);
  // A projection planned before the native resolution was kept: its model is known, so
  // the pixel count is filled in from the catalogue — without an undo step, because the
  // planner changed nothing.
  const lacksResolution = projection && projection.kind !== "display" && projection.model && projection.optics.pixelsV === undefined
    ? projection
    : undefined;
  useEffect(() => {
    if (!catalog || !lacksResolution?.model) return;
    const pixelsV = pixelsVOfResolution(findModel(catalog, lacksResolution.model)?.resolution);
    if (pixelsV) updateFloorplanProjection(page.id, lacksResolution.id, { optics: { ...lacksResolution.optics, pixelsV } }, { continuing: true });
  }, [catalog, lacksResolution, page.id, updateFloorplanProjection]);
  const [query, setQuery] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const sectionFile = useRef<HTMLInputElement>(null);
  const addToast = useSchematicStore((s) => s.addToast);
  const sliding = useRef(false);

  const recognised = useMemo(
    () => (catalog ? guessModel(catalog, [device?.modelNumber, device?.label, device?.model]) : undefined),
    [catalog, device?.modelNumber, device?.label, device?.model],
  );

  if (!projection) {
    return (
      <div className="flex items-center gap-2">
        <button
          className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-cyan-500 hover:text-cyan-700"
          data-testid="projection-create"
          onClick={() => {
            const picked = recognised && catalog ? opticsForModel(catalog, recognised) : null;
            const draft = defaultProjectionFor(symbol, picked?.optics ?? GENERIC_OPTICS, page.scaleDenominator);
            addFloorplanProjection(page.id, {
              ...draft,
              screenCenterMm: clampToSheet(draft.screenCenterMm, page),
              ...(picked && recognised ? { model: recognised.name, lens: picked.lens } : {}),
            }, symbol.rotationDeg ?? 0);
          }}
          title={t("Draw the picture this projector throws and work out distance, zoom and brightness")}
        >
          ▷ {t("Plan projection")}
        </button>
        {recognised && <span style={{ fontSize: 10 }} className="text-[var(--color-text-muted)] truncate">{recognised.name}</span>}
      </div>
    );
  }

  const g = projectionGeometry(projection, symbol.positionMm, page.scaleDenominator);
  const r = g.result;
  const patch = (p: Partial<Omit<FloorplanProjection, "id">>) => updateFloorplanProjection(page.id, projection.id, p);
  const model = catalog && projection.model ? findModel(catalog, projection.model) : undefined;
  const formats = projection.optics.formats?.map((f) => f.ratio) ?? PROJECTION_ASPECTS;
  const aspects = formats.includes(projection.aspect) ? formats : [projection.aspect, ...formats];
  const matches = catalog && query ? searchModels(catalog, query, 8) : [];

  const pickModel = (m: CatalogModel, lensId?: string) => {
    if (!catalog) return;
    const picked = opticsForModel(catalog, m, lensId);
    if (!picked) return;
    const ratios = picked.optics.formats?.map((f) => f.ratio) ?? [];
    const aspect = ratios.includes(projection.aspect) ? projection.aspect : (ratios[0] ?? projection.aspect);
    patch({ ...resizeSurface(projection, { aspect }), model: m.name, lens: picked.lens, optics: picked.optics });
    setQuery(null);
  };

  const moveTo = (distanceM: number, continuing: boolean) => {
    updateFloorplanProjection(page.id, projection.id, {}, {
      symbolPositionMm: clampToSheet(symbolPositionForDistance(projection, symbol.positionMm, distanceM, page.scaleDenominator), page),
      continuing,
    });
  };

  const issueText = (i: ProjectionIssue): string => {
    switch (i.kind) {
      case "behind": return t("The projector is behind the picture");
      case "too-near": return t("{m} m too near", { m: (i.byM ?? 0).toFixed(2) });
      case "too-far": return t("{m} m too far", { m: (i.byM ?? 0).toFixed(2) });
      case "too-small": return t("Picture too small — the lens focuses from {n}″", { n: i.limit ?? 0 });
      case "too-large": return t("Picture too large — the lens focuses up to {n}″", { n: i.limit ?? 0 });
      case "shift-h": return i.limit
        ? t("Shift H {v} % > {limit} %", { v: Math.abs(i.value ?? 0).toFixed(0), limit: i.limit.toFixed(0) })
        : t("No horizontal lens shift — put the projector on the picture's centre line");
      case "shift-v": return t("Shift V {v} % > {limit} %", { v: Math.abs(i.value ?? 0).toFixed(0), limit: (i.limit ?? 0).toFixed(0) });
    }
  };

  const sec = g.section;
  const personM = projection.section?.personHeightM ?? DEFAULT_PERSON_HEIGHT_M;
  const patchSection = (p: Partial<ProjectionSection>) => patch({ section: { ...projection.section, ...p } });
  const sectionText = (): string => {
    if (!sec) return "";
    const h = sec.personHeightM.toFixed(2);
    if (!sec.inPicture) return t("{h} m tall: never in the picture", { h });
    const { fromM, toM } = sec.inPicture;
    if (fromM <= 0.005 && toM >= sec.distanceM - 0.005) return t("{h} m tall: in the picture all the way to the projector", { h });
    if (fromM <= 0.005) return t("{h} m tall: in the picture up to {m} m in front of it", { h, m: toM.toFixed(2) });
    return t("{h} m tall: in the picture from {m} m in front of it to the projector", { h, m: fromM.toFixed(2) });
  };

  const lock = (on: boolean | undefined, toggle: () => void, title: string, testId: string) => (
    <button
      className={`px-1 rounded ${on ? "text-cyan-700 bg-cyan-500/15" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
      onClick={toggle}
      title={title}
      aria-pressed={Boolean(on)}
      data-testid={testId}
    >
      {on ? "\u{1F512}" : "\u{1F513}"}
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5 pt-1.5 mt-0.5 border-t border-[var(--color-border)]" data-testid="projection-panel">
      <div className="font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>{t("Projection")}</div>

      {/* Model — or, without manufacturer data, the throw ratio off the datasheet. */}
      {catalog && (
        <div className="relative">
          <label className={ROW}>
            <span className="shrink-0 w-12">{t("Model")}</span>
            <input
              className={`flex-1 min-w-0 ${FIELD} px-1.5`}
              value={query ?? projection.model ?? ""}
              placeholder={t("Search Epson model…")}
              data-testid="projection-model"
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => window.setTimeout(() => setQuery(null), 150)}
              title={t("Type part of the model name. Other makes: leave empty and enter the throw ratio.")}
            />
            {projection.model && query === null && (
              <button className="px-1 text-[var(--color-text-muted)] hover:text-red-600" title={t("Enter the values by hand instead")} onClick={() => patch({ model: undefined, lens: undefined })}>×</button>
            )}
          </label>
          {matches.length > 0 && (
            <div className="absolute left-14 right-0 z-10 mt-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] shadow">
              {matches.map((m) => (
                <button key={`${m.name}|${m.code}`} className="block w-full text-left px-1.5 py-0.5 hover:bg-cyan-500/15 text-[var(--color-text)]" onMouseDown={(e) => { e.preventDefault(); pickModel(m); }}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!projection.model && (
        <>
          <label className={ROW} title={t("Throw ratio = distance ÷ picture width, from the datasheet. Two values for a zoom lens.")}>
            <span className="shrink-0 w-12">{t("Throw")}</span>
            <NumberField className={`w-12 ${FIELD}`} digits={2} value={projection.optics.throwMin} testId="projection-throw-min"
              onCommit={(v) => v && patch({ optics: { ...projection.optics, formats: undefined, throwMin: v, throwMax: Math.max(v, projection.optics.throwMax ?? v) } })} />
            <span>–</span>
            <NumberField className={`w-12 ${FIELD}`} digits={2} value={projection.optics.throwMax} testId="projection-throw-max"
              onCommit={(v) => v && patch({ optics: { ...projection.optics, formats: undefined, throwMax: v, throwMin: Math.min(v, projection.optics.throwMin ?? v) } })} />
            <span style={{ fontSize: 10 }}>: 1</span>
          </label>
          <label className={ROW}>
            <span className="shrink-0 w-12">{t("Light")}</span>
            <NumberField className={`w-16 ${FIELD}`} digits={0} min={1} value={projection.optics.lumens} testId="projection-lumens"
              onCommit={(v) => patch({ optics: { ...projection.optics, lumens: v } })} />
            <span style={{ fontSize: 10 }}>lm</span>
          </label>
        </>
      )}

      <label className={ROW}>
        <span className="shrink-0 w-12">{t("Format")}</span>
        <select className={`${FIELD}`} value={projection.aspect} data-testid="projection-aspect" onChange={(e) => patch(resizeSurface(projection, { aspect: e.target.value }))}>
          {aspects.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="flex-1" />
        <NumberField className={`w-12 ${FIELD}`} digits={0} min={10} value={r.picture.diagonalIn} testId="projection-diagonal"
          title={t("Picture diagonal in inches")}
          onCommit={(v) => v && patch(resizeSurface(projection, { diagonalIn: v }))} />
        <span style={{ fontSize: 10 }}>″</span>
      </label>

      {/* Two short rows rather than one crowded one: value, unit, pin. */}
      <div className={ROW}>
        <span className="shrink-0 w-12">{t("Width")}</span>
        <NumberField className={`w-14 ${FIELD}`} digits={2} value={projection.widthM} testId="projection-width"
          onCommit={(v) => v && patch(resizeSurface(projection, { widthM: v }))} />
        <span style={{ fontSize: 10 }}>m</span>
        {lock(projection.lockWidth, () => patch({ lockWidth: !projection.lockWidth }), t("Pin the width — it stays when the height or the format changes"), "projection-lock-width")}
      </div>
      <div className={ROW}>
        <span className="shrink-0 w-12">{t("Height")}</span>
        <NumberField className={`w-14 ${FIELD}`} digits={2} value={projection.heightM} testId="projection-height"
          onCommit={(v) => v && patch(resizeSurface(projection, { heightM: v }))} />
        <span style={{ fontSize: 10 }}>m</span>
        {lock(projection.lockHeight, () => patch({ lockHeight: !projection.lockHeight }), t("Pin the height — it stays when the width or the format changes"), "projection-lock-height")}
      </div>

      {/* The slider only offers what the lens can do; the projector moves, the picture stays. */}
      {r.range && r.range.maxM > r.range.minM ? (
        <div className="flex flex-col gap-0.5">
          <div className={ROW}>
            <span className="shrink-0 w-12">{t("Distance")}</span>
            <input
              type="range"
              className="flex-1 min-w-0 accent-cyan-600"
              min={r.range.minM}
              max={r.range.maxM}
              // "any": a fixed step would stop short of the far limit by a fraction of it.
              step="any"
              value={Math.min(r.range.maxM, Math.max(r.range.minM, g.distanceM))}
              data-testid="projection-distance-slider"
              onPointerDown={() => { sliding.current = false; }}
              onChange={(e) => { moveTo(Number(e.target.value), sliding.current); sliding.current = true; }}
              onPointerUp={() => { sliding.current = false; }}
              title={t("Slide the projector between the nearest and the farthest position the lens allows")}
            />
            <NumberField className={`w-14 ${FIELD}`} digits={2} value={g.distanceM} testId="projection-distance"
              onCommit={(v) => v && moveTo(v, false)} />
            <span style={{ fontSize: 10 }}>m</span>
          </div>
          <div className="flex justify-between pl-14 pr-[5.2rem] text-[var(--color-text-muted)]" style={{ fontSize: 9 }}>
            <span>{r.range.minM.toFixed(2)}</span>
            <span>{r.range.maxM.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <div className={ROW}>
          <span className="shrink-0 w-12">{t("Distance")}</span>
          <NumberField className={`w-14 ${FIELD}`} digits={2} value={g.distanceM} testId="projection-distance" onCommit={(v) => v && moveTo(v, false)} />
          <span style={{ fontSize: 10 }}>m{r.range ? ` (${r.range.minM.toFixed(2)})` : ""}</span>
        </div>
      )}

      <div className="text-[var(--color-text)]" data-testid="projection-result">
        {r.zoom !== undefined && <>{t("Zoom")} {Math.round(r.zoom * 100)} % · </>}
        {t("Shift H")} {Math.abs(r.shiftH).toFixed(0)} %
        {r.shiftV !== undefined && <> · {t("Shift V")} {r.shiftV.toFixed(0)} %</>}
      </div>

      <div className="text-[var(--color-text)]" data-testid="projection-brightness" title={t("Light output ÷ picture area = illuminance on the picture. It changes with the picture size, not with the distance.")}>
        <span className="text-[var(--color-text-muted)]">{t("Brightness")} </span>
        {r.lux !== undefined && projection.optics.lumens
          ? <>{projection.optics.lumens} lm{(projection.screenGain ?? 1) !== 1 ? ` × ${projection.screenGain}` : ""} ÷ {r.areaM2.toFixed(2)} m² = <b>{Math.round(r.lux)} lx</b></>
          : <span className="text-[var(--color-text-muted)]">{t("enter the light output")}</span>}
      </div>

      <ContrastRows projection={projection} patch={patch} screenLux={r.lux} />

      {sec && (
        <div className={sec.inPicture ? "text-amber-700" : "text-[var(--color-text)]"} data-testid="projection-section-text">
          {sectionText()}
        </div>
      )}

      {r.issues.map((i, n) => (
        <div key={n} className="px-1.5 py-0.5 rounded border border-red-200 bg-red-100 text-red-800" data-testid="projection-issue">{issueText(i)}</div>
      ))}

      <ViewingRows page={page} projection={projection} picture={r.picture} patch={patch} />

      <details>
        <summary className="cursor-pointer select-none text-[var(--color-text-muted)]">{t("More")}</summary>
        <div className="flex flex-col gap-1.5 pt-1">
          {model?.lenses && (
            <label className={ROW}>
              <span className="shrink-0 w-12">{t("Lens")}</span>
              <select className={`flex-1 min-w-0 ${FIELD}`} value={projection.lens ?? ""} onChange={(e) => pickModel(model, e.target.value)}>
                {model.lenses.map((id) => <option key={id} value={id}>{id}{id === model.standardLens ? ` (${t("standard")})` : ""}</option>)}
              </select>
            </label>
          )}
          {/* Heights: they check the vertical shift and draw the section. */}
          <label className={ROW} title={t("Lower edge of the picture above the floor, m")}>
            <span className="shrink-0 w-16">{t("Lower edge")}</span>
            <NumberField className={`w-14 ${FIELD}`} digits={2} min={0} value={projection.screenBottomM} testId="projection-screen-bottom" onCommit={(v) => patch({ screenBottomM: v })} />
            <span style={{ fontSize: 10 }}>m</span>
          </label>
          <label className={ROW} title={t("Lens above the floor, m")}>
            <span className="shrink-0 w-16">{t("Lens height")}</span>
            <NumberField className={`w-14 ${FIELD}`} digits={2} min={0} value={projection.lensHeightM} testId="projection-lens-height" onCommit={(v) => patch({ lensHeightM: v })} />
            <span style={{ fontSize: 10 }}>m</span>
          </label>
          {r.lensHeightRangeM && (
            <div className="text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
              {t("Lens may hang between {a} and {b} m", { a: Math.max(0, r.lensHeightRangeM.min).toFixed(2), b: r.lensHeightRangeM.max.toFixed(2) })}
            </div>
          )}
          <label className={ROW} title={t("Room height, floor to ceiling, m")}>
            <span className="shrink-0 w-16">{t("Room height")}</span>
            <NumberField className={`w-14 ${FIELD}`} digits={2} min={0.5} value={projection.section?.roomHeightM} testId="projection-room-height" onCommit={(v) => patchSection({ roomHeightM: v })} />
            <span style={{ fontSize: 10 }}>m</span>
          </label>
          <div className={ROW} title={t("Height of the person tested against the beam, m")}>
            <span className="shrink-0 w-16">{t("Person")}</span>
            <NumberField className={`w-14 ${FIELD}`} digits={2} min={0.5} value={personM} testId="projection-person-height"
              onCommit={(v) => patchSection({ personHeightM: v && v !== DEFAULT_PERSON_HEIGHT_M ? v : undefined })} />
            <span style={{ fontSize: 10 }}>m</span>
            {[[DEFAULT_PERSON_HEIGHT_M, t("standing")], [SEATED_PERSON_HEIGHT_M, t("seated")]].map(([h, name]) => (
              <button
                key={String(h)}
                className={`px-1 rounded border ${personM === h ? "border-cyan-500 text-cyan-700 bg-cyan-500/10" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                style={{ fontSize: 10 }}
                onClick={() => patchSection({ personHeightM: h === DEFAULT_PERSON_HEIGHT_M ? undefined : (h as number) })}
              >
                {name}
              </button>
            ))}
          </div>
          {sec ? (
            <>
              <div className="rounded border border-[var(--color-border)] bg-white overflow-hidden self-start">
                <ProjectionSectionSvg drawing={sectionDrawingFor(sec, projection.section, 70)} pxPerMm={3} label={inPictureLabel(sec)} />
              </div>
              {sec.issues.includes("picture-above-ceiling") && <div className="px-1.5 py-0.5 rounded border border-red-200 bg-red-100 text-red-800">{t("The picture reaches above the ceiling")}</div>}
              {sec.issues.includes("lens-above-ceiling") && <div className="px-1.5 py-0.5 rounded border border-red-200 bg-red-100 text-red-800">{t("The lens is above the ceiling")}</div>}
              <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]" title={t("Puts the section on the plan as a box you can move and widen. It is exported with the sheet.")}>
                <input type="checkbox" checked={Boolean(projection.section?.show)} data-testid="projection-section-show"
                  onChange={(e) => patchSection({
                    show: e.target.checked,
                    positionMm: projection.section?.positionMm ?? clampToSheet({ x: projection.screenCenterMm.x + 10, y: projection.screenCenterMm.y + 10 }, page),
                  })} />
                <span>{t("Show the section on the sheet")}</span>
              </label>
              {/* The architect's own section as the backdrop, instead of the generated one. */}
              <input
                ref={sectionFile}
                type="file"
                accept={UNDERLAY_ACCEPT.split(",").filter((a) => !a.includes("dxf")).join(",")}
                className="hidden"
                data-testid="projection-section-file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const imported = await importUnderlayFile(file, { dpi: 100, maxLongEdgePx: SECTION_UNDERLAY_MAX_PX });
                    const small = await shrinkToJpeg(imported.src, SECTION_UNDERLAY_MAX_PX);
                    patchSection({ underlay: { ...small, name: file.name } });
                    setCalibrating(true);
                  } catch (err) {
                    addToast(err instanceof Error && err.message.length > 8 ? err.message : t("This file could not be read as a picture."), "error");
                  }
                }}
              />
              {projection.section?.underlay ? (
                <div className="flex items-center gap-1 min-w-0">
                  <span className="truncate text-[var(--color-text-muted)]" style={{ fontSize: 10 }} title={projection.section.underlay.name}>{projection.section.underlay.name ?? t("Section drawing")}</span>
                  <div className="flex-1" />
                  <button className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-cyan-500 hover:text-cyan-700" data-testid="projection-section-calibrate" onClick={() => setCalibrating(true)}
                    title={t("Click the floor below the picture and below the projector, so the beam lands in the right place")}>
                    {t("Set points…")}
                  </button>
                  <button className="px-1 text-[var(--color-text-muted)] hover:text-red-600" title={t("Back to the generated section")} onClick={() => patchSection({ underlay: undefined })}>×</button>
                </div>
              ) : (
                <button className="self-start px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-cyan-500 hover:text-cyan-700" onClick={() => sectionFile.current?.click()}
                  title={t("Use the architect's section (PDF or picture) as the backdrop. Two clicks on its floor line place the beam on it.")}>
                  {t("Attach a section drawing…")}
                </button>
              )}
              {projection.section?.underlay && !projection.section.underlay.floorAtProjectorPx && (
                <div className="text-amber-700" style={{ fontSize: 10 }}>{t("Set the two floor points to see beam and person on the drawing.")}</div>
              )}
              {calibrating && projection.section?.underlay && (
                <SectionCalibrator
                  underlay={projection.section.underlay}
                  onClose={() => setCalibrating(false)}
                  onApply={(a, b) => {
                    patchSection({ underlay: { ...projection.section!.underlay!, floorAtPicturePx: a, floorAtProjectorPx: b } });
                    setCalibrating(false);
                  }}
                />
              )}
            </>
          ) : (
            <div className="text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>{t("Enter lower edge and lens height to see the section.")}</div>
          )}
          <ViewingMoreRows projection={projection} patch={patch} />
          <ContrastMoreRows projection={projection} patch={patch} />
          <label className={ROW} title={t("Gain of the screen material. 1 = matt white.")}>
            <span className="shrink-0 w-12">{t("Gain")}</span>
            <NumberField className={`w-12 ${FIELD}`} digits={1} min={0.1} value={projection.screenGain ?? 1} onCommit={(v) => patch({ screenGain: v && v !== 1 ? v : undefined })} />
          </label>
          {r.range?.sizeMinIn !== undefined && (
            <div className="text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
              {t("The lens focuses {a}″ to {b}″", { a: r.range.sizeMinIn, b: r.range.sizeMaxIn ?? 0 })}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              className="px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:border-cyan-500 hover:text-cyan-700"
              onClick={() => {
                const centred = symbolPositionForDistance(projection, projection.screenCenterMm, g.distanceM, page.scaleDenominator);
                updateFloorplanProjection(page.id, projection.id, {}, { symbolPositionMm: centred, symbolRotationDeg: symbolRotationFacing(projection.screenRotationDeg) });
              }}
              title={t("Put the projector on the picture's centre line, facing it")}
            >
              {t("Centre")}
            </button>
            <div className="flex-1" />
            <button className="px-1.5 py-0.5 rounded text-red-500 hover:bg-red-500/10 hover:text-red-700" onClick={() => removeFloorplanProjection(page.id, projection.id)}>
              {t("Remove projection")}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
