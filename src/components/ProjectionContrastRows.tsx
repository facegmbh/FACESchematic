import {
  DEFAULT_DISPLAY_CONTRAST,
  DEFAULT_DISPLAY_REFLECTANCE_PCT,
  DEFAULT_PROJECTOR_CONTRAST,
  CONTRAST_APPLICATIONS,
  CONTRAST_BAND_COLORS,
  contrastApplication,
  formatContrast,
  pictureContrast,
  rateContrast,
  type ContrastApplication,
  type ContrastLevel,
} from "../projectionContrast";
import { DEFAULT_VIEWING } from "../projectionViewing";
import { contrastKeyText } from "../floorplan";
import { useLocale, useT } from "../i18n";
import { FIELD, NumberField, ROW } from "./ProjectionViewingRows";
import type { FloorplanProjection, ProjectionLight } from "../types";

/**
 * Contrast in the lit room, for a projector and for a display: the room light is typed,
 * the rest follows. Shared, because the question is the same for both — is black still
 * black once the lights are on?
 */

type Patch = (p: Partial<Omit<FloorplanProjection, "id">>) => void;

interface Props {
  projection: FloorplanProjection;
  patch: Patch;
  /** A projector's light on its screen, lux. Undefined for a display, or when the
   *  projector's light output is not known. */
  screenLux?: number;
}

function useContrast({ projection, screenLux }: Pick<Props, "projection" | "screenLux">) {
  const light = projection.light ?? {};
  const level: ContrastLevel = (projection.viewing ?? DEFAULT_VIEWING).task;
  const isDisplay = projection.kind === "display";
  const result = pictureContrast(projection, screenLux);
  return { light, level, isDisplay, result };
}

/** Room light, and what contrast it leaves. */
export function ContrastRows({ projection, patch, screenLux }: Props) {
  const t = useT();
  const { light, level, isDisplay, result } = useContrast({ projection, screenLux });
  const patchLight = (p: Partial<ProjectionLight>) => {
    const next = { ...light, ...p };
    patch({ light: Object.values(next).some((v) => v !== undefined) ? next : undefined });
  };
  const text = contrastKeyText(useLocale());
  const room = contrastApplication(light.application);
  const rating = result ? rateContrast(result.ratio, room.id) : null;
  const taskName = level === "adm" ? t("detail work") : t("a presentation");
  const missing = light.ambientLux === undefined
    ? t("enter the room light")
    : isDisplay && !light.nits
      ? t("enter the display's brightness")
      : !isDisplay && !screenLux
        ? t("enter the light output")
        : null;

  return (
    <>
      <label className={ROW} title={t("What the room is for. It sets the scale the contrast is rated on and a usual room light to start from — a cinema needs far more contrast than a classroom.")}>
        <span className="shrink-0 w-12">{t("Room")}</span>
        <select
          className={`flex-1 min-w-0 ${FIELD}`}
          value={room.id}
          data-testid="contrast-application"
          onChange={(e) => {
            const next = contrastApplication(e.target.value as ContrastApplication);
            patchLight({ application: next.id === CONTRAST_APPLICATIONS[0].id ? undefined : next.id, ambientLux: next.ambientLux });
          }}
        >
          {CONTRAST_APPLICATIONS.map((a) => <option key={a.id} value={a.id}>{text.rooms[a.id]} · {a.ambientLux} lx</option>)}
        </select>
      </label>
      <label className={ROW} title={t("Light of the room falling on the picture, in lux — measured on site, or the usual figure of the room chosen above. It is what turns black into grey.")}>
        <span className="shrink-0 w-12">{t("Room light")}</span>
        <NumberField className={`w-14 ${FIELD}`} digits={0} min={0} value={light.ambientLux} testId="contrast-ambient"
          onCommit={(v) => patchLight({ ambientLux: v })} />
        <span style={{ fontSize: 10 }}>lx</span>
      </label>
      {isDisplay && (
        <label className={ROW} title={t("Luminance of the display in cd/m² (nits), from its datasheet")}>
          <span className="shrink-0 w-12">{t("Brightness")}</span>
          <NumberField className={`w-14 ${FIELD}`} digits={0} min={1} value={light.nits} testId="contrast-nits"
            onCommit={(v) => patchLight({ nits: v })} />
          <span style={{ fontSize: 10 }}>cd/m²</span>
        </label>
      )}
      <div className="text-[var(--color-text)]" data-testid="contrast-result"
        title={t("Estimated contrast with the room light on, after AVIXA ISCR: 7:1 passive viewing, 15:1 presentations, 50:1 detail work, 80:1 moving pictures. An estimate for planning — the standard itself is measured on site.")}>
        <span className="text-[var(--color-text-muted)]">{t("Contrast")} </span>
        {result
          ? <><b>{formatContrast(result.ratio)}</b> · {t("{task} needs {n}:1", { task: taskName, n: result.required })}</>
          : <span className="text-[var(--color-text-muted)]">{missing}</span>}
      </div>
      {result && rating && (
        // The scale of Epson's Brightness & Contrast guide: five bands for this kind of
        // room, a mark where the picture sits, the band limits written under it.
        <div data-testid="contrast-scale" data-contrast-band={rating.band}
          title={t("Rating after Epson's Brightness & Contrast guide for this kind of room. The figures under the bar are the contrast at which one band ends and the next begins.")}>
          <div className="relative" style={{ height: 12 }}>
            <div className="absolute flex" style={{ left: 0, right: 0, top: 3, height: 6, borderRadius: 2, overflow: "hidden" }}>
              {CONTRAST_BAND_COLORS.map((c) => <span key={c} style={{ flex: 1, background: c }} />)}
            </div>
            <span className="absolute" data-testid="contrast-mark"
              style={{ left: `${rating.at * 100}%`, top: 0, height: 12, width: 2, marginLeft: -1, background: "var(--color-text)", outline: "1px solid var(--color-surface, #fff)" }} />
          </div>
          <div className="relative text-[var(--color-text-muted)]" style={{ height: 11, fontSize: 9 }}>
            {room.bands.map((b, i) => (
              <span key={b} className="absolute" style={{ left: `${(i + 1) * 20}%`, transform: "translateX(-50%)" }}>{b}</span>
            ))}
          </div>
          <div className="text-[var(--color-text)]" data-testid="contrast-band">
            <span className="inline-block align-middle mr-1" style={{ width: 8, height: 8, borderRadius: 2, background: CONTRAST_BAND_COLORS[rating.index] }} />
            <b>{text.bands[rating.band]}</b> · {text.rooms[room.id]}
          </div>
        </div>
      )}
      {result && !result.ok && (
        <div className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800" data-testid="contrast-issue">
          {result.maxAmbientLux >= 1
            ? t("Too little contrast for {task}. It needs the room light on the picture at {lx} lx or less.", { task: taskName, lx: Math.floor(result.maxAmbientLux) })
            : t("Too little contrast for {task} — not reachable with this device even in the dark.", { task: taskName })}
        </div>
      )}
    </>
  );
}

