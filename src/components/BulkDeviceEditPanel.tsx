import { useMemo, useState } from "react";

import { useSchematicStore } from "../store";
import type { DeviceData, DeviceNode } from "../types";

/** Free-text fields that are meaningful to set across many devices at once.
 *  Deliberately excludes per-instance identity (shortName, hostname, serialNumber,
 *  asset code, KNX/DALI address) and anything structural (ports, slots). */
const TEXT_FIELDS = [
  { key: "deviceType", label: "Device Type", placeholder: "e.g. speaker" },
  { key: "manufacturer", label: "Manufacturer", placeholder: "e.g. d&b audiotechnik" },
  { key: "modelNumber", label: "Model Number", placeholder: "e.g. E8" },
  { key: "category", label: "Category", placeholder: "e.g. audio" },
  { key: "voltage", label: "Voltage", placeholder: "e.g. 230V" },
] as const;

const NUMBER_FIELDS = [
  { key: "powerDrawW", label: "Power Draw (W)", placeholder: "e.g. 120" },
  { key: "powerCapacityW", label: "Power Capacity (W)", placeholder: "e.g. 1500" },
  { key: "unitCost", label: "Unit Cost", placeholder: "e.g. 899" },
] as const;

/** Every key the panel can write — also the invalidation signal for the selection snapshot. */
const WATCHED_KEYS = [
  "label",
  "baseLabel",
  "color",
  "headerColor",
  "note",
  "isSpare",
  "isVenueProvided",
  "wrapLabel",
  "procurementSource",
  "adapterVisibility",
  ...TEXT_FIELDS.map((f) => f.key),
  ...NUMBER_FIELDS.map((f) => f.key),
] as const;

/** Shared value across the selection, or `null` when the devices disagree. */
function sharedValue(devices: DeviceNode[], key: string): string | null {
  const vals = devices.map((d) => {
    const v = d.data[key];
    return v == null ? "" : String(v);
  });
  return vals.every((v) => v === vals[0]) ? vals[0] : null;
}

function boolState(devices: DeviceNode[], key: string) {
  const vals = devices.map((d) => d.data[key] === true);
  const allOn = vals.every(Boolean);
  const anyOn = vals.some(Boolean);
  return { allOn, mixed: anyOn && !allOn };
}

interface Props {
  onClose: () => void;
}

