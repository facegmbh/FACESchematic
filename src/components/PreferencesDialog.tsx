import { useRef, useState } from "react";
import { useSchematicStore } from "../store";
import { importLegendImage } from "../floorplanUnderlay";
import type { CompanyProfile } from "../types";
import { DEFAULT_SCROLL_CONFIG, DEFAULT_STUB_LABEL_SHOW_PORT, DEFAULT_STUB_LABEL_PAGE_MODE, PROJECT_STATUS_LABELS } from "../types";
import type { LabelCaseMode, PanMode, ProjectStatus, ScrollAction, ScrollConfig, StubLabelPageMode } from "../types";
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
  const stubLabelShowPort = useSchematicStore((s) => s.stubLabelShowPort);
  const setStubLabelShowPort = useSchematicStore((s) => s.setStubLabelShowPort);
  const stubLabelShowRoom = useSchematicStore((s) => s.stubLabelShowRoom);
  const setStubLabelShowRoom = useSchematicStore((s) => s.setStubLabelShowRoom);
  const stubLabelPageMode = useSchematicStore((s) => s.stubLabelPageMode);
  const setStubLabelPageMode = useSchematicStore((s) => s.setStubLabelPageMode);
  const useShortNames = useSchematicStore((s) => s.useShortNames);
  const setUseShortNames = useSchematicStore((s) => s.setUseShortNames);
  const wrapDeviceLabels = useSchematicStore((s) => s.wrapDeviceLabels);
  const setWrapDeviceLabels = useSchematicStore((s) => s.setWrapDeviceLabels);
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
    stubLabelShowPort === DEFAULT_STUB_LABEL_SHOW_PORT &&
    stubLabelPageMode === DEFAULT_STUB_LABEL_PAGE_MODE;

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
                  {t("Display style for device, port, slot, and card labels on the canvas and in exports. Doesn't modify your data — switch back to As-typed any time to see original casing.")}
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

              {/* Stub labels */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t("Stub labels")}
                </div>
                <div className="flex items-center justify-between py-1">
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
                  {t("Adds the destination room (e.g.")} <code className="text-[10px]">(Server Room)</code>{t(") after the device name on stubbed connections. Per-stub overrides via right-click on the label.")}
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
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{mcpStatusDetail}</p>
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
                setStubLabelShowPort(DEFAULT_STUB_LABEL_SHOW_PORT);
                setStubLabelPageMode(DEFAULT_STUB_LABEL_PAGE_MODE);
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
