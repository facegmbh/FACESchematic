import type { SectionDrawing, SectionRole } from "../projection";

/** How each part of the section is drawn. Shared by the panel and the box on the sheet;
 *  the PDF export mirrors these in its own primitives. */
export const SECTION_STYLE: Record<SectionRole, { stroke: string; widthMm: number; fill?: string; fillOpacity?: number }> = {
  floor: { stroke: "#111111", widthMm: 0.35 },
  ceiling: { stroke: "#64748b", widthMm: 0.25 },
  beam: { stroke: "#0e7490", widthMm: 0.2, fill: "#0e7490", fillOpacity: 0.12 },
  picture: { stroke: "#111111", widthMm: 0.8 },
  projector: { stroke: "#111111", widthMm: 0.2, fill: "#334155", fillOpacity: 1 },
  person: { stroke: "#b45309", widthMm: 0.2, fill: "#f59e0b", fillOpacity: 0.55 },
  "in-picture": { stroke: "#d97706", widthMm: 1 },
};

/** The section, drawn `pxPerMm` large. Pure presentation of `sectionDrawing`. */
export default function ProjectionSectionSvg({ drawing, pxPerMm, label }: { drawing: SectionDrawing; pxPerMm: number; label?: string }) {
  const k = pxPerMm;
  return (
    <svg width={drawing.widthMm * k} height={drawing.heightMm * k} viewBox={`0 0 ${drawing.widthMm} ${drawing.heightMm}`} data-testid="projection-section">
      {drawing.items.map((item, i) => {
        const st = SECTION_STYLE[item.role];
        if (item.points.length === 2) {
          const [a, b] = item.points;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={st.stroke} strokeWidth={st.widthMm} strokeLinecap="butt" data-section-role={item.role} />;
        }
        return (
          <polygon
            key={i}
            points={item.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={st.fill ?? "none"}
            fillOpacity={st.fillOpacity}
            stroke={st.stroke}
            strokeWidth={st.widthMm}
            strokeLinejoin="round"
            data-section-role={item.role}
          />
        );
      })}
      {label && drawing.inPictureLabelMm && (
        <text
          x={drawing.inPictureLabelMm.x}
          y={drawing.inPictureLabelMm.y}
          fontSize={drawing.labelSizeMm}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#b45309"
          fontWeight={600}
        >
          {label}
        </text>
      )}
    </svg>
  );
}
