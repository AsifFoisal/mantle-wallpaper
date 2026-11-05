import type { DetectedApp } from "../types";
import type { AppOverride } from "../types";

export interface AppView {
  app: DetectedApp;
  name: string;
  categories: string[];
  isFavorite: boolean;
  inDock: boolean;
  iconDataUrl: string | null;
  broken: boolean;
  /** Manual rank inside a collection, when the user has arranged one. */
  orderOf: (categoryId: string) => number | undefined;
}

/** displayName sentinel used to hide an app from the organizer. */
export const HIDDEN_SENTINEL = "\u0000hidden";

export function isHidden(_appId: string, o: AppOverride | undefined): boolean {
  return o?.displayName === HIDDEN_SENTINEL;
}

/**
 * Moves one id to a target slot. Pure so it can be unit-checked and reused by
 * the panel grid and the dock.
 */
export function reorderIds(ids: string[], movingId: string, targetId: string, position: "before" | "after"): string[] {
  const from = ids.indexOf(movingId);
  if (from < 0 || movingId === targetId) return ids;
  const rest = ids.filter((id) => id !== movingId);
  const at = rest.indexOf(targetId);
  if (at < 0) return ids;
  const slot = position === "after" ? at + 1 : at;
  rest.splice(slot, 0, movingId);
  return rest;
}

/**
 * Moves several ids to a drop slot in one pass, preserving their relative order.
 * Required for multi-select dragging: inserting one by one reverses the group.
 */
export function reorderGroup(ids: string[], movingIds: string[], targetId: string, position: "before" | "after"): string[] {
  const moving = new Set(movingIds.filter((id) => id !== targetId && ids.includes(id)));
  if (!moving.size || !ids.includes(targetId)) return ids;
  const kept = ids.filter((id) => !moving.has(id));
  const at = kept.indexOf(targetId);
  if (at < 0) return ids;
  const slot = position === "after" ? at + 1 : at;
  const group = ids.filter((id) => moving.has(id));
  kept.splice(slot, 0, ...group);
  return kept;
}
