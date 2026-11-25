import type { DeviceTemplate, MicCoverageSpec } from "./types";

/**
 * What Shure's ceiling array microphones cover, as Shure states it.
 *
 * Kept by model rather than only on our own templates: the shared library carries these
 * microphones under its own entries ("MXA 920 Ceiling Array Microphone"), and a plan
 * drawn with one of those has to get the same area.
 *
 * Sources, read 25.11.2026:
 *  - MXA920 user guide: 9 × 9 m dynamic coverage by default, up to eight areas, dedicated
 *    areas 2 × 2 m; mounting up to 3.7 m and talkers up to 4.9 m away "for most rooms".
 *    Shure's support pages say the same of the MXA925.
 *  - MXA901 user guide: one area of 6.1 × 6.1 m, adjustable down to 3 × 3 m; mounting up
 *    to 3.7 m. No talker distance stated.
 *  - MXA902 product page: a fixed single area of 20 × 20 ft.
 */
export const SHURE_MIC_COVERAGE: Record<"MXA920" | "MXA901" | "MXA902", MicCoverageSpec> = {
  MXA920: {
    areaM: { w: 9, d: 9 },
    maxAreas: 8,
    dedicatedAreaM: { w: 2, d: 2 },
    maxTalkerDistanceM: 4.9,
    maxMountHeightM: 3.7,
  },
  MXA901: {
    areaM: { w: 6.1, d: 6.1 },
    minSideM: 3,
    maxAreas: 1,
    maxMountHeightM: 3.7,
  },
  MXA902: {
    areaM: { w: 6.1, d: 6.1 },
    fixed: true,
    maxAreas: 1,
  },
};

const BY_MODEL: [string, MicCoverageSpec][] = [
  ["MXA920", SHURE_MIC_COVERAGE.MXA920],
  ["MXA925", SHURE_MIC_COVERAGE.MXA920],
  ["MXA901", SHURE_MIC_COVERAGE.MXA901],
  ["MXA902", SHURE_MIC_COVERAGE.MXA902],
];

/** The coverage a device's model stands for: its template's own, else a known model's by
 *  name — "MXA 920", "MXA920-S" and "MXA920W-R" are all the MXA920. */
export function micCoverageSpecFor(
  device: Pick<DeviceTemplate, "label" | "modelNumber" | "micCoverage"> | { label?: string; modelNumber?: string; model?: string; micCoverage?: MicCoverageSpec } | undefined,
): MicCoverageSpec | undefined {
  if (!device) return undefined;
  if (device.micCoverage) return device.micCoverage;
  const names = [device.modelNumber, device.label, "model" in device ? device.model : undefined];
  for (const name of names) {
    const key = (name ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const hit = BY_MODEL.find(([model]) => key.includes(model));
    if (hit) return hit[1];
  }
  return undefined;
}
