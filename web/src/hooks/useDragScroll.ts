import { useEffect, type RefObject } from "react";

/**
 * Press-and-drag panning for scrollable containers, with flick momentum.
 *
 * Lively renders wallpapers in WebView2 and forwards mouse moves and clicks
 * reliably, but wheel events are never forwarded at all (upstream Lively bug
 * #3042, unfixed) — so a plain `overflow-y-auto` is unreachable there. Pressing
 * non-interactive content and dragging pans the container; a fast flick keeps
 * scrolling with inertia, like a trackpad. Middle-button drag pans even when
 * starting on an app tile, since tiles reserve the left button for drag-and-drop.
 *
 * Wheel scrolling keeps working wherever it is delivered (browser dev page).
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let state: { y: number; top: number; id: number; moved: boolean; middle: boolean } | null = null;
    let lastY = 0;
    let lastT = 0;
    let vel = 0; // px per ms, downward positive → applied as scrollTop -= vel * dt
    let raf = 0;

    const stopMomentum = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      vel = 0;
    };

    const glide = () => {
      raf = 0;
      if (Math.abs(vel) < 0.02) return;
      let prev = performance.now();
      const step = (now: number) => {
        const dt = Math.max(1, now - prev);
        prev = now;
        el.scrollTop -= vel * dt;
        vel *= Math.pow(0.94, dt / 16);
        const atEdge =
          (vel > 0 && el.scrollTop <= 0) ||
          (vel < 0 && el.scrollTop >= el.scrollHeight - el.clientHeight);
        if (Math.abs(vel) > 0.02 && !atEdge) raf = requestAnimationFrame(step);
        else raf = 0;
      };
      raf = requestAnimationFrame(step);
    };

    const onDown = (e: PointerEvent) => {
      stopMomentum();
      if (e.button !== 0 && e.button !== 1) return;
      const middle = e.button === 1;
      if (el.scrollHeight <= el.clientHeight) return;
      const target = e.target as Element | null;
      // Left press must not steal tiles (they drag-and-drop) or controls;
      // middle press only avoids native controls so autoscroll stays off.
      if (target?.closest?.("button, a, input, select, textarea, [role='button'], [data-no-drag]")) return;
      if (!middle && target?.closest?.("[data-app-tile]")) return;
      if (middle) e.preventDefault();
      state = { y: e.clientY, top: el.scrollTop, id: e.pointerId, moved: false, middle };
      lastY = e.clientY;
      lastT = performance.now();
      vel = 0;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is an optimisation; listeners carry the gesture */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!state) return;
      const dy = e.clientY - state.y;
      if (!state.moved && Math.abs(dy) < 4) return;
      state.moved = true;
      e.preventDefault();
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      // Smoothed velocity keeps the flick stable over pointer jitter.
      const instant = (lastY - e.clientY) / dt;
      vel = vel * 0.7 + instant * 0.3;
      lastY = e.clientY;
      lastT = now;
      el.scrollTop = state.top - dy;
    };
    const finish = (e: PointerEvent) => {
      if (!state) return;
      const wasMoved = state.moved;
      state = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (wasMoved && Math.abs(vel) > 0.08) glide();
      else vel = 0;
    };

    const onWheel = () => stopMomentum();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      stopMomentum();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", finish);
      el.removeEventListener("pointercancel", finish);
      el.removeEventListener("wheel", onWheel);
    };
  }, [ref]);
}
