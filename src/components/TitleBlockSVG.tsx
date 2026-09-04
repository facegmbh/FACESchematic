import type { TitleBlock, TitleBlockLayout } from "../types";
import { computeCellRects, normalizeSizes, getFieldValue } from "../titleBlockLayout";

const SCREEN_PPI = 96;
const PT_TO_PX = SCREEN_PPI / 72;

/**
 * The project title block, drawn as SVG at an explicit pixel size.
 *
 * Shared by every sheet-style page (print sheets, floorplans) so the on-screen block
 * and the one `printSheetPdf`/`floorplanPdf` draw stay the same layout.
 */
interface TitleBlockSVGProps {
  tb: TitleBlock;
  layout: TitleBlockLayout;
  pageNum: number;
  totalPages: number;
  widthPx: number;
  heightPx: number;
}

export default function TitleBlockSVG({ tb, layout, pageNum, totalPages, widthPx, heightPx }: TitleBlockSVGProps) {
  const cellRects = computeCellRects(layout);
  const normCols = normalizeSizes(layout.columns);
  const normRows = normalizeSizes(layout.rows);

  const colStarts: number[] = [0];
  for (const v of normCols) colStarts.push(colStarts[colStarts.length - 1] + v);
  const rowStarts: number[] = [0];
  for (const v of normRows) rowStarts.push(rowStarts[rowStarts.length - 1] + v);

  // Build skip sets (merged cells don't get interior lines)
  const skipHLines = new Set<string>();
  const skipVLines = new Set<string>();
  for (const cell of layout.cells) {
    for (let r = cell.row + 1; r < cell.row + cell.rowSpan; r++)
      for (let c = cell.col; c < cell.col + cell.colSpan; c++)
        skipHLines.add(`${r},${c}`);
    for (let c = cell.col + 1; c < cell.col + cell.colSpan; c++)
      for (let r = cell.row; r < cell.row + cell.rowSpan; r++)
        skipVLines.add(`${c},${r}`);
  }

  // Horizontal grid lines
  const hLines: React.ReactElement[] = [];
  for (let ri = 1; ri < layout.rows.length; ri++) {
    const y = rowStarts[ri] * heightPx;
    let seg: number | null = null;
    for (let c = 0; c <= layout.columns.length; c++) {
      const done = c === layout.columns.length || skipHLines.has(`${ri},${c}`);
      if (done) {
        if (seg !== null) {
          hLines.push(<line key={`h${ri}-${seg}-${c}`} x1={colStarts[seg] * widthPx} y1={y} x2={(colStarts[c] ?? 1) * widthPx} y2={y} stroke="#646464" strokeWidth={0.5} />);
          seg = null;
        }
      } else if (seg === null) { seg = c; }
    }
  }

  // Vertical grid lines
  const vLines: React.ReactElement[] = [];
  for (let ci = 1; ci < layout.columns.length; ci++) {
    const x = colStarts[ci] * widthPx;
    let seg: number | null = null;
    for (let r = 0; r <= layout.rows.length; r++) {
      const done = r === layout.rows.length || skipVLines.has(`${ci},${r}`);
      if (done) {
        if (seg !== null) {
          vLines.push(<line key={`v${ci}-${seg}-${r}`} x1={x} y1={rowStarts[seg] * heightPx} x2={x} y2={(rowStarts[r] ?? 1) * heightPx} stroke="#646464" strokeWidth={0.5} />);
          seg = null;
        }
      } else if (seg === null) { seg = r; }
    }
  }

  const pad = 3;
  return (
    <svg width={widthPx} height={heightPx} style={{ display: "block", overflow: "visible" }}>
      <rect x={0} y={0} width={widthPx} height={heightPx} fill="white" stroke="#646464" strokeWidth={0.75} />
      {hLines}
      {vLines}
      {layout.cells.map((cell) => {
        const rect = cellRects.get(cell.id);
        if (!rect) return null;
        const cX = rect.x * widthPx;
        const cY = rect.y * heightPx;
        const cW = rect.w * widthPx;
        const cH = rect.h * heightPx;

        if (cell.content.type === "logo") {
          if (!tb.logo) return null;
          return <image key={cell.id} href={tb.logo} x={cX + 2} y={cY + 2} width={cW - 4} height={cH - 4} preserveAspectRatio="xMidYMid meet" />;
        }

        let text: string;
        if (cell.content.type === "field") {
          text = getFieldValue(tb, cell.content.field);
          if (!text) return null;
        } else if (cell.content.type === "static") {
          text = cell.content.text;
        } else {
          text = `Page ${pageNum} / ${totalPages}`;
        }

        const fsPx = cell.fontSize * PT_TO_PX;
        let textX: number;
        let anchor: "start" | "middle" | "end";
        if (cell.align === "center") { textX = cX + cW / 2; anchor = "middle"; }
        else if (cell.align === "right") { textX = cX + cW - pad; anchor = "end"; }
        else { textX = cX + pad; anchor = "start"; }

        return (
          <text
            key={cell.id}
            x={textX}
            y={cY + cH / 2}
            textAnchor={anchor}
            dominantBaseline="central"
            fontSize={fsPx}
            fontWeight={cell.fontWeight}
            fill={cell.color}
          >
            {text}
          </text>
        );
      })}
    </svg>
  );
}
