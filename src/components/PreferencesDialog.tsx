import { useEffect, useRef, useState } from "react";
import { useSchematicStore } from "../store";
import { importLegendImage } from "../floorplanUnderlay";
import { HEADER_COLOR_SWATCH_FALLBACK, resolveDefaultDeviceHeaderColor } from "../deviceHeaderColor";
import type { CompanyProfile } from "../types";
import { DEFAULT_SCROLL_CONFIG, DEFAULT_STUB_LABEL_SHOW_ARROW, DEFAULT_STUB_LABEL_SHOW_PORT, DEFAULT_STUB_LABEL_PAGE_MODE, DEFAULT_STUB_LABEL_MODE, DEFAULT_CONNECTION_TYPE, PROJECT_STATUS_LABELS } from "../types";
import type { DefaultConnectionType, LabelCaseMode, PanMode, ProjectStatus, ScrollAction, ScrollConfig, StubLabelMode, StubLabelPageMode } from "../types";
import { LOCALES, LOCALE_LABELS, setLocale, useLocale, useT, type Locale } from "../i18n";

const AUTOROUTE_PREF_KEY = "easyschematic-autoroute-pref";

/** English source strings — the i18n keys. Translated where they are rendered. */
const ACTION_LABELS: Record<ScrollAction, string> = {
  "zoom": "Zoom",
  "pan-x": "Pan left / right",
  "pan-y": "Pan up / down",
};

const ACTION_OPTIONS: ScrollAction[] = ["zoom", "pan-x", "pan-y"];

const selectClass =
  "bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none cursor-pointer w-[140px]";

function ScrollRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ScrollAction;
  onChange: (v: ScrollAction) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-[var(--color-text)]">{label}</span>
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value as ScrollAction)}
      >
        {ACTION_OPTIONS.map((a) => (
          <option key={a} value={a}>{t(ACTION_LABELS[a])}</option>
        ))}
      </select>
    </div>
  );
}

function SensitivityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-[var(--color-text)]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-[100px] accent-blue-600 cursor-pointer"
        />
        <span className="text-xs text-[var(--color-text-muted)] w-[32px] text-right">
          {value.toFixed(value % 1 === 0 ? 1 : 2)}x
        </span>
      </div>
    </div>
  );
}

/** How long the picker sits still before the chosen color is committed (#354). */
const COLOR_COMMIT_DELAY_MS = 250;

/** Header-color picker row (#354) — the same swatch + Reset pairing the device editor's
 *  header color picker uses, laid out as a preferences row. `undefined` = not set.
 *
 *  Dragging in the OS color wheel fires an event per frame, and committing the project
 *  override autosaves the whole document, so the swatch tracks the wheel from local state
 *  and only commits once the picker goes quiet, loses focus, or the row unmounts. */
function ColorRow({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  /** Swatch shown while nothing is set — the color that would apply anyway. */
  placeholder: string;
  onChange: (v: string | undefined) => void;
}) {
  const t = useT();
  // null = no uncommitted choice, so the swatch follows the setting itself.
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Read by the delayed commit and by the unmount cleanup, neither of which can see the
  // render they were scheduled from.
  const pending = useRef<{ draft: string | null; onChange: (v: string | undefined) => void }>({
    draft: null,
    onChange,
  });
  useEffect(() => {
    pending.current = { draft, onChange };
  });

  const commit = () => {
    clearTimeout(timer.current);
    const next = pending.current.draft;
    if (next === null) return;
    setDraft(null);
    pending.current.onChange(next);
  };

  // Closing the dialog mid-drag still keeps the color the user picked.
  useEffect(() => () => {
    clearTimeout(timer.current);
    const next = pending.current.draft;
    if (next !== null) pending.current.onChange(next);
  }, []);

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-[var(--color-text)]">{label}</span>
      <div className="flex items-center gap-2 w-[140px] justify-end">
        {(draft ?? value) ? (
          <button
            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
            onClick={() => {
              clearTimeout(timer.current);
              setDraft(null);
              onChange(undefined);
            }}
          >
            {t("Reset")}
          </button>
        ) : (
          <span className="text-[10px] text-[var(--color-text-muted)]">{t("Not set")}</span>
        )}
        <input
          type="color"
          className="w-6 h-6 rounded border border-[var(--color-border)] cursor-pointer p-0"
          value={draft ?? value ?? placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            clearTimeout(timer.current);
            timer.current = setTimeout(commit, COLOR_COMMIT_DELAY_MS);
          }}
          onBlur={commit}
        />
      </div>
    </div>
  );
}

