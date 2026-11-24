import {
  DEFAULT_DISPLAY_CONTRAST,
  DEFAULT_DISPLAY_REFLECTANCE_PCT,
  DEFAULT_PROJECTOR_CONTRAST,
  displayContrast,
  projectedContrast,
  type ContrastLevel,
} from "../projectionContrast";
import { DEFAULT_VIEWING } from "../projectionViewing";
import { useT } from "../i18n";
import { FIELD, NumberField, ROW } from "./ProjectionViewingRows";
import type { FloorplanProjection, ProjectionLight } from "../types";

/**
 * Contrast in the lit room, for a projector and for a display: the room light is typed,
 * the rest follows. Shared, because the question is the same for both — is black still
 * black once the lights are on?
 */

type Patch = (p: Partial<Omit<FloorplanProjection, "id">>) => void;

/** Room light on the picture, lux — rough figures to start from, not measurements. */
const AMBIENT_PRESETS: { lux: number; name: string }[] = [
  { lux: 10, name: "darkened" },
  { lux: 50, name: "dimmed" },
  { lux: 150, name: "meeting room" },
  { lux: 300, name: "bright office" },
];

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
  if (light.ambientLux === undefined) return { light, level, isDisplay, result: null };
  const result = isDisplay
    ? (light.nits ? displayContrast({ nits: light.nits, ambientLux: light.ambientLux, level, nativeContrast: light.nativeContrast, reflectancePct: light.reflectancePct }) : null)
    : (screenLux ? projectedContrast({ screenLux, ambientLux: light.ambientLux, level, nativeContrast: light.nativeContrast }) : null);
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
  const presetNames: Record<string, string> = {
    darkened: t("darkened"),
    dimmed: t("dimmed"),
    "meeting room": t("meeting room"),
    "bright office": t("bright office"),
  };
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
      <div className={ROW} title={t("Light of the room falling on the picture, in lux — measured on site, or a rough figure from the list. It is what turns black into grey.")}>
        <span className="shrink-0 w-12">{t("Room light")}</span>
        <NumberField className={`w-14 ${FIELD}`} digits={0} min={0} value={light.ambientLux} testId="contrast-ambient"
          onCommit={(v) => patchLight({ ambientLux: v })} />
        <span style={{ fontSize: 10 }}>lx</span>
        <select
          className={`flex-1 min-w-0 ${FIELD}`}
          value={AMBIENT_PRESETS.some((p) => p.lux === light.ambientLux) ? String(light.ambientLux) : ""}
          data-testid="contrast-ambient-preset"
          onChange={(e) => e.target.value && patchLight({ ambientLux: Number(e.target.value) })}
        >
          <option value="">—</option>
          {AMBIENT_PRESETS.map((p) => <option key={p.lux} value={p.lux}>{presetNames[p.name]} · {p.lux}</option>)}
        </select>
      </div>
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
          ? <><b>{result.ratio >= 100 ? Math.round(result.ratio) : result.ratio.toFixed(1)}:1</b> · {t("{task} needs {n}:1", { task: taskName, n: result.required })}</>
          : <span className="text-[var(--color-text-muted)]">{missing}</span>}
      </div>
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
