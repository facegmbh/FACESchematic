import type { DrawingBlockLayout, DrawingBlockSection } from "../floorplan";
import {
  DB_DISCLAIMER_FONT_MM,
  DB_FIELD_LABEL_FONT_MM,
  DB_FIELD_VALUE_FONT_MM,
  DB_PAD_MM,
  DB_REV_COLS,
  DB_REV_FONT_MM,
  DB_REV_ROW_MM,
  DB_SUBTITLE_FONT_MM,
  DB_TITLE_FONT_MM,
} from "../floorplan";
import type { FloorplanDrawingBlock } from "../types";

interface Props {
  block: FloorplanDrawingBlock;
  layout: DrawingBlockLayout;
  /** Paper mm → CSS px at the sheet's zoom-independent scale. */
  mmToPx: (mm: number) => number;
  logoSrc?: string;
}

/** North arrow: a filled half, an outline half, and the "N". Rotation is applied by the caller. */
export function NorthArrow({ sizePx }: { sizePx: number }) {
  const c = sizePx / 2;
  const tip = sizePx * 0.06;
  const base = sizePx * 0.86;
  return (
    <svg width={sizePx} height={sizePx} viewBox={`0 0 ${sizePx} ${sizePx}`} style={{ display: "block", overflow: "visible" }}>
      <circle cx={c} cy={c} r={c - 1} fill="none" stroke="#111" strokeWidth={Math.max(0.5, sizePx * 0.015)} />
      <polygon points={`${c},${tip} ${c},${base} ${c - sizePx * 0.13},${base}`} fill="#111" />
      <polygon points={`${c},${tip} ${c},${base} ${c + sizePx * 0.13},${base}`} fill="none" stroke="#111" strokeWidth={Math.max(0.5, sizePx * 0.015)} />
      <text x={c} y={sizePx * 0.98} textAnchor="middle" fontSize={sizePx * 0.16} fontWeight={700} fill="#111" dominantBaseline="ideographic">N</text>
    </svg>
  );
}

/**
 * On-screen rendering of the drawing block. Every box comes from `layoutDrawingBlock`,
 * so the PDF exporter — which walks the same layout — prints the identical block.
 */
export default function FloorplanDrawingBlockView({ block, layout, mmToPx, logoSrc }: Props) {
  const px = mmToPx;
  const section = (kind: DrawingBlockSection["kind"]) => layout.sections.find((s) => s.kind === kind);
  const rev = section("revisions");
  const disc = section("disclaimer");
  const title = section("title");
  const fields = section("fields");
  const footer = section("footer");
  const innerX = px(layout.innerXMm);
  const innerW = px(layout.innerWMm);

  return (
    <div
      className="relative bg-white"
      style={{ width: px(layout.widthMm), height: px(layout.heightMm), border: "0.72px solid #222", fontFamily: "Inter, system-ui, sans-serif", color: "#111" }}
    >
      {/* Revision table */}
      {rev && (
        <div className="absolute" style={{ left: innerX, top: px(rev.yMm + DB_PAD_MM / 2), width: innerW }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: px(DB_REV_FONT_MM), lineHeight: 1 }}>
            <thead>
              <tr>
                {block.revisionHeaders.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      width: `${DB_REV_COLS[i] * 100}%`,
                      height: px(DB_REV_ROW_MM),
                      border: "0.5px solid #555",
                      padding: `0 ${px(0.8)}px`,
                      textAlign: "left",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      fontSize: px(DB_REV_FONT_MM * 0.9),
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {layout.revisionRows.map((r, i) => (
                <tr key={i}>
                  {[r.index, r.date, r.description, r.author ?? "", r.checkedBy ?? ""].map((v, j) => (
                    <td
                      key={j}
                      style={{
                        height: px(DB_REV_ROW_MM),
                        border: "0.5px solid #555",
                        padding: `0 ${px(0.8)}px`,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 0,
                      }}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Disclaimer */}
      {disc && (
        <div
          className="absolute"
          style={{
            left: innerX, top: px(disc.yMm + DB_PAD_MM), width: innerW,
            fontSize: px(DB_DISCLAIMER_FONT_MM), lineHeight: 1.45, color: "#222",
            borderTop: rev ? "0.5px solid #555" : undefined, paddingTop: rev ? px(1) : 0,
          }}
        >
          {layout.disclaimerLines.map((l, i) => <div key={i} style={{ whiteSpace: "pre", height: px(DB_DISCLAIMER_FONT_MM * 1.45) }}>{l || " "}</div>)}
        </div>
      )}

      {/* Title band */}
      {title && (
        <div
          className="absolute flex flex-col items-center justify-center text-center"
          style={{ left: 0, top: px(title.yMm), width: "100%", height: px(title.heightMm), borderTop: title.yMm > 0 ? "0.72px solid #222" : undefined }}
        >
          <div style={{ fontSize: px(DB_TITLE_FONT_MM), fontWeight: 800, lineHeight: 1.1, letterSpacing: 0.5, whiteSpace: "nowrap", overflow: "hidden", maxWidth: innerW }}>{layout.title}</div>
          {layout.subtitle && <div style={{ fontSize: px(DB_SUBTITLE_FONT_MM), lineHeight: 1.3, marginTop: px(0.8), color: "#333", whiteSpace: "nowrap", overflow: "hidden", maxWidth: innerW }}>{layout.subtitle}</div>}
        </div>
      )}

      {/* Field grid */}
      {fields && (
        <div className="absolute" style={{ left: 0, top: px(fields.yMm), width: "100%", height: px(fields.heightMm), borderTop: "0.72px solid #222" }}>
          {layout.fieldCells.map((cell) => (
            <div
              key={cell.field.id}
              className="absolute"
              style={{
                left: px(cell.xMm), top: px(cell.yMm - fields.yMm), width: px(cell.wMm), height: px(cell.hMm),
                border: "0.5px solid #777", padding: `${px(0.6)}px ${px(1)}px`, boxSizing: "border-box", overflow: "hidden",
              }}
            >
              <div style={{ fontSize: px(DB_FIELD_LABEL_FONT_MM), lineHeight: 1.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "#444", whiteSpace: "nowrap" }}>{cell.label}</div>
              {cell.lines.map((l, i) => (
                <div key={i} style={{ fontSize: px(DB_FIELD_VALUE_FONT_MM), lineHeight: 1.4, whiteSpace: "pre", height: px(DB_FIELD_VALUE_FONT_MM * 1.4) }}>{l || " "}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Footer: logo + north arrow */}
      {footer && (
        <div className="absolute flex items-center justify-between" style={{ left: innerX, top: px(footer.yMm), width: innerW, height: px(footer.heightMm), borderTop: "0.72px solid #222" }}>
          <div style={{ height: px(footer.heightMm - 4), display: "flex", alignItems: "center" }}>
            {block.showLogo && logoSrc && <img src={logoSrc} alt="" style={{ height: px(footer.heightMm - 6), maxWidth: px(layout.innerWMm * 0.55), objectFit: "contain" }} />}
          </div>
          {block.showNorthArrow && (
            <div style={{ transform: `rotate(${block.northRotationDeg}deg)` }}>
              <NorthArrow sizePx={px(footer.heightMm - 5)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
