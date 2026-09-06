import type { CSSProperties } from "react";
import { SYMBOL_INK, glyphColorOn, symbolGlyphOffset, symbolGlyphScale, symbolOutlineColor, symbolOutlineWidth, symbolPrimitives } from "../floorplan";
import type { FloorplanSymbolGroup } from "../types";

interface Props {
  group: Pick<FloorplanSymbolGroup, "shape" | "color" | "glyph" | "symbolImageSrc" | "outlineColor" | "outlineWidthMm">;
  /** Side of the symbol square in CSS px. */
  sizePx: number;
  /** Clockwise rotation of the picture about its center, in degrees. The glyph stays
   *  upright so a number never reads upside down. */
  rotationDeg?: number;
  /** Transparent margin around the symbol, so outlines are not clipped in small chips. */
  paddingPx?: number;
  /** What the page draws symbols at on paper, so an outline given in mm scales to whatever
   *  size this instance is drawn at (sheet, legend row, sidebar chip). */
  symbolSizeMm?: number;
  className?: string;
  style?: CSSProperties;
}

/** One floorplan symbol as SVG — an uploaded picture, or the shape (abstract or pictogram)
 *  plus the optional glyph inside. Shared by the sheet, the sidebar chips and the on-screen
 *  legend so they never drift apart; the PDF walks the same primitives in floorplanPdf.ts. */
export default function FloorplanSymbolSvg({ group, sizePx, rotationDeg = 0, paddingPx = 0, symbolSizeMm, className, style }: Props) {
  const half = sizePx / 2;
  const contrast = glyphColorOn(group.color);
  const outlineW = symbolOutlineWidth(group, sizePx, symbolSizeMm);
  const outline = outlineW > 0 ? Math.max(0.4, outlineW) : 0;
  const outlineColor = symbolOutlineColor(group);
  const detail = Math.max(0.6, sizePx * 0.07);
  const glyph = group.glyph?.trim().slice(0, 2);
  const glyphAt = symbolGlyphOffset(group.shape, sizePx);
  const total = sizePx + paddingPx * 2;

  // An uploaded picture is the symbol: it replaces shape, color and glyph.
  const picture = group.symbolImageSrc ? (
    <image href={group.symbolImageSrc} x={0} y={0} width={sizePx} height={sizePx} preserveAspectRatio="xMidYMid meet" />
  ) : (
    symbolPrimitives(group.shape, sizePx).map((p, i) => {
      if (p.kind === "line") {
        return <line key={i} x1={p.from.x + half} y1={p.from.y + half} x2={p.to.x + half} y2={p.to.y + half} stroke={SYMBOL_INK} strokeWidth={detail} strokeLinecap="round" />;
      }
      // Body in the group color under a soft dark outline; every detail (lens, diagonals,
      // screen face) is inked so it reads on white paper as well as on the colored body.
      const fill = p.fill === "color" ? group.color : p.fill === "contrast" ? contrast : "none";
      const stroke = p.fill === "color" ? (outline > 0 ? outlineColor : "none") : SYMBOL_INK;
      const strokeWidth = p.fill === "color" ? outline : detail * 0.7;
      if (p.kind === "circle") {
        return <circle key={i} cx={p.center.x + half} cy={p.center.y + half} r={p.r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
      }
      return (
        <polygon
          key={i}
          points={p.points.map((q) => `${q.x + half},${q.y + half}`).join(" ")}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      );
    })
  );

  return (
    <svg
      width={total}
      height={total}
      viewBox={`${-paddingPx} ${-paddingPx} ${total} ${total}`}
      className={className}
      style={{ display: "block", overflow: "visible", ...style }}
    >
      <g transform={rotationDeg ? `rotate(${rotationDeg} ${half} ${half})` : undefined}>{picture}</g>
      {glyph && !group.symbolImageSrc && (
        <text
          x={half + glyphAt.x}
          y={half + glyphAt.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={sizePx * symbolGlyphScale(group.shape, glyph)}
          fontWeight={700}
          fill={contrast}
          style={{ pointerEvents: "none" }}
        >
          {glyph}
        </text>
      )}
    </svg>
  );
}
