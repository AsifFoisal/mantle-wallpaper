import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../state/store";
import { useViewportSize, resolvePosition } from "../../hooks/useAppIndex";
import { usePanelDrag } from "../floating/usePanelDrag";
import { DragGrip } from "../floating/DragGrip";
import { GLASS_CLASS } from "../floating/FloatingWindow";
import { AppIcon } from "../ui/AppIcon";
import { launchApp, isRunning } from "../../lib/launch";
import { mantleApi } from "../../api/mantle";
import type { WindowInfo } from "../../types";
import { isAppDrag, APP_MIME } from "../../lib/dnd";
import { LayoutGrid, Star } from "lucide-react";
import type { AppView } from "../../lib/apps";

const exeKey = (n?: string | null) => (n ? n.toLowerCase().replace(/\.exe$/, "") : null);

/** Honours the OS setting; re-evaluated on render so live changes apply. */
const prefersReducedMotion = () =>
  (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) ?? false;

/**
 * The quiet chrome: a slim rail of category glyphs (optional), the pinned dock,
 * and a small organizer entry. Everything else stays hidden until asked.
 */
export function Dock({
  onOrganizer,
  onFavorites,
}: {
  onOrganizer: () => void;
  onFavorites: () => void;
}) {
  const dock = useStore((s) => s.persist.dock);
  const updateDock = useStore((s) => s.updateDock);
  const running = useStore((s) => s.runningNames);
  const windows = useStore((s) => s.windows);
  const apps = useStore((s) => s.apps);
  const overrides = useStore((s) => s.persist.appOverrides);
  const lowResource = useStore((s) => s.persist.settings.lowResourceMode);
  const viewport = useViewportSize();
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dropSlot = useRef<number | null>(null);

  usePanelDrag(ref, {
    getPanel: () => ref.current,
    onEnd: (x, y) => updateDock({ x, y, anchored: false }),
    disabled: dock.locked || !dock.visible,
  });

  const vertical = dock.orientation === "vertical";

  // ── Magnetic hover ───────────────────────────────────────────────────────
  // Icons swell, lift and lean toward the cursor under a gaussian falloff
  // while a light sheen tracks the pointer across the glass. Everything is
  // direct style writes on rAF — the store never re-renders during a hover —
  // and the row springs back when the pointer leaves.
  const magnetic = dock.magnification && !lowResource && !prefersReducedMotion();

  const itemsRef = useRef<HTMLElement[]>([]);
  useEffect(() => {
    itemsRef.current = ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>("[data-dock-item]")) : [];
  });

  const magnet = useRef<{
    raf: number;
    rest: { el: HTMLElement; cx: number; cy: number; w: number; h: number }[];
    px: number;
    py: number;
  }>({ raf: 0, rest: [], px: 0, py: 0 });
  useEffect(() => () => {
    if (magnet.current.raf) cancelAnimationFrame(magnet.current.raf);
  }, []);

  const paintMagnet = () => {
    magnet.current.raf = 0;
    const { rest, px, py } = magnet.current;
    for (const it of rest) {
      const d = vertical ? py - it.cy : px - it.cx;
      const sigma = Math.max(16, it.w * 0.9);
      const t = Math.exp(-(d * d) / (2 * sigma * sigma));
      const ratio = Math.max(-1, Math.min(1, d / (it.w * 1.2)));
      const s = it.el.style;
      const pull = 7 * t * ratio;
      const tilt = 7 * t * ratio;
      s.transform = vertical
        ? `perspective(520px) translate(0px, ${pull.toFixed(1)}px) rotateX(${(-tilt).toFixed(2)}deg) scale(${(1 + 0.22 * t).toFixed(3)})`
        : `perspective(520px) translate(${pull.toFixed(1)}px, ${(-3.2 * t).toFixed(1)}px) rotateY(${tilt.toFixed(2)}deg) scale(${(1 + 0.24 * t).toFixed(3)})`;
      s.boxShadow = t > 0.06 ? `0 ${(6 * t).toFixed(1)}px ${(20 * t).toFixed(1)}px -9px rgb(0 0 0 / 0.55)` : "";
      s.setProperty("--sheen-x", `${(((px - it.cx) / it.w) * 50 + 50).toFixed(1)}%`);
      s.setProperty("--sheen-y", `${(((py - it.cy) / it.h) * 50 + 50).toFixed(1)}%`);
      s.setProperty("--sheen-o", (0.85 * t).toFixed(2));
    }
  };

  const resetMagnet = () => {
    for (const it of magnet.current.rest) {
      const s = it.el.style;
      // Springy settle: a slight overshoot instead of a flat ease-out.
      s.transition = "transform 540ms cubic-bezier(.2,1.5,.3,1), background-color .2s ease, opacity .2s ease";
      s.transform = "";
      s.boxShadow = "";
      s.setProperty("--sheen-o", "0");
    }
  };

  const onDockEnter = (e: React.PointerEvent) => {
    if (document.body.classList.contains("is-dragging")) return;
    // Snapshot rest geometry before any transform is written — a transformed
    // tile's rect would feed the effect back into itself.
    magnet.current.rest = itemsRef.current.map((el) => {
      el.style.transition = "background-color .2s ease, opacity .2s ease";
      const r = el.getBoundingClientRect();
      return { el, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
    });
    magnet.current.px = e.clientX;
    magnet.current.py = e.clientY;
    if (!magnet.current.raf) magnet.current.raf = requestAnimationFrame(paintMagnet);
  };

  const onDockMove = (e: React.PointerEvent) => {
    if (!magnetic) return;
    if (document.body.classList.contains("is-dragging")) {
      if (magnet.current.rest.length) {
        if (magnet.current.raf) cancelAnimationFrame(magnet.current.raf);
        magnet.current.raf = 0;
        resetMagnet();
        magnet.current.rest = [];
      }
      return;
    }
    // Pointer can already be inside at mount (no enter event fired yet).
    if (!magnet.current.rest.length) onDockEnter(e);
    magnet.current.px = e.clientX;
    magnet.current.py = e.clientY;
    if (!magnet.current.raf) magnet.current.raf = requestAnimationFrame(paintMagnet);
  };

  const onDockLeave = () => {
    if (magnet.current.raf) {
      cancelAnimationFrame(magnet.current.raf);
      magnet.current.raf = 0;
    }
    if (magnet.current.rest.length) resetMagnet();
    magnet.current.rest = [];
  };

  const viewMap = useMemo(() => {
    const map = new Map<string, AppView>();
    for (const app of apps) {
      const o = overrides[app.id];
      map.set(app.id, {
        app,
        name: o?.displayName || app.displayName || app.name,
        categories: o?.categories ?? [],
        isFavorite: Boolean(o?.isFavorite),
        inDock: true,
        iconDataUrl: o?.iconDataUrl ?? null,
        broken: !app.targetExists,
        orderOf: () => undefined,
      });
    }
    return map;
  }, [apps, overrides]);

  const views = useMemo(
    () => dock.appIds.map((id) => viewMap.get(id)).filter((v): v is AppView => Boolean(v)),
    [dock.appIds, viewMap],
  );

  // Open windows grouped by process name — the taskbar's source of truth.
  const windowsByExe = useMemo(() => {
    const map = new Map<string, WindowInfo[]>();
    for (const w of windows) {
      const k = exeKey(w.exe);
      if (!k) continue;
      const arr = map.get(k);
      if (arr) arr.push(w);
      else map.set(k, [w]);
    }
    return map;
  }, [windows]);

  // Taskbar section: apps with a window open that are not pinned.
  const taskViews = useMemo(() => {
    const pinned = new Set(views.map((v) => exeKey(v.app.executableName)).filter((k): k is string => Boolean(k)));
    const out: AppView[] = [];
    const seen = new Set<string>();
    for (const w of windows) {
      const k = exeKey(w.exe);
      if (!k || seen.has(k) || pinned.has(k)) continue;
      const app = apps.find((a) => exeKey(a.executableName) === k);
      const v = app ? viewMap.get(app.id) : undefined;
      if (v) {
        seen.add(k);
        out.push(v);
      }
    }
    return out;
  }, [windows, views, apps, viewMap]);

  /** Taskbar click: launch when closed, minimize visible windows, restore minimized. */
  const activateTask = async (view: AppView) => {
    const k = exeKey(view.app.executableName);
    const wins = k ? windowsByExe.get(k) ?? [] : [];
    if (wins.length && useStore.getState().backend !== "online") {
      useStore.getState().toast({ title: "Desktop bridge offline", detail: "Window control needs the companion service.", tone: "warn" });
      return;
    }
    if (!wins.length) {
      void launchApp(view, view.app.id);
      return;
    }
    const vis = wins.filter((w) => !w.minimized);
    try {
      if (vis.length) for (const w of vis) await mantleApi.windowAction("minimize", w.hwnd);
      else await mantleApi.windowAction("restore", wins[0].hwnd);
      useStore.getState().setWindows((await mantleApi.windows()).windows);
    } catch {
      /* best-effort; the next poll refreshes the snapshot */
    }
  };

  const icon = dock.iconSize;
  const pad = Math.round(icon * 0.18);

  // Size estimate: grip (24, with its spacing) + pinned + taskbar items + organizer + favorites.
  const iconCount = views.length + taskViews.length + 2;
  const length =
    34 +
    iconCount * icon +
    (iconCount - 1) * dock.gap +
    pad * 2 +
    12; // organizer divider padding
  const cross = icon + pad * 2;

  // Anchored dock sits bottom-centre by default; -1 means "anchored", not "offset".
  const anchoredPos = {
    x: dock.x < 0 ? Math.round((viewport.w - (vertical ? cross : length)) / 2) : dock.x,
    y: dock.y < 0 ? viewport.h - (vertical ? length : cross) - 26 : dock.y,
  };
  const pos = resolvePosition(anchoredPos, vertical ? cross : length, vertical ? length : cross, viewport);

  const reorder = (from: number, to: number) => {
    const ids = [...dock.appIds];
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    updateDock({ appIds: ids });
  };

  const onIconDragOver = (e: React.DragEvent, index: number) => {
    if (!isAppDrag(e) && dragIndex === null) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = vertical ? e.clientY < rect.top + rect.height / 2 : e.clientX < rect.left + rect.width / 2;
    dropSlot.current = before ? index : index + 1;
  };

  const onIconDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const external = e.dataTransfer.getData(APP_MIME);
    if (external) {
      if (dock.appIds.includes(external)) {
        useStore.getState().toast({ title: "Already in the dock", tone: "info" });
      } else {
        updateDock({ appIds: [...dock.appIds, external] });
      }
      return;
    }
    if (dragIndex !== null && dropSlot.current !== null) {
      let to = dropSlot.current;
      if (to > dragIndex) to -= 1;
      reorder(dragIndex, to);
    }
    setDragIndex(null);
    dropSlot.current = null;
  };

  const containerStyle: React.CSSProperties = {
    left: pos.x,
    top: pos.y,
    padding: pad,
    gap: dock.gap,
    flexDirection: vertical ? "column" : "row",
    touchAction: "none",
  };

  return (
    <div
      ref={ref}
      data-floating-root="dock"
      className={`fixed z-30 flex items-center ${GLASS_CLASS} transition-colors duration-300`}
      style={{
        ...containerStyle,
        borderRadius: Math.min(28, icon * 0.62),
        cursor: dock.locked ? "default" : "default",
        outline: dragOver ? "1px solid rgba(217,199,163,0.5)" : "none",
      }}
      onDragOver={(e) => {
        if (!isAppDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragOver(true);
        dropSlot.current = dock.appIds.length;
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onIconDrop}
      onPointerEnter={magnetic ? onDockEnter : undefined}
      onPointerMove={onDockMove}
      onPointerLeave={magnetic ? onDockLeave : undefined}
      onDoubleClick={() => {
        if (dock.locked) {
          useStore.getState().updateDock({ locked: false });
          useStore.getState().toast({ title: "Dock unlocked", detail: "Drag it anywhere; double-click to lock it again.", tone: "info" });
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        useStore.getState().updateDock({ locked: !dock.locked });
        useStore.getState().toast({ title: dock.locked ? "Dock unlocked" : "Dock locked", tone: "info" });
      }}
      title={dock.locked ? "Dock locked — right-click to unlock" : "Drag to move · right-click to lock"}
    >
      <DragGrip locked={dock.locked} className="size-6 shrink-0 text-mist-500" />

      {views.map((view, index) => {
        const k = exeKey(view.app.executableName);
        const wins = k ? windowsByExe.get(k) ?? [] : [];
        const runningNow = wins.length > 0 || isRunning(view, running);
        const allMin = wins.length > 0 && wins.every((w) => w.minimized);
        return (
          <button
            key={view.app.id}
            draggable
            data-dock-item
            onDragStart={(e) => {
              e.dataTransfer.setData(APP_MIME, view.app.id);
              e.dataTransfer.effectAllowed = "copyMove";
              setDragIndex(index);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOver(false);
            }}
            onDragOver={(e) => onIconDragOver(e, index)}
            onDrop={onIconDrop}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void activateTask(view)}
            onContextMenu={(e) => {
              e.preventDefault();
              useStore.getState().toggleDock(view.app.id);
              useStore.getState().toast({ title: `${view.name} removed from dock`, tone: "info" });
            }}
            title={wins.length ? `${view.name} — ${wins.every((w) => w.minimized) ? "restore" : "minimize"} · right-click to unpin` : view.name}
            className={`dock-item group relative grid shrink-0 place-items-center rounded-2xl transition-[background-color,opacity] duration-200 hover:bg-white/[0.07] ${magnetic ? "" : "dock-item-lift"}`}
            style={{ width: icon, height: icon, opacity: dragIndex === index ? 0.45 : 1 }}
          >
            <AppIcon view={view} size={Math.round(icon * 0.55)} />
            {dock.labels && (
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 max-w-[96px] -translate-x-1/2 truncate rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-mist-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {view.name}
              </span>
            )}
            {runningNow && (
              <span
                className={`absolute rounded-full bg-champagne-400 ${
                  vertical ? "-left-[3px] top-1/2 size-[3px] -translate-y-1/2" : "-bottom-[3px] left-1/2 size-[3px] -translate-x-1/2"
                }`}
                style={{ boxShadow: "0 0 6px rgba(217,199,163,0.9)", opacity: allMin ? 0.35 : 1 }}
              />
            )}
          </button>
        );
      })}

      {taskViews.length > 0 && views.length > 0 && (
        <div className={`${vertical ? "h-px w-5" : "h-5 w-px"} shrink-0 bg-white/10`} />
      )}

      {taskViews.map((view) => {
        const k = exeKey(view.app.executableName);
        const wins = k ? windowsByExe.get(k) ?? [] : [];
        const allMin = wins.length > 0 && wins.every((w) => w.minimized);
        return (
          <button
            key={`task-${view.app.id}`}
            data-dock-item
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void activateTask(view)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!useStore.getState().persist.dock.appIds.includes(view.app.id)) {
                useStore.getState().toggleDock(view.app.id);
                useStore.getState().toast({ title: `${view.name} pinned to dock`, tone: "success" });
              }
            }}
            title={wins.length ? `${wins.slice(0, 3).map((w) => w.title).join(" · ")} — ${allMin ? "restore" : "minimize"} · right-click to pin` : view.name}
            className={`dock-item group relative grid shrink-0 place-items-center rounded-2xl transition-[background-color,opacity] duration-200 hover:bg-white/[0.07] ${magnetic ? "" : "dock-item-lift"}`}
            style={{ width: icon, height: icon, opacity: allMin ? 0.55 : 1 }}
          >
            <AppIcon view={view} size={Math.round(icon * 0.55)} />
            {dock.labels && (
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 max-w-[96px] -translate-x-1/2 truncate rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-mist-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {view.name}
              </span>
            )}
            <span
              className={`absolute rounded-full bg-champagne-400 ${
                vertical ? "-left-[3px] top-1/2 size-[3px] -translate-y-1/2" : "-bottom-[3px] left-1/2 size-[3px] -translate-x-1/2"
              }`}
              style={{ boxShadow: "0 0 6px rgba(217,199,163,0.9)", opacity: allMin ? 0.35 : 1 }}
            />
          </button>
        );
      })}

      {views.length === 0 && (
        <div
          className="grid shrink-0 place-items-center rounded-xl border border-dashed border-white/10 text-mist-600"
          style={{ width: icon, height: icon, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}
          title="Drag apps here, or pin from the organizer"
        >
          drop
        </div>
      )}

      <div className={`${vertical ? "h-px w-5" : "h-5 w-px"} shrink-0 bg-white/10`} />

      <button
        onClick={onOrganizer}
        onPointerDown={(e) => e.stopPropagation()}
        title="Organizer — settings"
        className="grid shrink-0 place-items-center rounded-xl text-mist-400 transition-colors hover:bg-white/[0.07] hover:text-mist-100"
        style={{ width: icon, height: icon }}
      >
        <LayoutGrid size={Math.round(icon * 0.4)} strokeWidth={1.7} />
      </button>
      <button
        onClick={onFavorites}
        onPointerDown={(e) => e.stopPropagation()}
        title="Favorites"
        className="grid shrink-0 place-items-center rounded-xl text-mist-400 transition-colors hover:bg-white/[0.07] hover:text-mist-100"
        style={{ width: icon, height: icon }}
      >
        <Star size={Math.round(icon * 0.4)} strokeWidth={1.7} />
      </button>
    </div>
  );
}

