/**
 * Positioning system for floating elements:
 * - preset placements (corners, edge centers, screen center) computed exactly
 *   from the viewport, so "top center" is pixel-perfect every time
 * - magnetic snapping while dragging, with alignment to viewport guides and
 *   to the edges/centers of every other floating element
 * - rigid group geometry: a group's bounding box is positioned as one body
 */

export type PresetId =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "center";

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: "top-left", label: "Top left corner" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right corner" },
  { id: "bottom-left", label: "Bottom left corner" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right corner" },
  { id: "center", label: "Center screen" },
];

/** Inset from the viewport edge for preset placements. */
export const SNAP_MARGIN = 24;

export function presetPosition(preset: PresetId, w: number, h: number, vw: number, vh: number): { x: number; y: number } {
  const m = SNAP_MARGIN;
  const clamp = (v: number, max: number) => Math.max(m, Math.min(v, Math.max(m, max)));
  let x: number;
  let y: number;
  switch (preset) {
    case "top-left":
      x = m;
      y = m;
      break;
    case "top-center":
      x = Math.round((vw - w) / 2);
      y = m;
      break;
    case "top-right":
      x = clamp(vw - w - m, vw - w - m);
      y = m;
      break;
    case "bottom-left":
      x = m;
      y = clamp(vh - h - m, vh - h - m);
      break;
    case "bottom-center":
      x = Math.round((vw - w) / 2);
      y = clamp(vh - h - m, vh - h - m);
      break;
    case "bottom-right":
      x = clamp(vw - w - m, vw - w - m);
      y = clamp(vh - h - m, vh - h - m);
      break;
    case "center":
      x = Math.round((vw - w) / 2);
      y = Math.round((vh - h) / 2);
      break;
  }
  return { x: Math.max(4, x), y: Math.max(4, y) };
}

export interface SnapTarget {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Snapshot of every floating element currently on screen (panels, dock,
 * clock, orb, settings, search) except the one being dragged.
 */
export function collectSnapTargets(exclude: Element | null): SnapTarget[] {
  const out: SnapTarget[] = [];
  const seen = new Set<Element>();
  for (const el of document.querySelectorAll("[data-floating-root]")) {
    if (el === exclude || seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return out;
}

export interface SnapResult {
  x: number;
  y: number;
  /** Guide-line viewport coordinate that matched (vertical / horizontal). */
  v?: number;
  h?: number;
}

/** Distance within which a snap engages. */
const SNAP_THRESHOLD = 10;

function best(
  candidates: { at: number; guide: number }[],
  value: number,
  limit: number,
): { at: number; guide: number } | null {
  let bestC: { at: number; guide: number } | null = null;
  let bestDist = limit;
  for (const c of candidates) {
    const d = Math.abs(c.at - value);
    if (d <= bestDist) {
      bestDist = d;
      bestC = c;
    }
  }
  return bestC;
}

/**
 * Magnetic snap: aligns the dragged box to viewport margins/centers and to
 * other elements' edges and centers. Returns the adjusted position and the
 * guide line to draw for the winning axis (closest axis wins per dimension).
 */
export function computeSnap(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
  targets: SnapTarget[],
): SnapResult {
  const m = SNAP_MARGIN;

  const xCands: { at: number; guide: number }[] = [
    { at: m, guide: m },
    { at: (vw - w) / 2, guide: vw / 2 },
    { at: vw - w - m, guide: vw - m },
    { at: m - w, guide: m },
  ];
  const yCands: { at: number; guide: number }[] = [
    { at: m, guide: m },
    { at: (vh - h) / 2, guide: vh / 2 },
    { at: vh - h - m, guide: vh - m },
    { at: m - h, guide: m },
  ];
  for (const t of targets) {
    const tcx = t.x + t.w / 2;
    const tcy = t.y + t.h / 2;
    // Our left edge ↔ their left / right / center
    xCands.push({ at: t.x, guide: t.x });
    xCands.push({ at: t.x + t.w, guide: t.x + t.w });
    xCands.push({ at: tcx - w / 2, guide: tcx });
    // Our right edge ↔ their edges / center
    xCands.push({ at: t.x - w, guide: t.x });
    xCands.push({ at: t.x + t.w - w, guide: t.x + t.w });
    xCands.push({ at: tcx - w, guide: tcx });
    // Our center ↔ their edges / center
    xCands.push({ at: t.x - w / 2, guide: t.x });
    xCands.push({ at: t.x + t.w - w / 2, guide: t.x + t.w });
    xCands.push({ at: tcx - w / 2, guide: tcx });
    // Same for vertical
    yCands.push({ at: t.y, guide: t.y });
    yCands.push({ at: t.y + t.h, guide: t.y + t.h });
    yCands.push({ at: tcy - h / 2, guide: tcy });
    yCands.push({ at: t.y - h, guide: t.y });
    yCands.push({ at: t.y + t.h - h, guide: t.y + t.h });
    yCands.push({ at: tcy - h, guide: tcy });
    yCands.push({ at: t.y - h / 2, guide: t.y });
    yCands.push({ at: t.y + t.h - h / 2, guide: t.y + t.h });
    yCands.push({ at: tcy - h / 2, guide: tcy });
  }

  const bx = best(xCands, x, SNAP_THRESHOLD);
  const by = best(yCands, y, SNAP_THRESHOLD);

  const maxX = Math.max(4, vw - w - 4);
  const maxY = Math.max(4, vh - h - 4);
  return {
    x: bx ? Math.max(4, Math.min(bx.at, maxX)) : x,
    y: by ? Math.max(4, Math.min(by.at, maxY)) : y,
    v: bx ? bx.guide : undefined,
    h: by ? by.guide : undefined,
  };
}

/** Union bounding box of several rects. */
export function boundingBox(rects: { x: number; y: number; w: number; h: number }[]): { x: number; y: number; w: number; h: number } {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
