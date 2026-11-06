import { useEffect, useRef } from "react";

export interface DragConfig {
  /** Element whose box is moved and clamped. */
  getPanel: () => HTMLElement | null;
  /** Persist final px coordinates. */
  onEnd?: (x: number, y: number) => void;
  /** Called with live px while dragging (optional). */
  onMove?: (x: number, y: number) => void;
  disabled?: boolean;
  threshold?: number;
  /**
   * Elements that may start the drag. Defaults to "[data-drag-handle]" — the
   * `;;;` grip zone. The whole registered element is only a fallback for
   * components with no visual grip worth holding (e.g. the tiny settings orb).
   */
  handleSelector?: string;
  /**
   * Magnetic snapping. Receives the clamped visual position and the panel
   * size; returns the snapped position plus guide-line coordinates (viewport
   * px). Guides are broadcast as `mantle:snap` events for the overlay.
   */
  snap?: (x: number, y: number, w: number, h: number) => { x: number; y: number; v?: number; h?: number };
}

/**
 * Pointer-drag for floating elements with pointer capture. By default a drag
 * only starts from inside the `;;;` grip zone (`[data-drag-handle]`) so the
 * rest of the component — titles, text, dock icons, the clock face — can be
 * selected, clicked and hovered without moving the panel. Pass a different
 * `handleSelector` (or the element itself when no grip exists) to opt out.
 * Capture retargets native events (incl. click) to the grip, so keep only
 * decorative content inside it.
 * With `threshold`, a stationary press dispatches `floating:tap` on the panel.
 */
export function usePanelDrag(ref: React.RefObject<HTMLElement | null>, cfg: DragConfig) {
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let state: { startX: number; startY: number; panelX: number; panelY: number; kX: number; kY: number; moved: boolean } | null = null;

    // Once a drag has started it always runs to completion, even if the panel
    // re-renders, re-mounts its body or the caller's config changes mid-gesture.
    const panelFor = (live: boolean) => {
      const panel = cfgRef.current.getPanel();
      if (!panel) return null;
      if (!live) return panel;
      if (panel.dataset.floatingLocked === "true" || cfgRef.current.disabled) return null;
      return panel;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // The press must land inside THIS component, and (unless the whole
      // element is the handle, e.g. the settings orb) on its `;;;` grip zone.
      // Without the containment check every grip on the page would match every
      // registered drag listener and move all floating elements together.
      if (!el.contains(e.target as Node)) return;
      // Default: only the `;;;` grip starts a drag. `handleSelector: ""`
      // (settings orb) makes the whole registered element the drag zone.
      const handleSel = cfgRef.current.handleSelector ?? "[data-drag-handle]";
      if (handleSel && !(e.target as Element).closest?.(handleSel)) return;
      // Interactive children inside a drag handle keep their own clicks:
      // never start a drag when the press lands on a button/input.
      const target = e.target as Element | null;
      if (target?.closest?.("button, a, input, select, textarea, [role='button'], [data-no-drag]")) return;
      const panel = panelFor(true);
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      // The rect is the visual position, but style.left/top are layout values:
      // they diverge when the panel sits inside a positioned wrapper or a
      // transformed ancestor (the neighbour nudge). kX/kY convert the desired
      // visual coordinate into the style value to write.
      const cs = getComputedStyle(panel);
      const kX = rect.left - (parseFloat(cs.left) || 0);
      const kY = rect.top - (parseFloat(cs.top) || 0);
      state = { startX: e.clientX, startY: e.clientY, panelX: rect.left, panelY: rect.top, kX, kY, moved: false };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is an optimisation; window listeners carry the gesture */
      }
      document.body.classList.add("is-dragging");
    };

    const onMove = (e: PointerEvent) => {
      if (!state) return;
      const panel = panelFor(false);
      if (!panel) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (!state.moved && Math.hypot(dx, dy) < (cfgRef.current.threshold ?? 3)) return;
      state.moved = true;
      e.preventDefault();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let nx = Math.max(4, Math.min(state.panelX + dx, vw - panel.offsetWidth - 4));
      let ny = Math.max(4, Math.min(state.panelY + dy, vh - panel.offsetHeight - 4));
      const snap = cfgRef.current.snap;
      let guides: { v?: number; h?: number } = {};
      if (snap) {
        const s = snap(nx, ny, panel.offsetWidth, panel.offsetHeight);
        nx = s.x;
        ny = s.y;
        guides = { v: s.v, h: s.h };
      }
      window.dispatchEvent(new CustomEvent("mantle:snap", { detail: guides }));
      panel.style.left = `${nx - state.kX}px`;
      panel.style.top = `${ny - state.kY}px`;
      cfgRef.current.onMove?.(nx, ny);
    };

    const finish = (e: PointerEvent, cancelled: boolean) => {
      if (!state) return;
      const s = state;
      state = null;
      document.body.classList.remove("is-dragging");
      window.dispatchEvent(new CustomEvent("mantle:snap", { detail: {} }));
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      const panel = panelFor(false);
      if (!panel) return;
      if (!s.moved) {
        panel.dispatchEvent(new CustomEvent("floating:tap", { bubbles: true }));
        return;
      }
      if (cancelled) {
        panel.style.left = `${s.panelX - s.kX}px`;
        panel.style.top = `${s.panelY - s.kY}px`;
        return;
      }
      const rect = panel.getBoundingClientRect();
      panel.dispatchEvent(
        new CustomEvent("floating:dragend", { detail: { x: rect.left, y: rect.top } }),
      );
      cfgRef.current.onEnd?.(Math.round(rect.left), Math.round(rect.top));
    };

    const onUp = (e: PointerEvent) => finish(e, false);
    const onCancel = (e: PointerEvent) => finish(e, true);

    window.addEventListener("pointerdown", onDown, true);
    // Move/up live on window with capture: pointer capture on the handle can be
    // lost (element remount, focus change), and then React would also close the
    // panel on the stray click. This keeps the gesture alive regardless.
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
    };
  }, [ref]);
}