export default function BulkDeviceEditPanel({ onClose }: Props) {
  // Serialize to a stable string — avoids the "new array ref every tick" infinite-loop
  // trap, and makes the panel reflect patches it just applied.
  const selectionKey = useSchematicStore((s) =>
    s.nodes
      .filter((n) => n.selected && n.type === "device")
      .map((n) => `${n.id}:${WATCHED_KEYS.map((k) => String(n.data[k] ?? "")).join(",")}`)
      .join("|"),
  );

  // selectionKey is the invalidation signal for this getState() snapshot
  const devices = useMemo(
    () =>
      useSchematicStore
        .getState()
        .nodes.filter((n) => n.selected && n.type === "device") as DeviceNode[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectionKey],
  );

  const [nameInput, setNameInput] = useState("");
  const [numberNames, setNumberNames] = useState(true);

  const hasDevices = devices.length >= 2;

  const patchAll = (patch: Partial<DeviceData>) => {
    useSchematicStore
      .getState()
      .batchPatchDeviceData(devices.map((d) => ({ nodeId: d.id, patch })));
  };

  const applyName = () => {
    const name = nameInput.trim();
    if (!name) return;
    // baseLabel opts the group into auto-numbering — the store's renumberNodes then
    // rewrites label to "<name> 1..N" ordered top-left first. Without it the label is
    // pinned and every device reads identically.
    if (numberNames) patchAll({ baseLabel: name, label: name });
    else patchAll({ label: name, baseLabel: undefined });
    setNameInput("");
  };

  const sharedColor = sharedValue(devices, "color");
  const sharedHeaderColor = sharedValue(devices, "headerColor");

  const isSpare = boolState(devices, "isSpare");
  const isVenueProvided = boolState(devices, "isVenueProvided");

  const wrapLabelShared = (() => {
    const vals = devices.map((d) =>
      d.data.wrapLabel === undefined ? "inherit" : d.data.wrapLabel ? "on" : "off",
    );
    return vals.every((v) => v === vals[0]) ? vals[0] : null;
  })();

  const adapterVisShared = (() => {
    const vals = devices.map((d) => (d.data.adapterVisibility as string | undefined) ?? "default");
    return vals.every((v) => v === vals[0]) ? vals[0] : null;
  })();

  return (
    <div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[40] bg-white border border-[var(--color-border)] rounded-lg shadow-lg p-3 w-72 max-h-[70vh] overflow-y-auto"
      data-print-hide
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--color-text)]">
          {hasDevices ? `Edit ${devices.length} devices` : "Edit devices"}
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs leading-none cursor-pointer"
        >
          ✕
        </button>
      </div>

      {!hasDevices && (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-3">
          Select 2 or more devices to edit them.
        </p>
      )}

      {hasDevices && (
        <>
          <p className="text-[10px] text-[var(--color-text-muted)] leading-tight mb-3">
            Changes apply to all {devices.length} selected devices as one undo step. Ports, short
            name, hostname, serial number and asset ID stay per-device — edit those individually.
          </p>

          {/* Name */}
          <section className="mb-3">
            <Heading>Name</Heading>
            <input
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-blue-500"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") applyName();
              }}
              placeholder="e.g. Lautsprecher"
            />
            <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={numberNames}
                onChange={(e) => setNumberNames(e.target.checked)}
                className="cursor-pointer"
              />
              <span className="text-[11px] text-[var(--color-text)]">Number them</span>
            </label>
            <p className="text-[10px] text-[var(--color-text-muted)] leading-tight mt-0.5">
              {numberNames
                ? `Names become "${nameInput.trim() || "Name"} 1"…"${nameInput.trim() || "Name"} ${devices.length}", ordered top-left first, and keep renumbering as you add or remove devices.`
                : "Every selected device gets exactly this name."}
            </p>
            <button
              onClick={applyName}
              disabled={!nameInput.trim()}
              className="w-full mt-1.5 px-2 py-0.5 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Apply name
            </button>
          </section>

          {/* Appearance */}
          <section className="mb-3">
            <Heading mixed={sharedColor === null || sharedHeaderColor === null}>Appearance</Heading>
            <ColorRow
              label="Body"
              shared={sharedColor}
              fallback="#ffffff"
              onPick={(hex) => patchAll({ color: hex })}
              onReset={() => patchAll({ color: undefined })}
              canReset={devices.some((d) => d.data.color)}
            />
            <ColorRow
              label="Header"
              shared={sharedHeaderColor}
              fallback="#1f2937"
              onPick={(hex) => patchAll({ headerColor: hex })}
              onReset={() => patchAll({ headerColor: undefined })}
              canReset={devices.some((d) => d.data.headerColor)}
            />
          </section>

          {/* Classification */}
          <section className="mb-3">
            <Heading>Classification</Heading>
            <div className="space-y-1.5">
              {TEXT_FIELDS.map((f) => (
                <BulkField
                  key={f.key}
                  label={f.label}
                  placeholder={f.placeholder}
                  shared={sharedValue(devices, f.key)}
                  onCommit={(v) => patchAll({ [f.key]: v })}
                />
              ))}
            </div>
          </section>

          {/* Power & cost */}
          <section className="mb-3">
            <Heading>Power &amp; Cost</Heading>
            <div className="space-y-1.5">
              {NUMBER_FIELDS.map((f) => (
                <BulkField
                  key={f.key}
                  label={f.label}
                  placeholder={f.placeholder}
                  numeric
                  shared={sharedValue(devices, f.key)}
                  onCommit={(v) => {
                    if (v === undefined) return patchAll({ [f.key]: undefined });
                    const n = Number(v);
                    if (Number.isFinite(n)) patchAll({ [f.key]: n });
                  }}
                />
              ))}
            </div>
          </section>

          {/* Logistics */}
          <section className="mb-3">
            <Heading>Logistics</Heading>
            <div className="space-y-1.5">
              <BulkSelect
                label="Source"
                shared={sharedValue(devices, "procurementSource")}
                options={[
                  { value: "", label: "—" },
                  { value: "stock", label: "Own stock" },
                  { value: "procuring", label: "Being procured" },
                  { value: "contractor", label: "Other contractor" },
                ]}
                onCommit={(v) =>
                  patchAll({ procurementSource: (v || undefined) as DeviceData["procurementSource"] })
                }
              />
              <BulkField
                label="Note"
                placeholder="Applies to every selected device"
                multiline
                shared={sharedValue(devices, "note")}
                onCommit={(v) => patchAll({ note: v })}
              />
            </div>
          </section>

          {/* Options */}
          <section>
            <Heading>Options</Heading>
            <div className="space-y-1">
              <Toggle
                label="Cold spare"
                state={isSpare}
                onToggle={() =>
                  patchAll({ isSpare: isSpare.allOn && !isSpare.mixed ? undefined : true })
                }
              />
              <Toggle
                label="Venue provided"
                state={isVenueProvided}
                onToggle={() =>
                  patchAll({
                    isVenueProvided:
                      isVenueProvided.allOn && !isVenueProvided.mixed ? undefined : true,
                  })
                }
              />
            </div>
            <div className="space-y-1.5 mt-1.5">
              <BulkSelect
                label="Wrap label"
                shared={wrapLabelShared}
                options={[
                  { value: "inherit", label: "Inherit document setting" },
                  { value: "on", label: "Wrap" },
                  { value: "off", label: "Single line" },
                ]}
                onCommit={(v) =>
                  patchAll({ wrapLabel: v === "inherit" ? undefined : v === "on" })
                }
              />
              <BulkSelect
                label="Adapter visibility"
                hint="Only affects devices of type “adapter”."
                shared={adapterVisShared}
                options={[
                  { value: "default", label: "Default" },
                  { value: "force-show", label: "Always show" },
                  { value: "force-hide", label: "Always hide" },
                ]}
                onCommit={(v) =>
                  patchAll({
                    adapterVisibility:
                      v === "default" ? undefined : (v as DeviceData["adapterVisibility"]),
                  })
                }
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Heading({ children, mixed }: { children: React.ReactNode; mixed?: boolean }) {
  return (
    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">
      {children}
      {mixed && <span className="ml-1 normal-case">(mixed)</span>}
    </div>
  );
}

