import {
  DEFAULT_TALKER_HEIGHT_M,
  MIC_MOUNT_HEIGHT_RANGE_M,
  micCoverageIssues,
  micReachM,
  micReachOnSheet,
} from "../floorplan";
import { useT } from "../i18n";
import { useSchematicStore } from "../store";
import { FIELD, NumberField, ROW } from "./ProjectionViewingRows";
import type { CoverageMic, FloorplanCoverage, FloorplanPage } from "../types";

interface Props {
  page: FloorplanPage;
  coverage: FloorplanCoverage;
  patch: (p: Partial<Omit<FloorplanCoverage, "id">>) => void;
}

/**
 * A ceiling microphone's side of its coverage area: how high it hangs, where the area
 * lies from it, and how much of the area a talker can still be heard in.
 *
 * The heights belong to the microphone, not to one area, so changing them here changes
 * every area the same device carries.
 */
export default function MicCoverageRows({ page, coverage, patch }: Props) {
  const t = useT();
  const updateFloorplanCoverage = useSchematicStore((s) => s.updateFloorplanCoverage);
  const mic = coverage.mic;
  if (!mic) return null;

  const patchMic = (p: Partial<CoverageMic>) => {
    const siblings = coverage.symbolId
      ? (page.coverages ?? []).filter((c) => c.symbolId === coverage.symbolId && c.mic)
      : [coverage];
    for (const c of siblings) updateFloorplanCoverage(page.id, c.id, { mic: { ...c.mic!, ...p } });
  };
  const offset = coverage.offsetM ?? { x: 0, y: 0 };
  const patchOffset = (p: Partial<{ x: number; y: number }>) => {
    const next = { ...offset, ...p };
    patch({ offsetM: next.x === 0 && next.y === 0 ? undefined : next });
  };

  const reachM = micReachM(mic);
  const reach = micReachOnSheet(coverage, page);
  const issues = micCoverageIssues(coverage, page);
  const onDevice = coverage.symbolId
    ? (page.coverages ?? []).filter((c) => c.symbolId === coverage.symbolId && c.mic).length
    : 1;
  const comma = (v: number, digits = 1) => v.toFixed(digits);

  return (
    <>
      <label className={ROW} title={t("Height of the microphone above the floor. The higher it hangs, the less of the talker distance is left for the floor.")}>
        <span className="shrink-0 w-12">{t("Mounted")}</span>
        <NumberField className={`w-14 ${FIELD}`} digits={2} min={MIC_MOUNT_HEIGHT_RANGE_M.min} value={mic.mountHeightM} testId="mic-mount-height"
          onCommit={(v) => { if (v !== undefined && v <= MIC_MOUNT_HEIGHT_RANGE_M.max) patchMic({ mountHeightM: v }); }} />
        <span style={{ fontSize: 10 }}>m</span>
      </label>
      <label className={ROW} title={t("Height of a talker's mouth above the floor: about 1.2 m seated, 1.6 m standing.")}>
        <span className="shrink-0 w-12">{t("Talker")}</span>
        <NumberField className={`w-14 ${FIELD}`} digits={2} min={0.5} value={mic.talkerHeightM ?? DEFAULT_TALKER_HEIGHT_M} testId="mic-talker-height"
          onCommit={(v) => { if (v !== undefined && v <= 2.2) patchMic({ talkerHeightM: v === DEFAULT_TALKER_HEIGHT_M ? undefined : v }); }} />
        <span style={{ fontSize: 10 }}>m</span>
      </label>
      <label className={ROW} title={t("Where the middle of the area lies from the microphone, in metres along and across the direction the device faces. Dragging the area on the plan sets the same two numbers.")}>
        <span className="shrink-0 w-12">{t("Shifted")}</span>
        <NumberField className={`w-12 ${FIELD}`} digits={1} min={-100} value={offset.x} testId="mic-offset-x"
          onCommit={(v) => patchOffset({ x: v ?? 0 })} />
        <NumberField className={`w-12 ${FIELD}`} digits={1} min={-100} value={offset.y} testId="mic-offset-y"
          onCommit={(v) => patchOffset({ y: v ?? 0 })} />
        <span style={{ fontSize: 10 }}>m</span>
      </label>

      <div className="text-[var(--color-text)]" data-testid="mic-reach"
        data-mic-share={reach ? reach.share.toFixed(3) : ""}
        title={t("The maker states how far a talker may be from the microphone in a straight line. Taking off the height between mouth and microphone leaves the distance along the floor — the dashed circle on the plan. Worked out here from the maker's figure; the maker's own software does not draw it.")}>
        {reachM === null || !reach
          ? <span className="text-[var(--color-text-muted)]">{t("The maker states no talker distance for this model.")}</span>
          : <>
              <span className="text-[var(--color-text-muted)]">{t("Talkers up to")} </span>
              <b>{comma(reachM)} m</b>
              <span className="text-[var(--color-text-muted)]"> {t("from the point under it")} · </span>
              <b>{Math.round(reach.share * 100)} %</b>
              <span className="text-[var(--color-text-muted)]"> {t("of the area in reach")}</span>
            </>}
      </div>
      {mic.maxAreas !== undefined && mic.maxAreas > 1 && (
        <div className="text-[var(--color-text-muted)]" data-testid="mic-areas">
          {t("Area {n} of at most {max} on this microphone", { n: onDevice, max: mic.maxAreas })}
          {mic.dedicated ? ` · ${t("steered at one seat")}` : ""}
        </div>
      )}
      {issues.length > 0 && (
        <div className="rounded border border-amber-400/60 bg-amber-400/10 px-1.5 py-1 text-[var(--color-text)]" data-testid="mic-issue">
          {issues.map((issue) => (
            <div key={issue}>
              {issue === "too-high" && t("Hangs higher than the {n} m the maker recommends.", { n: comma(mic.maxMountHeightM ?? 0) })}
              {issue === "out-of-reach" && t("At this height no seat in the area is within the talker distance.")}
              {issue === "partly-out-of-reach" && t("The pale part of the area is farther than the talker distance of {n} m.", { n: comma(mic.maxTalkerDistanceM ?? 0) })}
              {issue === "too-many-areas" && t("More areas than the {n} this microphone carries.", { n: mic.maxAreas ?? 1 })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