type PrefTab = "canvas" | "display" | "company" | "ai";

/** English source strings — the i18n keys. Translated where they are rendered. */
const TAB_LABELS: Record<PrefTab, string> = {
  canvas: "Canvas",
  display: "Display",
  company: "Company",
  ai: "AI (Beta)",
};

/** English source strings — the i18n keys. Translated where they are rendered. */
const MCP_STATUS_LABELS: Record<string, string> = {
  off: "Off",
  connecting: "Connecting…",
  connected: "Connected",
  error: "Not connected",
};

export default function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const scrollConfig = useSchematicStore((s) => s.scrollConfig);
  const setScrollConfig = useSchematicStore((s) => s.setScrollConfig);
  const edgeHitboxSize = useSchematicStore((s) => s.edgeHitboxSize);
  const setEdgeHitboxSize = useSchematicStore((s) => s.setEdgeHitboxSize);
  const labelCase = useSchematicStore((s) => s.labelCase);
  const setLabelCase = useSchematicStore((s) => s.setLabelCase);
  const currency = useSchematicStore((s) => s.currency);
  const setCurrency = useSchematicStore((s) => s.setCurrency);
  const status = useSchematicStore((s) => s.status);
  const setProjectStatus = useSchematicStore((s) => s.setProjectStatus);
  const panMode = useSchematicStore((s) => s.panMode);
  const setPanMode = useSchematicStore((s) => s.setPanMode);
  const stubLabelShowArrow = useSchematicStore((s) => s.stubLabelShowArrow);
  const setStubLabelShowArrow = useSchematicStore((s) => s.setStubLabelShowArrow);
  const stubLabelShowPort = useSchematicStore((s) => s.stubLabelShowPort);
  const setStubLabelShowPort = useSchematicStore((s) => s.setStubLabelShowPort);
  const stubLabelShowRoom = useSchematicStore((s) => s.stubLabelShowRoom);
  const setStubLabelShowRoom = useSchematicStore((s) => s.setStubLabelShowRoom);
  const stubLabelPageMode = useSchematicStore((s) => s.stubLabelPageMode);
  const setStubLabelPageMode = useSchematicStore((s) => s.setStubLabelPageMode);
  const appStubLabelMode = useSchematicStore((s) => s.appDefaultStubLabelMode);
  const setAppStubLabelMode = useSchematicStore((s) => s.setAppDefaultStubLabelMode);
  const projectStubLabelMode = useSchematicStore((s) => s.defaultStubLabelMode);
  const setProjectStubLabelMode = useSchematicStore((s) => s.setDefaultStubLabelMode);
  const defaultConnectionType = useSchematicStore((s) => s.defaultConnectionType);
  const setDefaultConnectionType = useSchematicStore((s) => s.setDefaultConnectionType);
  const useShortNames = useSchematicStore((s) => s.useShortNames);
  const setUseShortNames = useSchematicStore((s) => s.setUseShortNames);
  const wrapDeviceLabels = useSchematicStore((s) => s.wrapDeviceLabels);
  const setWrapDeviceLabels = useSchematicStore((s) => s.setWrapDeviceLabels);
  const appHeaderColor = useSchematicStore((s) => s.appDefaultDeviceHeaderColor);
  const setAppHeaderColor = useSchematicStore((s) => s.setAppDefaultDeviceHeaderColor);
  const projectHeaderColor = useSchematicStore((s) => s.defaultDeviceHeaderColor);
  const setProjectHeaderColor = useSchematicStore((s) => s.setDefaultDeviceHeaderColor);
  const mcpEnabled = useSchematicStore((s) => s.mcpBridgeEnabled);
  const setMcpEnabled = useSchematicStore((s) => s.setMcpBridgeEnabled);
  const mcpToken = useSchematicStore((s) => s.mcpBridgeToken);
  const setMcpToken = useSchematicStore((s) => s.setMcpBridgeToken);
  const mcpPort = useSchematicStore((s) => s.mcpBridgePort);
  const setMcpPort = useSchematicStore((s) => s.setMcpBridgePort);
  const mcpStatus = useSchematicStore((s) => s.mcpBridgeStatus);
  const mcpStatusDetail = useSchematicStore((s) => s.mcpBridgeStatusDetail);
  const companyProfile = useSchematicStore((s) => s.companyProfile);
  const setCompanyProfile = useSchematicStore((s) => s.setCompanyProfile);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const patchCompany = (patch: Partial<CompanyProfile>) => setCompanyProfile({ ...companyProfile, ...patch });
  const [autoRoutePref, setAutoRoutePref] = useState(
    () => localStorage.getItem(AUTOROUTE_PREF_KEY) ?? "ask",
  );
  const [activeTab, setActiveTab] = useState<PrefTab>("canvas");

  const update = (patch: Partial<ScrollConfig>) =>
    setScrollConfig({ ...scrollConfig, ...patch });

  // Which of the two header-color settings a device placed right now would take (#354).
  const effectiveHeaderColor = resolveDefaultDeviceHeaderColor(projectHeaderColor, appHeaderColor);

  const isDefault =
    scrollConfig.scroll === DEFAULT_SCROLL_CONFIG.scroll &&
    scrollConfig.shiftScroll === DEFAULT_SCROLL_CONFIG.shiftScroll &&
    scrollConfig.ctrlScroll === DEFAULT_SCROLL_CONFIG.ctrlScroll &&
    scrollConfig.zoomSpeed === DEFAULT_SCROLL_CONFIG.zoomSpeed &&
    scrollConfig.panSpeed === DEFAULT_SCROLL_CONFIG.panSpeed &&
    scrollConfig.trackpadEnabled === DEFAULT_SCROLL_CONFIG.trackpadEnabled &&
    edgeHitboxSize === 10 &&
    autoRoutePref === "ask" &&
    labelCase === "as-typed" &&
    currency === "USD" &&
    panMode === "select-first" &&
    stubLabelShowArrow === DEFAULT_STUB_LABEL_SHOW_ARROW &&
    stubLabelShowPort === DEFAULT_STUB_LABEL_SHOW_PORT &&
    stubLabelPageMode === DEFAULT_STUB_LABEL_PAGE_MODE &&
    defaultConnectionType === DEFAULT_CONNECTION_TYPE &&
    // The per-project override is document data (like the project status), so it is not
    // part of "reset preferences" — only the app-level default header color is (#354).
    appHeaderColor === undefined &&
    // Same split for the default stub tag mode: only the app preference resets (#377).
    appStubLabelMode === DEFAULT_STUB_LABEL_MODE;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[var(--color-border)] rounded-lg shadow-2xl w-[420px] flex flex-col max-h-[calc(100vh-4rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] shrink-0">
          <span className="text-sm font-semibold text-[var(--color-text-heading)]">
            {t("Preferences")}
          </span>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-[var(--color-border)] px-5 shrink-0">
          {(Object.keys(TAB_LABELS) as PrefTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium -mb-px border-b-2 transition-colors cursor-pointer ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {t(TAB_LABELS[tab])}
            </button>
          ))}
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {activeTab === "canvas" && (
            <>
              {/* Navigation */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Navigation")}
                </div>
                <div className="space-y-0.5">
                  {/* Configurable row */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--color-text)]">{t("Left drag")}</span>
                    <select
                      className={selectClass}
                      value={panMode}
                      onChange={(e) => setPanMode(e.target.value as PanMode)}
                    >
                      <option value="select-first">{t("Selection box")}</option>
                      <option value="pan-first">{t("Pan canvas")}</option>
                    </select>
                  </div>
                  {/* Fixed / derived rows */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--color-text)]">{t("Shift + left drag")}</span>
                    <span className="text-xs text-[var(--color-text-muted)] w-[140px] text-right">
                      {panMode === "pan-first" ? t("Selection box") : t("Add to selection")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--color-text)]">{t("Middle drag")}</span>
                    <span className="text-xs text-[var(--color-text-muted)] w-[140px] text-right">{t("Pan canvas")}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--color-text)]">{t("Space + drag")}</span>
                    <span className="text-xs text-[var(--color-text-muted)] w-[140px] text-right">{t("Pan canvas")}</span>
                  </div>
                </div>
              </div>

              {/* Scroll Wheel */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Scroll Wheel")}
                </div>
                <div className="space-y-0.5">
                  <ScrollRow
                    label={t("Scroll")}
                    value={scrollConfig.scroll}
                    onChange={(v) => update({ scroll: v })}
                  />
                  <ScrollRow
                    label={t("Shift + Scroll")}
                    value={scrollConfig.shiftScroll}
                    onChange={(v) => update({ shiftScroll: v })}
                  />
                  <ScrollRow
                    label={t("Ctrl + Scroll")}
                    value={scrollConfig.ctrlScroll}
                    onChange={(v) => update({ ctrlScroll: v })}
                  />
                </div>
              </div>

              {/* Sensitivity */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Sensitivity")}
                </div>
                <div className="space-y-0.5">
                  <SensitivityRow
                    label={t("Zoom speed")}
                    value={scrollConfig.zoomSpeed}
                    onChange={(v) => update({ zoomSpeed: v })}
                  />
                  <SensitivityRow
                    label={t("Pan speed")}
                    value={scrollConfig.panSpeed}
                    onChange={(v) => update({ panSpeed: v })}
                  />
                </div>
              </div>

              {/* Trackpad */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Trackpad")}
                </div>
                <label className="flex items-center justify-between py-1 cursor-pointer">
                  <span className="text-xs text-[var(--color-text)]">{t("Auto-detect trackpad")}</span>
                  <input
                    type="checkbox"
                    checked={scrollConfig.trackpadEnabled}
                    onChange={(e) => update({ trackpadEnabled: e.target.checked })}
                    className="accent-blue-600 cursor-pointer"
                  />
                </label>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("When off, all scroll input uses the scroll wheel settings above")}
                </p>
              </div>

              {/* Edge Interaction */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Edge Interaction")}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--color-text)]">{t("Connection hitbox width")}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={4}
                      max={20}
                      step={2}
                      value={edgeHitboxSize}
                      onChange={(e) => setEdgeHitboxSize(Number(e.target.value))}
                      className="w-[100px] accent-blue-600 cursor-pointer"
                    />
                    <span className="text-xs text-[var(--color-text-muted)] w-[32px] text-right">
                      {edgeHitboxSize}px
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Smaller = easier to create new connections without selecting existing ones")}
                </p>
              </div>

              {/* New Connections */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("New Connections")}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--color-text)]">{t("Draw new connections as")}</span>
                  <select
                    className={selectClass}
                    value={defaultConnectionType}
                    onChange={(e) => setDefaultConnectionType(e.target.value as DefaultConnectionType)}
                  >
                    <option value="wire">{t("Wire")}</option>
                    <option value="stub">{t("Stub")}</option>
                  </select>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Stub creates each new connection already stubbed at both ends, the same as right-clicking it and choosing Stub Connection. Existing connections are left alone, and connections through an auto-inserted adapter stay wires.")}
                </p>
              </div>

              {/* Auto-Route */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Auto-Route")}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--color-text)]">{t("When disabling auto-route")}</span>
                  <select
                    className={selectClass}
                    value={autoRoutePref}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "ask") localStorage.removeItem(AUTOROUTE_PREF_KEY);
                      else localStorage.setItem(AUTOROUTE_PREF_KEY, v);
                      setAutoRoutePref(v);
                    }}
                  >
                    <option value="ask">{t("Ask me")}</option>
                    <option value="keep">{t("Always keep routes")}</option>
                    <option value="revert">{t("Always restore previous")}</option>
                  </select>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Choose whether to keep auto-routed paths or revert to your previous routing")}
                </p>
              </div>
            </>
          )}

          {activeTab === "display" && (
            <>
              {/* Language */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Language")}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--color-text)]">{t("Interface language")}</span>
                  <select
                    className={selectClass}
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as Locale)}
                  >
                    {LOCALES.map((l) => (
                      // Each language is named in its own language, never translated.
                      <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Applies to the whole editor and takes effect right away. Kept in this browser, so it survives a reload. Your own text — device names, room names, notes — is never translated.")}
                </p>
              </div>

              {/* Labels */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Labels")}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--color-text)]">{t("Display label case")}</span>
                  <select
                    className={selectClass}
                    value={labelCase}
                    onChange={(e) => setLabelCase(e.target.value as LabelCaseMode)}
                  >
                    <option value="as-typed">{t("As-typed")}</option>
                    <option value="uppercase">{t("UPPERCASE")}</option>
                    <option value="lowercase">{t("lowercase")}</option>
                    <option value="capitalize">{t("Capitalize Words")}</option>
                  </select>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Display style for device, port, room, slot, and card labels on the canvas and in exports. Doesn't modify your data — switch back to As-typed any time to see original casing.")}
                </p>
                <div className="flex items-center justify-between py-1 mt-2">
                  <span className="text-xs text-[var(--color-text)]">{t("Use short device names")}</span>
                  <input
                    type="checkbox"
                    checked={useShortNames}
                    onChange={(e) => setUseShortNames(e.target.checked)}
                    className="cursor-pointer accent-blue-600"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Render device labels using a more compact identifier when available — curated short name first, then model number, falling back to the full label. Per-device override available in the device editor.")}
                </p>
                <div className="flex items-center justify-between py-1 mt-2">
                  <span className="text-xs text-[var(--color-text)]">{t("Wrap device labels")}</span>
                  <input
                    type="checkbox"
                    checked={wrapDeviceLabels}
                    onChange={(e) => setWrapDeviceLabels(e.target.checked)}
                    className="cursor-pointer accent-blue-600"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Allow long device labels to wrap onto a second line on the schematic and rack views, instead of truncating with an ellipsis.")}
                </p>
              </div>

              {/* Device header color (#354) */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Device header color")}
                </div>
                <ColorRow
                  label={t("Default for new devices")}
                  value={appHeaderColor}
                  placeholder={HEADER_COLOR_SWATCH_FALLBACK}
                  onChange={setAppHeaderColor}
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Header bar color given to every device you place from here on, in this and every other project on this computer. Not set = the standard header color.")}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("This is the device's header color everywhere it is drawn, not just on the canvas: it also overrides the device's own color in the rack elevation, the rack SVG and PDF, the face plate editor, and the DXF export. Set it and every new device shares one color in those views instead of being colored by device type — leave it unset, or clear a device's header color in the device editor, to keep that color coding.")}
                </p>
                <div className="mt-2">
                  <ColorRow
                    label={t("This project only")}
                    value={projectHeaderColor}
                    placeholder={appHeaderColor ?? HEADER_COLOR_SWATCH_FALLBACK}
                    onChange={setProjectHeaderColor}
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Overrides the default above for this schematic, and is saved in the schematic file so it travels with it. Devices already on the canvas keep their own colors either way — change one from the device editor's header color picker.")}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {t("New devices here get")}
                  </span>
                  <span
                    className="w-4 h-4 shrink-0 rounded border border-[var(--color-border)]"
                    style={{ backgroundColor: effectiveHeaderColor ?? "var(--color-surface)" }}
                  />
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {effectiveHeaderColor
                      ? projectHeaderColor
                        ? t("{color} (this project)", { color: effectiveHeaderColor })
                        : t("{color} (app default)", { color: effectiveHeaderColor })
                      : t("the standard header color")}
                  </span>
                </div>
              </div>

              {/* Stub labels */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Stub labels")}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--color-text)]">{t("Show direction arrow on stub labels")}</span>
                  <input
                    type="checkbox"
                    checked={stubLabelShowArrow}
                    onChange={(e) => setStubLabelShowArrow(e.target.checked)}
                    className="cursor-pointer accent-blue-600"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Prefixes each stub label with an arrow pointing toward the far end (e.g.")} <code className="text-[10px]">→ Projector</code>{t("). Off by default — the destination name already says where the connection goes.")}
                </p>
                <div className="flex items-center justify-between py-1 mt-2">
                  <span className="text-xs text-[var(--color-text)]">{t("Show port name on stub labels")}</span>
                  <input
                    type="checkbox"
                    checked={stubLabelShowPort}
                    onChange={(e) => setStubLabelShowPort(e.target.checked)}
                    className="cursor-pointer accent-blue-600"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Adds the destination port (e.g.")} <code className="text-[10px]">[HDMI In 1]</code>{t(") after the device name on stubbed connections.")}
                </p>
                <div className="flex items-center justify-between py-1 mt-2">
                  <span className="text-xs text-[var(--color-text)]">{t("Show room name on stub labels")}</span>
                  <input
                    type="checkbox"
                    checked={stubLabelShowRoom}
                    onChange={(e) => setStubLabelShowRoom(e.target.checked)}
                    className="cursor-pointer accent-blue-600"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Adds the destination room (e.g.")} <code className="text-[10px]">(Server Room)</code>{t(") after the device name on stubbed connections, when the far device is in a different room. A tag between two devices in the same room leaves the room off unless you right-click it and set Show room to On.")}
                </p>
                <div className="flex items-center justify-between py-1 mt-2">
                  <span className="text-xs text-[var(--color-text)]">{t("Page number on stub labels")}</span>
                  <select
                    className={selectClass}
                    value={stubLabelPageMode}
                    onChange={(e) => setStubLabelPageMode(e.target.value as StubLabelPageMode)}
                  >
                    <option value="cross-page">{t("Cross-page only")}</option>
                    <option value="always">{t("Always")}</option>
                    <option value="never">{t("Never")}</option>
                  </select>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("When to display the destination page on stub labels. Cross-page only suppresses the tag when both ends are on the same printed page.")}
                </p>
                {/* Default stub tag mode (#377) — same app + project pair as the header color (#354) */}
                <div className="flex items-center justify-between py-1 mt-2">
                  <span className="text-xs text-[var(--color-text)]">{t("Tag text for new stubs")}</span>
                  <select
                    className={selectClass}
                    value={appStubLabelMode}
                    onChange={(e) => setAppStubLabelMode(e.target.value as StubLabelMode)}
                  >
                    <option value="full">{t("Destination")}</option>
                    <option value="cableId">{t("Cable ID only")}</option>
                  </select>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("What both tags of a connection show when you stub it, in this and every other project on this computer. Destination names the far device; Cable ID only shows just the cable ID.")}
                </p>
                <div className="flex items-center justify-between py-1 mt-2">
                  <span className="text-xs text-[var(--color-text)]">{t("This project only")}</span>
                  <select
                    className={selectClass}
                    value={projectStubLabelMode ?? ""}
                    onChange={(e) =>
                      setProjectStubLabelMode(e.target.value === "" ? undefined : (e.target.value as StubLabelMode))
                    }
                  >
                    <option value="">{t("Use default")}</option>
                    <option value="full">{t("Destination")}</option>
                    <option value="cableId">{t("Cable ID only")}</option>
                  </select>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Overrides the default above for this schematic, and is saved in the schematic file. Stub tags already on the canvas keep their tag text either way; right-click a tag to switch it, and its partner tag at the other end switches with it.")}
                </p>
              </div>

              {/* Project */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Project")}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--color-text)]">{t("Status")}</span>
                  <select
                    className={selectClass}
                    value={status ?? ""}
                    onChange={(e) =>
                      setProjectStatus(e.target.value === "" ? undefined : (e.target.value as ProjectStatus))
                    }
                  >
                    <option value="">{t("Active (default)")}</option>
                    {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((key) => (
                      <option key={key} value={key}>
                        {t(PROJECT_STATUS_LABELS[key])}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Lifecycle status for this project. Stored in the file and shown in project metadata.")}
                </p>
              </div>

              {/* Costs */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Costs")}
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--color-text)]">{t("Currency")}</span>
                  <select
                    className={selectClass}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="USD">{t("USD — US Dollar ($)")}</option>
                    <option value="GBP">{t("GBP — British Pound (£)")}</option>
                    <option value="EUR">{t("EUR — Euro (€)")}</option>
                    <option value="CAD">{t("CAD — Canadian Dollar (CA$)")}</option>
                    <option value="AUD">{t("AUD — Australian Dollar (A$)")}</option>
                    <option value="JPY">{t("JPY — Japanese Yen (¥)")}</option>
                    <option value="NZD">{t("NZD — New Zealand Dollar (NZ$)")}</option>
                    <option value="CHF">{t("CHF — Swiss Franc (CHF)")}</option>
                    <option value="SEK">{t("SEK — Swedish Krona (kr)")}</option>
                    <option value="NOK">{t("NOK — Norwegian Krone (kr)")}</option>
                    <option value="DKK">{t("DKK — Danish Krone (kr.)")}</option>
                    <option value="CNY">{t("CNY — Chinese Yuan (¥)")}</option>
                    <option value="INR">{t("INR — Indian Rupee (₹)")}</option>
                    <option value="AED">{t("AED — United Arab Emirates Dirham (د.إ)")}</option>
                  </select>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Symbol used for cost fields in reports. All entered costs are assumed to be in this currency — no conversion is applied.")}
                </p>
              </div>
            </>
          )}

          {activeTab === "company" && (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Planning company")}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
                  {t("Printed at the foot of every floorplan legend and used for the drawing block's logo and the")}{" "}
                  <code>{"{{companyName}}"}</code> / <code>{"{{companyAddress}}"}</code> / <code>{"{{companyContact}}"}</code>{" "}
                  {t("tokens. Saved in this browser and snapshotted into each project file.")}
                </p>
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-xs text-[var(--color-text)]">{t("Company name")}</span>
                    <input
                      className={`${selectClass} w-full mt-1`}
                      value={companyProfile.name}
                      onChange={(e) => patchCompany({ name: e.target.value })}
                      placeholder="FACE GmbH"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[var(--color-text)]">{t("Address (one line per row)")}</span>
                    <textarea
                      className={`${selectClass} w-full mt-1 resize-y`}
                      rows={3}
                      value={companyProfile.addressLines.join("\n")}
                      onChange={(e) => patchCompany({ addressLines: e.target.value.split("\n") })}
                      placeholder={"Musterstraße 1\n12345 Musterstadt"}
                    />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="text-xs text-[var(--color-text)]">{t("Phone")}</span>
                      <input className={`${selectClass} w-full mt-1`} value={companyProfile.phone ?? ""} onChange={(e) => patchCompany({ phone: e.target.value || undefined })} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-[var(--color-text)]">{t("E-mail")}</span>
                      <input className={`${selectClass} w-full mt-1`} value={companyProfile.email ?? ""} onChange={(e) => patchCompany({ email: e.target.value || undefined })} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-[var(--color-text)]">{t("Web")}</span>
                      <input className={`${selectClass} w-full mt-1`} value={companyProfile.web ?? ""} onChange={(e) => patchCompany({ web: e.target.value || undefined })} />
                    </label>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-28 h-14 border border-[var(--color-border)] rounded flex items-center justify-center bg-white overflow-hidden">
                      {companyProfile.logo ? (
                        <img src={companyProfile.logo} alt={t("Company logo")} className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-[var(--color-text-muted)]">{t("No logo")}</span>
                      )}
                    </div>
                    <input
                      ref={companyLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          patchCompany({ logo: await importLegendImage(file, 480) });
                        } catch (err) {
                          alert(err instanceof Error ? err.message : t("Could not load that image."));
                        }
                      }}
                    />
                    <button
                      onClick={() => companyLogoInputRef.current?.click()}
                      className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
                    >
                      {companyProfile.logo ? t("Replace logo…") : t("Upload logo…")}
                    </button>
                    {companyProfile.logo && (
                      <button
                        onClick={() => patchCompany({ logo: undefined })}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded cursor-pointer"
                      >
                        {t("Remove")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "ai" && (
            <>
              {/* AI Assistant (MCP) — Beta */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("AI Assistant (MCP) — Beta")}
                </div>
                <label className="flex items-center justify-between py-1 cursor-pointer">
                  <span className="text-xs text-[var(--color-text)]">{t("Let Claude read & edit this schematic")}</span>
                  <input
                    type="checkbox"
                    checked={mcpEnabled}
                    onChange={(e) => setMcpEnabled(e.target.checked)}
                    className="cursor-pointer accent-blue-600"
                  />
                </label>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Connects this tab to the EasySchematic MCP server running on your computer, so an AI assistant (Claude) can add devices, set properties, and make connections live. Off by default; your drawing is only reachable while this is on.")}
                </p>

                <div className="flex items-center justify-between py-1 mt-3">
                  <span className="text-xs text-[var(--color-text)]">{t("Pairing token")}</span>
                  <input
                    type="password"
                    value={mcpToken}
                    onChange={(e) => setMcpToken(e.target.value)}
                    placeholder={t("Paste from the server")}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none w-[180px]"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {t("Copy the token the MCP server prints on startup and paste it here. This stops other programs on your computer from reaching the bridge.")}
                </p>

                <div className="flex items-center justify-between py-1 mt-3">
                  <span className="text-xs text-[var(--color-text)]">{t("Server port")}</span>
                  <input
                    type="number"
                    value={mcpPort}
                    onChange={(e) => setMcpPort(Number(e.target.value) || mcpPort)}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none w-[100px]"
                  />
                </div>

                <div className="flex items-center justify-between py-1 mt-3">
                  <span className="text-xs text-[var(--color-text)]">{t("Status")}</span>
                  <span
                    className={`text-xs font-medium ${
                      mcpStatus === "connected"
                        ? "text-green-600"
                        : mcpStatus === "error"
                          ? "text-red-600"
                          : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {MCP_STATUS_LABELS[mcpStatus] ? t(MCP_STATUS_LABELS[mcpStatus]) : mcpStatus}
                  </span>
                </div>
                {mcpStatusDetail && (
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{t(mcpStatusDetail)}</p>
                )}
                <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                  {t("Setup help is in the docs under “AI Assistant (MCP)”. This is an early Beta — only a core set of actions is supported.")}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] shrink-0">
          {!isDefault ? (
            <button
              onClick={() => {
                setScrollConfig({ ...DEFAULT_SCROLL_CONFIG });
                setEdgeHitboxSize(10);
                localStorage.removeItem(AUTOROUTE_PREF_KEY);
                setAutoRoutePref("ask");
                setLabelCase("as-typed");
                setCurrency("USD");
                setPanMode("select-first");
                setStubLabelShowArrow(DEFAULT_STUB_LABEL_SHOW_ARROW);
                setStubLabelShowPort(DEFAULT_STUB_LABEL_SHOW_PORT);
                setStubLabelPageMode(DEFAULT_STUB_LABEL_PAGE_MODE);
                setDefaultConnectionType(DEFAULT_CONNECTION_TYPE);
                setAppHeaderColor(undefined);
                setAppStubLabelMode(DEFAULT_STUB_LABEL_MODE);
              }}
              className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
            >
              {t("Reset to defaults")}
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            {t("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