/** Text/number input over a multi-selection. Pre-filled when the devices agree; blank with
 *  a "(mixed)" hint when they don't. Commits on Enter/blur, and only once actually typed in —
 *  so opening the panel and clicking around never overwrites anything. */
function BulkField({
  label,
  placeholder,
  shared,
  onCommit,
  numeric,
  multiline,
}: {
  label: string;
  placeholder: string;
  /** Shared value, or null when the selection disagrees. */
  shared: string | null;
  onCommit: (value: string | undefined) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  const [value, setValue] = useState(shared ?? "");
  const [dirty, setDirty] = useState(false);

  // Re-sync when the underlying value changes — a different selection, an undo, or our own
  // applied patch. Adjusted during render rather than in an effect so committing with Enter
  // doesn't remount the input and steal focus mid-edit.
  const [prevShared, setPrevShared] = useState(shared);
  if (prevShared !== shared) {
    setPrevShared(shared);
    setValue(shared ?? "");
    setDirty(false);
  }

  const commit = () => {
    if (!dirty) return;
    const t = value.trim();
    onCommit(t || undefined);
    setDirty(false);
  };

  const cls =
    "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs outline-none focus:border-blue-500";
  const common = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(e.target.value);
      setDirty(true);
    },
    onBlur: commit,
    placeholder: shared === null ? "(mixed — type to overwrite)" : placeholder,
    className: cls,
  };

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
        {label}
        {shared === null && <span className="ml-1 normal-case">(mixed)</span>}
      </label>
      {multiline ? (
        <textarea
          {...common}
          rows={2}
          onKeyDown={(e) => e.stopPropagation()}
          className={`${cls} resize-y`}
        />
      ) : (
        <input
          {...common}
          type={numeric ? "number" : "text"}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commit();
          }}
        />
      )}
    </div>
  );
}

function BulkSelect({
  label,
  shared,
  options,
  onCommit,
  hint,
}: {
  label: string;
  /** Shared value, or null when the selection disagrees. */
  shared: string | null;
  options: { value: string; label: string }[];
  onCommit: (value: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
        {label}
        {shared === null && <span className="ml-1 normal-case">(mixed)</span>}
      </label>
      <select
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-blue-500 cursor-pointer"
        value={shared ?? "__mixed__"}
        onChange={(e) => {
          if (e.target.value === "__mixed__") return;
          onCommit(e.target.value);
        }}
      >
        {shared === null && <option value="__mixed__">— mixed —</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <p className="text-[10px] text-[var(--color-text-muted)] leading-tight mt-0.5">{hint}</p>
      )}
    </div>
  );
}

function ColorRow({
  label,
  shared,
  fallback,
  onPick,
  onReset,
  canReset,
}: {
  label: string;
  shared: string | null;
  fallback: string;
  onPick: (hex: string) => void;
  onReset: () => void;
  canReset: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] w-12">
        {label}
      </span>
      <input
        type="color"
        value={shared || fallback}
        onChange={(e) => onPick(e.target.value)}
        className="w-8 h-7 cursor-pointer border border-[var(--color-border)] rounded p-0.5 bg-white"
        title={shared ? shared : "Mixed or unset — pick to apply to all"}
      />
      <span className="flex-1 text-[11px] text-[var(--color-text-muted)] truncate">
        {shared === null ? "mixed" : shared || "default"}
      </span>
      <button
        onClick={onReset}
        disabled={!canReset}
        className="px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-red-600 border border-[var(--color-border)] rounded hover:border-red-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        title="Reset to template/default color"
      >
        Reset
      </button>
    </div>
  );
}

function Toggle({
  label,
  state,
  onToggle,
}: {
  label: string;
  state: { allOn: boolean; mixed: boolean };
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={state.allOn}
        ref={(el) => {
          if (el) el.indeterminate = state.mixed;
        }}
        onChange={onToggle}
        className="cursor-pointer"
      />
      <span className="text-xs text-[var(--color-text)]">
        {label}
        {state.mixed && (
          <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">(mixed)</span>
        )}
      </span>
    </label>
  );
}
