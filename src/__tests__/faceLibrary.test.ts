import { describe, it, expect } from 'vitest';
import { templates as faceLibrary } from '../devices/face-library';
import { DEVICE_TEMPLATES, DEVICE_TYPE_TO_CATEGORY } from '../deviceLibrary';
import { CONNECTOR_LABELS, SIGNAL_LABELS } from '../types';

/**
 * The FACE house library is data-driven (face-library.json) rather than built from the
 * `port()` helpers, so tsc can't catch a bad connector/signal type inside it the way it
 * does for the hand-authored modules. These guards stand in for that.
 */
describe('FACE house device library', () => {
  it('is bundled into DEVICE_TEMPLATES', () => {
    expect(faceLibrary.length).toBeGreaterThan(0);
    const bundledIds = new Set(DEVICE_TEMPLATES.map((t) => t.id));
    for (const t of faceLibrary) expect(bundledIds).toContain(t.id);
  });

  // Scoped to this module on purpose: DEVICE_TEMPLATES as a whole still carries 16
  // pre-existing id collisions between the older modules (e.g. "ATEM Mini" vs
  // "PowerCON Distro"), which makes one of each pair unreachable via getTemplateById.
  // Widen this to the full library once those are fixed.
  it('has ids unique within itself and disjoint from the rest of the library', () => {
    const ids = faceLibrary.map((t) => t.id);
    expect(ids.filter(Boolean).length).toBe(ids.length);
    expect(new Set(ids).size).toBe(ids.length);

    const faceIds = new Set(ids);
    const collisions = DEVICE_TEMPLATES.filter(
      (t) => !faceLibrary.includes(t) && t.id && faceIds.has(t.id),
    ).map((t) => `${t.id} (${t.label})`);
    expect(collisions).toEqual([]);
  });

  it('uses only signal types the app knows', () => {
    for (const t of faceLibrary) {
      for (const p of t.ports) {
        expect(SIGNAL_LABELS, `${t.label} / ${p.label}`).toHaveProperty(p.signalType);
      }
    }
  });

  // CONNECTOR_LABELS doubles as the import validator's whitelist, so an unknown
  // connector here would make exported schematics using it fail to re-import.
  it('uses only connector types the app knows', () => {
    for (const t of faceLibrary) {
      for (const p of t.ports) {
        if (!p.connectorType) continue;
        expect(CONNECTOR_LABELS, `${t.label} / ${p.label}`).toHaveProperty(p.connectorType);
      }
    }
  });

  it('maps every device type to a real category', () => {
    for (const t of faceLibrary) {
      expect(DEVICE_TYPE_TO_CATEGORY, t.label).toHaveProperty(t.deviceType);
    }
  });
});
