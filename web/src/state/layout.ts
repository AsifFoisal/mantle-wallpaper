import { useEffect, useSyncExternalStore } from "react";

/** Breathing room left between a pushed panel and the one that shoved it. */
export const NUDGE_GAP = 14;

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Panels currently showing their body, keyed by category id. */
const expanded = new Map<string, Bounds>();
const listeners = new Set<() => void>();
let snapshot: [string, Bounds][] = [];

function publish() {
  snapshot = [...expanded.entries()];
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Registers a panel's on-screen box so neighbours to its right can dodge it. */
export function useExpandedBounds(id: string, bounds: Bounds, active: boolean) {
  useEffect(() => {
    setExpanded(id, active ? bounds : null);
  }, [id, active, bounds.x, bounds.y, bounds.w, bounds.h]);
}

export function useExpandedPanels(): [string, Bounds][] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function setExpanded(id: string, bounds: Bounds | null) {
  if (!bounds) {
    if (!expanded.delete(id)) return;
  } else {
    const prev = expanded.get(id);
    if (prev && prev.x === bounds.x && prev.y === bounds.y && prev.w === bounds.w && prev.h === bounds.h) return;
    expanded.set(id, bounds);
  }
  publish();
}

/**
 * Horizontal shift this panel needs so an expanded neighbour sitting to its
 * left does not cover it. Panels to the right slide away while a neighbour is
 * expanded and return to their stored position when it collapses.
 */
export function pushFor(self: Bounds, others: [string, Bounds][], selfId: string): number {
  let shift = 0;
  for (const [id, neighbour] of others) {
    if (id === selfId) continue;
    const neighbourRight = neighbour.x + neighbour.w;
    const sharesRow = self.y < neighbour.y + neighbour.h && self.y + self.h > neighbour.y;
    // Slide right until there is NUDGE_GAP between the neighbour and this panel
    // (or a touch more, so a small existing gap is kept rather than closed).
    const needed = Math.max(NUDGE_GAP, neighbourRight + NUDGE_GAP - self.x);
    if (!sharesRow) continue;
    if (neighbour.x >= self.x) continue;
    if (needed > shift) shift = needed;
  }
  return shift;
}
