import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { HIDDEN_SENTINEL, isHidden, type AppView } from "../lib/apps";

export type { AppView };

export function useAppIndex(): {
  byId: Map<string, AppView>;
  all: AppView[];
  visible: AppView[];
  hiddenIds: string[];
} {
  const apps = useStore((s) => s.apps);
  const overrides = useStore((s) => s.persist.appOverrides);
  const dockIds = useStore((s) => s.persist.dock.appIds);

  return useMemo(() => {
    const byId = new Map<string, AppView>();
    const all: AppView[] = [];
    const hiddenIds: string[] = [];
    for (const app of apps) {
      const o = overrides[app.id];
      const view: AppView = {
        app,
        name: o?.displayName && o.displayName !== HIDDEN_SENTINEL ? o.displayName : app.displayName || app.name,
        categories: o?.categories ?? [],
        isFavorite: Boolean(o?.isFavorite),
        inDock: dockIds.includes(app.id),
        iconDataUrl: o?.iconDataUrl ?? null,
        broken: !app.targetExists,
        orderOf: (categoryId: string) => o?.order?.[categoryId],
      };
      if (isHidden(app.id, o)) hiddenIds.push(app.id);
      byId.set(app.id, view);
      all.push(view);
    }
    return {
      byId,
      all,
      visible: all.filter((v) => !hiddenIds.includes(v.app.id)),
      hiddenIds,
    };
  }, [apps, overrides, dockIds]);
}

/** Resolve a stored position; -1 means anchored to the right / bottom edge. */
export function resolvePosition(
  pos: { x: number; y: number },
  w: number,
  h: number,
  viewport?: { w: number; h: number },
  pad = 8,
): { x: number; y: number } {
  // `pad` only relaxes the top/left clamp; the right/bottom edges always keep
  // the standard 8px margin so panels cannot be dragged off-screen. Stored
  // values already respect that margin, so a reload restores them exactly.
  const vw = viewport?.w ?? window.innerWidth;
  const vh = viewport?.h ?? window.innerHeight;
  const x = pos.x < 0 ? vw - w - 28 : pos.x;
  const y = pos.y < 0 ? vh - h + pos.y + 1 + 28 : pos.y;
  return {
    x: Math.max(pad, Math.min(x, Math.max(pad, vw - w - 8))),
    y: Math.max(pad, Math.min(y, Math.max(pad, vh - h - 8))),
  };
}

export function clampPosition(x: number, y: number, w: number, h: number, pad = 8) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.min(Math.max(pad, x), Math.max(pad, vw - w - pad)),
    y: Math.min(Math.max(pad, y), Math.max(pad, vh - h - pad)),
  };
}

export function useViewportSize(): { w: number; h: number } {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSize({ w: window.innerWidth, h: window.innerHeight }));
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return size;
}