/** The assumptions behind the estimate, for the panel's "More" section. */
export function ContrastMoreRows({ projection, patch }: Pick<Props, "projection" | "patch">) {
  const t = useT();
  const light = projection.light ?? {};
  const isDisplay = projection.kind === "display";
  const patchLight = (p: Partial<ProjectionLight>) => {
    const next = { ...light, ...p };
    patch({ light: Object.values(next).some((v) => v !== undefined) ? next : undefined });
  };
  const defaultContrast = isDisplay ? DEFAULT_DISPLAY_CONTRAST : DEFAULT_PROJECTOR_CONTRAST;
  return (
    <>
      <label className={ROW} title={t("Contrast the device reaches within one picture (checkerboard), not the full-on/full-off or dynamic figure of the datasheet. An assumption until measured.")}>
        <span className="shrink-0 w-16">{t("Device contrast")}</span>
        <NumberField className={`w-14 ${FIELD}`} digits={0} min={2} value={light.nativeContrast ?? defaultContrast} testId="contrast-native"
          onCommit={(v) => patchLight({ nativeContrast: v && v !== defaultContrast ? v : undefined })} />
        <span style={{ fontSize: 10 }}>:1</span>
      </label>
      {isDisplay && (
        <label className={ROW} title={t("Share of the room light the display's front throws back. About 5 % for a matt panel, more for a glossy one.")}>
          <span className="shrink-0 w-16">{t("Reflection")}</span>
          <NumberField className={`w-12 ${FIELD}`} digits={1} min={0.1} value={light.reflectancePct ?? DEFAULT_DISPLAY_REFLECTANCE_PCT} testId="contrast-reflectance"
            onCommit={(v) => patchLight({ reflectancePct: v && v !== DEFAULT_DISPLAY_REFLECTANCE_PCT ? v : undefined })} />
          <span style={{ fontSize: 10 }}>%</span>
        </label>
      )}
    </>
  );
}
