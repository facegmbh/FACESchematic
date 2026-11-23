import { useEffect, useMemo, useRef, useState } from "react";
import { useSchematicStore } from "../store";
import {
  PROJECTION_ASPECTS,
  defaultProjectionFor,
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
  searchModels,
  type CatalogModel,
  type ProjectionCatalog,
} from "../projectionData";
import { clampToSheet } from "../floorplan";
import { useT } from "../i18n";
import type { DeviceData, FloorplanPage, FloorplanProjection, FloorplanSymbol, ProjectionOptics } from "../types";

interface Props {
  page: FloorplanPage;
  symbol: FloorplanSymbol;
  /** The device the symbol stands for, to recognise its model. */
  device?: DeviceData;
}

const FIELD = "border border-[var(--color-border)] rounded px-1 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-emerald-400";
const ROW = "flex items-center gap-2 text-[var(--color-text-muted)]";
/** A typed throw ratio to start from when nothing is known about the lens. */
const GENERIC_OPTICS: ProjectionOptics = { throwMin: 1.5, throwMax: 2 };

/** A number field that only commits a usable value, so half-typed input ("2,") does not
 *  collapse the picture to nothing. Accepts a decimal comma. */
function NumberField({ value, digits, onCommit, className, title, min = 0.01, testId }: {
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
  const [query, setQuery] = useState<string | null>(null);
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

      <div className={ROW}>
        <span className="shrink-0 w-12">{t("Width")}</span>
        <NumberField className={`w-14 ${FIELD}`} digits={2} value={projection.widthM} testId="projection-width"
          onCommit={(v) => v && patch(resizeSurface(projection, { widthM: v }))} />
        {lock(projection.lockWidth, () => patch({ lockWidth: !projection.lockWidth }), t("Pin the width — it stays when the height or the format changes"), "projection-lock-width")}
        <span className="shrink-0">{t("Height")}</span>
        <NumberField className={`w-14 ${FIELD}`} digits={2} value={projection.heightM} testId="projection-height"
          onCommit={(v) => v && patch(resizeSurface(projection, { heightM: v }))} />
        {lock(projection.lockHeight, () => patch({ lockHeight: !projection.lockHeight }), t("Pin the height — it stays when the width or the format changes"), "projection-lock-height")}
        <span style={{ fontSize: 10 }}>m</span>
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
              step={0.01}
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
          <div className="flex justify-between pl-14 pr-[4.6rem] text-[var(--color-text-muted)]" style={{ fontSize: 9 }}>
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

      {r.issues.map((i, n) => (
        <div key={n} className="px-1.5 py-0.5 rounded border border-red-200 bg-red-100 text-red-800" data-testid="projection-issue">{issueText(i)}</div>
      ))}

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
          <div className={ROW} title={t("Lower edge of the picture and the lens above the floor. With both, the vertical lens shift is checked too.")}>
            <span className="shrink-0 w-12">{t("Heights")}</span>
            <NumberField className={`w-12 ${FIELD}`} digits={2} min={0} value={projection.screenBottomM} onCommit={(v) => patch({ screenBottomM: v })} title={t("Lower edge of the picture above the floor, m")} />
            <span style={{ fontSize: 10 }}>{t("picture")}</span>
            <NumberField className={`w-12 ${FIELD}`} digits={2} min={0} value={projection.lensHeightM} onCommit={(v) => patch({ lensHeightM: v })} title={t("Lens above the floor, m")} />
            <span style={{ fontSize: 10 }}>{t("lens")} m</span>
          </div>
          {r.lensHeightRangeM && (
            <div className="pl-14 text-[var(--color-text-muted)]" style={{ fontSize: 10 }}>
              {t("Lens may hang between {a} and {b} m", { a: Math.max(0, r.lensHeightRangeM.min).toFixed(2), b: r.lensHeightRangeM.max.toFixed(2) })}
            </div>
          )}
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
