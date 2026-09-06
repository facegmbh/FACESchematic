import { useEffect } from "react";
import { useSchematicStore } from "../store";
import { useContextMenuPosition } from "../hooks/useContextMenuPosition";
import { formatCoverageSpec, coverageApertureDeg, coverageOffersOptics, defaultCameraOptics, COVERAGE_MP_PRESETS, DEFAULT_COVERAGE_OPACITY } from "../floorplan";
import { useT } from "../i18n";
import { COVERAGE_SHAPES, DORI_LEVELS, DORI_PX_PER_M, type CoverageShape, type DeviceData, type DoriLevel, type FloorplanPage } from "../types";

interface Props {
  page: FloorplanPage;
  /** Where the right-click landed, in client coordinates. */
  x: number;
  y: number;
  coverageId: string;
  onClose: () => void;
}

/** Apertures that come off datasheets rather than out of a slider: a wide-angle PIR, a
 *  corridor lens, a standard camera lens, a ceiling detector's full circle. */
const APERTURE_PRESETS = [360, 110, 90, 60, 30];
/** Ranges the same way — the reaches Ajax and Telenot detectors actually state. */
const RANGE_PRESETS_M = [3, 8, 10, 12, 15, 20];

/**
 * Right-click on a detection area. The properties panel on the right can reach any area
 * by list, but on a plan with a dozen overlapping wedges the one under the pointer is the
 * one meant — same reasoning as the cover menu.
 */
export default function FloorplanCoverageContextMenu({ page, x, y, coverageId, onClose }: Props) {
  const t = useT();
  const { ref: menuRef, pos } = useContextMenuPosition(x, y);
  const nodes = useSchematicStore((s) => s.nodes);
  const updateFloorplanCoverage = useSchematicStore((s) => s.updateFloorplanCoverage);
  const removeFloorplanCoverage = useSchematicStore((s) => s.removeFloorplanCoverage);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const timer = setTimeout(() => {
      document.addEventListener("click", onClose);
      document.addEventListener("contextmenu", onClose);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", onClose);
      document.removeEventListener("contextmenu", onClose);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const coverage = (page.coverages ?? []).find((c) => c.id === coverageId);
  if (!coverage) return null;

  const anchoredTo = coverage.symbolId ? page.symbols.find((s) => s.id === coverage.symbolId) : undefined;
  const anchoredDevice = anchoredTo?.deviceNodeId ? nodes.find((n) => n.id === anchoredTo.deviceNodeId) : undefined;
  const offersOptics = coverageOffersOptics(coverage, (anchoredDevice?.data as DeviceData | undefined)?.deviceType);
  const turnBy = coverage.rotationDeg ?? 0;
  const fade = Math.round((coverage.opacity ?? DEFAULT_COVERAGE_OPACITY) * 100);

  const act = (run: () => void) => { run(); onClose(); };
  const patch = (p: Parameters<typeof updateFloorplanCoverage>[2]) => act(() => updateFloorplanCoverage(page.id, coverageId, p));

  const shapeLabel: Record<CoverageShape, string> = {
    sector: t("Sector — detector or lens wedge"),
    circle: t("Circle — all-round, ceiling mounted"),
    rect: t("Corridor — rectangular field"),
  };

  /** Switching shape has to bring the field that shape needs, or a wedge turned into a
   *  corridor would have no width and draw nothing. */
  const changeShape = (shape: CoverageShape) => patch({
    shape,
    apertureDeg: shape === "sector" ? coverageApertureDeg(coverage) : coverage.apertureDeg,
    widthM: shape === "rect" ? (coverage.widthM ?? 2) : coverage.widthM,
  });

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded shadow-lg py-1 min-w-[220px] text-xs"
      style={{
        left: pos.x,
        top: pos.y,
        maxHeight: pos.maxHeight,
        overflowY: pos.maxHeight ? "auto" : undefined,
        visibility: pos.ready ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
      data-allow-scroll
      data-floorplan-coverage-menu
    >
      <div className="px-3 py-1 text-[var(--color-text-muted)] border-b border-[var(--color-border)] mb-1 truncate">
        {coverage.label || t("Coverage")} · {formatCoverageSpec(coverage)}
        {anchoredTo ? ` · ${t("on")} ${anchoredTo.label}` : ""}
      </div>

      <Section>{t("Shape")}</Section>
      {COVERAGE_SHAPES.map((shape) => (
        <Item
          key={shape}
          label={shapeLabel[shape]}
          selected={coverage.shape === shape}
          onClick={() => changeShape(shape)}
        />
      ))}

      {coverage.shape === "sector" && (
        <>
          <Divider />
          <Section>{t("Opening angle")}</Section>
          {APERTURE_PRESETS.map((deg) => (
            <Item
              key={deg}
              label={`${deg}°`}
              selected={Math.round(coverageApertureDeg(coverage)) === deg}
              onClick={() => patch({ apertureDeg: deg })}
            />
          ))}
        </>
      )}

      <Divider />
      {offersOptics && (
        <Item
          label={coverage.optics ? t("Not a camera — set the reach by hand") : t("It is a camera — compute the reach")}
          onClick={() => patch({ optics: coverage.optics ? undefined : defaultCameraOptics() })}
          title={t("A camera has no range of its own: it has pixels spread over an angle. Computed from the megapixels, the opening angle and the level you need.")}
        />
      )}

      {coverage.optics ? (
        <>
          <Section>{t("Sensor")}</Section>
          {COVERAGE_MP_PRESETS.map((mp) => (
            <Item
              key={mp}
              label={`${mp} MP`}
              selected={Math.abs(coverage.optics!.megapixels - mp) < 0.05}
              onClick={() => patch({ optics: { ...coverage.optics!, megapixels: mp } })}
            />
          ))}
          <Section>{t("Purpose")}</Section>
          {DORI_LEVELS.map((lvl) => (
            <Item
              key={lvl}
              label={`${doriLabel(lvl, t)} — ${DORI_PX_PER_M[lvl]} px/m`}
              selected={coverage.optics!.dori === lvl}
              onClick={() => patch({ optics: { ...coverage.optics!, dori: lvl } })}
            />
          ))}
        </>
      ) : (
        <>
          <Section>{t("Range")}</Section>
          {RANGE_PRESETS_M.map((m) => (
            <Item
              key={m}
              label={`${m} m`}
              selected={Math.abs(coverage.rangeM - m) < 0.05}
              onClick={() => patch({ rangeM: m })}
            />
          ))}
        </>
      )}

      <Divider />
      <Section>{t("Turn")}</Section>
      <Item label={t("15° clockwise")} onClick={() => patch({ rotationDeg: turnBy + 15 })} />
      <Item label={t("15° counter-clockwise")} onClick={() => patch({ rotationDeg: turnBy - 15 })} />
      <Item label={t("90° clockwise")} onClick={() => patch({ rotationDeg: turnBy + 90 })} />
      {turnBy !== 0 && (
        <Item
          label={anchoredTo ? t("Aim it with the device again") : t("Square to the sheet again")}
          onClick={() => patch({ rotationDeg: undefined })}
          title={anchoredTo ? t("Drop the offset — the area then faces wherever the device faces.") : undefined}
        />
      )}

      <Divider />
      <Section>{t("Fade")}</Section>
      {[40, 30, 20, 10].map((percent) => (
        <Item
          key={percent}
          label={`${percent}%`}
          onClick={() => patch({ opacity: percent / 100 })}
          selected={fade === percent}
        />
      ))}
      <Item
        label={coverage.showOutline === false ? t("Show the boundary line") : t("Hide the boundary line")}
        onClick={() => patch({ showOutline: coverage.showOutline === false ? undefined : false })}
      />

      <Divider />
      {anchoredTo && (
        <Item
          label={t("Detach from the device")}
          onClick={() => patch({ symbolId: undefined, positionMm: { ...anchoredTo.positionMm } })}
          title={t("The area stays where it is but stops following the device.")}
        />
      )}
      <Item
        label={coverage.locked ? t("Unlock") : t("Lock in place")}
        onClick={() => patch({ locked: coverage.locked ? undefined : true })}
        title={coverage.locked
          ? t("Let it be dragged and aimed again.")
          : t("Pin it, so placing symbols inside it cannot nudge it. It stays editable from here.")}
      />
      <Item
        label={coverage.hidden ? t("Show again") : t("Hide on this sheet")}
        onClick={() => patch({ hidden: coverage.hidden ? undefined : true })}
      />
      <Item label={t("Remove coverage")} danger onClick={() => act(() => removeFloorplanCoverage(page.id, coverageId))} />
    </div>
  );
}

function doriLabel(level: DoriLevel, t: (s: string) => string): string {
  switch (level) {
    case "detect": return t("Detect");
    case "observe": return t("Observe");
    case "recognise": return t("Recognise");
    case "identify": return t("Identify");
  }
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1 pb-0.5 font-semibold text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontSize: 9 }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[var(--color-border)] my-1" />;
}

function Item({ label, onClick, danger, title, selected }: { label: string; onClick: () => void; danger?: boolean; title?: string; selected?: boolean }) {
  return (
    <button
      className={`w-full text-left px-3 py-1.5 cursor-pointer flex items-center gap-1.5 ${
        danger
          ? "text-red-600 hover:bg-red-500/10 hover:text-red-700"
          : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}
      onClick={onClick}
      title={title}
    >
      <span className="w-3 shrink-0 text-emerald-600">{selected ? "✓" : ""}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
